#!/usr/bin/env node
/**
 * emit-unlayered-css.mjs (issue #462)
 *
 * Emits the OPT-IN "escape hatch" stylesheet `dist/styles.unlayered.css` from
 * the default layered bundle `dist/design-system.css`.
 *
 * WHY
 * ---
 * The DS ships all CSS inside named cascade layers (`ll.reset` … `ll.utilities`)
 * so a consumer's UNLAYERED CSS overrides DS components with no `!important`.
 * That contract has a sharp edge: an UNLAYERED consumer reset
 * (`* { margin: 0; padding: 0 }`, the create-next-app default) ALSO beats the
 * layered DS component spacing and zeroes it out. The golden-path fix is the
 * layer-order primer (`@lando-labs/lando-ds/layer-order.css`). This file
 * is the ALTERNATIVE for consumers who don't want to manage layer order at all
 * (or who need Tailwind coexistence): the exact same rules with every `@layer`
 * wrapper stripped, so ordinary specificity + source order apply again.
 *
 * WHAT IT DOES (postcss)
 * ----------------------
 *   (a) REMOVE every bare `@layer a, b, c;` STATEMENT at-rule (params, no body).
 *   (b) UNWRAP every `@layer NAME { … }` BLOCK at-rule — hoist its children up
 *       in place, dropping only the wrapper. Runs repeatedly so any nested
 *       layer is unwrapped too. No declarations are added or removed, so the
 *       output is byte-for-byte the same rules minus the layer scaffolding
 *       (a few KB smaller — well within size parity).
 *
 * ORDER: must run AFTER `vite build` (needs dist/design-system.css). Wired into
 * the `build` npm script. Fails loudly if the source bundle is missing.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import postcss from 'postcss'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const SRC_CSS = resolve(REPO_ROOT, 'dist/design-system.css')
const OUT_CSS = resolve(REPO_ROOT, 'dist/styles.unlayered.css')

if (!existsSync(SRC_CSS)) {
  console.error(
    `[emit-unlayered-css] Missing ${SRC_CSS}. Run \`vite build --mode library\` ` +
      `(i.e. \`npm run build\`) first — this step reads the built layered bundle.`,
  )
  process.exit(1)
}

const source = readFileSync(SRC_CSS, 'utf8')

/**
 * postcss plugin: strip cascade layers.
 *   - `@layer a, b;`      (no body)  → remove
 *   - `@layer name { … }` (has body) → replace with its children (unwrap)
 * Iterates until no `@layer` at-rule remains so nested layers flatten too.
 */
const stripLayers = {
  postcssPlugin: 'll-strip-cascade-layers',
  OnceExit(root) {
    let remaining = true
    // Bounded loop: each pass removes/unwraps at least one layer; the guard
    // prevents an infinite loop if a malformed AST ever failed to shrink.
    for (let pass = 0; pass < 100 && remaining; pass++) {
      remaining = false
      root.walkAtRules('layer', (atRule) => {
        remaining = true
        if (atRule.nodes === undefined) {
          // Bare `@layer a, b, c;` statement — no body.
          atRule.remove()
        } else {
          // `@layer NAME { … }` block — hoist children out in place.
          atRule.replaceWith(...atRule.nodes)
        }
      })
    }
  },
}

const result = postcss([stripLayers]).process(source, {
  from: SRC_CSS,
  to: OUT_CSS,
  // Do not emit/inherit a source map: the layered bundle ships none, and the
  // flattened offsets wouldn't line up with design-system.css.map anyway.
  map: false,
})

const output = result.css

// Hard guard: the whole point is ZERO `@layer` in the output.
if (output.includes('@layer')) {
  console.error(
    `[emit-unlayered-css] FAILED — output still contains '@layer'. ` +
      `The strip pass did not remove every layer at-rule.`,
  )
  process.exit(1)
}

writeFileSync(OUT_CSS, output, 'utf8')

const kb = (n) => `${(n / 1024).toFixed(1)} kB`
console.log(
  `[emit-unlayered-css] wrote dist/styles.unlayered.css ` +
    `(${kb(output.length)} from ${kb(source.length)} layered; ` +
    `${(100 - (output.length / source.length) * 100).toFixed(1)}% smaller, 0 @layer).`,
)
