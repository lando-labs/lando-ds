/**
 * Lando Labs Design System - Spacing Tokens
 * Base-16 system with 4px increments for precise control
 *
 * Philosophy:
 * - Consistent rhythm and alignment across components
 * - 4px grid system for pixel-perfect layouts
 * - Named tokens for semantic usage
 * - Scales from micro spacing to large layout gaps
 *
 * Platform-agnostic primitives:
 * - All spacing values are stored as numbers representing pixels (`px`).
 * - The web rendering path composes CSS strings via {@link composeSpacing}
 *   (see ../utils/tokens-web.ts).
 * - React Native and other non-web targets consume the numeric primitives
 *   directly without unit conversion.
 *
 * Special cases:
 * - `none` is the literal number `0`.
 * - Layout `maxWidth` ramp keeps the responsive special `'full'` token (100%);
 *   it is stored separately from numeric pixel widths.
 */

export const spacing = {
  // Pixel values (numbers, in px) - for direct usage
  px: {
    0: 0,
    1: 1,    // Hairline borders
    2: 2,    // Thin borders
    4: 4,
    8: 8,
    12: 12,
    16: 16,  // Base unit
    20: 20,
    24: 24,
    32: 32,
    40: 40,
    48: 48,
    56: 56,
    64: 64,
    80: 80,
    96: 96,
    128: 128,
    160: 160,
    192: 192,
    224: 224,
    256: 256,
  },

  // Named tokens (semantic usage), values in px
  none: 0,
  '2xs': 4,        // Minimal spacing
  '2xs-dense': 6,  // Dense-step (#375) — between `2xs` (4) and `xs` (8) for compact UI rows / IconButton inner padding
  xs: 8,           // Tight spacing
  sm: 12,          // Small spacing
  md: 16,          // Default spacing
  lg: 24,          // Comfortable spacing
  xl: 32,          // Large spacing
  '2xl': 48,       // Extra large spacing
  '3xl': 64,       // Huge spacing
  '4xl': 96,       // Massive spacing
  '5xl': 128,      // Section spacing
  '6xl': 192,      // Hero spacing
  '7xl': 256,      // Page spacing
} as const

// Component-specific spacing presets (all values in px numbers)
export const componentSpacing = {
  // Padding for different component sizes
  padding: {
    xs: {
      x: spacing.xs,
      y: spacing['2xs'],
    },
    sm: {
      x: spacing.sm,
      y: spacing.xs,
    },
    md: {
      x: spacing.md,
      y: spacing.sm,
    },
    lg: {
      x: spacing.lg,
      y: spacing.md,
    },
    xl: {
      x: spacing.xl,
      y: spacing.lg,
    },
  },

  // Gap for flex/grid layouts
  gap: {
    tight: spacing.xs,      // 8px - Tight layouts
    normal: spacing.md,     // 16px - Default layouts
    loose: spacing.lg,      // 24px - Spacious layouts
    relaxed: spacing.xl,    // 32px - Very spacious layouts
  },

  // Stack spacing (vertical rhythm)
  stack: {
    '2xs': spacing['2xs'], // 4px
    xs: spacing.xs,        // 8px
    sm: spacing.sm,        // 12px
    md: spacing.md,        // 16px
    lg: spacing.lg,        // 24px
    xl: spacing.xl,        // 32px
    '2xl': spacing['2xl'], // 48px
  },

  // Container padding
  container: {
    mobile: spacing.md,    // 16px
    tablet: spacing.lg,    // 24px
    desktop: spacing.xl,   // 32px
    wide: spacing['2xl'],  // 48px
  },

  // Section spacing
  section: {
    sm: spacing['3xl'],   // 64px
    md: spacing['4xl'],   // 96px
    lg: spacing['5xl'],   // 128px
    xl: spacing['6xl'],   // 192px
  },
} as const

/**
 * Component padding rhythm (#448) — Phase A, additive.
 *
 * A single shared padding-rhythm surface so components stop mixing two spacing
 * vocabularies for internal padding. Values reference the SEMANTIC spacing
 * scale (`spacing.xs` … `spacing.xl`), so a future retune of the semantic rungs
 * flows through automatically. This is the TS source of truth for the CSS
 * `--component-padding-*` custom properties in `src/styles/tokens.css`.
 *
 * Deliberately a DISTINCT export (NOT merged into `spacing` or
 * `componentSpacing`): a sibling lane's TS↔CSS parity test enumerates only the
 * primitive `spacing` scale, so keeping this separate avoids a false-positive
 * collision. Phase A seeded xs…xl; Phase B (#448) extends the group to the full
 * padding range (2xs/2xl/3xl) and migrates component padding onto these tokens.
 * All values in px (numbers).
 */
export const componentPadding = {
  none: spacing.none, // 0
  '2xs': spacing['2xs'], // 4px
  xs: spacing.xs, // 8px
  sm: spacing.sm, // 12px
  md: spacing.md, // 16px
  lg: spacing.lg, // 24px
  xl: spacing.xl, // 32px
  '2xl': spacing['2xl'], // 48px
  '3xl': spacing['3xl'], // 64px
} as const

/**
 * Layout spacing
 *
 * Numeric ramps are in px; the `maxWidth.full` token is the responsive special
 * `'100%'` string because percent widths have no platform-agnostic numeric
 * equivalent. Consumers should treat `'full'` as a sentinel and handle it
 * platform-appropriately (e.g. RN: `'100%'` or flex: 1).
 */
export const layout = {
  // Page margins (px)
  pageMargin: {
    mobile: spacing.md,    // 16px
    tablet: spacing.xl,    // 32px
    desktop: spacing['3xl'], // 64px
  },

  // Content width constraints (px, except `full`)
  maxWidth: {
    xs: 320,        // Narrow content
    sm: 384,        // Small content
    md: 448,        // Medium content
    lg: 512,        // Large content
    xl: 576,        // Extra large content
    '2xl': 672,     // 2XL content
    '3xl': 768,     // 3XL content
    '4xl': 896,     // 4XL content
    '5xl': 1024,    // 5XL content
    '6xl': 1152,    // 6XL content
    '7xl': 1280,    // 7XL content
    full: '100%',   // Responsive full width — non-numeric sentinel
  },

  // Grid gaps (px)
  gridGap: {
    none: spacing.none,
    sm: spacing.sm,    // 12px
    md: spacing.md,    // 16px
    lg: spacing.lg,    // 24px
    xl: spacing.xl,    // 32px
  },
} as const

// Type exports
export type Spacing = typeof spacing
export type SpacingValue = keyof typeof spacing | keyof typeof spacing.px
export type ComponentSpacing = typeof componentSpacing
export type ComponentPadding = typeof componentPadding
export type Layout = typeof layout
