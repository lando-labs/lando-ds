#!/usr/bin/env node
/**
 * emit-tokens.mjs
 *
 * Generates the COLOR-RAMP section of `src/styles/tokens.css` from the hex
 * authored source of truth (`src/tokens/colors.ts`), translating every ramp
 * rung to `oklch()` at emit time. Ends the long-standing dual-maintenance where
 * `colors.ts` and `tokens.css` carried two hand-edited copies of the same hexes
 * (the file header claimed "Generated from TypeScript" but no emitter existed).
 *
 * WHAT IS GENERATED (between the GENERATED:COLOR-RAMPS markers in tokens.css):
 *   - ocean / teal / neutral / success / warning / error / info ramps
 *     (sourced from colors.ts) as oklch()
 *   - the ocean RGB-channel mirror tokens (`--color-ocean-*-rgb`) for
 *     `rgb(var(--token) / α)` composition (derived from the same hexes)
 *   - the identity palettes (orange/blue/purple/green/rose) as oklch() —
 *     these only ever lived in CSS, so the emitter holds their hex here
 *   - the color-mix() state-tint DERIVATION layer (primary/secondary/error
 *     hover/active/disabled), derived from the base token at runtime
 *
 * WHAT IS NOT TOUCHED: everything outside the markers — the semantic/contextual
 * aliases, typography, spacing, radius, shadows, animation, z-index, dark-mode
 * block, charts, reduced-motion, high-contrast. Those are not colors-from-ramps
 * and were never duplicated in colors.ts.
 *
 * hex -> OKLCH is a lossless coordinate transform: the emitted ramps round-trip
 * back to the source sRGB within < 1/255 per channel (proven by
 * src/tokens/oklch-roundtrip.test.ts). So the Ocean theme renders identically;
 * only the *derived* state tints change (intended — they were hand-mapped to
 * adjacent rungs before; now they are computed so a preset that overrides only
 * the base token re-skins hover/active automatically).
 *
 * Usage:
 *   node scripts/emit-tokens.mjs           # write tokens.css in place
 *   node scripts/emit-tokens.mjs --check   # exit 1 if tokens.css would change
 *                                           # (drift guard — used by the test)
 *
 * Exit 0: tokens.css written / already up to date.
 * Exit 1: parse failure, missing markers, OR (with --check) drift detected.
 *
 * No external deps — pure node + scripts/lib/oklch.mjs.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  hexToOklch,
  formatOklch,
  hexToRgb,
  oklabFromHex,
  mixOklab,
  oklabDeltaE,
  WHITE_OKLAB,
  BLACK_OKLAB,
} from './lib/oklch.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const colorsPath = join(repoRoot, 'src', 'tokens', 'colors.ts')
const tokensPath = join(repoRoot, 'src', 'styles', 'tokens.css')

const START = '/* GENERATED:COLOR-RAMPS:START — emitted by scripts/emit-tokens.mjs. Do not edit by hand. */'
const END = '/* GENERATED:COLOR-RAMPS:END */'

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')

/* ------------------------------------------------------------------ */
/* 1. Parse the hex ramps out of colors.ts (regex — no TS runtime).    */
/* ------------------------------------------------------------------ */

if (!existsSync(colorsPath)) {
  console.error(`[emit-tokens] Cannot find ${colorsPath}`)
  process.exit(1)
}
const colorsSrc = readFileSync(colorsPath, 'utf8')

/**
 * Extract a single-level `name: { key: '#hex', ... }` block from colors.ts.
 * Returns an ordered array of [key, hex]. Throws if the block is missing.
 */
function parseRamp(objectName, blockSource) {
  // Find `name: {` then capture to the matching close brace (non-nested blocks).
  const re = new RegExp(`${objectName}\\s*:\\s*\\{([\\s\\S]*?)\\}`, 'm')
  const m = blockSource.match(re)
  if (!m) throw new Error(`[emit-tokens] Could not find ramp "${objectName}" in colors.ts`)
  const body = m[1]
  const entries = []
  const entryRe = /([A-Za-z0-9_]+)\s*:\s*'(#[0-9A-Fa-f]{3,6})'/g
  let e
  while ((e = entryRe.exec(body)) !== null) {
    entries.push([e[1], e[2]])
  }
  if (entries.length === 0) throw new Error(`[emit-tokens] Ramp "${objectName}" parsed to 0 entries`)
  return entries
}

// Isolate the `semantic: { ... }` sub-tree so nested success/warning/error/info
// don't collide with any top-level same-named key.
const semanticBlockMatch = colorsSrc.match(/semantic\s*:\s*\{([\s\S]*?)\n {2}\},/m)
const semanticBlock = semanticBlockMatch ? semanticBlockMatch[1] : colorsSrc

const ocean = parseRamp('ocean', colorsSrc)
const teal = parseRamp('teal', colorsSrc)
const neutral = parseRamp('neutral', colorsSrc)
const success = parseRamp('success', semanticBlock)
const warning = parseRamp('warning', semanticBlock)
const error = parseRamp('error', semanticBlock)
const info = parseRamp('info', semanticBlock)

// Guard: the coral test ramp must be gone from colors.ts (Sprint 43 decision 1).
if (/\bcoral\s*:/.test(colorsSrc)) {
  console.error(
    '[emit-tokens] colors.ts still defines a `coral` ramp. Sprint 43 removed coral; ' +
      'remove it from colors.ts before emitting.',
  )
  process.exit(1)
}

/* ------------------------------------------------------------------ */
/* 2. Identity palettes (#87) — CSS-only, no colors.ts home.           */
/*    Held here as the emitter's source of truth; emitted as oklch().  */
/* ------------------------------------------------------------------ */

const identity = {
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

// neutral-550 (#12 — WCAG AA text tier) is a CSS-only extra rung inserted between
// neutral-500 and neutral-600. colors.ts has no 550; carry it here so the emitted
// neutral ramp keeps it (and its inline rationale comment).
const NEUTRAL_550 = ['550', '#5C6F78']

/* ------------------------------------------------------------------ */
/* 3. Render helpers.                                                  */
/* ------------------------------------------------------------------ */

const oklch = (hex) => formatOklch(hexToOklch(hex))

/** Render a ramp as `--color-<prefix>-<key>: oklch(...);` lines. */
function rampLines(prefix, entries, indent = '  ') {
  return entries.map(([key, hex]) => `${indent}--color-${prefix}-${key}: ${oklch(hex)};`)
}

/** Render the RGB-channel mirror for a ramp: `--color-<prefix>-<key>-rgb: r g b;`. */
function rgbMirrorLines(prefix, entries, indent = '  ') {
  return entries.map(([key, hex]) => {
    const { r, g, b } = hexToRgb(hex)
    return `${indent}--color-${prefix}-${key}-rgb: ${r} ${g} ${b};`
  })
}

/* ------------------------------------------------------------------ */
/* 3b. Brand-ramp derivation (#285).                                   */
/*                                                                     */
/* Each --color-{primary,secondary}-<shade> is emitted as a 2-color    */
/* color-mix() of the BASE token (--color-primary / --color-secondary) */
/* toward white (lighter rungs) or black (darker rungs). The mix % is  */
/* TUNED PER RUNG at emit time: we resolve the current ocean/teal      */
/* target hex, convert it to OKLab, and pick the white/black weight    */
/* that lands closest (min OKLab ΔE). This is what makes overriding    */
/* ONLY --color-primary re-skin the entire ramp while holding the      */
/* Ocean default within the round-trip tolerance the repo enforces.    */
/*                                                                     */
/* Constraint (same as the state layer): oklab interpolation + 2-color */
/* color-mix() only. No relative-color / oklch(from …).                */
/* ------------------------------------------------------------------ */

const MIX_STEP = 0.5 // percent granularity of emitted mix weights (readable + precise)

/**
 * For a base hex and a target hex, find the `color-mix(in oklab, base, white|black p%)`
 * that minimizes OKLab ΔE to the target. Returns { dir, p, deltaE, targetHex }.
 */
function bestMixToTarget(baseHex, targetHex) {
  const baseO = oklabFromHex(baseHex)
  const targetO = oklabFromHex(targetHex)
  let best = null
  for (const [dir, endpoint] of [
    ['white', WHITE_OKLAB],
    ['black', BLACK_OKLAB],
  ]) {
    for (let p = 0; p <= 100 + 1e-9; p += MIX_STEP) {
      const deltaE = oklabDeltaE(mixOklab(baseO, endpoint, p), targetO)
      if (best === null || deltaE < best.deltaE) {
        best = { dir, p: Math.round(p / MIX_STEP) * MIX_STEP, deltaE, targetHex }
      }
    }
  }
  return best
}

/** Format a mix percentage without trailing `.0` (e.g. 52.5 stays, 90 not 90.0). */
function fmtPct(p) {
  return Number.isInteger(p) ? String(p) : String(p)
}

/**
 * Emit a brand ramp (primary/secondary) as per-rung-tuned color-mix() of the
 * base token. `entries` is the ordered [shade, targetHex] list (ocean for
 * primary, teal for secondary); `baseKey` is the shade that equals the base
 * token (emitted as an identity `var(--color-<name>)`). Returns { lines, stats }
 * where stats is an array of { shade, dir, p, deltaE } for the manifest report.
 */
function brandRampLines(name, entries, baseKey, indent = '  ') {
  const baseHex = entries.find(([k]) => k === baseKey)?.[1]
  if (!baseHex) throw new Error(`[emit-tokens] base key "${baseKey}" not found in ${name} ramp`)
  const lines = []
  const stats = []
  for (const [shade, targetHex] of entries) {
    if (shade === baseKey) {
      lines.push(`${indent}--color-${name}-${shade}: var(--color-${name}); /* base rung (identity) */`)
      stats.push({ shade, dir: 'base', p: 0, deltaE: 0 })
      continue
    }
    const { dir, p, deltaE } = bestMixToTarget(baseHex, targetHex)
    lines.push(
      `${indent}--color-${name}-${shade}: color-mix(in oklab, var(--color-${name}), ${dir} ${fmtPct(p)}%); /* ~${targetHex} ΔE${deltaE.toFixed(4)} */`,
    )
    stats.push({ shade, dir, p, deltaE })
  }
  return { lines, stats }
}

/* ------------------------------------------------------------------ */
/* 4. Build the generated block.                                       */
/* ------------------------------------------------------------------ */

const L = []
L.push(`  ${START}`)
L.push('  /*')
L.push('   * Color ramps in OKLCH (Sprint 43 / #271). Authored as sRGB hex in')
L.push('   * src/tokens/colors.ts; translated to oklch() here at emit time. Each rung')
L.push('   * round-trips back to its source hex within < 1/255 per channel')
L.push('   * (src/tokens/oklch-roundtrip.test.ts), so the Ocean theme is perceptually')
L.push('   * unchanged. Regenerate with `node scripts/emit-tokens.mjs`.')
L.push('   */')
L.push('')

// Ocean
L.push('  /* Ocean Blues - Primary Brand */')
L.push(...rampLines('ocean', ocean))
L.push('')
L.push('  /*')
L.push('   * RGB channel tokens for modern `rgb(var(--token) / α)` alpha composition.')
L.push('   * Prefer these over hardcoded rgba() literals in component stylesheets.')
L.push('   * See reference/design-tokens-implementation.md.')
L.push('   */')
L.push(...rgbMirrorLines('ocean', ocean))
L.push('')

// Teal
L.push('  /* Teals & Aqua - Success */')
L.push(...rampLines('teal', teal))
L.push('')

// Identity palettes
L.push('  /* ---------------------------------------------------------------------------')
L.push('   * Identity Palettes (#87, Sprint 16) — non-semantic source/identity colors.')
L.push('   * Back the Badge `colorScheme` prop (orthogonal to `variant`) so consumers can')
L.push('   * paint identities (a "RSS" source is always orange regardless of state)')
L.push('   * without abusing the semantic state palettes. Contrast verified WCAG AA on')
L.push('   * Badge text (lightest×darkest ≈ 8–10:1 light; light×darkest ≈ 5.5–7:1 dark).')
L.push('   * CSS-only ramps (no colors.ts home) — source of truth is scripts/emit-tokens.mjs.')
L.push('   * ------------------------------------------------------------------------- */')
L.push('')
L.push('  /* Orange — RSS / warm-source identity */')
L.push(...rampLines('orange', identity.orange))
L.push('')
L.push('  /* Blue — true blue, distinct from ocean (which trends teal) */')
L.push(...rampLines('blue', identity.blue))
L.push('')
L.push('  /* Purple — research / academic identity */')
L.push(...rampLines('purple', identity.purple))
L.push('')
L.push('  /* Green — emerald, distinct from teal/success */')
L.push(...rampLines('green', identity.green))
L.push('')
L.push('  /* Rose — pink/rose identity */')
L.push(...rampLines('rose', identity.rose))
L.push('')

// Neutral (insert 550 after 500)
L.push('  /* Neutrals - Cool-tinted grays */')
for (const [key, hex] of neutral) {
  L.push(`  --color-neutral-${key}: ${oklch(hex)};`)
  if (key === '500') {
    L.push(
      `  --color-neutral-${NEUTRAL_550[0]}: ${oklch(NEUTRAL_550[1])}; /* #12 — WCAG AA text tier (4.58:1 on #FFFFFF) */`,
    )
  }
}
L.push('')

// Semantic ramps
L.push('  /* Semantic Colors */')
L.push(...rampLines('success', success))
L.push('')
L.push(...rampLines('warning', warning))
L.push('')
L.push(...rampLines('error', error))
L.push('')
L.push(...rampLines('info', info))
L.push('')

// Derivation layer
L.push('  /* ---------------------------------------------------------------------------')
L.push('   * STATE-TINT DERIVATION LAYER (Sprint 43 / #271)')
L.push('   *')
L.push('   * Interactive state tints are DERIVED from the base token via 2-color')
L.push('   * color-mix() (Baseline May 2023), instead of being hand-mapped to adjacent')
L.push('   * ramp rungs. This is what lets a theme preset that overrides ONLY the base')
L.push('   * token (--color-primary / --color-secondary / --color-error) re-skin its')
L.push('   * hover/active/disabled states automatically — previously impossible because')
L.push('   * --color-primary-hover pointed at a fixed --color-ocean-base.')
L.push('   *')
L.push("   * Mix percentages were tuned so the Ocean defaults land perceptually next to")
L.push('   * the prior hand-picked rungs (primary-active ≈ ocean-dark ΔE≈0.0004;')
L.push('   * error-active ≈ error-darkest ΔE≈0.005; error-hover ≈ error-dark ΔE≈0.026).')
L.push('   * primary-hover lightens toward ocean-base in L and H; it is slightly less')
L.push('   * chromatic than the old rung because color-mix with white cannot ADD chroma')
L.push('   * (the old ocean-base rung was hand-saturated). This is the one intended,')
L.push('   * visible-on-close-inspection change. disabled mixes toward --color-surface so')
L.push('   * it tracks light/dark mode automatically.')
L.push('   *')
L.push("   * Constraint: oklab interpolation + 2-color color-mix only. No relative-color")
L.push("   * syntax / oklch(from …) — not Baseline-safe yet.")
L.push('   * ------------------------------------------------------------------------- */')
L.push('')
L.push('  /*')
L.push('   * Bare semantic BASE token for the secondary family. Mirrors the bare')
L.push('   * --color-primary (declared in the contextual colors block) so the')
L.push('   * secondary derivation below has a single base to mix from. Without it,')
L.push('   * color-mix(... var(--color-secondary) ...) had no value to resolve.')
L.push('   *')
L.push('   * v0.36.0 OSS-prep (#421): default points at a neutral cool gray so the')
L.push('   * library ships brand-neutral. The opt-in `lando` theme preset overrides')
L.push('   * this back to teal-base for the historical Lando ocean+teal look.')
L.push('   * Consumers re-skin the secondary state derivation by overriding this one')
L.push('   * token at :root (or via ThemeProvider).')
L.push('   */')
L.push('  --color-secondary: oklch(0.62 0.018 250);')
L.push('')

// Brand SHADE RAMPS (#285) — derived from the base token, not static aliases.
const primaryRamp = brandRampLines('primary', ocean, 'medium')
const secondaryRamp = brandRampLines('secondary', teal, 'base')
L.push('  /*')
L.push('   * BRAND SHADE RAMPS (Sprint 44 / #285)')
L.push('   *')
L.push('   * --color-{primary,secondary}-<shade> are DERIVED from the base token via')
L.push('   * per-rung-tuned 2-color color-mix(), replacing the old static aliases to')
L.push('   * --color-ocean-* / --color-teal-*. This is the keystone that makes')
L.push('   * overriding ONLY --color-primary (raw CSS or setProductTheme) re-skin the')
L.push('   * whole ramp — and therefore every surface routed through it (Avatar')
L.push('   * gradients, DetailCard, Header, Sidebar, CodeBlock, the chart default,')
L.push('   * --shadow-primary). Mix % per rung was chosen at emit time to minimize')
L.push('   * OKLab ΔE to the prior ocean/teal value, so the Ocean default holds.')
L.push('   *')
L.push('   * Known chroma cost (color-mix-with-white cannot ADD chroma, so the')
L.push('   * hand-saturated mid-light rungs land slightly less chromatic — the same')
L.push('   * intended shift #271 documented for the state layer):')
L.push('   *   primary-light  ΔE≈0.041, primary-base ΔE≈0.043 (the worst rungs);')
L.push('   *   secondary-light ΔE≈0.024. All other rungs ΔE < 0.02 (≈imperceptible).')
L.push('   */')
L.push(...primaryRamp.lines)
L.push('')
L.push(...secondaryRamp.lines)
L.push('')
L.push('  /*')
L.push('   * `-rgb` mirror EXCEPTION (#285): color-mix() cannot emit space-separated')
L.push('   * channels, and relative-color syntax (rgb(from …)) is not Baseline-safe, so')
L.push('   * the derived brand ramps have no `-rgb` form. The `--color-primary-*-rgb`')
L.push('   * mirrors stay pinned to ocean (hand-authored in the contextual-aliases')
L.push('   * block), so the ~36 `rgb(var(--…-rgb) / α)` alpha-composition sites keep')
L.push('   * working but do NOT re-skin — a documented exception. Follow-up: migrate')
L.push('   * those sites to `color-mix(in srgb, var(--color-primary-<shade>) <α>%,')
L.push('   * transparent)` so the alpha tints also track the base.')
L.push('   */')
L.push('')
L.push('  --color-primary-hover: color-mix(in oklab, var(--color-primary), white 22%);')
L.push('  --color-primary-active: color-mix(in oklab, var(--color-primary), black 18%);')
L.push('  --color-primary-disabled: color-mix(in oklab, var(--color-primary), var(--color-surface) 60%);')
L.push('')
L.push('  --color-secondary-hover: color-mix(in oklab, var(--color-secondary), white 18%);')
L.push('  --color-secondary-active: color-mix(in oklab, var(--color-secondary), black 18%);')
L.push('  --color-secondary-disabled: color-mix(in oklab, var(--color-secondary), var(--color-surface) 60%);')
L.push('')
L.push('  --color-error-hover: color-mix(in oklab, var(--color-error), black 7.5%);')
L.push('  --color-error-active: color-mix(in oklab, var(--color-error), black 38%);')
L.push('  --color-error-disabled: color-mix(in oklab, var(--color-error), var(--color-surface) 60%);')
L.push('  /* danger is an alias of error — mirror the derived state tints. */')
L.push('  --color-danger-hover: var(--color-error-hover);')
L.push('  --color-danger-active: var(--color-error-active);')
L.push('  --color-danger-disabled: var(--color-error-disabled);')
L.push('')
L.push(`  ${END}`)

const generated = L.join('\n')

/* ------------------------------------------------------------------ */
/* 4b. Optional: print the brand-ramp ΔE table (--report-ramps).       */
/*     The Ocean-held proof, re-derivable on demand.                   */
/* ------------------------------------------------------------------ */

if (args.has('--report-ramps')) {
  const rows = [
    ['primary', primaryRamp.stats],
    ['secondary', secondaryRamp.stats],
  ]
  let maxDE = 0
  let worst = ''
  console.log('BRAND-RAMP DERIVATION — per-rung mix % + OKLab ΔE vs prior ocean/teal value\n')
  for (const [name, stats] of rows) {
    console.log(`--color-${name}-*`)
    for (const s of stats) {
      const mix = s.dir === 'base' ? 'identity (= base)' : `${s.dir} ${fmtPct(s.p)}%`
      console.log(`  ${s.shade.padEnd(9)} ${mix.padEnd(20)} ΔE ${s.deltaE.toFixed(4)}`)
      if (s.deltaE > maxDE) {
        maxDE = s.deltaE
        worst = `${name}-${s.shade}`
      }
    }
  }
  console.log(`\nmax ΔE = ${maxDE.toFixed(4)} at ${worst}`)
}

/* ------------------------------------------------------------------ */
/* 5. Splice into tokens.css between the markers.                       */
/* ------------------------------------------------------------------ */

if (!existsSync(tokensPath)) {
  console.error(`[emit-tokens] Cannot find ${tokensPath}`)
  process.exit(1)
}
const current = readFileSync(tokensPath, 'utf8')

const startIdx = current.indexOf(START)
const endIdx = current.indexOf(END)
if (startIdx === -1 || endIdx === -1) {
  console.error(
    `[emit-tokens] Could not find the GENERATED:COLOR-RAMPS markers in tokens.css.\n` +
      `Expected both:\n  ${START}\n  ${END}\n` +
      `Add them around the color-ramp block before running the emitter.`,
  )
  process.exit(1)
}
if (endIdx < startIdx) {
  console.error('[emit-tokens] END marker precedes START marker in tokens.css.')
  process.exit(1)
}

// Splice the generated block in place of the marked region. The block already
// carries its own 2-space indentation (matching the `:root { ... }` body), so we
// replace from the start of the START-marker line through the END marker.
const lineStart = current.lastIndexOf('\n', startIdx) + 1
const before = current.slice(0, lineStart)
const after = current.slice(endIdx + END.length)
const next = before + generated + after

if (next === current) {
  console.log('[emit-tokens] tokens.css already up to date.')
  process.exit(0)
}

if (checkOnly) {
  console.error(
    '[emit-tokens] DRIFT DETECTED: src/styles/tokens.css does not match a fresh emit.\n' +
      'Run `node scripts/emit-tokens.mjs` and commit the result.',
  )
  process.exit(1)
}

writeFileSync(tokensPath, next)
console.log(`[emit-tokens] Wrote ${tokensPath} — color ramps emitted as oklch() + derivation layer.`)
