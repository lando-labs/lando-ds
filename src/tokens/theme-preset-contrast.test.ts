// @vitest-environment node

/**
 * Theme preset primary/on-primary contrast guard (#10).
 *
 * WHAT THIS CATCHES
 * ------------------
 * `Button.module.css`'s `.primary` variant sets
 * `background-color: var(--color-primary)` + `color: var(--color-on-primary)`.
 * `--color-on-primary` is declared exactly once, globally, in `tokens.css`
 * (`var(--color-neutral-white)`) — a preset that overrides `primary` to
 * something lighter than ~4.5:1 against white has no way to express a
 * conforming replacement UNLESS it sets `colors.onPrimary`
 * (`src/tokens/themePresets.ts`), which `presetColorVars`
 * (`src/utils/themeScript.ts`) emits as `--color-on-primary`.
 *
 * 4 of the 6 shipped presets (`midnight`, `sunset`, `forest`, `rose`) failed
 * this before #10 — see `reference/theme-presets.md` for the measured
 * before/after numbers. This test loops over every entry in `themePresets`
 * and asserts `primary` vs. its RESOLVED `onPrimary` (the preset's explicit
 * override, or the inherited global default when it doesn't set one) clears
 * WCAG AA — so a new preset that ships a light `primary` without an
 * `onPrimary` override fails CI instead of shipping unreadable button text.
 *
 * It also asserts the brand-neutral DEFAULT (no preset applied) still holds,
 * per the "don't break the default theme" requirement in #10 — this is what
 * `Button.test.tsx`'s existing `contrastRatio(label, surface)` assertion
 * (#9/#71) does NOT cover: that test checks `--color-primary` against
 * `--color-surface` (Button `variant="outline"`'s TEXT case), not against
 * `--color-on-primary` (the `variant="primary"` FILL case this issue is
 * about).
 *
 * Math: `contrastRatio` / `AA_NORMAL` from `src/tokens/contrast.ts` — the
 * same WCAG luminance/contrast implementation `chrome-contrast.test.ts` (#288)
 * and `Button.test.tsx` (#9/#71) already use. The default's tokens are
 * resolved from the REAL `src/styles/tokens.css` via `resolveTokenHex`
 * (`src/test/contrast-helpers.ts`) rather than a hand-copied hex, so this
 * can't silently drift from what ships.
 */

import { describe, it, expect } from 'vitest'
import { themePresets } from './themePresets'
import { contrastRatio, AA_NORMAL } from './contrast'
import { resolveTokenHex } from '../test/contrast-helpers'

// The global fallback every preset inherits when it doesn't set `onPrimary`
// (tokens.css `:root { --color-on-primary: var(--color-neutral-white); }`,
// resolved for real rather than hand-copied as `#FFFFFF`).
const INHERITED_ON_PRIMARY = resolveTokenHex('--color-on-primary', 'light')

describe('theme preset primary/on-primary contrast (#10)', () => {
  it('brand-neutral default (no preset) clears AA on Button variant="primary"', () => {
    const primary = resolveTokenHex('--color-primary', 'light')
    const onPrimary = resolveTokenHex('--color-on-primary', 'light')
    const ratio = contrastRatio(primary, onPrimary)
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  for (const preset of themePresets) {
    const primary = preset.colors.primary
    // Presets without a `primary` override (none currently) inherit the
    // default, already covered above — nothing preset-specific to assert.
    if (!primary) continue

    const onPrimary = preset.colors.onPrimary ?? INHERITED_ON_PRIMARY

    it(`${preset.id}: primary (${primary}) vs resolved on-primary (${onPrimary}) clears AA (>= ${AA_NORMAL}:1)`, () => {
      const ratio = contrastRatio(primary, onPrimary)
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }
})
