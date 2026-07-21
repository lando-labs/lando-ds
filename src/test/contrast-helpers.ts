/**
 * src/test/contrast-helpers.ts
 *
 * Shared WCAG contrast-assertion helper for component-level dark/light theme
 * regression tests (#9 Button outline, #12 Switch off-track — the pattern is
 * intentionally reusable for future component contrast fixes).
 *
 * WHY NOT `getComputedStyle` IN JSDOM: jsdom does not resolve `@layer`
 * precedence (see reference/css-layers.md's note that the real override check
 * has to happen in a browser) and does not reliably evaluate `color-mix()` /
 * `oklch()` custom-property cascades either. Rendering the component and
 * reading its computed color would silently test the wrong thing.
 *
 * WHAT THIS DOES INSTEAD: parses the REAL `src/styles/tokens.css` (never a
 * hand-copied number that can drift from what ships) and resolves a named
 * custom property to a concrete hex color for a given theme scope, expanding
 * `var()` chains and evaluating `color-mix(in oklab, …)` with the same OKLab
 * math the browser uses (`src/tokens/oklch.ts`). This mirrors the token-scope
 * parser `src/tokens/chrome-contrast.test.ts` (#288) already established as
 * this repo's contrast-testing convention — trimmed down here (no hostile-
 * primary matrix override) since these tests only need the tokens' own
 * literal values, not a swapped `--color-primary`.
 *
 * Contrast math itself is NOT reimplemented — `contrastRatio` / `AA_NORMAL` /
 * `AA_LARGE` are imported from `src/tokens/contrast.ts`, the same functions
 * `chrome-contrast.test.ts` uses.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { oklabFromHex, oklabToOklch, oklchToHex, mixOklab, type Oklab } from '../tokens/oklch'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = resolve(HERE, '../styles/tokens.css')

/**
 * Collect `--name: value;` custom-property declarations grouped by the
 * selector block they appear in. At-rule aware: declarations gated by a
 * conditional at-rule (`@media` / `@supports` / `@container`) are skipped —
 * these tests assert the default rendered state, not a
 * `prefers-contrast: high` / `prefers-reduced-motion` override. An
 * unconditional wrapper (`@layer ll.tokens { … }`, which wraps the whole
 * file) is transparent: the scope is the nearest enclosing real selector.
 */
function parseScopes(css: string): Map<string, Map<string, string>> {
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
 * `color-mix(in oklab, A, B p%)`. Supports the value forms tokens.css
 * actually uses: hex, `oklch(L C H)`, `var(--x[, fallback])`, `white`/`black`,
 * and 2-color `color-mix(in oklab, …)`.
 */
function evalColor(value: string, scope: Map<string, string>): Oklab {
  const v = value.trim()

  if (HEX.test(v)) return oklabFromHex(v)
  if (v === 'white') return oklabFromHex('#FFFFFF')
  if (v === 'black') return oklabFromHex('#000000')

  const oklchM = v.match(/^oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/)
  if (oklchM) {
    const lRaw = oklchM[1]!
    const cRaw = oklchM[2]!
    const hRaw = oklchM[3]!
    const L = lRaw.endsWith('%') ? parseFloat(lRaw) / 100 : parseFloat(lRaw)
    return oklchLiteralToOklab(L, parseFloat(cRaw), parseFloat(hRaw))
  }

  if (v.startsWith('var(')) {
    const inner = v.slice(4, v.lastIndexOf(')'))
    const [ref, ...fallback] = splitTop(inner)
    if (ref === undefined) throw new Error(`empty var() reference in: ${value}`)
    if (scope.has(ref)) return evalColor(scope.get(ref)!, scope)
    if (fallback.length) return evalColor(fallback.join(','), scope)
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
    const a = evalColor(colorA, scope)
    const pMatch = colorB.match(/([0-9.]+)%\s*$/)
    const p = pMatch ? parseFloat(pMatch[1]!) : 50
    const bColor = colorB.replace(/([0-9.]+)%\s*$/, '').trim()
    const b = evalColor(bColor, scope)
    return mixOklab(a, b, p)
  }

  throw new Error(`cannot evaluate color value: "${value}"`)
}

function resolveHex(token: string, scope: Map<string, string>): string {
  if (!scope.has(token)) throw new Error(`token ${token} not defined in scope`)
  const o = evalColor(scope.get(token)!, scope)
  const { L, C, H } = oklabToOklch(o)
  return oklchToHex(L, C, H)
}

const scopes = parseScopes(readFileSync(TOKENS_CSS, 'utf-8'))
const rootScope = scopes.get(':root')
const darkScope = scopes.get('[data-theme="dark"]')

if (!rootScope) throw new Error('contrast-helpers: could not find :root scope in tokens.css')
if (!darkScope) {
  throw new Error('contrast-helpers: could not find [data-theme="dark"] scope in tokens.css')
}

const THEME_SCOPES = {
  light: layer(rootScope),
  dark: layer(rootScope, darkScope),
} as const

/**
 * Resolve a `--color-*` custom property to a concrete `#RRGGBB` hex for the
 * given theme, by parsing the real `src/styles/tokens.css` (see module docs
 * for why this beats rendering + `getComputedStyle` in jsdom).
 */
export function resolveTokenHex(token: string, theme: 'light' | 'dark'): string {
  return resolveHex(token, THEME_SCOPES[theme])
}
