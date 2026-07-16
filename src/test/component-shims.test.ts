// @vitest-environment node

/**
 * Per-component flat-shim contract (#283 — clean `./components/<Name>` specifier).
 *
 * THE FEATURE
 * -----------
 * `components/Card` (single segment) should resolve the FULL Card barrel, not
 * force `components/Card/Card`. The build emits each component's real barrel at
 * `dist/components/<Name>/index.js` (forced via the vite.config entry list) and
 * `scripts/emit-component-shims.mjs` writes a flat `dist/components/<Name>.{js,cjs,d.ts}`
 * re-export beside the dir. The existing `./components/*` export map entry then
 * serves the clean form, WITHOUT breaking the v0.22.0 `<Dir>/<Module>` deep form.
 *
 * WHY THESE GUARDS
 * ----------------
 *   1. WIRING (always) — the two build-time mechanisms (barrel entries in
 *      vite.config, the emitter in the `build` script) and the unchanged export
 *      map. If someone drops either mechanism, the clean specifier silently
 *      stops shipping while the export map still points at it → 404 for consumers.
 *   2. SHIM SHAPE (dist-guarded) — every component barrel has all three flat
 *      shims and each is the expected one-line re-export of `./<Name>/index`.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8'))
const VITE_CONFIG = readFileSync(resolve(REPO_ROOT, 'vite.config.ts'), 'utf-8')
const COMPONENTS_DIST = resolve(REPO_ROOT, 'dist/components')
const SRC_COMPONENTS = resolve(REPO_ROOT, 'src/components')

/** Source component dirs that publish a barrel. */
function barrelDirs(): string[] {
  return readdirSync(SRC_COMPONENTS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(SRC_COMPONENTS, e.name, 'index.ts')))
    .map((e) => e.name)
    .sort()
}

describe('per-component flat shims (#283)', () => {
  describe('1. build wiring', () => {
    it('vite.config forces per-component barrel emission (entry glob present)', () => {
      // The mechanism that makes dist/components/<Name>/index.js exist.
      expect(VITE_CONFIG).toMatch(/readdirSync\([^)]*['"`]src\/components['"`]?[\s\S]*?components\/\$\{[\w.]+\}\/index/)
    })

    it('the build script runs the shim emitter', () => {
      expect(PKG.scripts.build).toContain('scripts/emit-component-shims.mjs')
    })

    it('the ./components/* export map is unchanged (serves both clean + deep forms)', () => {
      // Unchanged from v0.22.0: single-segment hits the flat shim, multi-segment
      // hits the deep module — both via `*.js`/`*.cjs`/`*.d.ts`.
      expect(PKG.exports['./components/*']).toEqual({
        types: './dist/components/*.d.ts',
        import: './dist/components/*.js',
        require: './dist/components/*.cjs',
      })
    })
  })

  describe('2. emitted shim shape (dist-guarded)', () => {
    const hasDist = existsSync(COMPONENTS_DIST)
    const dirs = barrelDirs()

    it('sanity: found the component barrels', () => {
      expect(dirs.length).toBeGreaterThan(90)
    })

    it.skipIf(!hasDist)('every component barrel has flat .js/.cjs/.d.ts shims that re-export ./<Name>/index', () => {
      const missing: string[] = []
      const wrongContent: string[] = []
      for (const name of dirs) {
        const js = join(COMPONENTS_DIST, `${name}.js`)
        const cjs = join(COMPONENTS_DIST, `${name}.cjs`)
        const dts = join(COMPONENTS_DIST, `${name}.d.ts`)
        for (const f of [js, cjs, dts]) if (!existsSync(f)) missing.push(f)
        if (existsSync(js) && !readFileSync(js, 'utf-8').includes(`export * from './${name}/index.js'`))
          wrongContent.push(js)
        if (existsSync(cjs) && !readFileSync(cjs, 'utf-8').includes(`require('./${name}/index.cjs')`))
          wrongContent.push(cjs)
        if (existsSync(dts) && !readFileSync(dts, 'utf-8').includes(`export * from './${name}/index'`))
          wrongContent.push(dts)
      }
      expect(missing, `missing flat shims:\n  ${missing.join('\n  ')}`).toEqual([])
      expect(wrongContent, `unexpected shim content:\n  ${wrongContent.join('\n  ')}`).toEqual([])
    })

    it.skipIf(!hasDist)('the flat shim sits BESIDE the deep dir (both forms coexist)', () => {
      // Clean `components/Card` (flat file) and deep `components/Card/CardBody`
      // (dir module) both resolvable — the whole point.
      expect(existsSync(join(COMPONENTS_DIST, 'Card.js'))).toBe(true)
      expect(existsSync(join(COMPONENTS_DIST, 'Card', 'CardBody.js'))).toBe(true)
    })
  })
})
