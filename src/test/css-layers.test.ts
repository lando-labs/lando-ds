// @vitest-environment node

/**
 * CSS cascade-layers contract guard (issues #267 / #268 / #13).
 *
 * The design system publishes its CSS inside named cascade layers so that a
 * consumer's UNLAYERED CSS always overrides DS component styles without
 * `!important` or stylesheet-load-order luck. The published order is:
 *
 *   @layer app-reset, ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app;
 *
 * `app-reset` and `app` are consumer-opt-in (the DS never puts rules in them)
 * but their *position* — below and above the five DS layers, respectively —
 * is part of the same public contract (#13): declaring them here, in the
 * MAIN stylesheet's own statement, means `@layer app { … }` reliably beats
 * `ll.components` as soon as a consumer imports `@lando-labs/lando-ds/styles`,
 * without also needing the separate `layer-order.css` primer. See
 * reference/css-layers.md "The published layer order" and "Load-order caveat".
 *
 * A consumer's unlayered rules outrank ALL of the above by the cascade-layer
 * spec. This test locks the contract against the *built* artifact
 * (`dist/design-system.css`) so it cannot silently drift from the docs
 * (README "Customizing & overriding styles" + reference/css-layers.md):
 *
 *   1. The bundle OPENS with the seven-layer order statement (whitespace
 *      tolerant — the minifier strips spaces after commas).
 *   2. All seven documented layer names are present (anti-drift: docs ↔ build).
 *   3. Every `*.module.css` rule is wrapped in `@layer ll.components` (spot-check
 *      Button + a floor on the wrap count so a broken plugin fails loudly).
 *   4. The base stylesheets are mapped to the correct layers and are NOT
 *      double-wrapped into `ll.components` (tokens→ll.tokens, reset→ll.reset,
 *      utilities→ll.utilities).
 *   5. Override proof: a Button class selector exists inside `ll.components`, so
 *      a consumer's `.foo { background: red }` on `<Button className="foo">`
 *      wins as unlayered CSS. (jsdom's CSSOM does not resolve @layer precedence,
 *      so we assert the structural guarantee the spec derives the win from,
 *      rather than a flaky getComputedStyle.)
 *
 * What this test CANNOT prove: that a real browser actually resolves `@layer
 * app` as winning against `ll.components` in a real consumer bundle — jsdom's
 * CSSOM does not implement `@layer` precedence at all, and a real bundler's
 * CSS chunk order can differ from this repo's build. That proof lives in
 * `tests/e2e/layer-override.spec.ts` (real Chromium, via the
 * `examples/next-app-router` fixture) — see reference/css-layers.md
 * "Automated real-browser proof (#13)".
 *
 * Self-contained: CI runs `npm test` BEFORE `npm run build` (.github/workflows/
 * test.yml), so the dist artifact may be absent/stale. We build the library CSS
 * on-demand in `beforeAll` when the artifact is missing, then read it.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const DIST_CSS = resolve(REPO_ROOT, 'dist/design-system.css')

const SEVEN_LAYERS = [
  'app-reset',
  'll.reset',
  'll.tokens',
  'll.base',
  'll.components',
  'll.utilities',
  'app',
] as const

let css = ''

beforeAll(() => {
  if (!existsSync(DIST_CSS)) {
    // Build the library so the artifact exists. Generous timeout: a cold Vite
    // library build of the full DS is a few seconds.
    execSync('npm run build', { cwd: REPO_ROOT, stdio: 'inherit' })
  }
  css = readFileSync(DIST_CSS, 'utf-8')
}, 180_000)

/**
 * Find the params of the nearest enclosing `@layer NAME {` block that contains
 * `needle`. Returns the layer name (e.g. "ll.components") or null if the needle
 * is not inside any `@layer … {` block.
 */
function enclosingLayerOf(source: string, needle: string): string | null {
  const at = source.indexOf(needle)
  if (at === -1) return null
  const before = source.slice(0, at)
  const opener = before.lastIndexOf('@layer ')
  if (opener === -1) return null
  // Grab the params up to the opening brace.
  const after = source.slice(opener + '@layer '.length)
  const brace = after.indexOf('{')
  if (brace === -1) return null
  return after.slice(0, brace).trim()
}

describe('CSS cascade layers (#267/#268)', () => {
  it('built design-system.css exists and is non-trivial', () => {
    expect(css.length).toBeGreaterThan(10_000)
  })

  it('OPENS with the seven-layer order statement, in order (whitespace tolerant)', () => {
    expect(css).toMatch(
      /^@layer\s+app-reset\s*,\s*ll\.reset\s*,\s*ll\.tokens\s*,\s*ll\.base\s*,\s*ll\.components\s*,\s*ll\.utilities\s*,\s*app\s*;/,
    )
  })

  it('contains all seven documented layer names (anti-drift: docs <-> build)', () => {
    const missing = SEVEN_LAYERS.filter((name) => !css.includes(name))
    expect(
      missing,
      `\nThese documented layer names are absent from dist/design-system.css — ` +
        `the docs (README + reference/css-layers.md) would be lying:\n` +
        missing.map((m) => `  - ${m}`).join('\n') +
        '\n',
    ).toEqual([])
  })

  it('positions app-reset before and app after the five DS layers (#13)', () => {
    // The opening statement is the single source of truth for relative order —
    // re-derive each layer's index within it rather than trusting substring
    // presence alone (which the previous test already covers).
    const statement = css.match(/^@layer\s+([^;]+);/)?.[1] ?? ''
    const order = statement.split(',').map((s) => s.trim())
    expect(order).toEqual([...SEVEN_LAYERS])
  })

  it('wraps every *.module.css in @layer ll.components (floor on wrap count)', () => {
    const wrapCount = (css.match(/@layer ll\.components\s*\{/g) ?? []).length
    // There are ~74 component modules today; keep a floor so a broken/disabled
    // plugin (which would drop the wrappers entirely) fails loudly. New modules
    // only push this number up.
    expect(wrapCount).toBeGreaterThanOrEqual(70)
  })

  it('places Button module rules inside ll.components (override-precedence proof)', () => {
    // The presence of a Button scoped class inside ll.components is exactly what
    // lets a consumer beat it with unlayered CSS and no !important.
    expect(enclosingLayerOf(css, '.Button-module_button_')).toBe('ll.components')
  })

  it('maps base stylesheets to their layers and does NOT double-wrap them', () => {
    // Tokens live in ll.tokens (custom properties on :root), NOT ll.components.
    expect(enclosingLayerOf(css, ':root{--color-ocean-lightest')).toBe('ll.tokens')
    // The box-sizing reset lives in ll.reset.
    expect(enclosingLayerOf(css, 'box-sizing:border-box')).toBe('ll.reset')
    // DS utility classes live in ll.utilities.
    expect(enclosingLayerOf(css, '.container{')).toBe('ll.utilities')
  })

  it('does not wrap token/reset/utility rules inside ll.components', () => {
    // Negative guard against the plugin over-reaching onto the base files.
    expect(enclosingLayerOf(css, ':root{--color-ocean-lightest')).not.toBe('ll.components')
    expect(enclosingLayerOf(css, 'box-sizing:border-box')).not.toBe('ll.components')
    expect(enclosingLayerOf(css, '.container{')).not.toBe('ll.components')
  })
})
