// @vitest-environment node

/**
 * Lockstep guard for the inline anti-flash script and the runtime token-write
 * guards (post-#384 skeptic review).
 *
 * WHY THIS EXISTS
 * ---------------
 * `themeScript()` injects an inline IIFE that runs BEFORE React boots — it
 * replays the persisted product theme's `--*` custom properties so first paint
 * matches the saved theme instead of flashing the base palette. That script
 * cannot import from the runtime, so its defenses are HAND-MIRRORED from
 * `isSafeTokenValue` / `isSafeTokenKey`:
 *
 *   - `INJECTION` ←→ runtime `INJECTION_VECTORS` (CSS break-out deny-list)
 *   - 500-char length cap on values
 *   - `KEY_RE` ←→ runtime `isSafeTokenKey` regex
 *   - 100-char length cap on keys
 *
 * Mirrors drift. If someone updates `isSafeTokenValue` (adds a vector, tightens
 * the cap) and forgets the inline `safe()` filter, a hostile value gets past
 * the pre-hydration script — which runs BEFORE React boots, so there is NO
 * runtime defense to catch it. The asymmetry runs both ways: if the inline
 * filter tightens without the runtime, behavior diverges between first paint
 * and post-hydration.
 *
 * This guard reads both files as text, extracts the array literals + regex +
 * cap, and asserts they match. Failure means: update both, in lockstep.
 *
 * Companion: `themeScript-rsc-safe.test.ts` (RSC-safety of the impl file) and
 * `no-reparsing-style-sink.test.ts` (sink invariant on both files).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const THEME_PROVIDER = resolve(HERE, '../utils/ThemeProvider.tsx')
const THEME_SCRIPT = resolve(HERE, '../utils/themeScript.ts')

/**
 * Extract a JS array-literal of single-quoted strings from `source` by
 * locating the variable declaration `const? <name> = [ … ]` and returning the
 * string contents in declaration order.
 *
 * `embedded` indicates the array literal lives INSIDE a template literal that
 * itself runs in the browser (the inline `THEME_SCRIPT_BODY`). In that case
 * every backslash in the source has already been doubled to survive the
 * outer template literal, so `\\\\` in the file represents a single `\` once
 * the browser parses it. We undo one level of escaping to recover the runtime
 * value the inline IIFE actually sees.
 */
function extractStringArray(
  source: string,
  name: string,
  embedded = false,
): string[] {
  // Match `<name> = [ ... ]` — capture the body between the brackets.
  const re = new RegExp(
    `\\b${name}\\b\\s*=\\s*\\[([\\s\\S]*?)\\]`,
    'm',
  )
  const match = re.exec(source)
  if (!match) {
    throw new Error(`Could not locate array literal \`${name}\` in source`)
  }
  const body = match[1]! // safe: match is non-null (throw above) → capture group 1 present
  // Pull each single-quoted segment.
  const items = body.match(/'((?:[^'\\]|\\.)*)'/g) ?? []
  return items.map((s) => {
    let unquoted = s.slice(1, -1)
    if (embedded) {
      // First, the OUTER template literal: `\\\\` → `\\`.
      unquoted = unquoted.replace(/\\\\/g, '\\')
    }
    // Then the INNER JS string-literal layer: `\\` → `\`, `\'` → `'`.
    return unquoted.replace(/\\\\/g, '\\').replace(/\\'/g, "'")
  })
}

/** Find an integer literal in `source` for a `value.length > N` comparison. */
function extractLengthCap(source: string, hint: RegExp): number {
  const match = hint.exec(source)
  if (!match) {
    throw new Error(`Could not locate length cap matching ${hint}`)
  }
  return Number(match[1])
}

/** Find a regex literal `/.../i` assigned to a const in `source`. */
function extractKeyRegex(source: string, name: string): RegExp {
  // Look for `<name> = /<pattern>/flags` (handles `/^[a-z0-9_-]+$/i`-style).
  const re = new RegExp(
    `\\b${name}\\b\\s*=\\s*/([^/\\n]+)/([gimsuy]*)`,
    'm',
  )
  const match = re.exec(source)
  if (!match) {
    throw new Error(`Could not locate regex literal \`${name}\` in source`)
  }
  return new RegExp(match[1]!, match[2]!) // safe: match non-null (throw above) → both capture groups present
}

describe('themeScript ↔ ThemeProvider lockstep (post-#384)', () => {
  const providerSrc = readFileSync(THEME_PROVIDER, 'utf-8')
  const scriptSrc = readFileSync(THEME_SCRIPT, 'utf-8')

  it('INJECTION_VECTORS (runtime) matches INJECTION (inline script)', () => {
    const runtime = extractStringArray(providerSrc, 'INJECTION_VECTORS')
    // `INJECTION` lives inside the THEME_SCRIPT_BODY template literal, so its
    // string escapes are one layer hotter than the runtime array.
    const inline = extractStringArray(scriptSrc, 'INJECTION', true)

    expect(runtime.length, 'INJECTION_VECTORS must not be empty').toBeGreaterThan(0)
    expect(
      inline,
      `\nInline THEME_SCRIPT_BODY's INJECTION deny-list has drifted from ` +
        `ThemeProvider's INJECTION_VECTORS. The inline script runs BEFORE ` +
        `React boots, so any divergence becomes a pre-hydration security gap.\n` +
        `Runtime: ${JSON.stringify(runtime)}\nInline:  ${JSON.stringify(inline)}\n`,
    ).toEqual(runtime)
  })

  it('value length cap (500) matches in both files', () => {
    // Runtime: `if (value.length > 500) return false`.
    const runtimeCap = extractLengthCap(
      providerSrc,
      /value\.length\s*>\s*(\d+)/,
    )
    // Inline: `|| v.length > 500`.
    const inlineCap = extractLengthCap(scriptSrc, /v\.length\s*>\s*(\d+)/)

    expect(runtimeCap).toBe(500)
    expect(
      inlineCap,
      `\nInline script's value length cap (${inlineCap}) does not match the ` +
        `runtime cap (${runtimeCap}). Both must reject the same shapes.\n`,
    ).toBe(runtimeCap)
  })

  it('key length cap (100) matches in both files', () => {
    // Runtime: `if (name.length === 0 || name.length > 100) return false`.
    const runtimeCap = extractLengthCap(
      providerSrc,
      /name\.length\s*>\s*(\d+)/,
    )
    // Inline: `k.length <= 100`.
    const inlineCap = extractLengthCap(scriptSrc, /k\.length\s*<=\s*(\d+)/)

    expect(runtimeCap).toBe(100)
    expect(
      inlineCap,
      `\nInline script's key length cap (${inlineCap}) does not match the ` +
        `runtime cap (${runtimeCap}). Both must reject the same shapes.\n`,
    ).toBe(runtimeCap)
  })

  it('isSafeTokenKey regex matches the inline KEY_RE', () => {
    // Runtime: `return /^[a-z0-9_-]+$/i.test(name)` — pull the regex by
    // scanning ThemeProvider for the function body.
    const runtimeMatch = /isSafeTokenKey[\s\S]*?return\s+\/([^/]+)\/([gimsuy]*)\.test/.exec(
      providerSrc,
    )
    if (!runtimeMatch) {
      throw new Error('Could not locate isSafeTokenKey regex in ThemeProvider')
    }
    const runtimeRe = new RegExp(runtimeMatch[1]!, runtimeMatch[2]!) // safe: runtimeMatch non-null (throw above) → both capture groups present

    const inlineRe = extractKeyRegex(scriptSrc, 'KEY_RE')

    expect(
      inlineRe.source,
      `\nInline KEY_RE pattern (${inlineRe.source}) does not match runtime ` +
        `isSafeTokenKey regex (${runtimeRe.source}).\n`,
    ).toBe(runtimeRe.source)
    expect(inlineRe.flags).toBe(runtimeRe.flags)
  })

  it('sample hostile keys are rejected by BOTH guards (sanity)', () => {
    // Hostile shapes the keys-from-localStorage attack would try.
    const samples = [
      'foo;}.attacker{',
      'foo bar', // whitespace
      'foo<script>',
      '',
      'a'.repeat(101),
      'foo/*comment*/',
    ]
    const runtimeRe = /^[a-z0-9_-]+$/i
    const inlineRe = extractKeyRegex(scriptSrc, 'KEY_RE')

    for (const s of samples) {
      const runtimeOk = s.length > 0 && s.length <= 100 && runtimeRe.test(s)
      const inlineOk = s.length > 0 && s.length <= 100 && inlineRe.test(s)
      expect(runtimeOk, `runtime should reject "${s}"`).toBe(false)
      expect(inlineOk, `inline should reject "${s}"`).toBe(false)
    }
  })
})
