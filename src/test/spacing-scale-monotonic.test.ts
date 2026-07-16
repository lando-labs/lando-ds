// @vitest-environment node

/**
 * Spacing-scale monotonicity lint (#448) — Phase A.
 *
 * BACKGROUND
 * ----------
 * `src/styles/tokens.css` publishes the spacing scale under TWO conventions on
 * the same `:root`:
 *
 *   1. A PIXEL-NUMERIC scale — `--spacing-N` where N *is* the pixel count
 *      (`--spacing-16` = 1rem = 16px, `--spacing-24` = 1.5rem = 24px). This is
 *      the primary scale and, read as "N = pixels", it is strictly monotonic.
 *   2. A SEMANTIC scale — `--spacing-{none,2xs,xs,…,7xl}` — context-named rungs
 *      that survive scale redesigns.
 *
 * Three Tailwind-step-compat aliases (`--spacing-3` = 12px, `--spacing-5` =
 * 20px, `--spacing-6` = 24px) also live on `:root`. Read as a bare number they
 * make the numeric scale look NON-monotonic (a "3" worth 12px sits between
 * `--spacing-2` = 2px and `--spacing-4` = 4px). They are NOT part of the ordered
 * pixel scale — they exist purely so Tailwind muscle-memory (`p-3`/`p-5`/`p-6`)
 * resolves instead of falling back to `initial`. This test encodes exactly that:
 * the pixel-numeric rungs are strictly increasing, the aliases are allow-listed
 * OUT of that assertion, and their alias equivalences are locked so they can't
 * silently drift off their pixel twin.
 *
 * WHAT THIS LOCKS
 * ---------------
 *   1. The PIXEL-NUMERIC rungs are strictly increasing in px.
 *   2. The SEMANTIC scale (none…7xl) is strictly increasing in px.
 *   3. The alias equivalences: `--spacing-3 == --spacing-12` (12px),
 *      `--spacing-5 == --spacing-20` (20px), `--spacing-6 == --spacing-24`
 *      (24px).
 *
 * EXPLICIT ALLOWLIST (intentionally NOT part of the strictly-increasing
 * bare-numeric assertion):
 *   - `--spacing-1` (1px), `--spacing-2` (2px): sub-4 HAIRLINE rungs (thin/
 *     hairline borders). They predate the "N = pixels on a 4px grid" scale and
 *     are kept for border widths, not layout rhythm; `--spacing-1` in particular
 *     is a documented wart (#43 — it is 1px, not the 4px a Tailwind reading
 *     implies). Including them would be fine numerically (1 < 2 < 4) but they are
 *     conceptually a separate hairline set, so they are asserted only via their
 *     own ascending check below, not folded into the main pixel scale.
 *   - `--spacing-3` (12px), `--spacing-5` (20px), `--spacing-6` (24px):
 *     Tailwind-step-compat ALIASES. As bare numbers they are non-monotonic by
 *     design; their correctness is instead pinned by the alias-equivalence
 *     assertions (#3 above).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = readFileSync(resolve(HERE, '../styles/tokens.css'), 'utf8')

/**
 * Read a spacing custom property's px value from anywhere in tokens.css.
 *
 * Accepts `0` / `<n>rem` / `<n>px` literal values (rem → ×16). Returns
 * `undefined` for a missing token or a non-literal value (e.g. a `var(...)`
 * reference), so callers can distinguish "absent" from a real 0.
 *
 * The name is matched with an exact `:` terminator so `--spacing-2` does NOT
 * accidentally match `--spacing-2xs` / `--spacing-24`, and `--spacing-2xs`
 * does not match `--spacing-2xs-dense`.
 */
function readSpacingPx(name: string): number | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`--${escaped}\\s*:\\s*([^;]+);`)
  const m = re.exec(TOKENS_CSS)
  if (!m) return undefined
  const raw = m[1]!.trim() // safe: regex has 1 capture group → present when m matched
  if (raw === '0') return 0
  const rem = /^(-?[\d.]+)rem$/.exec(raw)
  if (rem) return parseFloat(rem[1]!) * 16 // safe: capture group 1 present when rem matched
  const px = /^(-?[\d.]+)px$/.exec(raw)
  if (px) return parseFloat(px[1]!) // safe: capture group 1 present when px matched
  return undefined // non-literal (var(), color-mix(), etc.) — not in scope here
}

/** Read a value that MUST resolve to a literal px, or fail loudly. */
function px(name: string): number {
  const v = readSpacingPx(name)
  if (v === undefined) {
    throw new Error(`--${name} missing or non-literal in tokens.css`)
  }
  return v
}

/**
 * PIXEL-NUMERIC rungs, in intended ascending order. N is the pixel value.
 * Deliberately EXCLUDES the hairline rungs (1, 2) and the Tailwind-step aliases
 * (3, 5, 6) — see the allowlist rationale in the file header.
 */
const PIXEL_NUMERIC_RUNGS = [
  4, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128, 160, 192, 224, 256,
] as const

/** SEMANTIC scale, in intended ascending order. */
const SEMANTIC_RUNGS = [
  'none',
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
] as const

/** Tailwind-step aliases → their pixel-numeric twin. Locks the equivalence. */
const ALIAS_EQUIVALENCES: ReadonlyArray<readonly [alias: string, twin: string, expectedPx: number]> = [
  ['spacing-3', 'spacing-12', 12],
  ['spacing-5', 'spacing-20', 20],
  ['spacing-6', 'spacing-24', 24],
]

/**
 * Read a token RAW value from tokens.css (the text before the semicolon), so a var(--spacing-md) alias returns verbatim; readSpacingPx returns only literals.
 */
function readRawDef(name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`--${escaped}\\s*:\\s*([^;]+);`).exec(TOKENS_CSS)
  return m ? m[1]!.trim() : undefined // safe: regex has 1 capture group → present when m is non-null
}

/** Component-padding rhythm keys (Phase B) — each a pure alias of --spacing-<key>. */
const COMPONENT_PADDING_KEYS = [
  'none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl',
] as const

/**
 * Component-padding rhythm layer (#448 Phase B). Every component `padding`
 * declaration now routes through `--component-padding-*`, so these tokens are
 * LOAD-BEARING: a broken alias (a hardcoded literal, or the wrong `--spacing-`
 * twin) would silently shift padding library-wide with NO other test catching
 * it — the TS↔CSS parity guard deliberately excludes this alias layer. Lock the
 * alias so any drift fails CI.
 */
describe('component-padding rhythm layer (#448 Phase B)', () => {
  it('exposes exactly the expected rhythm keys', () => {
    for (const k of COMPONENT_PADDING_KEYS) {
      expect(readRawDef(`component-padding-${k}`), `--component-padding-${k} must be defined`).toBeTypeOf('string')
    }
  })

  it('every --component-padding-X is a pure alias of --spacing-X (no hardcoded value)', () => {
    for (const k of COMPONENT_PADDING_KEYS) {
      expect(
        readRawDef(`component-padding-${k}`),
        `--component-padding-${k} must be exactly "var(--spacing-${k})"; a hardcoded value would drift padding library-wide`,
      ).toBe(`var(--spacing-${k})`)
    }
  })

  it('each rhythm token has a --spacing twin that resolves to a real px', () => {
    for (const k of COMPONENT_PADDING_KEYS) {
      expect(
        readSpacingPx(`spacing-${k}`),
        `--spacing-${k} (twin of --component-padding-${k}) must be a literal px`,
      ).toBeTypeOf('number')
    }
  })
})

describe('spacing scale monotonicity (#448)', () => {
  it('sanity: reads the tokens.css spacing block (a known rung resolves)', () => {
    expect(px('spacing-16')).toBe(16)
    expect(px('spacing-md')).toBe(16)
  })

  it('every pixel-numeric rung resolves to a literal px value', () => {
    for (const n of PIXEL_NUMERIC_RUNGS) {
      expect(readSpacingPx(`spacing-${n}`), `--spacing-${n} must be a literal px`).toBeTypeOf('number')
    }
  })

  it('the pixel-numeric rungs are strictly increasing in px', () => {
    const values = PIXEL_NUMERIC_RUNGS.map((n) => ({ name: `--spacing-${n}`, px: px(`spacing-${n}`) }))
    for (let i = 1; i < values.length; i++) {
      const cur = values[i]! // safe: 1 ≤ i < values.length
      const prev = values[i - 1]! // safe: i ≥ 1 → i-1 in range
      expect(
        cur.px,
        `${cur.name} (${cur.px}px) must be > ${prev.name} (${prev.px}px)`,
      ).toBeGreaterThan(prev.px)
    }
  })

  it('each pixel-numeric rung equals its own N (the "N = pixels" contract)', () => {
    for (const n of PIXEL_NUMERIC_RUNGS) {
      expect(px(`spacing-${n}`), `--spacing-${n} should resolve to ${n}px`).toBe(n)
    }
  })

  it('the semantic scale (none…7xl) is strictly increasing in px', () => {
    const values = SEMANTIC_RUNGS.map((k) => ({ name: `--spacing-${k}`, px: px(`spacing-${k}`) }))
    for (let i = 1; i < values.length; i++) {
      const cur = values[i]! // safe: 1 ≤ i < values.length
      const prev = values[i - 1]! // safe: i ≥ 1 → i-1 in range
      expect(
        cur.px,
        `${cur.name} (${cur.px}px) must be > ${prev.name} (${prev.px}px)`,
      ).toBeGreaterThan(prev.px)
    }
  })

  it('locks the Tailwind-step alias equivalences (--spacing-3/5/6 == their pixel twin)', () => {
    for (const [alias, twin, expected] of ALIAS_EQUIVALENCES) {
      expect(px(alias), `--${alias} should be ${expected}px`).toBe(expected)
      expect(px(twin), `--${twin} should be ${expected}px`).toBe(expected)
      expect(px(alias), `--${alias} must equal --${twin}`).toBe(px(twin))
    }
  })

  /**
   * ALLOWLIST documentation-as-assertion: the sub-4 hairline rungs exist and
   * are ascending among themselves, but are intentionally kept OUT of the
   * ordered pixel scale above (they are a hairline/border set, not layout
   * rhythm — `--spacing-1` is the documented 1px wart, #43).
   */
  it('allowlisted hairline rungs (--spacing-1, --spacing-2) exist and ascend, but stay out of the pixel scale', () => {
    expect(px('spacing-1')).toBe(1)
    expect(px('spacing-2')).toBe(2)
    expect(px('spacing-1')).toBeLessThan(px('spacing-2'))
    // Guard the intent: they are NOT enumerated in the ordered pixel scale.
    expect(PIXEL_NUMERIC_RUNGS).not.toContain(1)
    expect(PIXEL_NUMERIC_RUNGS).not.toContain(2)
  })

  /**
   * ALLOWLIST documentation-as-assertion: the Tailwind-step aliases are
   * deliberately excluded from the strictly-increasing pixel scale because,
   * read as bare numbers, they are non-monotonic (a "3" worth 12px). Their
   * correctness lives in the alias-equivalence test instead.
   */
  it('allowlisted Tailwind-step aliases (3/5/6) are excluded from the ordered pixel scale', () => {
    for (const n of [3, 5, 6]) {
      expect(PIXEL_NUMERIC_RUNGS, `bare --spacing-${n} is an alias, not an ordered pixel rung`).not.toContain(n)
    }
  })
})
