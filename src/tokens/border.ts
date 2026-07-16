/**
 * Lando Labs Design System - Border Width Tokens (#375)
 *
 * A small, hardcoded primitive scale for stroke widths that pairs with the
 * existing color-only `--color-border-*` tokens. Before #375 component
 * stylesheets and consumers either hard-coded `1px`/`2px`/`4px` inline or
 * stacked an outline alongside a border to fake a stroke change; this
 * exposes the four values we actually use as named tokens so the brand
 * (and product themes) can re-skin them.
 *
 * Values:
 *  - `0` (no border)
 *  - `1` (default tier — chrome dividers, input outlines)
 *  - `2` (emphasis — selected/focus states)
 *  - `4` (heavy — decorative rules, alert top accents)
 *
 * Platform-agnostic primitives:
 * - All values are stored as numbers representing pixels (`px`).
 * - The web rendering path emits `--border-width-{0,1,2,4}` custom properties
 *   in `src/styles/tokens.css` (appended in the Sprint 49 / #375 section).
 * - RN consumers can use these numeric values directly with `borderWidth`.
 */

export const borderWidth = {
  0: 0,
  1: 1,
  2: 2,
  4: 4,
} as const

export type BorderWidth = typeof borderWidth
export type BorderWidthKey = keyof typeof borderWidth
