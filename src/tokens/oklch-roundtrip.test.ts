// @vitest-environment node

/**
 * OKLCH round-trip proof + tokens.css drift guard (Sprint 43 / #271).
 *
 * The DS authors colors as sRGB hex in `colors.ts` (the JS source of truth —
 * `resolveColorPath` returns hex, see color-path.test.ts) and ships the same
 * ramps as `oklch()` in `tokens.css`, translated at emit time by
 * `scripts/emit-tokens.mjs`. hex -> OKLCH is a lossless coordinate transform,
 * so the Ocean theme must render *identically* — only the derived state tints
 * change.
 *
 * This file makes "perceptually unchanged" a machine-checked claim:
 *
 *   1. ROUND-TRIP: every `oklch(L C H)` literal emitted into tokens.css converts
 *      back to sRGB within <= 1/255 per channel of... what? We re-derive the
 *      expected hex from colors.ts (brand/semantic/neutral) + the emitter's
 *      identity palettes, so the assertion is end-to-end: colors.ts hex ->
 *      oklch() string in tokens.css -> sRGB == original hex. A regression in
 *      the emitter's math, the precision, or a hand-edit of tokens.css all fail
 *      here.
 *
 *   2. GAMUT: every emitted ramp rung is in-gamut for sRGB (no silent clipping).
 *
 *   3. DRIFT GUARD: `scripts/emit-tokens.mjs --check` exits 0, i.e. the committed
 *      tokens.css equals a fresh emit (mirrors the COMPONENTS.md doc-sync pattern
 *      so the generated file cannot drift from its source).
 *
 *   4. NO RAW HEX RAMPS: the generated block carries no `#rrggbb` ramp literals
 *      (acceptance criterion — ramps are oklch(); var() aliases are fine).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { hexToOklch, formatOklch, oklchToSrgb, hexToRgb } from '../../scripts/lib/oklch.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const TOKENS_CSS = resolve(REPO_ROOT, 'src/styles/tokens.css')
const EMIT_SCRIPT = resolve(REPO_ROOT, 'scripts/emit-tokens.mjs')

/**
 * The authoritative source ramps. Brand/semantic/neutral hexes are read from
 * colors.ts at runtime (so this test fails if colors.ts ramp values change
 * without the emitter being re-run); identity palettes are CSS-only and mirror
 * the emitter's own table.
 */
const colorsSrc = readFileSync(resolve(REPO_ROOT, 'src/tokens/colors.ts'), 'utf8')

function parseRamp(objectName: string, source: string): Array<[string, string]> {
  const re = new RegExp(`${objectName}\\s*:\\s*\\{([\\s\\S]*?)\\}`, 'm')
  const m = source.match(re)
  if (!m) throw new Error(`Could not find ramp "${objectName}" in colors.ts`)
  const entries: Array<[string, string]> = []
  const entryRe = /([A-Za-z0-9_]+)\s*:\s*'(#[0-9A-Fa-f]{3,6})'/g
  let e: RegExpExecArray | null
  while ((e = entryRe.exec(m[1]!)) !== null) entries.push([e[1]!, e[2]!]) // safe: m matched (throw above); entryRe has 2 capture groups
  return entries
}

const semanticBlock = colorsSrc.match(/semantic\s*:\s*\{([\s\S]*?)\n {2}\},/m)?.[1] ?? colorsSrc

const sourceRamps: Record<string, Array<[string, string]>> = {
  ocean: parseRamp('ocean', colorsSrc),
  teal: parseRamp('teal', colorsSrc),
  neutral: parseRamp('neutral', colorsSrc),
  success: parseRamp('success', semanticBlock),
  warning: parseRamp('warning', semanticBlock),
  error: parseRamp('error', semanticBlock),
  info: parseRamp('info', semanticBlock),
  // Identity palettes (CSS-only) + the neutral-550 extra rung.
  orange: [
    ['lightest', '#FFEDD5'],
    ['light', '#FDBA74'],
    ['base', '#F97316'],
    ['dark', '#C2410C'],
    ['darkest', '#7C2D12'],
  ],
  blue: [
    ['lightest', '#DBEAFE'],
    ['light', '#93C5FD'],
    ['base', '#3B82F6'],
    ['dark', '#1D4ED8'],
    ['darkest', '#1E3A8A'],
  ],
  purple: [
    ['lightest', '#EDE9FE'],
    ['light', '#C4B5FD'],
    ['base', '#8B5CF6'],
    ['dark', '#6D28D9'],
    ['darkest', '#4C1D95'],
  ],
  green: [
    ['lightest', '#D1FAE5'],
    ['light', '#6EE7B7'],
    ['base', '#10B981'],
    ['dark', '#047857'],
    ['darkest', '#064E3B'],
  ],
  rose: [
    ['lightest', '#FFE4E6'],
    ['light', '#FDA4AF'],
    ['base', '#F43F5E'],
    ['dark', '#BE123C'],
    ['darkest', '#881337'],
  ],
}
// CSS-only neutral-550 (#12 — WCAG AA text tier) inserted after neutral-500.
// `neutral` is a literal key of sourceRamps, but the Record<string,…> type widens
// the access to `| undefined`; guard (never fires in practice) to keep it honest.
const neutralRamp = sourceRamps.neutral
if (!neutralRamp) throw new Error('sourceRamps.neutral missing — neutral ramp failed to parse from colors.ts')
neutralRamp.splice(
  neutralRamp.findIndex(([k]) => k === '500') + 1,
  0,
  ['550', '#5C6F78'],
)

const tokensCss = readFileSync(TOKENS_CSS, 'utf8')

/** Extract the generated block between the markers. */
function generatedBlock(): string {
  const start = tokensCss.indexOf('GENERATED:COLOR-RAMPS:START')
  const end = tokensCss.indexOf('GENERATED:COLOR-RAMPS:END')
  expect(start, 'GENERATED:COLOR-RAMPS:START marker present in tokens.css').toBeGreaterThan(-1)
  expect(end, 'GENERATED:COLOR-RAMPS:END marker present in tokens.css').toBeGreaterThan(start)
  return tokensCss.slice(start, end)
}

/** Parse a single `oklch(L C H)` declaration value for a token from the block. */
function readOklch(block: string, tokenName: string): { L: number; C: number; H: number } | null {
  const re = new RegExp(
    `--${tokenName}:\\s*oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\)`,
  )
  const m = block.match(re)
  if (!m) return null
  // safe: m matched → its three capture groups are present.
  return { L: parseFloat(m[1]!), C: parseFloat(m[2]!), H: parseFloat(m[3]!) }
}

describe('OKLCH ramp round-trip (perceptual-equivalence proof, #271)', () => {
  const block = generatedBlock()

  // Build the flat list of [tokenName, sourceHex] the emitter is expected to emit.
  const cases: Array<[string, string]> = []
  for (const [ramp, entries] of Object.entries(sourceRamps)) {
    for (const [key, hex] of entries) cases.push([`color-${ramp}-${key}`, hex])
  }

  it('emits an oklch() value for every source ramp rung', () => {
    const missing = cases.filter(([token]) => readOklch(block, token) === null)
    expect(
      missing.map(([t]) => t),
      'these ramp tokens are absent (or not oklch()) in the generated block',
    ).toEqual([])
  })

  it('every emitted oklch() round-trips to its source hex within <= 1/255 per channel', () => {
    let maxDelta = 0
    let worst = ''
    const failures: string[] = []

    for (const [token, hex] of cases) {
      const parsed = readOklch(block, token)
      if (!parsed) continue
      const back = oklchToSrgb(parsed.L, parsed.C, parsed.H)
      const src = hexToRgb(hex)
      const dr = Math.abs(Math.round(back.r) - src.r)
      const dg = Math.abs(Math.round(back.g) - src.g)
      const db = Math.abs(Math.round(back.b) - src.b)
      const d = Math.max(dr, dg, db)
      if (d > maxDelta) {
        maxDelta = d
        worst = `${token} (${hex}) -> oklch(${parsed.L} ${parsed.C} ${parsed.H}) -> rgb(${Math.round(back.r)} ${Math.round(back.g)} ${Math.round(back.b)})`
      }
      if (d > 1) failures.push(`${token}: ${hex} drifted by ${d}/255`)
    }

    // Surface the headline number even on success (visible in -v / on failure).
    expect(
      failures,
      `max channel delta observed: ${maxDelta}/255 at ${worst}\n` + failures.join('\n'),
    ).toEqual([])
    // The transform is near-lossless; we expect sub-1 deltas across the board.
    expect(maxDelta).toBeLessThanOrEqual(1)
  })

  it('every emitted ramp rung is in sRGB gamut (no silent clipping)', () => {
    const clipped: string[] = []
    for (const [token] of cases) {
      const parsed = readOklch(block, token)
      if (!parsed) continue
      const back = oklchToSrgb(parsed.L, parsed.C, parsed.H)
      if (!back.inGamut) clipped.push(token)
    }
    expect(clipped, 'these ramp rungs fall outside sRGB gamut').toEqual([])
  })

  it('the generated block contains no raw #hex ramp literals (oklch only; var() aliases ok)', () => {
    // Inspect DECLARATION VALUES only — comments in the block legitimately mention
    // issue refs (#271) and example hexes (#FFFFFF). RGB-channel mirrors
    // (`--color-ocean-*-rgb: 43 163 212;`) are space-separated integers, not hex.
    // Strip /* ... */ comments, then assert no `#rrggbb`/`#rgb` survives in the CSS.
    const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, '')
    const hexLiterals = withoutComments.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []
    expect(hexLiterals, 'unexpected hex color literals in the generated ramp block').toEqual([])
  })

  it('formatOklch(hexToOklch(hex)) for a known rung matches the committed token', () => {
    // Belt-and-suspenders: the in-repo math reproduces exactly what is committed,
    // so a precision change in formatOklch is caught even if round-trip tolerance
    // would still pass.
    const oceanBase = sourceRamps.ocean!.find(([k]) => k === 'base')![1] // safe: 'ocean' is a literal key of sourceRamps
    const expected = formatOklch(hexToOklch(oceanBase))
    expect(block).toContain(`--color-ocean-base: ${expected};`)
  })
})

describe('tokens.css drift guard (#271)', () => {
  it('committed tokens.css equals a fresh emit (emit-tokens.mjs --check)', () => {
    // Throws (non-zero exit) if the generated block has drifted from the source.
    expect(() => {
      execFileSync('node', [EMIT_SCRIPT, '--check'], {
        cwd: REPO_ROOT,
        stdio: 'pipe',
      })
    }).not.toThrow()
  })
})
