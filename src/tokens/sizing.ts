/**
 * Lando Labs Design System - Sizing Tokens (#375)
 *
 * Component-sizing primitives that don't belong to spacing/radius/typography.
 * Today this is the popover/panel size scale used by the floating
 * overlays (Popover, Dropdown, Tooltip detail). Before #375 each overlay
 * hard-coded `min-width: 280px` / `max-width: 420px` / `max-height: 320px`
 * inline; this file centralizes the values so a product theme can reskin
 * the whole panel rhythm.
 *
 * Platform-agnostic primitives:
 * - Values are stored as numbers (px).
 * - The web rendering path emits `--size-popover-{min-width,max-width,max-height}`
 *   custom properties in `src/styles/tokens.css` (appended in the
 *   Sprint 49 / #375 section).
 * - RN consumers should treat the popover scale as a logical default and
 *   override per platform as needed.
 */

export const popoverSize = {
  /** Minimum width of a popover/panel surface (px). */
  minWidth: 280,
  /** Maximum width of a popover/panel surface (px). */
  maxWidth: 420,
  /** Maximum visible height before scroll (px). */
  maxHeight: 320,
} as const

export const sizing = {
  popover: popoverSize,
} as const

export type Sizing = typeof sizing
export type PopoverSize = typeof popoverSize
