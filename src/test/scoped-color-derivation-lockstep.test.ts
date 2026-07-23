// @vitest-environment node

/**
 * Lockstep guard for the scoped ramp/interaction-state re-derivation (#11).
 *
 * WHY THIS EXISTS
 * ----------------
 * `src/utils/colorDerivation.ts` hand-mirrors the `color-mix()` FORMULA
 * STRINGS that `src/styles/tokens.css` declares once at `:root` (the
 * GENERATED:COLOR-RAMPS block) and once more, dark-mode-only, for
 * `--color-primary-base` inside `[data-theme="dark"]` (#73). `ThemeScope`
 * needs its own copy of these formulas because a non-root element is never
 * matched by a `:root` CSS rule — see the doc comment atop
 * `colorDerivation.ts` for the full mechanism.
 *
 * Two hand-authored copies of the same formulas WILL drift the moment
 * someone retunes a mix percentage in tokens.css (or in the emitter that
 * writes it, `scripts/emit-tokens.mjs`) without updating the mirror — at
 * which point a themed `ThemeScope` would silently paint a different ramp
 * than the identical override applied at `:root`. This test parses BOTH
 * files and asserts every formula in `colorDerivation.ts` appears verbatim
 * in tokens.css (and vice versa for the tracked key set).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  SCOPED_DERIVED_COLOR_VARS,
  SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES,
} from '../utils/colorDerivation'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = resolve(HERE, '../styles/tokens.css')

const START_MARKER = '/* GENERATED:COLOR-RAMPS:START — emitted by scripts/emit-tokens.mjs. Do not edit by hand. */'
const END_MARKER = '/* GENERATED:COLOR-RAMPS:END */'

/**
 * Parse `--name: value;` declarations out of a CSS text block into a
 * `{ name: value }` map. Strips trailing `/* … *\/` comments and surrounding
 * whitespace so formatting differences (which this repo's emitter is free to
 * change) don't cause false failures — only the FORMULA itself is compared.
 */
function parseDeclarations(block: string): Record<string, string> {
  const decls: Record<string, string> = {}
  // Matches `--custom-prop-name: <value up to the terminating semicolon>;`.
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    const name = m[1]!
    // Strip a trailing `/* ... */` comment (and any preceding whitespace).
    const value = m[2]!.replace(/\/\*[\s\S]*?\*\/\s*$/, '').trim()
    decls[name] = value
  }
  return decls
}

describe('colorDerivation.ts ↔ tokens.css lockstep (#11)', () => {
  const css = readFileSync(TOKENS_CSS, 'utf-8')

  const startIdx = css.indexOf(START_MARKER)
  const endIdx = css.indexOf(END_MARKER)
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not locate GENERATED:COLOR-RAMPS markers in tokens.css')
  }
  const rampBlock = css.slice(startIdx, endIdx)
  const rampDecls = parseDeclarations(rampBlock)

  // Isolate `[data-theme="dark"] { … }` — a plain (non-compound) selector, so
  // stop at the first top-level `}` after the opening brace.
  const darkMatch = /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css)
  if (!darkMatch) {
    throw new Error('Could not locate [data-theme="dark"] block in tokens.css')
  }
  const darkDecls = parseDeclarations(darkMatch[1]!)

  it('every SCOPED_DERIVED_COLOR_VARS formula matches tokens.css :root verbatim', () => {
    const mismatches: string[] = []
    for (const [name, formula] of Object.entries(SCOPED_DERIVED_COLOR_VARS)) {
      const rootValue = rampDecls[name]
      if (rootValue === undefined) {
        mismatches.push(`${name}: declared in colorDerivation.ts but MISSING from tokens.css :root`)
      } else if (rootValue !== formula) {
        mismatches.push(`${name}:\n    colorDerivation.ts: ${formula}\n    tokens.css :root:    ${rootValue}`)
      }
    }
    expect(
      mismatches,
      `\ncolorDerivation.ts has drifted from tokens.css's GENERATED:COLOR-RAMPS block:\n${mismatches.join('\n')}\n`,
    ).toEqual([])
  })

  it('every tokens.css :root ramp/state formula for primary/secondary/error/danger is mirrored', () => {
    // Reverse direction: catch a NEW ramp/state token added to tokens.css that
    // colorDerivation.ts forgot to pick up. Scope to the same token families
    // colorDerivation.ts documents covering (primary/secondary tonal ramp +
    // primary/secondary/error/danger state tints) — other GENERATED entries
    // (ocean/teal/neutral/identity ramps, ocean -rgb mirrors) are literal
    // oklch()/rgb values, not color-mix() derivations, and are out of scope.
    const trackedNamePattern =
      /^--color-(primary|secondary)-(lightest|lighter|light|base|medium|dark|darker|darkest|hover|active|disabled)$|^--color-(error|danger)-(hover|active|disabled)$/
    const missing: string[] = []
    for (const [name, value] of Object.entries(rampDecls)) {
      if (!trackedNamePattern.test(name)) continue
      if (!(name in SCOPED_DERIVED_COLOR_VARS)) {
        missing.push(`${name}: ${value}`)
      }
    }
    expect(
      missing,
      `\ntokens.css declares ramp/state tokens colorDerivation.ts does not mirror:\n${missing.join('\n')}\n`,
    ).toEqual([])
  })

  it('SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES matches the [data-theme="dark"] override verbatim', () => {
    for (const [name, formula] of Object.entries(SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES)) {
      expect(darkDecls[name], `${name} missing from [data-theme="dark"] in tokens.css`).toBeDefined()
      expect(
        darkDecls[name],
        `${name} dark-mode formula drifted:\n  colorDerivation.ts:   ${formula}\n  tokens.css dark block: ${darkDecls[name]}`,
      ).toBe(formula)
    }
  })

  it('SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES only overrides keys that also exist in the light set', () => {
    // Sanity: `getScopedDerivedColorVars('dark')` spreads the dark overrides
    // OVER the light set, so an override for a key absent from the light set
    // would silently introduce an untracked token instead of overriding one.
    for (const name of Object.keys(SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES)) {
      expect(name in SCOPED_DERIVED_COLOR_VARS, `${name} has a dark override but no light-mode base entry`).toBe(
        true,
      )
    }
  })
})
