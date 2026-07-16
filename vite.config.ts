import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import preserveDirectives from 'rollup-plugin-preserve-directives'
import { resolve } from 'path'
import fs from 'fs'
import type { Plugin as PostcssPlugin } from 'postcss'

// #468 — single source of truth for the published VERSION constant. Read the
// real version from package.json at config-eval time and inline it via `define`
// (below) so `src/index.ts`'s `export const VERSION = __DS_VERSION__` compiles
// to the real value in the built bundle. Replaces the stale hardcoded '0.1.0'.
const pkg = JSON.parse(
  fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string }

/**
 * CSS cascade-layer wrapper for component modules (#267).
 *
 * Wraps the compiled output of every `*.module.css` file in
 * `@layer ll.components { … }`. With the layer ORDER declared first in the
 * bundle (`@layer ll.reset, ll.tokens, ll.base, ll.components, ll.utilities;`
 * prepended to src/styles/index.css), this guarantees:
 *
 *   - DS component rules live in the LOW-priority `ll.components` layer, so a
 *     consumer's *unlayered* CSS (e.g. `.foo { background: red }` on a
 *     `<Button className="foo">`) always wins WITHOUT `!important` or relying on
 *     stylesheet load order. Unlayered styles outrank every named layer.
 *   - DS base/reset/tokens/utilities are mapped to their own layers by hand in
 *     src/styles/tokens.css + global.css, so they too sit below consumer CSS
 *     and in a deterministic order relative to components.
 *
 * Scope: ONLY `*.module.css`. The base stylesheets (tokens.css, global.css,
 * fonts.css, index.css) carry hand-authored `@layer` blocks and must NOT be
 * wrapped here — wrapping them would nest their `ll.reset`/`ll.tokens`/… rules
 * inside `ll.components`, collapsing the taxonomy. We also guard against
 * double-wrapping (idempotent if the file already opens with an `@layer`
 * statement that references our component layer).
 *
 * Why a PostCSS plugin (not a manual `@layer` in each module file): there are
 * ~74 component modules today and the set grows. Wrapping at build time means a
 * brand-new `Foo.module.css` is layered automatically with zero ceremony, and
 * the CSS-Modules scoped-class hashing still runs (this plugin appends AFTER
 * vite's css.modules transform, operating on already-scoped selectors).
 */
const COMPONENT_LAYER = 'll.components'

function wrapModulesInComponentLayer(): PostcssPlugin {
  return {
    postcssPlugin: 'll-wrap-module-in-component-layer',
    // `OnceExit` runs after all other plugins have processed the AST for this
    // file, so the CSS-Modules selector rewriting is already applied.
    OnceExit(root, { AtRule }) {
      const from = root.source?.input.file ?? ''
      // Only target CSS-Module files. Vite compiles `*.module.css` through the
      // same PostCSS pipeline; the base stylesheets are NOT modules.
      if (!/\.module\.css$/.test(from)) return

      // Idempotency guard: if this file's output already lives inside our
      // component layer (e.g. plugin ran twice, or a future hand-authored
      // `@layer ll.components`), do nothing.
      let alreadyWrapped = false
      root.walkAtRules('layer', (at) => {
        if (at.params.split(',').some((p) => p.trim() === COMPONENT_LAYER)) {
          alreadyWrapped = true
        }
      })
      if (alreadyWrapped) return

      // Move every existing node into a new `@layer ll.components { … }` block.
      const layer = new AtRule({ name: 'layer', params: COMPONENT_LAYER })
      layer.append(root.nodes)
      root.removeAll()
      root.append(layer)
    },
  }
}
wrapModulesInComponentLayer.postcss = true

// Shared CSS config — applied in BOTH the library build and the dev showcase so
// the showcase renders with the exact same layering as the published bundle
// (critical for the maintainer's priority-inversion visual check).
const cssConfig = {
  modules: {
    scopeBehaviour: 'local' as const,
    generateScopedName: '[name]_[local]_[hash:base64:5]',
  },
  postcss: {
    plugins: [wrapModulesInComponentLayer()],
  },
  preprocessorOptions: {
    css: {
      // Ensure global styles like :root are preserved
      charset: false,
    },
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isLibrary = mode === 'library'

  return {
    // #468 — inline the real package.json version wherever `__DS_VERSION__`
    // appears (src/index.ts). Top-level so it applies to every mode/build.
    define: {
      __DS_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      ...(isLibrary
        ? [
            dts({
              include: ['src/**/*.ts', 'src/**/*.tsx'],
              // #322 — also exclude unit tests + the test dir so no test
              // scaffolding (`*.test.ts`, `src/test/**`) emits `.d.ts` into dist.
              exclude: ['src/**/*.stories.tsx', 'src/**/*.test.tsx', 'src/**/*.test.ts', 'src/test/**'],
              // After emitting per-module .d.ts files, create companion barrel
              // .d.ts files alongside the entry-point JS barrels (components.js,
              // tokens.js, markdown-editor.js). Without these, TypeScript with
              // moduleResolution:bundler resolves e.g. `export * from './components'`
              // in dist/index.d.ts to the JS file rather than the type barrel —
              // causing false "no exported member" errors in consumer apps. (#265 fix)
              afterBuild: () => {
                const distDir = resolve(__dirname, 'dist')
                const barrels: Array<{ file: string; target: string }> = [
                  { file: 'components.d.ts', target: './components/index' },
                  { file: 'tokens.d.ts', target: './tokens/index' },
                  { file: 'hooks.d.ts', target: './hooks/index' },
                  { file: 'markdown-editor.d.ts', target: './components/MarkdownEditor/index' },
                ]
                for (const { file, target } of barrels) {
                  const outPath = resolve(distDir, file)
                  fs.writeFileSync(outPath, `export * from '${target}';\n`)
                }
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@/components': resolve(__dirname, './src/components'),
        '@/tokens': resolve(__dirname, './src/tokens'),
        '@/utils': resolve(__dirname, './src/utils'),
        '@/hooks': resolve(__dirname, './src/hooks'),
        '@/types': resolve(__dirname, './src/types'),
      },
    },
    ...(isLibrary
      ? {
          build: {
            lib: {
              entry: {
                index: resolve(__dirname, 'src/index.ts'),
                tokens: resolve(__dirname, 'src/tokens/index.ts'),
                components: resolve(__dirname, 'src/components/index.ts'),
                // #504 — `/hooks` subpath. The hooks were exported from the root
                // barrel but had no subpath, no meta entry and no docs, so they
                // were effectively invisible: a consumer importing the DS in 77
                // files still hand-rolled its own useFocusTrap. Giving hooks a
                // first-class entry (alongside the meta `hooks` section) is what
                // makes the surface findable.
                hooks: resolve(__dirname, 'src/hooks/index.ts'),
                // #283 — force per-component barrel emission. Rollup collapses a
                // pure re-export `index.ts` under preserveModules, so
                // `dist/components/<Name>/index.js` normally doesn't exist. Adding
                // each barrel as an entry marks it a preserveModules root, so the
                // real (Rollup-correct) barrel is emitted — including the tricky
                // ones (DataTable's `.Static` namespace, Icon's lucide re-exports).
                // `scripts/emit-component-shims.mjs` then wraps each in a flat
                // `dist/components/<Name>.js` shim so `@lando-labs/lando-ds/
                // components/<Name>` resolves the full barrel. Verified additive:
                // this adds only the new index.* files; every pre-existing dist
                // file is byte-identical (0 re-chunking). MarkdownEditor is already
                // an entry via `markdown-editor`, so it's excluded here.
                ...Object.fromEntries(
                  fs
                    .readdirSync(resolve(__dirname, 'src/components'), { withFileTypes: true })
                    .filter(
                      (e) =>
                        e.isDirectory() &&
                        fs.existsSync(resolve(__dirname, `src/components/${e.name}/index.ts`)),
                    )
                    .map((e) => [
                      `components/${e.name}/index`,
                      resolve(__dirname, `src/components/${e.name}/index.ts`),
                    ]),
                ),
                'markdown-editor': resolve(__dirname, 'src/components/MarkdownEditor/index.ts'),
                // #376 — `/icons` subpath: single source of truth for the
                // lucide-react set the DS bundles. Consumers stop importing
                // `lucide-react` directly, eliminating version skew (lab
                // pinned `^1.8.0` vs. DS `^0.548.0`).
                icons: resolve(__dirname, 'src/icons.ts'),
                // #418, #419 — `/meta-schema` subpath: TS types + JSON Schema
                // + Ajv-backed validator for the dist/meta.json artifact.
                // Each release ships a self-describing meta blob; this entry
                // is how consumers (AI agents, build tools) load the schema.
                'meta/index': resolve(__dirname, 'src/meta/index.ts'),
              },
              formats: ['es', 'cjs'],
            },
            rollupOptions: {
              // Preserve per-module `'use client'` directives 1:1 with source.
              // Requires output.preserveModules (set below): each source module
              // emits its own file, so a server-safe leaf carries no directive
              // and renders with zero client JS in an RSC (#265).
              plugins: [preserveDirectives()],
              // Externalize React + heavy/runtime-sensitive deps so the consumer's
              // bundler resolves them. Critical for SSR: e.g. react-markdown's
              // transitive `parse-entities` calls `document.createElement` at
              // module top-level — when we inline that into our library bundle,
              // Next.js App Router crashes during server render. When the consumer
              // imports react-markdown via their own node_modules, their bundler
              // applies the right SSR shimming.
              external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                'lucide-react',
                'react-markdown',
                'remark-gfm',
                'rehype-sanitize',
                /^@uiw\/react-md-editor/,
                /^recharts/,
                // #419 — ajv is a peer of the meta-schema subpath; it is
                // dynamically imported by `validate.ts` only when consumers
                // call `validateMeta()`. Externalizing keeps it OUT of the
                // bundle for consumers that only use the types.
                'ajv',
              ],
              // preserveDirectives() (above) keeps per-module `'use client'`.
              // Suppress Rollup's default "module-level directives are not
              // preserved" warning — the plugin owns preservation.
              onwarn(warning, warn) {
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
                warn(warning)
              },
              output: {
                // Emit one file per source module (mirror of src/) so each
                // module's `'use client'` boundary is preserved independently.
                preserveModules: true,
                preserveModulesRoot: 'src',
                // All public entries export named symbols; the CSS-module proxies
                // emit a default + named, which warns under preserveModules. Pin
                // to named-export interop to silence it (no runtime change).
                exports: 'named',
                globals: {
                  react: 'React',
                  'react-dom': 'ReactDOM',
                  'react/jsx-runtime': 'react/jsx-runtime',
                },
                assetFileNames: (assetInfo) => {
                  // Single bundled stylesheet (cssCodeSplit: false). Vite names it
                  // `style.css` or after the package name; always publish it as the
                  // stable `design-system.css` that package.json `exports` and the
                  // emit-* scripts expect, independent of the package name.
                  if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'design-system.css'
                  return assetInfo.name || ''
                },
              },
            },
            cssCodeSplit: false,
            // #322 — sourcemaps kept ON intentionally: the DS source is OSS
            // (Apache-2.0, public on GitHub), so the maps expose nothing secret, and
            // they let consumers step into DS internals when debugging. The
            // dist no longer ships test `.d.ts` (see the dts exclude above).
            sourcemap: true,
          },
          css: cssConfig,
        }
      : {
          css: cssConfig,
          server: {
            port: 6173,
            open: true,
          },
        }),
  }
})
