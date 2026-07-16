/**
 * src/tokens/contrast.ts
 *
 * WCAG 2.1 relative-luminance + contrast-ratio math, composed on top of the
 * published OKLCH helpers (`srgbChannelToLinear` does the sRGB companding).
 *
 * Why this is part of the public token surface: the DS ships OKLCH helpers so
 * consumers (and agents) can DERIVE a theme from one brand color. The natural
 * companion is being able to CHECK that a derived theme still clears WCAG AA —
 * without that, "re-skin to any brand" is a promise you can't verify. The
 * brand-tinted-chrome contrast harness (#288) uses exactly these functions to
 * prove the tint ladder holds AA across hostile primaries.
 *
 * Standard math (WCAG SC 1.4.3 / 1.4.6 / 1.4.11), zero dependencies.
 */

import { hexToRgb, srgbChannelToLinear } from './oklch'

/** WCAG AA contrast minimums. Large text / UI-component graphics are 3:1. */
export const AA_NORMAL = 4.5
export const AA_LARGE = 3
/** WCAG AAA contrast minimum for normal text. */
export const AAA_NORMAL = 7
/** WCAG AAA contrast minimum for large text (SC 1.4.6). */
export const AAA_LARGE = 4.5

/**
 * WCAG 2.1 relative luminance of an sRGB hex color (0 = black, 1 = white).
 * L = 0.2126·R + 0.7152·G + 0.0722·B over linear-light channels.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const R = srgbChannelToLinear(r)
  const G = srgbChannelToLinear(g)
  const B = srgbChannelToLinear(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * WCAG contrast ratio between two sRGB hex colors, in [1, 21]. Order-independent.
 * `(Llighter + 0.05) / (Ldarker + 0.05)`.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Does `fg` on `bg` clear WCAG AA? Normal text needs 4.5:1 (SC 1.4.3). Pass
 * `{ large: true }` for the 3:1 threshold, which covers two distinct success
 * criteria that happen to share the same number: large text — ≥18.66px bold /
 * ≥24px — (SC 1.4.3) and non-text UI-component / graphical-object contrast
 * (SC 1.4.11).
 */
export function meetsContrastAA(fg: string, bg: string, opts: { large?: boolean } = {}): boolean {
  return contrastRatio(fg, bg) >= (opts.large ? AA_LARGE : AA_NORMAL)
}

/**
 * Does `fg` on `bg` clear WCAG AAA? Normal text needs 7:1; pass `{ large: true }`
 * for the 4.5:1 large-text threshold (≥18.66px bold / ≥24px). WCAG SC 1.4.6.
 */
export function meetsContrastAAA(fg: string, bg: string, opts: { large?: boolean } = {}): boolean {
  return contrastRatio(fg, bg) >= (opts.large ? AAA_LARGE : AAA_NORMAL)
}

/**
 * Minimum `contrastRatio(fg, bg)` over every background in `bgs` — the "does my
 * text clear every surface it lands on?" helper. Pair with a threshold check
 * (e.g. `worstContrast(fg, surfaces) >= AA_NORMAL`) to gate a foreground across
 * a whole token ramp. Throws if `bgs` is empty.
 */
export function worstContrast(fg: string, bgs: string[]): number {
  if (bgs.length === 0) {
    throw new Error('worstContrast: `bgs` must contain at least one background color')
  }
  return Math.min(...bgs.map((bg) => contrastRatio(fg, bg)))
}
