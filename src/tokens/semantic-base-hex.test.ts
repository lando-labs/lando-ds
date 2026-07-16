/**
 * Semantic anchor hex constants (#379).
 *
 * These constants exist as the JS-side mirror of the `--color-<X>-base`
 * CSS custom properties (defined in `src/styles/tokens.css`). Downstream
 * theme tooling (OKLCH derivation, contrast math, swatch grids in the lab)
 * needs hex values, and was previously hardcoding them as
 * `SUCCESS_ANCHOR='#2DBFBF'` etc. — duplicating the DS source of truth.
 *
 * This test locks the constants to the palette values in `colors.ts`. If
 * the brand semantic anchors ever move, BOTH this file and the matching
 * `oklch(…)` declarations in tokens.css have to update together — the test
 * fails loudly to force the dual update.
 */

import { describe, it, expect } from 'vitest'
import {
  SUCCESS_BASE,
  WARNING_BASE,
  ERROR_BASE,
  INFO_BASE,
  colors,
} from './colors'

describe('semantic anchor hex constants (#379)', () => {
  // v0.36.0 OSS-prep (#421): success shifted to emerald-green (#10B981)
  // and info shifted to true blue (#3B82F6) so the semantic layer reads
  // as universally-recognizable status hues without carrying the legacy
  // Lando ocean+teal brand identity. Warning/error are unchanged.
  it('SUCCESS_BASE matches the success.base palette value', () => {
    expect(SUCCESS_BASE).toBe('#10B981')
    expect(SUCCESS_BASE).toBe(colors.semantic.success.base)
  })

  it('WARNING_BASE matches the warning.base palette value', () => {
    expect(WARNING_BASE).toBe('#F59E0B')
    expect(WARNING_BASE).toBe(colors.semantic.warning.base)
  })

  it('ERROR_BASE matches the error.base palette value', () => {
    expect(ERROR_BASE).toBe('#EF4444')
    expect(ERROR_BASE).toBe(colors.semantic.error.base)
  })

  it('INFO_BASE matches the info.base palette value', () => {
    expect(INFO_BASE).toBe('#3B82F6')
    expect(INFO_BASE).toBe(colors.semantic.info.base)
  })

  it('all four constants are 6-digit uppercase hex strings', () => {
    // Format invariant — downstream OKLCH conversion expects a canonical
    // `#RRGGBB` shape. Keep this loose enough to allow either case but
    // strict on the digit count.
    for (const value of [SUCCESS_BASE, WARNING_BASE, ERROR_BASE, INFO_BASE]) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
