// @vitest-environment node

/**
 * Brand-tinted-chrome contrast harness (#288) — the gate that makes a
 * brand-driven surface SAFE.
 *
 * WHAT IT DOES
 * ------------
 * Opt-in `[data-tint-chrome]` lets the chrome layer (background / surface /
 * border / text) tint toward `--color-primary`, so a re-skin reaches the
 * majority of the app surface — not just accents. A tint that quietly drops
 * body text below WCAG AA would be worse than no tint at all. So this harness:
 *
 *   1. PARSES the real `src/styles/tokens.css` (not a hand-copy — it can't drift
 *      from what ships): every `--color-*` declaration, per selector scope
 *      (`:root`, `[data-theme="dark"]`, `[data-tint-chrome]`, and the compound
 *      `[data-theme="dark"][data-tint-chrome]`), including the generated ramp.
 *   2. RESOLVES each chrome token to a concrete hex for an arbitrary
 *      `--color-primary`, expanding nested `var()` chains and evaluating
 *      `color-mix(in oklab, …)` with the SAME oklab math the browser uses
 *      (the published `mixOklab`).
 *   3. ASSERTS WCAG AA on the #12 text tiers — for the Ocean default AND a
 *      matrix of HOSTILE primaries (hues round the wheel, plus L/C extremes) —
 *      in light + dark × tinted + untinted. If the ladder can't hold AA for a
 *      bright-yellow or near-black brand, that's a real defect, caught here.
 *
 * Disabled text is intentionally NOT asserted (WCAG SC 1.4.3 exempts inactive
 * UI). Borders are decorative hairlines by design (< 3:1) and not asserted.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  oklabFromHex,
  oklabToOklch,
  oklchToHex,
  mixOklab,
  type Oklab,
} from './oklch'
import { contrastRatio, AA_NORMAL, AA_LARGE } from './contrast'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = resolve(HERE, '../styles/tokens.css')

/* ───────────────────────── CSS scope parser ───────────────────────── */

/**
 * Collect `--name: value;` custom-property declarations grouped by the selector
 * block they appear in. A brace-depth scan that is AT-RULE AWARE:
 *
 *   - Declarations gated by a CONDITIONAL at-rule (`@media` / `@supports` /
 *     `@container`) are SKIPPED — the harness tests the default rendered state,
 *     not `prefers-contrast: high` / `prefers-reduced-motion` overrides. (Missing
 *     this silently let the `@media (prefers-contrast: high)` block's
 *     `[data-theme="dark"] { --color-text-secondary: var(--color-text-primary) }`
 *     overwrite the real default-dark value — the harness was asserting the wrong
 *     color. Regression-guarded by a sanity test below.)
 *   - An UNCONDITIONAL wrapper (`@layer ll.tokens { … }`, which wraps the whole
 *     file) is transparent: the scope is the nearest enclosing real selector.
 */
function parseScopes(css: string): Map<string, Map<string, string>> {
  // Strip comments first so `;`/`{`/`}` inside them never confuse the scan.
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const scopes = new Map<string, Map<string, string>>()
  const stack: string[] = []
  const isConditional = (s: string) => /^@(media|supports|container)/.test(s)
  let i = 0
  let buf = ''
  while (i < src.length) {
    const ch = src[i]
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
      if (idx > 0 && decl.startsWith('--') && !stack.some(isConditional)) {
        // Nearest enclosing real selector (skip @layer / other at-rule frames).
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
    i++
  }
  return scopes
}

/** Merge selector maps in cascade order (later wins). */
function layer(...maps: Array<Map<string, string> | undefined>): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of maps) if (m) for (const [k, v] of m) out.set(k, v)
  return out
}

/* ───────────────────────── color evaluator ───────────────────────── */

const HEX = /^#[0-9a-fA-F]{6}$/

/** Split a comma-separated arg list respecting nested parens. */
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
 * Resolve a CSS color value to OKLab, expanding `var()` chains and evaluating
 * `color-mix(in oklab, A, B p%)`. `primary` overrides `--color-primary`.
 * Supports the value forms tokens.css actually uses: hex, `oklch(L C H)`,
 * `var(--x[, fallback])`, and 2-color `color-mix(in oklab, …)`.
 */
function evalColor(value: string, scope: Map<string, string>, primary: string): Oklab {
  const v = value.trim()

  if (HEX.test(v)) return oklabFromHex(v)
  if (v === 'white') return oklabFromHex('#FFFFFF')
  if (v === 'black') return oklabFromHex('#000000')

  const oklchM = v.match(/^oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/)
  if (oklchM) {
    // safe: oklchM matched → its three capture groups are all present.
    const lRaw = oklchM[1]!
    const cRaw = oklchM[2]!
    const hRaw = oklchM[3]!
    const L = lRaw.endsWith('%') ? parseFloat(lRaw) / 100 : parseFloat(lRaw)
    return oklchLiteralToOklab(L, parseFloat(cRaw), parseFloat(hRaw))
  }

  if (v.startsWith('var(')) {
    const inner = v.slice(4, v.lastIndexOf(')'))
    const [ref, ...fallback] = splitTop(inner)
    // Honest guard: a var() with no reference is malformed token data — fail loudly
    // (this already threw below as `unresolved var undefined`; narrowing ref here too).
    if (ref === undefined) throw new Error(`empty var() reference in: ${value}`)
    if (ref === '--color-primary') return oklabFromHex(primary)
    if (scope.has(ref)) return evalColor(scope.get(ref)!, scope, primary)
    if (fallback.length) return evalColor(fallback.join(','), scope, primary)
    throw new Error(`unresolved var ${ref}`)
  }

  if (v.startsWith('color-mix(')) {
    const inner = v.slice(v.indexOf('(') + 1, v.lastIndexOf(')'))
    const args = splitTop(inner)
    // args[0] === "in oklab"; args[1] === colorA; args[2] === "colorB p%"
    const [space, colorA, colorB] = args
    // Honest guard: a color-mix() missing any of its three parts is malformed token
    // data (previously threw downstream via undefined.trim()) — fail loudly here.
    if (space === undefined || colorA === undefined || colorB === undefined) {
      throw new Error(`malformed color-mix (expected "in oklab, A, B p%"): ${value}`)
    }
    if (!/^in\s+oklab$/.test(space)) throw new Error(`unsupported mix space: ${space}`)
    const a = evalColor(colorA, scope, primary)
    const pMatch = colorB.match(/([0-9.]+)%\s*$/)
    const p = pMatch ? parseFloat(pMatch[1]!) : 50 // safe: capture group 1 present when pMatch is non-null
    const bColor = colorB.replace(/([0-9.]+)%\s*$/, '').trim()
    const b = evalColor(bColor, scope, primary)
    return mixOklab(a, b, p)
  }

  throw new Error(`cannot evaluate color value: "${value}"`)
}

function resolveHex(token: string, scope: Map<string, string>, primary: string): string {
  if (!scope.has(token)) throw new Error(`token ${token} not defined in scope`)
  const o = evalColor(scope.get(token)!, scope, primary)
  const { L, C, H } = oklabToOklch(o)
  return oklchToHex(L, C, H)
}

/* ───────────────────────── scenarios + matrix ───────────────────────── */

const scopes = parseScopes(readFileSync(TOKENS_CSS, 'utf-8'))
const root = scopes.get(':root')
const dark = scopes.get('[data-theme="dark"]')
const lightTint = scopes.get('[data-tint-chrome]')
const darkTint =
  scopes.get('[data-theme="dark"][data-tint-chrome]') ??
  scopes.get('[data-tint-chrome][data-theme="dark"]')

const SCENARIOS = {
  'light · untinted': { map: layer(root), tinted: false },
  'dark · untinted': { map: layer(root, dark), tinted: false },
  'light · tinted': { map: layer(root, lightTint), tinted: true },
  'dark · tinted': { map: layer(root, dark, darkTint), tinted: true },
} as const

// Ocean default + hostile primaries: every hue family, plus very-light and
// very-dark brands that stress the fixed-contrast assumption hardest.
const PRIMARIES: Array<[string, string]> = [
  ['ocean (default)', '#1B7FA8'],
  ['crimson', '#DC2626'],
  ['amber (light!)', '#F59E0B'],
  ['lime-yellow (lightest!)', '#EAB308'],
  ['emerald', '#10B981'],
  ['violet', '#7C3AED'],
  ['magenta', '#D946EF'],
  ['hot-pink', '#EC4899'],
  ['navy (darkest!)', '#1E3A8A'],
  ['near-black', '#1F2937'],
  ['slate (low-chroma)', '#64748B'],
]

/**
 * Pre-existing sub-AA-normal pairs in the DEFAULT theme — NOT caused by the tint
 * (the tint actually RAISES them). Held to AA-large (3:1) so the harness keeps
 * guarding them from catastrophe without retroactively failing the shipped
 * default. Both tracked for a dedicated fix (see task in the sprint manifest);
 * fixing them changes default text colors, so they don't ride a tinted-chrome PR.
 *
 *  - `text-secondary` == `neutral-600` (#607D8B): sub-AA on every light surface
 *    (≤4.37:1 on white, down to ~3.5:1 on surface-hover). The #12 work lifted
 *    *tertiary* to neutral-550/4.58:1 but left secondary on neutral-600. The tint
 *    darkens it (helps), but on `surface-hover` it still lands ~4.1:1 < AA.
 *  - `text-tertiary` on the HOVER surface is pre-existing in BOTH themes:
 *    neutral-550 on neutral-200 ≈ 4.24:1 (light); ocean.light on ocean.dark
 *    ≈ 3.41:1 (dark). Tint-independent — the hover surface is just darker/closer
 *    to the helper-text tier than the AA margin allows.
 */
const BASELINE_SUB_AA = new Set([
  'light · untinted|--color-text-secondary|--color-background',
  'light · untinted|--color-text-secondary|--color-surface',
  'light · untinted|--color-text-secondary|--color-surface-elevated',
  'light · untinted|--color-text-secondary|--color-surface-hover',
  'light · tinted|--color-text-secondary|--color-surface-hover',
  'light · untinted|--color-text-tertiary|--color-surface-hover',
  'dark · untinted|--color-text-tertiary|--color-surface-hover',
  'dark · tinted|--color-text-tertiary|--color-surface-hover',
])

// Full matrix: every text tier × every surface it can render on, INCLUDING
// surface-hover (hovered list rows / menu items carry secondary + tertiary text,
// not just primary). Omitting hover for secondary/tertiary previously hid a real
// AA failure on the most-tinted surface.
const TEXT_PAIRS: Array<[fg: string, bg: string]> = [
  ['--color-text-primary', '--color-background'],
  ['--color-text-primary', '--color-surface'],
  ['--color-text-primary', '--color-surface-elevated'],
  ['--color-text-primary', '--color-surface-hover'],
  ['--color-text-secondary', '--color-background'],
  ['--color-text-secondary', '--color-surface'],
  ['--color-text-secondary', '--color-surface-elevated'],
  ['--color-text-secondary', '--color-surface-hover'],
  ['--color-text-tertiary', '--color-background'],
  ['--color-text-tertiary', '--color-surface'],
  ['--color-text-tertiary', '--color-surface-elevated'],
  ['--color-text-tertiary', '--color-surface-hover'],
]

describe('brand-tinted chrome holds WCAG AA (#288)', () => {
  it('parsed the tint scopes from tokens.css (sanity — guard against silent inert test)', () => {
    expect(root, ':root scope').toBeDefined()
    expect(dark, '[data-theme="dark"] scope').toBeDefined()
    expect(lightTint, '[data-tint-chrome] scope must exist').toBeDefined()
    expect(darkTint, '[data-theme="dark"][data-tint-chrome] scope must exist').toBeDefined()
    // The tint blocks must actually override the chrome tokens we assert on.
    for (const tok of ['--color-background', '--color-surface', '--color-text-tertiary']) {
      expect(lightTint!.has(tok), `light tint defines ${tok}`).toBe(true)
      expect(darkTint!.has(tok), `dark tint defines ${tok}`).toBe(true)
    }
    // Parser regression guard: the `@media (prefers-contrast: high)` block also
    // contains a `[data-theme="dark"]` rule; if the scanner folded it into the base
    // dark scope, default-dark assertions would test the high-contrast color. The
    // real default-dark secondary is now the neutral-200 ref (v0.36.0 OSS-prep
    // #421 — was ocean-lighter), not text-primary.
    expect(
      dark!.get('--color-text-secondary'),
      'default-dark text-secondary must be the base value, not the prefers-contrast override',
    ).toBe('var(--color-neutral-200)')
  })

  for (const [scenarioName, scenario] of Object.entries(SCENARIOS)) {
    // Untinted scenarios are primary-independent (chrome routes through neutral/
    // static-ocean), so one representative primary exercises them fully.
    const primaries = scenario.tinted ? PRIMARIES : PRIMARIES.slice(0, 1)

    describe(scenarioName, () => {
      for (const [primaryName, primary] of primaries) {
        for (const [fg, bg] of TEXT_PAIRS) {
          const min = BASELINE_SUB_AA.has(`${scenarioName}|${fg}|${bg}`) ? AA_LARGE : AA_NORMAL
          it(`${fg.replace('--color-', '')} on ${bg.replace('--color-', '')} ≥ ${min}:1  [${primaryName}]`, () => {
            const fgHex = resolveHex(fg, scenario.map, primary)
            const bgHex = resolveHex(bg, scenario.map, primary)
            const ratio = contrastRatio(fgHex, bgHex)
            expect(
              ratio,
              `\n${scenarioName} · primary ${primary}\n  ${fg} = ${fgHex}\n  on ${bg} = ${bgHex}\n  contrast ${ratio.toFixed(2)}:1 < ${min}:1\n`,
            ).toBeGreaterThanOrEqual(min)
          })
        }
      }
    })
  }
})
