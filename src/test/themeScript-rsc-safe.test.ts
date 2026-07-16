// @vitest-environment node

/**
 * RSC-safety guard for `themeScript` (#384).
 *
 * `themeScript()` is a pure string-producing utility — no React, no browser
 * APIs — and the canonical anti-flash injection point is inside a React
 * Server Component (`<head dangerouslySetInnerHTML={{ __html: themeScript() }} />`).
 *
 * Next.js 16 App Router refuses to call a function exported from a `'use client'`
 * module on the server:
 *
 *   > Attempted to call themeScript() from the server but themeScript is on
 *   > the client.
 *
 * So the file that *implements* `themeScript` (currently `src/utils/themeScript.ts`)
 * MUST NOT carry a `'use client'` directive. This guard reads the source as
 * text and asserts the first non-comment, non-blank line is NOT `'use client'`.
 *
 * If `themeScript` is ever moved or refactored, update `IMPL_FILE` to point at
 * the new module. The public API path (re-exported from `ThemeProvider.tsx`
 * which IS `'use client'`) is a separate concern — `'use client'` re-exports
 * of server-safe symbols are fine; what's NOT fine is implementing the symbol
 * inside a client module.
 *
 * The companion runtime test (`src/utils/ThemeProvider.test.tsx`) covers the
 * function's behavior. This file is a static-text guard only.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { themeScript } from '../utils/ThemeProvider'
import { themeScript as themeScriptDirect } from '../utils/themeScript'

const HERE = dirname(fileURLToPath(import.meta.url))
const IMPL_FILE = resolve(HERE, '../utils/themeScript.ts')

/**
 * Walk `source` line-by-line, skipping leading block comments, line comments,
 * and blank lines, and yield every line that looks like a directive
 * (`'use <ident>'` or `"use <ident>"`, optionally trailing `;`). Stop at the
 * first line that is NOT a directive — the V8 / esbuild / TS rule is that the
 * directive prologue is a *contiguous* prefix of string-literal statements.
 *
 * Returns the trimmed directive lines (with trailing `;` stripped). Used by
 * the RSC-safety guard to defend against a maintainer placing `'use client'`
 * AFTER an unrelated `'use strict'` (or similar) — the first-line check alone
 * would miss it.
 */
function leadingDirectives(source: string): string[] {
  const lines = source.split('\n')
  const directives: string[] = []
  let inBlockComment = false

  for (const raw of lines) {
    let line = raw.trim()

    if (inBlockComment) {
      const end = line.indexOf('*/')
      if (end === -1) continue
      inBlockComment = false
      line = line.slice(end + 2).trim()
      if (line === '') continue
    }

    if (line === '') continue
    if (line.startsWith('//')) continue

    if (line.startsWith('/*')) {
      const end = line.indexOf('*/')
      if (end === -1) {
        inBlockComment = true
        continue
      }
      line = line.slice(end + 2).trim()
      if (line === '') continue
    }

    const trimmed = line.replace(/;$/, '').trim()
    // A directive is a bare string-literal statement matching `'use <ident>'`.
    if (/^['"]use\s+[a-z]+['"]$/i.test(trimmed)) {
      directives.push(trimmed)
      continue
    }

    // First non-directive line of code — the directive prologue is over.
    break
  }

  return directives
}

describe("themeScript implementation is RSC-safe (#384)", () => {
  const src = readFileSync(IMPL_FILE, 'utf-8')

  it("declares no 'use client' directive anywhere in the leading prologue", () => {
    // Post-#384 skeptic (N6) — scan ALL leading directive-shaped lines, not
    // just the first. A maintainer who adds `'use strict'` (or any other
    // directive) above an unrelated `'use client'` would slip past the
    // first-line check; this is belt-and-suspenders.
    const directives = leadingDirectives(src)
    const clientDirective = directives.find(
      (d) => d === "'use client'" || d === '"use client"',
    )
    expect(
      clientDirective,
      `\n${IMPL_FILE} must NOT declare 'use client' anywhere in its directive ` +
        `prologue (the contiguous string-statement prefix). The file must be ` +
        `callable from a React Server Component. Directives found:\n  ${directives.join('\n  ')}\n`,
    ).toBeUndefined()
  })

  it("does not reference browser-only globals at module scope", () => {
    // A defensive sanity check — if someone later imports `window` / `document`
    // / `navigator` at top-level of this module, calling `themeScript()` from
    // an RSC would still throw at import time even without the directive.
    // Inside the script BODY string those identifiers are fine (they're
    // executed in the browser); we just don't want them at module scope.
    const stripped = src
      // Drop the THEME_SCRIPT_BODY template literal — its contents run in the
      // browser, not in this module's import-time code.
      .replace(/`[\s\S]*?`\.trim\(\)/g, '``')
      // Strip comments to avoid false positives from doc-comments mentioning
      // `window.matchMedia`, etc.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')

    const offenders: string[] = []
    if (/\bwindow\./.test(stripped)) offenders.push('window.')
    if (/\bdocument\./.test(stripped)) offenders.push('document.')
    if (/\bnavigator\./.test(stripped)) offenders.push('navigator.')
    if (/\blocalStorage\b/.test(stripped)) offenders.push('localStorage')

    expect(
      offenders,
      `\nthemeScript.ts must not touch browser-only globals at module scope ` +
        `(only inside the THEME_SCRIPT_BODY template). Offenders:\n  ${offenders.join('\n  ')}\n`,
    ).toEqual([])
  })
})

describe('themeScript public surface (#384)', () => {
  it('re-export from ./utils/ThemeProvider matches the direct module export', () => {
    expect(themeScript).toBe(themeScriptDirect)
  })

  it('returns a string containing the expected setProperty + safe-value mirror', () => {
    const out = themeScript()
    expect(typeof out).toBe('string')
    // Single-value sink — the #323 invariant.
    expect(out).toContain('setProperty')
    // Inlined `isSafeTokenValue` mirror (#371) screens persisted token values
    // before the pre-hydration setProperty calls.
    expect(out).toContain('url(')
    expect(out).toContain('@import')
    // Sets the theme attribute on documentElement so a SSR page paints the
    // right mode on first frame.
    expect(out).toContain('data-theme')
    expect(out).toContain('prefers-color-scheme')
  })

  it('accepts a nonce and emits a wrapped <script> tag', () => {
    const out = themeScript({ nonce: 'abc' })
    expect(out.startsWith('<script nonce="abc">')).toBe(true)
    expect(out.endsWith('</script>')).toBe(true)
    expect(out).toContain('setProperty')
  })
})
