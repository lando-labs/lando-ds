/**
 * Lando Labs Design System - Border Radius Tokens
 * Soft, approachable rounded corners (6-12px sweet spot)
 *
 * Philosophy:
 * - Gentle curves inspired by ocean waves
 * - 6-12px range for primary UI elements
 * - Larger radii for cards and containers
 * - Full rounding for pills and avatars
 *
 * Platform-agnostic primitives:
 * - All radii are numbers in pixels (`px`).
 * - The web rendering path composes CSS strings via {@link composeRadius}
 *   (see ../utils/tokens-web.ts).
 * - `full` is a sentinel meaning "fully rounded" (pill / circle). On web this
 *   maps to a very large pixel value (e.g. `9999px`); on RN it maps to a value
 *   that exceeds the element's half-min-dimension (commonly 9999).
 */

// Sentinel used for fully-rounded shapes (pills, avatars). On web composes to
// `9999px`; on RN should be passed through as-is or interpreted as the largest
// representable rounding. Stored as a numeric constant so consumers can do
// math on it without a sentinel-string check.
export const RADIUS_FULL = 9999

export const radius = {
  // Pixel values (numbers)
  none: 0,
  xs: 2,         // Subtle rounding
  sm: 4,         // Small elements
  md: 6,         // Default rounding (brand foundation)
  lg: 8,         // Buttons, inputs
  xl: 12,        // Cards (brand foundation)
  '2xl': 16,     // Large cards
  '3xl': 24,     // Hero elements
  '4xl': 32,     // Feature sections
  full: RADIUS_FULL, // Fully rounded (pills, avatars)
} as const

// Component-specific radius presets
export const componentRadius = {
  // Form elements
  input: radius.lg,         // 8px
  select: radius.lg,        // 8px
  checkbox: radius.sm,      // 4px
  radio: radius.full,       // Fully rounded
  switch: radius.full,      // Fully rounded

  // Buttons
  button: {
    sm: radius.md,          // 6px
    md: radius.lg,          // 8px
    lg: radius.xl,          // 12px
  },

  // Cards and containers
  card: {
    sm: radius.lg,          // 8px
    md: radius.xl,          // 12px - Default card
    lg: radius['2xl'],      // 16px - Large card
    xl: radius['3xl'],      // 24px - Hero card
  },

  // Avatars and badges
  avatar: radius.full,      // Fully rounded
  badge: radius.full,       // Fully rounded (pill shape)
  tag: radius.md,           // 6px (subtle rounding)

  // Overlays
  modal: radius.xl,         // 12px
  popover: radius.lg,       // 8px
  dropdown: radius.lg,      // 8px
  tooltip: radius.md,       // 6px

  // Interactive elements
  tab: radius.lg,           // 8px
  accordion: radius.lg,     // 8px

  // Media
  image: {
    sm: radius.md,          // 6px
    md: radius.lg,          // 8px
    lg: radius.xl,          // 12px
    full: radius.full,      // Circular
  },

  // Tables
  table: radius.lg,         // 8px
  tableCell: radius.none,   // No rounding on cells
} as const

// Type exports
export type Radius = typeof radius
export type RadiusValue = keyof typeof radius
export type ComponentRadius = typeof componentRadius
