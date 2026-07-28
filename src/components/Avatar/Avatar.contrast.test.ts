// @vitest-environment node

/**
 * Avatar gradient-initials contrast harness (#83).
 *
 * White initials render on top of one of the 8 gradient variants
 * (`.gradient`, `.gradient-0` … `.gradient-6`) in `Avatar.module.css`.
 * Initials are normal text below `size="2xl"`, so SC 1.4.3 requires 4.5:1
 * against the LEAST-contrasting point of the gradient — i.e. every
 * individual color stop, not just an average.
 *
 * This is a drift guard, not a one-time measurement: it PARSES the real
 * `Avatar.module.css` (every `.gradient*` / `[data-theme='dark'] .gradient*`
 * rule) for the `var(--color-*)` stop tokens actually in use, resolves them
 * against the real `src/styles/tokens.css` (OKLCH → hex, `color-mix(in
 * oklab, …)`), and asserts white clears 4.5:1 against every stop directly.
 * If a future edit to a gradient slot's stops, or to a `--color-primary-*` /
 * `--color-secondary-*` rung, reintroduces a sub-AA stop, this fails loudly
 * with the exact stop, mode, and ratio — instead of silently shipping.
 *
 * See `Avatar.module.css`'s "#83 — WCAG AA fix" comment block for the
 * measured before/after ratios and the rejected alternatives (a uniform
 * darkening scrim — reverted after a real-browser preview showed it
 * crushing the palette to near-identical dark circles — and a min-size
 * threshold).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { oklabFromHex, oklabToOklch, oklchToHex, mixOklab, type Oklab } from '../../tokens/oklch'
import { contrastRatio, AA_NORMAL } from '../../tokens/contrast'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = resolve(HERE, '../../styles/tokens.css')
const AVATAR_CSS = resolve(HERE, './Avatar.module.css')

/* ───────────────────────── minimal local CSS scope parser ─────────────────────────
 * Deliberately NOT imported from src/tokens/chrome-contrast.test.ts (that file lives
 * on another in-flight branch) — replicated here in trimmed form since it isn't
 * exported machinery, just a test-local helper there either. */

function parseScopes(css: string): Map<string, Map<string, string>> {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const scopes = new Map<string, Map<string, string>>()
  const stack: string[] = []
  const isConditional = (s: string) => /^@(media|supports|container)/.test(s)
  let buf = ''
  for (const ch of src) {
    if (ch === '{') {
      stack.push(buf.trim())
      buf = ''
    } else if (ch === '}') {
      stack.pop()
      buf = ''
    } else if (ch === ';') {
      const decl = buf.trim()
      buf = ''
      const idx = decl.indexOf(':')
      // Unlike the chrome-contrast harness (which only needs `--color-*`
      // custom-property declarations), this parser also needs a real
      // property (`background`) from Avatar.module.css — so it captures
      // ANY `prop: value;` declaration, not just custom properties.
      if (idx > 0 && !stack.some(isConditional)) {
        const selector = [...stack].reverse().find((s) => s && !s.startsWith('@')) ?? ''
        if (selector) {
          const name = decl.slice(0, idx).trim()
          const value = decl.slice(idx + 1).trim()
          if (!scopes.has(selector)) scopes.set(selector, new Map())
          scopes.get(selector)!.set(name, value)
        }
      }
    } else {
      buf += ch
    }
  }
  return scopes
}

function layer(...maps: Array<Map<string, string> | undefined>): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of maps) if (m) for (const [k, v] of m) out.set(k, v)
  return out
}

const HEX = /^#[0-9a-fA-F]{6}$/

function splitTop(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function oklchLiteralToOklab(L: number, C: number, H: number): Oklab {
  const h = (H * Math.PI) / 180
  return { L, a: C * Math.cos(h), b: C * Math.sin(h) }
}

/**
 * Resolve a CSS color value to OKLab, expanding `var()` chains and
 * `color-mix(in oklab, A, B p%)`. `primaryHex`/`secondaryHex` override the
 * bare `--color-primary` / `--color-secondary` base tokens (simulating a
 * theme preset or the brand-neutral default), matching the derivation
 * mechanism in the real `chrome-contrast.test.ts` harness.
 */
function evalColor(
  value: string,
  scope: Map<string, string>,
  primaryHex: string,
  secondaryHex: string
): Oklab {
  const v = value.trim()

  if (HEX.test(v)) return oklabFromHex(v)
  if (v === 'white') return oklabFromHex('#FFFFFF')
  if (v === 'black') return oklabFromHex('#000000')

  const oklchM = v.match(/^oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/)
  if (oklchM) {
    const lRaw = oklchM[1]!
    const L = lRaw.endsWith('%') ? parseFloat(lRaw) / 100 : parseFloat(lRaw)
    return oklchLiteralToOklab(L, parseFloat(oklchM[2]!), parseFloat(oklchM[3]!))
  }

  if (v.startsWith('var(')) {
    const inner = v.slice(4, v.lastIndexOf(')'))
    const [ref, ...fallback] = splitTop(inner)
    if (ref === undefined) throw new Error(`empty var() reference in: ${value}`)
    if (ref === '--color-primary') return oklabFromHex(primaryHex)
    if (ref === '--color-secondary') return oklabFromHex(secondaryHex)
    if (scope.has(ref)) return evalColor(scope.get(ref)!, scope, primaryHex, secondaryHex)
    if (fallback.length) return evalColor(fallback.join(','), scope, primaryHex, secondaryHex)
    throw new Error(`unresolved var ${ref}`)
  }

  if (v.startsWith('color-mix(')) {
    const inner = v.slice(v.indexOf('(') + 1, v.lastIndexOf(')'))
    const args = splitTop(inner)
    const [space, colorA, colorB] = args
    if (space === undefined || colorA === undefined || colorB === undefined) {
      throw new Error(`malformed color-mix (expected "in oklab, A, B p%"): ${value}`)
    }
    if (!/^in\s+oklab$/.test(space)) throw new Error(`unsupported mix space: ${space}`)
    const a = evalColor(colorA, scope, primaryHex, secondaryHex)
    const pMatch = colorB.match(/([0-9.]+)%\s*$/)
    const p = pMatch ? parseFloat(pMatch[1]!) : 50
    const bColor = colorB.replace(/([0-9.]+)%\s*$/, '').trim()
    const b = evalColor(bColor, scope, primaryHex, secondaryHex)
    return mixOklab(a, b, p)
  }

  throw new Error(`cannot evaluate color value: "${value}"`)
}

function resolveHex(
  token: string,
  scope: Map<string, string>,
  primaryHex: string,
  secondaryHex: string
): string {
  if (!scope.has(token)) throw new Error(`token ${token} not defined in scope`)
  const o = evalColor(scope.get(token)!, scope, primaryHex, secondaryHex)
  const { L, C, H } = oklabToOklch(o)
  return oklchToHex(L, C, H)
}

/* ───────────────────────── parse Avatar.module.css ───────────────────────── */

const avatarCss = readFileSync(AVATAR_CSS, 'utf-8')
const avatarScopes = parseScopes(avatarCss)

const COLOR_TOKEN_RE = /var\(--color-[a-z0-9-]+\)/g

/** Every `.gradient` / `.gradient-N` selector, light + `[data-theme='dark']`. */
const gradientSelectors = [...avatarScopes.keys()].filter((sel) => /\.gradient(-\d)?\b/.test(sel))

/** `[selector, isDark, colorTokens[]]` — the actual stop tokens in use, per rule. */
const gradientRules: Array<{ selector: string; isDark: boolean; tokens: string[] }> = []
for (const selector of gradientSelectors) {
  const decls = avatarScopes.get(selector)!
  const bg = decls.get('background')
  if (!bg) continue
  const tokens = [...bg.matchAll(COLOR_TOKEN_RE)].map((m) => m[0].slice(4, -1))
  if (tokens.length === 0) continue
  gradientRules.push({
    selector,
    isDark: selector.includes(`[data-theme='dark']`),
    tokens,
  })
}

/* ───────────────────────── resolve against tokens.css ───────────────────────── */

const tokenScopes = parseScopes(readFileSync(TOKENS_CSS, 'utf-8'))
const root = tokenScopes.get(':root')
const dark = tokenScopes.get('[data-theme="dark"]')
const lightScope = layer(root)
const darkScope = layer(root, dark)

// Two brand scenarios: the shipped brand-neutral default (no preset applied —
// what actually renders out of the box), and the `lando` ocean/teal preset
// (primary '#1B7FA8' / secondary '#2DBFBF' — mirrors `landoTheme` in
// `src/tokens/themePresets.ts`), since Avatar's own comments describe the
// gradient family as "ocean/teal" and it was the worse-case scenario measured
// during the #83 investigation (`--color-secondary-medium` only fails under
// this preset, not the brand-neutral default).
const BRAND_NEUTRAL_PRIMARY = resolveHex('--color-primary', lightScope, '', '')
const BRAND_NEUTRAL_SECONDARY = resolveHex('--color-secondary', lightScope, '', '')

const SCENARIOS: Array<{ name: string; primary: string; secondary: string }> = [
  { name: 'brand-neutral default', primary: BRAND_NEUTRAL_PRIMARY, secondary: BRAND_NEUTRAL_SECONDARY },
  { name: 'lando preset (ocean/teal)', primary: '#1B7FA8', secondary: '#2DBFBF' },
]

describe('Avatar gradient initials clear WCAG AA (#83)', () => {
  it('sanity — parsed exactly 16 gradient rules from Avatar.module.css (8 light + 8 dark)', () => {
    expect(gradientRules.length, 'gradient rules parsed from Avatar.module.css').toBeGreaterThan(0)
    expect(gradientRules.some((r) => !r.isDark), 'at least one light-mode gradient rule').toBe(true)
    expect(gradientRules.some((r) => r.isDark), 'at least one dark-mode gradient rule').toBe(true)
    // 8 light variants (.gradient + .gradient-0..6) + 8 dark overrides = 16.
    expect(gradientRules.length).toBe(16)
    // Every rule is a genuine two-stop gradient — a flat/collapsed pair would
    // silently zero out the gradient look while still passing the per-stop
    // contrast checks below, so guard against that separately.
    for (const { selector, tokens } of gradientRules) {
      expect(tokens.length, `${selector} should reference exactly 2 color-stop tokens`).toBe(2)
    }
  })

  for (const scenario of SCENARIOS) {
    describe(scenario.name, () => {
      for (const { selector, isDark, tokens } of gradientRules) {
        const scope = isDark ? darkScope : lightScope
        for (const token of tokens) {
          it(`${selector} :: ${token} clears 4.5:1 for white text`, () => {
            const stopHex = resolveHex(token, scope, scenario.primary, scenario.secondary)
            const ratio = contrastRatio('#FFFFFF', stopHex)
            expect(
              ratio,
              `\n${scenario.name} · ${selector} · ${token}\n  stop = ${stopHex}\n  contrast ${ratio.toFixed(3)}:1 < ${AA_NORMAL}:1\n`
            ).toBeGreaterThanOrEqual(AA_NORMAL)
          })
        }
      }
    })
  }

  /**
   * Regression lock on the exact #83 measurements — independent of the
   * parametrized sweep above, which is generic and would keep passing even
   * if the specific numbers drifted within the "still >= 4.5" range. Pins
   * (a) the worst pre-fix pairing the issue reported, and (b) the worst
   * post-fix pairing across the whole sweep, to the ratios measured during
   * the investigation, so both the historical regression and the current
   * safety margin are traceable.
   */
  it('#83 — regression lock: brand-neutral dark --color-primary-base (the reported pairing) was sub-AA pre-fix', () => {
    const preFixRatio = contrastRatio(
      '#FFFFFF',
      resolveHex('--color-primary-base', darkScope, BRAND_NEUTRAL_PRIMARY, BRAND_NEUTRAL_SECONDARY)
    )
    // Was 3.23:1 pre-#83 (matches the issue's measured value) — sub-AA. Not
    // reachable via any current gradient rule (primary-base is no longer
    // used as a stop by any slot), but pinned here so the historical number
    // stays traceable.
    expect(preFixRatio).toBeCloseTo(3.228, 2)
    expect(preFixRatio).toBeLessThan(AA_NORMAL)
  })

  it('#83 — regression lock: worst post-fix margin is --color-primary-medium under the lando preset', () => {
    // The thinnest passing margin in the whole sweep (4.5183:1) — genuinely
    // >= 4.5, but close enough that it's worth pinning explicitly. The
    // parametrized sweep above is what actually guards this in CI; this
    // just documents which stop carries the least headroom.
    const ratio = contrastRatio(
      '#FFFFFF',
      resolveHex('--color-primary-medium', lightScope, '#1B7FA8', '#2DBFBF')
    )
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL)
    expect(ratio).toBeCloseTo(4.518, 2)
  })
})
