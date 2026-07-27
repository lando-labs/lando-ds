// @vitest-environment node

/**
 * Lockstep guard for the scoped mode-dependent BASE token re-derivation
 * (#92).
 *
 * WHY THIS EXISTS
 * ----------------
 * `src/utils/scopedModeTokens.ts` hand-mirrors two things out of
 * `src/styles/tokens.css`:
 *
 *   1. Every token whose LITERAL value differs between the top-level
 *      `:root` block and the top-level `[data-theme="dark"]` block
 *      (`LIGHT_MODE_TOKEN_VARS` / `DARK_MODE_TOKEN_VARS`) — excluding
 *      `--color-primary-base`, which is already owned end-to-end by
 *      `colorDerivation.ts` (#11) as a `color-mix()` FORMULA, not a literal.
 *   2. Every token declared ONCE at `:root` as a pure single-level
 *      `var(--other)` indirection to one of the tokens in (1)
 *      (`MODE_ALIAS_VARS`) — e.g. `--color-surface-tertiary: var(--color-
 *      surface-hover)`, the token DetailCard's default `.field` row reads
 *      (#93).
 *
 * A hand-maintained mirror of either set WILL drift the moment someone
 * retunes a dark-mode color in tokens.css, adds a new mode-dependent token,
 * or adds a new alias — at which point a `ThemeScope` would silently keep
 * painting the WRONG mode's value for that token while every other token
 * stayed correct. This test parses tokens.css directly (independently of
 * `scopedModeTokens.ts`) and diffs the two, in BOTH directions, so drift
 * fails CI instead of shipping.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  LIGHT_MODE_TOKEN_VARS,
  DARK_MODE_TOKEN_VARS,
  MODE_ALIAS_VARS,
} from '../utils/scopedModeTokens'
import { SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES } from '../utils/colorDerivation'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = resolve(HERE, '../styles/tokens.css')

/**
 * Tokens intentionally excluded from `scopedModeTokens.ts` even though they
 * differ between `:root` and `[data-theme="dark"]` — already owned by a
 * DIFFERENT scoped-re-derivation mechanism. Kept as an explicit, tested
 * allowlist (rather than a silent gap) so this lockstep guard's reverse
 * direction can't be satisfied by accident.
 */
const OWNED_ELSEWHERE = new Set<string>(Object.keys(SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES))

/** Parse `--name: value;` declarations out of a CSS text block into a
 * `{ name: value }` map, stripping a trailing `/* … *\/` comment. */
function parseDeclarations(block: string): Record<string, string> {
  const decls: Record<string, string> = {}
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    const name = m[1]!
    const value = m[2]!.replace(/\/\*[\s\S]*?\*\/\s*$/, '').trim()
    decls[name] = value
  }
  return decls
}

describe('scopedModeTokens.ts ↔ tokens.css lockstep (#92)', () => {
  const css = readFileSync(TOKENS_CSS, 'utf-8')

  // Isolate the top-level `:root { … }` block (light mode). tokens.css has a
  // SECOND `:root { … }` block later (border-width/text-transform/etc, #375)
  // that carries no mode-dependent tokens — stopping at the FIRST `[data-
  // theme="dark"]` occurrence captures everything the dark block could
  // possibly override, which is all this guard cares about.
  const rootStart = css.indexOf('\n:root {')
  const darkStart = css.indexOf('[data-theme="dark"] {')
  if (rootStart === -1 || darkStart === -1) {
    throw new Error('Could not locate :root / [data-theme="dark"] blocks in tokens.css')
  }
  const rootBlock = css.slice(rootStart, darkStart)
  const rootDecls = parseDeclarations(rootBlock)

  // The dark block is a plain (non-compound) selector — stop at the first
  // top-level `}` after the opening brace, mirroring the #11 lockstep test's
  // approach (avoids also matching `[data-theme="dark"][data-tint-chrome]`,
  // a deliberately out-of-scope compound block — see scopedModeTokens.ts).
  const darkMatch = /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css)
  if (!darkMatch) {
    throw new Error('Could not locate [data-theme="dark"] block in tokens.css')
  }
  const darkDecls = parseDeclarations(darkMatch[1]!)

  // Tokens.css names whose LITERAL value differs between the two blocks.
  const actualDiff: Record<string, { light: string; dark: string }> = {}
  for (const [name, darkValue] of Object.entries(darkDecls)) {
    const lightValue = rootDecls[name]
    if (lightValue !== undefined && lightValue !== darkValue) {
      actualDiff[name] = { light: lightValue, dark: darkValue }
    }
  }

  it('every LIGHT_MODE_TOKEN_VARS entry matches tokens.css :root verbatim', () => {
    const mismatches: string[] = []
    for (const [name, formula] of Object.entries(LIGHT_MODE_TOKEN_VARS)) {
      const rootValue = rootDecls[name]
      if (rootValue === undefined) {
        mismatches.push(`${name}: declared in scopedModeTokens.ts but MISSING from tokens.css :root`)
      } else if (rootValue !== formula) {
        mismatches.push(`${name}:\n    scopedModeTokens.ts: ${formula}\n    tokens.css :root:    ${rootValue}`)
      }
    }
    expect(
      mismatches,
      `\nscopedModeTokens.ts LIGHT_MODE_TOKEN_VARS has drifted from tokens.css :root:\n${mismatches.join('\n')}\n`,
    ).toEqual([])
  })

  it('every DARK_MODE_TOKEN_VARS entry matches tokens.css [data-theme="dark"] verbatim', () => {
    const mismatches: string[] = []
    for (const [name, formula] of Object.entries(DARK_MODE_TOKEN_VARS)) {
      const darkValue = darkDecls[name]
      if (darkValue === undefined) {
        mismatches.push(`${name}: declared in scopedModeTokens.ts but MISSING from tokens.css [data-theme="dark"]`)
      } else if (darkValue !== formula) {
        mismatches.push(`${name}:\n    scopedModeTokens.ts: ${formula}\n    tokens.css dark block: ${darkValue}`)
      }
    }
    expect(
      mismatches,
      `\nscopedModeTokens.ts DARK_MODE_TOKEN_VARS has drifted from tokens.css [data-theme="dark"]:\n${mismatches.join('\n')}\n`,
    ).toEqual([])
  })

  it('LIGHT_MODE_TOKEN_VARS and DARK_MODE_TOKEN_VARS track the exact same key set', () => {
    const lightKeys = Object.keys(LIGHT_MODE_TOKEN_VARS).sort()
    const darkKeys = Object.keys(DARK_MODE_TOKEN_VARS).sort()
    expect(darkKeys).toEqual(lightKeys)
  })

  it('every token whose value differs between tokens.css :root and [data-theme="dark"] is mirrored (or explicitly owned elsewhere)', () => {
    // Reverse direction: catches a NEW mode-dependent token added to
    // tokens.css (or an existing one retuned to newly differ) that
    // scopedModeTokens.ts forgot to pick up.
    const missing: string[] = []
    for (const name of Object.keys(actualDiff)) {
      if (OWNED_ELSEWHERE.has(name)) continue
      if (!(name in LIGHT_MODE_TOKEN_VARS)) {
        missing.push(`${name}: light=${actualDiff[name]!.light} dark=${actualDiff[name]!.dark}`)
      }
    }
    expect(
      missing,
      `\ntokens.css declares mode-dependent tokens scopedModeTokens.ts does not mirror:\n${missing.join('\n')}\n`,
    ).toEqual([])
  })

  it('LIGHT_MODE_TOKEN_VARS contains no token that tokens.css does NOT actually vary by mode', () => {
    // Forward-direction drift in the other direction: a token that USED to
    // differ by mode (or was mistakenly added) but no longer does should be
    // dropped from the module, not carried as dead weight that masks a real
    // gap elsewhere.
    const stale: string[] = []
    for (const name of Object.keys(LIGHT_MODE_TOKEN_VARS)) {
      if (!(name in actualDiff)) {
        stale.push(name)
      }
    }
    expect(
      stale,
      `\nscopedModeTokens.ts tracks tokens tokens.css no longer varies by mode (stale entries):\n${stale.join('\n')}\n`,
    ).toEqual([])
  })

  it('--color-primary-base is deliberately excluded (owned by colorDerivation.ts / #11)', () => {
    expect(LIGHT_MODE_TOKEN_VARS).not.toHaveProperty('--color-primary-base')
    expect(DARK_MODE_TOKEN_VARS).not.toHaveProperty('--color-primary-base')
    // Sanity: the exclusion allowlist itself must still be non-empty and
    // must still actually differ by mode in tokens.css, or the exclusion
    // is stale.
    expect(actualDiff).toHaveProperty('--color-primary-base')
  })

  it('every MODE_ALIAS_VARS entry matches its tokens.css :root declaration verbatim', () => {
    const mismatches: string[] = []
    for (const [name, formula] of Object.entries(MODE_ALIAS_VARS)) {
      const rootValue = rootDecls[name]
      if (rootValue === undefined) {
        mismatches.push(`${name}: declared in scopedModeTokens.ts MODE_ALIAS_VARS but MISSING from tokens.css :root`)
      } else if (rootValue !== formula) {
        mismatches.push(`${name}:\n    scopedModeTokens.ts: ${formula}\n    tokens.css :root:    ${rootValue}`)
      }
    }
    expect(
      mismatches,
      `\nscopedModeTokens.ts MODE_ALIAS_VARS has drifted from tokens.css :root:\n${mismatches.join('\n')}\n`,
    ).toEqual([])
  })

  it('every :root pure single-var indirection to a mode-dependent base token is mirrored in MODE_ALIAS_VARS', () => {
    // Reverse direction: finds every `--name: var(--other);` declaration at
    // :root whose `other` is one of the mode-dependent base tokens, and
    // asserts it is tracked. Catches a NEW alias (e.g. a future `--color-
    // surface-quaternary`) added to tokens.css that forgot to update this
    // module — the exact class of gap that caused #93.
    const baseNames = new Set(Object.keys(LIGHT_MODE_TOKEN_VARS))
    const missing: string[] = []
    for (const [name, value] of Object.entries(rootDecls)) {
      const m = /^var\((--[a-z0-9-]+)\)$/i.exec(value)
      if (!m) continue
      const target = m[1]!
      if (!baseNames.has(target)) continue
      if (!(name in MODE_ALIAS_VARS)) {
        missing.push(`${name}: ${value}`)
      }
    }
    expect(
      missing,
      `\ntokens.css declares an alias to a mode-dependent base token that scopedModeTokens.ts MODE_ALIAS_VARS does not mirror:\n${missing.join('\n')}\n`,
    ).toEqual([])
  })

  it('MODE_ALIAS_VARS contains no stale entry (target no longer a tracked mode-dependent base token)', () => {
    const baseNames = new Set(Object.keys(LIGHT_MODE_TOKEN_VARS))
    const stale: string[] = []
    for (const [name, value] of Object.entries(MODE_ALIAS_VARS)) {
      const m = /^var\((--[a-z0-9-]+)\)$/i.exec(value)
      const target = m?.[1]
      if (!target || !baseNames.has(target)) {
        stale.push(`${name}: ${value}`)
      }
    }
    expect(
      stale,
      `\nscopedModeTokens.ts MODE_ALIAS_VARS has a stale entry no longer pointing at a tracked base token:\n${stale.join('\n')}\n`,
    ).toEqual([])
  })
})
