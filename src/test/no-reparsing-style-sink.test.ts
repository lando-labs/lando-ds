// @vitest-environment node

/**
 * Token-value sink-invariant guard (#323 follow-up).
 *
 * WHY THIS EXISTS
 * ---------------
 * `ThemeProvider` screens consumer-supplied token VALUES with `isSafeTokenValue`
 * (a substring deny-list) before writing them. An adversarial review showed the
 * deny-list is "leaky" as a filter — many hostile-looking values pass it — and
 * that it is nonetheless sufficient ONLY because the single write sink is
 * `element.style.setProperty('--x', value)`, which places the value in exactly
 * one custom-property slot. Without a literal `;` (which IS blocked) there is no
 * way to synthesize a second declaration, so a passing value stays inert.
 *
 * That security property lives in the SINK SHAPE, not the filter. If a future
 * change ever routes consumer token values through a RE-PARSING sink —
 * `style.cssText = …`, `CSSStyleSheet.insertRule(…)`, a `<style>` text node, or
 * `innerHTML` — the value gets re-tokenized and the guarantee collapses. This
 * test pins the invariant: the ThemeProvider token-write path must use only
 * `setProperty` / `removeProperty`, never a re-parsing sink.
 *
 * (Length is also capped in `isSafeTokenValue` — unit-tested below.)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { isSafeTokenValue } from '../utils/ThemeProvider'

const HERE = dirname(fileURLToPath(import.meta.url))
// Post-#384 — token writes now happen in TWO files:
//   - `ThemeProvider.tsx` (runtime `applyTheme` + cleanup effect)
//   - `themeScript.ts` (the pre-hydration inline IIFE that replays product
//     theme `--*` vars before React boots)
// Both must obey the sink invariant. The skeptic flagged that hardcoding only
// ThemeProvider here let the new themeScript module bypass the guard — a
// future refactor that moved write logic into themeScript.ts (or a sibling)
// would silently lose the check. Iterate over BOTH so the guard tracks the
// real surface.
const SINK_FILES: Array<readonly [string, string]> = [
  ['ThemeProvider.tsx', resolve(HERE, '../utils/ThemeProvider.tsx')],
  ['themeScript.ts', resolve(HERE, '../utils/themeScript.ts')],
]

/** Strip comments so a `cssText` mention in a doc-comment doesn't trip the scan. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('Token-write sink invariant (#323, #384)', () => {
  for (const [label, path] of SINK_FILES) {
    describe(label, () => {
      const src = stripComments(readFileSync(path, 'utf-8'))

      it('writes token values only via setProperty — no re-parsing CSS sink', () => {
        const forbidden: Array<[RegExp, string]> = [
          [/\.cssText\s*=/, 'style.cssText assignment (re-parses `;`)'],
          [/\.insertRule\s*\(/, 'CSSStyleSheet.insertRule'],
          [/\.innerHTML\s*=/, 'innerHTML assignment'],
          [/document\.write\s*\(/, 'document.write'],
        ]
        const hits = forbidden
          .filter(([re]) => re.test(src))
          .map(([, hint]) => hint)
        expect(
          hits,
          `\n${label} must not route token values through a re-parsing sink — ` +
            `the #323 value screen is only sufficient for single-value setProperty:\n  ${hits.join('\n  ')}\n`,
        ).toEqual([])
      })

      it('actually uses setProperty (sanity — guard is not vacuous)', () => {
        expect(src).toMatch(/\.setProperty\s*\(/)
      })
    })
  }
})

describe('isSafeTokenValue length cap (#323)', () => {
  it('rejects absurdly long values (style-recalc DoS amplification)', () => {
    expect(isSafeTokenValue('a'.repeat(501))).toBe(false)
    expect(isSafeTokenValue('#1B7FA8')).toBe(true)
    expect(isSafeTokenValue('a'.repeat(500))).toBe(true)
  })
})
