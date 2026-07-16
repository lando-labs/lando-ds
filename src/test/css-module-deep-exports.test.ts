// @vitest-environment node

/**
 * CSS-module deep-export guard (#427 — Tier-1 claims enforcement).
 *
 * THE CLAIM
 * ---------
 * The v0.22.0 deep-export contract (`reference/rsc-boundary-matrix.md:157-165`,
 * #276) + the "deep CSS-Module exports" layer of the DS customizability promise
 * (memory "full-customizability"):
 *
 *   "adding a `./components/*` wildcard to `package.json#exports` that maps each
 *    per-module file (types + ESM + CJS)"
 *
 * so a consumer can deep-import a single component
 * (`@lando-labs/lando-ds/components/<Dir>/<Module>`) and get exactly that
 * component AND its co-located CSS module — nothing else.
 *
 * There is NO existing test covering "every component's `.module.css` is emitted
 * as a deep import" (grep of src/test confirmed) — css-layers.test.ts only
 * checks the `@layer` WRAPPING of the flattened bundle, not the per-module
 * emission. This guard fills that gap in two parts, keyed off the barrel
 * (`src/components/index.ts`) as the acceptance criterion requests:
 *
 *   (A) DEEP-IMPORT REACHABILITY — `package.json#exports` carries the
 *       `./components/*` wildcard (types+import+require), AND every component the
 *       barrel names emits a deep entry point (`dist/components/<Dir>/<Dir>.js`
 *       + `<Dir>.d.ts`). Removing the wildcard, or a build that stops emitting
 *       per-component entries, fails here.
 *
 *   (B) DEEP CSS-MODULE EXPORTS — every `src/components/**\/*.module.css` has a
 *       matching emitted `dist/components/**\/*.module.css.js` (+ `.cjs`). This
 *       is the CSS half of the deep-import: the scoped class map ships alongside
 *       the component so a deep import is self-contained.
 *
 * Self-contained: CI runs `npm test` BEFORE `npm run build`, so the dist
 * artifact may be absent. We build on-demand in `beforeAll` (mirrors
 * css-layers.test.ts), then read the emitted tree.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const COMPONENTS_DIR = resolve(REPO_ROOT, 'src/components')
const DIST = resolve(REPO_ROOT, 'dist')
const DIST_COMPONENTS = resolve(DIST, 'components')
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8'))

/** Distinct `./Dir` targets referenced by the components barrel. */
function barrelDirs(): string[] {
  const src = readFileSync(join(COMPONENTS_DIR, 'index.ts'), 'utf-8')
  const set = new Set<string>()
  for (const m of src.matchAll(/from '\.\/([A-Za-z0-9]+)'/g)) set.add(m[1]!)
  return [...set].sort()
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

/** src `…/components/Foo/Foo.module.css` → dist `…/components/Foo/Foo.module.css.js`. */
function expectedDistCssModule(srcCss: string, ext: 'js' | 'cjs'): string {
  const rel = relative(COMPONENTS_DIR, srcCss) // Foo/Foo.module.css
  return join(DIST_COMPONENTS, `${rel}.${ext}`)
}

beforeAll(() => {
  if (!existsSync(DIST_COMPONENTS) || !existsSync(join(DIST, 'index.js'))) {
    execSync('npm run build', { cwd: REPO_ROOT, stdio: 'inherit' })
  }
}, 180_000)

describe('deep-import reachability (#427 · rsc-boundary-matrix.md:157-165)', () => {
  it('package.json#exports carries the ./components/* wildcard (types+import+require)', () => {
    const wildcard = PKG.exports?.['./components/*']
    expect(
      wildcard,
      `\npackage.json#exports must expose "./components/*" so every component is ` +
        `deep-importable (the v0.22.0 contract, rsc-boundary-matrix.md:157-165).\n`,
    ).toBeTruthy()
    expect(wildcard.types).toBe('./dist/components/*.d.ts')
    expect(wildcard.import).toBe('./dist/components/*.js')
    expect(wildcard.require).toBe('./dist/components/*.cjs')
  })

  it('every barrel component emits a deep entry point (<Dir>.js + <Dir>.d.ts)', () => {
    const dirs = barrelDirs()
    expect(dirs.length).toBeGreaterThan(80)
    const missing: string[] = []
    for (const dir of dirs) {
      const js = join(DIST_COMPONENTS, dir, `${dir}.js`)
      const dts = join(DIST_COMPONENTS, dir, `${dir}.d.ts`)
      if (!existsSync(js)) missing.push(`  ${dir}: missing dist/components/${dir}/${dir}.js`)
      if (!existsSync(dts)) missing.push(`  ${dir}: missing dist/components/${dir}/${dir}.d.ts`)
    }
    expect(
      missing,
      `\nBarrel components without a deep entry point — the deep-import path ` +
        `(rsc-boundary-matrix.md:157-165) is broken for them:\n${missing.join('\n')}\n`,
    ).toEqual([])
  })
})

describe('deep CSS-module exports (#427 · v0.22.0 "deep CSS-Module exports" layer)', () => {
  const moduleCss = collectModuleCss(COMPONENTS_DIR).sort()

  it('finds a healthy number of component CSS modules (sanity)', () => {
    // If this collapses to ~0 the sweep below would be silently inert.
    expect(moduleCss.length).toBeGreaterThan(70)
  })

  it('every src `*.module.css` is emitted as a deep ESM + CJS export', () => {
    const missing: string[] = []
    for (const srcCss of moduleCss) {
      const rel = relative(COMPONENTS_DIR, srcCss).split('\\').join('/')
      const jsOut = expectedDistCssModule(srcCss, 'js')
      const cjsOut = expectedDistCssModule(srcCss, 'cjs')
      if (!existsSync(jsOut)) missing.push(`  ${rel} → missing ${relative(REPO_ROOT, jsOut)}`)
      if (!existsSync(cjsOut)) missing.push(`  ${rel} → missing ${relative(REPO_ROOT, cjsOut)}`)
    }
    expect(
      missing,
      `\nCSS modules not emitted as deep exports — a deep component import would ` +
        `ship without its scoped class map (#427 "deep CSS-Module exports"):\n${missing.join('\n')}\n`,
    ).toEqual([])
  })

  it('mapper is non-vacuous — locates a real export and rejects a phantom one', () => {
    // Positive: a known css-bearing component's deep CSS export exists.
    expect(existsSync(join(DIST_COMPONENTS, 'Button', 'Button.module.css.js'))).toBe(true)
    // Inversion: the existence check can actually be FALSE — a phantom source
    // path maps to a dist path that does not exist, so the sweep above isn't
    // vacuously green.
    const phantom = expectedDistCssModule(
      join(COMPONENTS_DIR, '__DoesNotExist__', '__DoesNotExist__.module.css'),
      'js',
    )
    expect(existsSync(phantom)).toBe(false)
  })
})
