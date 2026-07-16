#!/usr/bin/env node
/**
 * emit-component-shims.mjs (issue #283)
 *
 * Emits a flat re-export shim `dist/components/<Name>.{js,cjs,d.ts}` for every
 * component barrel, so the CLEAN per-component specifier resolves the FULL barrel:
 *
 *     import { Card, CardBody } from '@lando-labs/lando-ds/components/Card'
 *
 * WHY
 * ---
 * v0.22.0 (#276) shipped deep imports via the tree-mirror wildcard
 * `"./components/*": "./dist/components/*.js"`. That serves the `<Dir>/<Module>`
 * form (`components/Card/CardBody` → `dist/components/Card/CardBody.js`) but NOT
 * the cleaner single-segment `components/Card`, because `dist/components/Card.js`
 * (a flat file beside the `Card/` dir) didn't exist.
 *
 * This script creates exactly that flat file as a one-line re-export of the real
 * per-component barrel `dist/components/<Name>/index.js` (which the build now
 * emits — see the entry list in vite.config.ts). Because it re-exports the
 * Rollup-built barrel via `export *`, it faithfully carries every export shape —
 * including the tricky ones (`DataTable.Static` namespace, `Icon`'s lucide-react
 * re-exports) — with zero hand-reconstruction.
 *
 * ADDITIVE / NON-BREAKING
 * -----------------------
 * The existing `"./components/*"` mapping is UNCHANGED. It now resolves BOTH:
 *   - `components/Card`         → `dist/components/Card.js`         (this shim)
 *   - `components/Card/CardBody`→ `dist/components/Card/CardBody.js`(v0.22.0, intact)
 * A flat `dist/components/<Name>.js` file and the `dist/components/<Name>/` dir
 * coexist without collision.
 *
 * ORDER: must run AFTER `vite build` (needs `dist/components/<Name>/index.js`).
 * Wired into the `build` npm script. Fails loudly if the barrels are missing.
 */

import { readdirSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const COMPONENTS_DIST = resolve(REPO_ROOT, 'dist/components')

if (!existsSync(COMPONENTS_DIST)) {
  console.error(
    `[emit-component-shims] FAILED — ${COMPONENTS_DIST} not found. ` +
      `Run this AFTER 'vite build' (check the 'build' npm script ordering).`,
  )
  process.exit(1)
}

/** Component dirs that have a real emitted barrel `<Name>/index.js`. */
const dirs = readdirSync(COMPONENTS_DIST, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => existsSync(join(COMPONENTS_DIST, name, 'index.js')))
  .sort()

let written = 0
for (const name of dirs) {
  // ESM: tree-shakeable named re-export of the whole barrel.
  writeFileSync(join(COMPONENTS_DIST, `${name}.js`), `export * from './${name}/index.js';\n`)
  // CJS: re-expose the barrel's module.exports object verbatim (named exports +
  // the esModule/toStringTag markers the Rollup barrel already sets).
  writeFileSync(join(COMPONENTS_DIST, `${name}.cjs`), `module.exports = require('./${name}/index.cjs');\n`)
  // Types: re-export the collapsed barrel's `.d.ts` (value + type members).
  writeFileSync(join(COMPONENTS_DIST, `${name}.d.ts`), `export * from './${name}/index';\n`)
  written++
}

// Sanity: the tree has ~96 component barrels; a big shortfall means the barrel
// entries didn't emit (a vite.config regression) — fail rather than ship a
// half-populated clean-specifier surface.
if (written < 90) {
  console.error(
    `[emit-component-shims] FAILED — only ${written} barrels found (expected ~96). ` +
      `Did the per-component entries drop out of vite.config.ts?`,
  )
  process.exit(1)
}

console.log(
  `[emit-component-shims] wrote ${written} flat component shims ` +
    `(.js/.cjs/.d.ts) — clean './components/<Name>' specifier now resolves the full barrel.`,
)
