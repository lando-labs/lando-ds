// @vitest-environment node

/**
 * Static `dist/theme-init.js` contract (#80 — canonical themeScript packaging).
 *
 * THE FEATURE
 * -----------
 * The DS build emits `dist/theme-init.js`: the `themeScript()` body as a
 * standalone file a consumer loads via `<script src>` (the warning-free
 * anti-flash path for Next.js App Router + React 19, vs. inlining via
 * `dangerouslySetInnerHTML`). Emission lives in `scripts/emit-theme-init.mjs`
 * and the file is exposed at the `./theme-init.js` export subpath, resolvable
 * via the `themeScriptPath` const.
 *
 * WHY THESE GUARDS
 * ----------------
 * The static file must NEVER drift from the runtime `themeScript()`. The emitter
 * guarantees that structurally (it imports and calls the live compiled function
 * — there is no second copy of the body). These tests pin the surrounding
 * contract so a refactor can't quietly defeat that:
 *
 *   1. SOURCE CONTRACT — `themeScript()` returns a bare IIFE (no `<script>`
 *      wrapper). A `<script src>` file executes its content verbatim, so a
 *      wrapped tag would be a broken artifact. If someone changes the default
 *      return to a wrapped tag, this fails.
 *   2. EXPORT WIRING — `themeScriptPath`, the package.json `exports` entry, and
 *      the `build` script's emitter invocation. If someone drops the emitter
 *      from the build or breaks the export subpath, this fails.
 *   3. ZERO-DRIFT (dist-guarded) — when `dist/theme-init.js` exists, its body is
 *      byte-identical to `themeScript()`. Runs after any build (local `npm run
 *      build`, and CI where `npm ci` → `prepare` → `build` produces `dist/`
 *      before the test step); skips only when no build has run yet, so it never
 *      hard-fails a pristine checkout.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { themeScript, themeScriptPath } from '../utils/themeScript'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8'))
const DIST_FILE = resolve(REPO_ROOT, 'dist/theme-init.js')

describe('static theme-init.js contract (#80)', () => {
  describe('1. source contract — themeScript() is a bare, src-loadable IIFE', () => {
    it('returns a non-empty bare IIFE body (no <script> wrapper)', () => {
      const body = themeScript()
      expect(typeof body).toBe('string')
      expect(body.length).toBeGreaterThan(0)
      expect(body.startsWith('(function()')).toBe(true)
      // A <script src> file must NOT contain a wrapping tag — that is the
      // nonce path (`themeScript({ nonce })`), which is inline-only.
      expect(body).not.toContain('<script')
    })

    it('the nonce variant IS wrapped — proving the default is deliberately bare', () => {
      // Non-vacuous companion: the same function CAN return a wrapped tag, so
      // the bare-ness of the default above is a real, tested choice.
      const tag = themeScript({ nonce: 'abc123' })
      expect(tag.startsWith('<script')).toBe(true)
      expect(tag).toContain('nonce="abc123"')
    })
  })

  describe('2. export wiring — path, exports map, and build step', () => {
    it('themeScriptPath is the resolvable ./theme-init.js specifier', () => {
      expect(themeScriptPath).toBe('@lando-labs/lando-ds/theme-init.js')
    })

    it('package.json exports "./theme-init.js" → the built dist file', () => {
      expect(PKG.exports['./theme-init.js']).toBe('./dist/theme-init.js')
    })

    it('the export subpath matches the themeScriptPath const (no drift between them)', () => {
      // themeScriptPath must equal "<pkg name>/<exports subpath, minus ./>".
      const subpath = Object.keys(PKG.exports).find((k) => k === './theme-init.js')
      expect(subpath).toBeTruthy()
      expect(`${PKG.name}/${subpath!.replace(/^\.\//, '')}`).toBe(themeScriptPath)
    })

    it('the build script emits the static file (emitter is wired in)', () => {
      // If the emitter is dropped from `build`, dist/theme-init.js silently
      // stops shipping while the export still points at it → 404 for consumers.
      expect(PKG.scripts.build).toContain('scripts/emit-theme-init.mjs')
    })
  })

  describe('3. zero-drift — emitted file equals themeScript() (dist-guarded)', () => {
    const hasDist = existsSync(DIST_FILE)

    it.skipIf(!hasDist)('dist/theme-init.js body is byte-identical to themeScript()', () => {
      const file = readFileSync(DIST_FILE, 'utf-8')
      // Strip the generated header block comment + trailing newline the emitter adds.
      const fileBody = file.replace(/^\/\*![\s\S]*?\*\/\n/, '').replace(/\n$/, '')
      expect(fileBody).toBe(themeScript())
    })

    it.skipIf(!hasDist)('dist/theme-init.js is executable-as-is (bare IIFE, no wrapper)', () => {
      const file = readFileSync(DIST_FILE, 'utf-8')
      expect(file).toContain('(function()')
      expect(file).not.toContain('<script')
    })
  })
})
