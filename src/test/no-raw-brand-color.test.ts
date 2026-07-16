// @vitest-environment node

/**
 * No-raw-brand-color guard (#290) — the long-promised token-migration CI block.
 *
 * BACKGROUND
 * ----------
 * The #101 token-migration note in `src/styles/tokens.css` stated that direct
 * refs to the raw `--color-ocean-*` / `--color-teal-*` rungs are "subsequently
 * CI-blocked" — but that guard was never actually built, and the v0.23.0–v0.25.0
 * color-architecture audit found new raw literals slipping into component CSS
 * (BottomNav `#1B7FA8`, Callout `rgb(45 191 191 / …)` tints, a Header brand-hex
 * fallback). #289 swept them; this test stops them coming back.
 *
 * WHY IT MATTERS
 * --------------
 * The whole re-skin contract (#271 → #285) is: a consumer overrides ONE base
 * token (`--color-primary`, `--color-secondary`, a semantic base) and the entire
 * surface re-skins, because every component routes color through the semantic /
 * derived-ramp tokens. A baked literal — whether a hex, an `rgb()` channel
 * triple, or a raw `var(--color-ocean-*)` rung — is a hole in that contract: it
 * stays Ocean no matter what theme is applied.
 *
 * WHAT THIS LOCKS (scanning every `*.module.css` under `src/components/**`,
 * comments stripped so explanatory hex in `/* … *\/` is ignored):
 *
 *   1. No raw `var(--color-ocean-*)` / `var(--color-teal-*)` references.
 *      Components must consume the SEMANTIC tokens (`--color-primary`,
 *      `--color-secondary`, `--color-accent`, the derived `--color-primary-*`
 *      ramp, `--color-success/-warning/-error/-info`), never the raw ramps.
 *   2. No brand/semantic HEX literals (the ocean ∪ teal ∪ semantic palette from
 *      `colors.ts`). Neutrals / white / black are allowed — they're legitimate
 *      `var(--token, #neutral)` fallbacks for chrome.
 *   3. No brand/semantic `rgb()` / `rgba()` CHANNEL triples (e.g.
 *      `rgb(45 191 191 / .08)` == `#2DBFBF`). Same palette as (2), matched by
 *      resolved channels. The `rgb(var(--token-rgb) / α)` alpha-composition form
 *      is fine — it routes through a token, so it has no literal channels here.
 *
 * The blocklist is DERIVED from `src/tokens/colors.ts` (the source of truth), so
 * it can't drift from the palette. If a NEW base color is added, this guard
 * starts protecting it automatically.
 *
 * If a literal is ever genuinely intentional, add the file to ALLOWLIST with a
 * one-line justification (mirrors the container-query sweep's allowlist pattern).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'
import { colors } from '../tokens/colors'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const COMPONENTS_DIR = resolve(REPO_ROOT, 'src/components')

/**
 * Files permitted to contain an otherwise-blocked literal, each with a reason.
 * Empty today — the #289 sweep left component CSS clean. Add `'Foo/Foo.module.css'`
 * here (with justification) only for a deliberate, un-tokenizable literal.
 */
const ALLOWLIST: Record<string, string> = {}

/** Strip `/* … *\/` block comments so commented-out literals are ignored. */
function stripBlockComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Recursively collect every `*.module.css` under a directory. */
function collectModuleCss(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectModuleCss(full))
    else if (entry.endsWith('.module.css')) out.push(full)
  }
  return out
}

/** Recursively gather every `#RRGGBB` string value under an object. */
function collectHexes(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof node === 'string') {
    if (/^#[0-9a-fA-F]{6}$/.test(node)) out.add(node.toUpperCase())
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) collectHexes(v, out)
  }
  return out
}

// Brand + semantic palette (re-skin-blocking). Neutrals are intentionally
// EXCLUDED — `var(--token, #455a64)` chrome fallbacks are legitimate.
const BRAND_HEXES = Array.from(
  collectHexes(colors.ocean, collectHexes(colors.teal, collectHexes(colors.semantic))),
)

/** `#2DBFBF` → `"45,191,191"` (resolved rgb channel key). */
function hexToTripleKey(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}
const BRAND_TRIPLES = new Set(BRAND_HEXES.map(hexToTripleKey))

/** Brand hex literals present in a (comment-stripped) stylesheet body. */
function findBrandHex(css: string): string[] {
  const upper = css.toUpperCase()
  return BRAND_HEXES.filter((hex) => upper.includes(hex))
}

/** Raw `var(--color-ocean-* / --color-teal-*)` references in a body. */
function findRawRampRefs(css: string): string[] {
  return css.match(/var\(\s*--color-(?:ocean|teal)-[a-z0-9-]+/gi) ?? []
}

/**
 * Brand `rgb()/rgba()` channel literals. Each color-function's first three
 * numeric args are read as R,G,B and matched against the brand triples. The
 * `rgb(var(--token-rgb) / α)` form yields a non-numeric first arg (the `var(`)
 * and is correctly ignored.
 */
function findBrandRgb(css: string): string[] {
  const hits: string[] = []
  const re = /rgba?\(([^)]+)\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    const nums = m[1]!.split(/[\s,/]+/).filter(Boolean) // safe: capture group 1 present when exec matched
    const r = Number(nums[0]), g = Number(nums[1]), b = Number(nums[2])
    if (Number.isInteger(r) && Number.isInteger(g) && Number.isInteger(b)) {
      if (BRAND_TRIPLES.has(`${r},${g},${b}`)) hits.push(m[0])
    }
  }
  return hits
}

describe('no raw brand colors in component CSS (#290)', () => {
  const files = collectModuleCss(COMPONENTS_DIR).sort()
  const rel = (f: string) => relative(COMPONENTS_DIR, f).split('\\').join('/')

  it('finds the component stylesheets (sanity)', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it('derives a non-empty brand palette from colors.ts (sanity)', () => {
    // Ocean #2BA3D4 / #1B7FA8, teal #2DBFBF, etc. — if this is empty the guard
    // is silently inert.
    expect(BRAND_HEXES).toContain('#1B7FA8')
    expect(BRAND_HEXES).toContain('#2DBFBF')
    expect(BRAND_HEXES.length).toBeGreaterThanOrEqual(16)
  })

  it('no component CSS references the raw --color-ocean-* / --color-teal-* rungs', () => {
    const offenders: string[] = []
    for (const file of files) {
      const key = rel(file)
      if (key in ALLOWLIST) continue
      const hits = findRawRampRefs(stripBlockComments(readFileSync(file, 'utf-8')))
      if (hits.length) offenders.push(`  ${key}: ${[...new Set(hits)].join(', ')}`)
    }
    expect(
      offenders,
      `\nRaw brand-ramp refs in component CSS — route through a semantic token ` +
        `(--color-primary / -secondary / -accent / the --color-primary-* ramp):\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })

  it('no component CSS bakes a brand/semantic hex literal', () => {
    const offenders: string[] = []
    for (const file of files) {
      const key = rel(file)
      if (key in ALLOWLIST) continue
      const hits = findBrandHex(stripBlockComments(readFileSync(file, 'utf-8')))
      if (hits.length) offenders.push(`  ${key}: ${hits.join(', ')}`)
    }
    expect(
      offenders,
      `\nBrand/semantic hex baked into component CSS — replace with the matching ` +
        `semantic token (a re-skin can't move a literal):\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })

  it('no component CSS bakes a brand/semantic rgb()/rgba() channel triple', () => {
    const offenders: string[] = []
    for (const file of files) {
      const key = rel(file)
      if (key in ALLOWLIST) continue
      const hits = findBrandRgb(stripBlockComments(readFileSync(file, 'utf-8')))
      if (hits.length) offenders.push(`  ${key}: ${[...new Set(hits)].join(', ')}`)
    }
    expect(
      offenders,
      `\nBrand/semantic rgb() channels baked into component CSS — use ` +
        `color-mix(in oklab, var(--color-X), transparent N%) so it re-skins:\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })
})
