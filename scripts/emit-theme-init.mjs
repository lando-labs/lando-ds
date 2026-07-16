#!/usr/bin/env node
/**
 * emit-theme-init.mjs (issue #80)
 *
 * Emits the pre-built static anti-flash script `dist/theme-init.js`.
 *
 * WHY
 * ---
 * The DS exports `themeScript()` as a *string* for inline injection via
 * `<script dangerouslySetInnerHTML={{ __html: themeScript() }}>`. In Next.js 15/16
 * App Router with React 19, rendering that inline `<script>` in the RSC tree
 * fires React's "Encountered a script tag while rendering" dev warning on every
 * client navigation. The warning-free path is a real `<script src="/…">` that
 * points at a STATIC file (warns once at hydration, never on nav) — but that
 * forced consumers to hand-copy the DS's script body into their own
 * `public/theme-init.js`, a copy that silently drifts from the DS internals.
 *
 * This script ships that static file AS PART OF THE DS BUILD so consumers
 * reference the DS artifact instead of maintaining a copy. See
 * `reference/integrating-with-nextjs.md` and the `themeScriptPath` export.
 *
 * ZERO DRIFT BY CONSTRUCTION
 * --------------------------
 * The file content is produced by importing the SAME compiled `themeScript`
 * the runtime ships and calling it — there is no second copy of the script body
 * to fall out of sync. `themeScript()` (no options) returns the bare IIFE body,
 * which is exactly what a `<script src>` executes. The `{ nonce }` and
 * `{ defaultPreset }` options are inline-only (per-consumer, per-request) and so
 * do not apply to a single static artifact; the persisted-state replay (mode +
 * persisted preset attribute + persisted product-theme `--color-*` vars) that
 * fixes the reload-FOUC is fully covered by the base body.
 *
 * ORDER: must run AFTER `vite build` (needs `dist/utils/themeScript.js`). Wired
 * into the `build` npm script. Fails loudly if the compiled module is missing
 * or its output doesn't look like the expected IIFE.
 */

import { writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const THEME_SCRIPT_MODULE = resolve(REPO_ROOT, 'dist/utils/themeScript.js')
const OUT_FILE = resolve(REPO_ROOT, 'dist/theme-init.js')

if (!existsSync(THEME_SCRIPT_MODULE)) {
  console.error(
    `[emit-theme-init] FAILED — ${THEME_SCRIPT_MODULE} not found. ` +
      `This script must run AFTER 'vite build' (it imports the compiled ` +
      `themeScript). Check the 'build' npm script ordering.`,
  )
  process.exit(1)
}

// Import the REAL compiled themeScript and call it — the single source of truth.
const { themeScript } = await import(pathToFileURL(THEME_SCRIPT_MODULE).href)

if (typeof themeScript !== 'function') {
  console.error(
    `[emit-theme-init] FAILED — 'themeScript' is not a function in the ` +
      `compiled module. The export shape changed; update this emitter.`,
  )
  process.exit(1)
}

// No options → the bare IIFE body (no <script> wrapper), which is what a
// `<script src="/theme-init.js">` executes verbatim.
const body = themeScript()

// Hard guard: a static file loaded via <script src> must be executable as-is —
// a bare IIFE, never a wrapped `<script>…</script>` tag (that would be the
// nonce path) and never empty.
if (typeof body !== 'string' || !body.startsWith('(function()') || body.includes('<script')) {
  console.error(
    `[emit-theme-init] FAILED — themeScript() did not return a bare IIFE body ` +
      `(got ${body?.length ?? 0} chars, startsWith='${String(body).slice(0, 20)}'). ` +
      `A static <script src> file must contain the unwrapped script body.`,
  )
  process.exit(1)
}

// Header is angle-bracket-free on purpose: no `<script`/`</script>` literal in
// the artifact, so it can't break out if a consumer ever inlines it by mistake,
// and the "no wrapper tag" test can assert over the whole file.
const header =
  `/*! @lando-labs/lando-ds — theme-init.js (generated, do not edit).\n` +
  ` * Pre-hydration anti-flash script. Load it as an EXTERNAL script (script[src])\n` +
  ` * BEFORE hydration — e.g. Next.js: next/script with strategy="beforeInteractive"\n` +
  ` * pointing at this file copied into /public. Generated from the DS themeScript()\n` +
  ` * export by scripts/emit-theme-init.mjs so it can never drift from the runtime.\n` +
  ` * See reference/integrating-with-nextjs.md. */\n`

const output = `${header}${body}\n`

// Whole-artifact invariant: no `<script`/`</script>` literal anywhere (body OR
// header). Keeps the file safe if a consumer ever inlines it by mistake, and
// pins the header rewrite above against regressions.
if (output.includes('<script') || output.includes('</script')) {
  console.error(
    `[emit-theme-init] FAILED — output contains a '<script' literal (likely a ` +
      `header edit). A static script[src] artifact must have no tag literal.`,
  )
  process.exit(1)
}

writeFileSync(OUT_FILE, output, 'utf8')

const kb = (n) => `${(n / 1024).toFixed(1)} kB`
console.log(
  `[emit-theme-init] wrote dist/theme-init.js (${kb(output.length)}, ` +
    `from the live themeScript() export — zero-drift).`,
)
