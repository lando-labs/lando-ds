// @vitest-environment node

/**
 * Unlayered escape-hatch bundle guard (issue #462).
 *
 * The DS ships its default CSS inside named cascade layers (see
 * src/test/css-layers.test.ts). That layer contract has a sharp edge: a
 * consumer's UNLAYERED reset (`* { margin: 0; padding: 0 }`) beats the layered
 * DS component spacing and zeroes it out. For consumers who can't control their
 * global reset (or need Tailwind coexistence), the build emits an OPT-IN
 * flattened bundle `dist/styles.unlayered.css` — the exact same rules with every
 * `@layer` wrapper stripped, so ordinary specificity + source order apply again.
 *
 * This test locks that asset against the *built* artifacts so it cannot silently
 * regress:
 *
 *   1. dist/styles.unlayered.css EXISTS.
 *   2. It contains ZERO `@layer` — the whole point of the escape hatch. Both the
 *      bare order statement (`@layer a, b;`) and every `@layer NAME { … }` block
 *      must be gone.
 *   3. It's within ~10% of the layered bundle's byte size — the transform only
 *      removes layer scaffolding, so NOTHING (no rules/declarations) is dropped.
 *   4. A known component selector's padding survives: a `.Button-module_…`
 *      rule with a `padding` declaration is still present (proves real CSS was
 *      hoisted out of the layers, not discarded).
 *
 * Self-contained: CI runs `npm test` BEFORE `npm run build`, so the dist
 * artifacts may be absent/stale. We build on-demand in `beforeAll` when the
 * layered bundle is missing, then run the (cheap) emitter to (re)produce the
 * unlayered file — mirroring css-layers.test.ts.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const LAYERED_CSS = resolve(REPO_ROOT, 'dist/design-system.css')
const UNLAYERED_CSS = resolve(REPO_ROOT, 'dist/styles.unlayered.css')

let layered = ''
let unlayered = ''

beforeAll(() => {
  // Ensure the source layered bundle exists (full build if missing). This also
  // emits dist/styles.unlayered.css, since the emitter is wired into `build`.
  if (!existsSync(LAYERED_CSS)) {
    execSync('npm run build', { cwd: REPO_ROOT, stdio: 'inherit' })
  }
  // Belt-and-suspenders: if only the unlayered asset is missing (partial/older
  // dist), regenerate it from the existing layered bundle — a cheap postcss
  // pass, no full vite rebuild.
  if (!existsSync(UNLAYERED_CSS)) {
    execSync('node scripts/emit-unlayered-css.mjs', { cwd: REPO_ROOT, stdio: 'inherit' })
  }
  layered = readFileSync(LAYERED_CSS, 'utf-8')
  unlayered = readFileSync(UNLAYERED_CSS, 'utf-8')
}, 180_000)

describe('unlayered escape-hatch bundle (#462)', () => {
  it('emits dist/styles.unlayered.css', () => {
    expect(existsSync(UNLAYERED_CSS)).toBe(true)
    expect(unlayered.length).toBeGreaterThan(10_000)
  })

  it('contains ZERO @layer (statements AND block wrappers all stripped)', () => {
    // Sanity: the layered source we transformed actually HAD layers, so a zero
    // here means the strip worked — not that the input was already flat.
    expect(layered).toContain('@layer')
    expect(unlayered.includes('@layer')).toBe(false)
    expect((unlayered.match(/@layer/g) ?? []).length).toBe(0)
  })

  it('is within ~10% of the layered bundle size (nothing dropped)', () => {
    // Removing only `@layer …{` wrappers + the order statement makes the file
    // marginally SMALLER (a few KB). A large delta would mean rules went
    // missing (or got duplicated) — fail loudly either way.
    const delta = Math.abs(layered.length - unlayered.length) / layered.length
    expect(
      delta,
      `unlayered (${unlayered.length}B) vs layered (${layered.length}B) differ by ` +
        `${(delta * 100).toFixed(1)}% — expected <10%; the strip should only remove ` +
        `layer scaffolding, not rules.`,
    ).toBeLessThan(0.1)
  })

  it('preserves a known component padding declaration (Button)', () => {
    // Hash suffix is not stable across builds, so match the module prefix + a
    // padding declaration inside the rule rather than a literal class name.
    expect(unlayered).toMatch(/\.Button-module_[A-Za-z0-9_]+\{[^}]*padding[^}]*\}/)
  })
})
