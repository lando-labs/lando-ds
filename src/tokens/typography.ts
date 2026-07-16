/**
 * Lando Labs Design System - Typography Tokens
 * Based on Inter font family with Major Third (1.250) type scale
 *
 * Philosophy:
 * - Clean, modern typography for clarity and readability
 * - Major Third scale (1.250 ratio) provides balanced hierarchy
 * - Inter font for optimal screen readability
 * - JetBrains Mono for code/technical content
 *
 * Platform-agnostic primitives:
 * - `fontSize` values are numbers (px). The 16px base maps to historical 1rem
 *   values; multiply by the consumer's base font size if a different base is
 *   required.
 * - `letterSpacing` values are numbers in `em` units (web-native). React
 *   Native consumers should compute `fontSize * letterSpacing` to derive a
 *   point value, since RN's `letterSpacing` is absolute.
 * - `fontFamily` values remain CSS font stacks (web-compatible strings). RN
 *   consumers should consume `fontFamilyPrimary` (a single name extracted
 *   from each stack) for native font loading.
 * - `fontWeight` and `lineHeight` are unitless numbers on both platforms.
 *
 * The web rendering path composes CSS strings via composers in
 * ../utils/tokens-web.ts (`composeFontSize`, `composeLetterSpacing`).
 */

/**
 * Single-name font families for React Native consumers.
 * These map to the primary face in each font stack and assume the consumer
 * has loaded the corresponding asset (e.g. via `expo-font` or a native asset
 * link). Falls back to system fonts if unavailable.
 */
export const fontFamilyPrimary = {
  base: 'Inter',
  mono: 'JetBrains Mono',
  display: 'Inter',
} as const

export const typography = {
  // Font Families (CSS stacks — web-compatible)
  fontFamily: {
    base: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Roboto Mono", "Courier New", monospace',
    display: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },

  // Font Sizes (numbers in px, Major Third Scale — 1.250 ratio, base 16px)
  fontSize: {
    '2xs': 10,    // ~10px - Fine print, captions (was 0.64rem)
    xs: 13,       // ~13px - Small labels, metadata (was 0.8rem)
    sm: 14,       // 14px - Secondary text, helper text (was 0.875rem)
    base: 16,     // 16px - Body text
    lg: 18,       // 18px - Emphasized body text (was 1.125rem)
    xl: 20,       // 20px - H5
    '2xl': 25,    // ~25px - H4 (was 1.563rem)
    '3xl': 31,    // ~31px - H3 (was 1.953rem)
    '4xl': 39,    // ~39px - H2 (was 2.441rem)
    '5xl': 49,    // ~49px - H1 (was 3.052rem)
    '6xl': 61,    // ~61px - Display heading (was 3.815rem)
    '7xl': 76,    // ~76px - Hero text (was 4.768rem)
  },

  // Font Weights (numeric, unitless — same on both platforms)
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // Line Heights (unitless ratios — multiply by fontSize for px)
  lineHeight: {
    none: 1,
    tight: 1.25,     // Headings
    snug: 1.375,     // Subheadings
    normal: 1.5,     // Body text
    relaxed: 1.625,  // Long-form content
    loose: 2,        // Sparse layouts
  },

  // Letter Spacing (numbers in em — multiply by fontSize for RN px equivalent)
  letterSpacing: {
    tighter: -0.05,
    tight: -0.025,
    normal: 0,
    wide: 0.025,
    wider: 0.05,
    widest: 0.1,
  },
} as const

/**
 * Text transform keyword constants (#375).
 *
 * `text-transform` is a CSS keyword, not a custom-property value — the
 * official tokens for this live in JS as exported constants and in the
 * CSS layer as `--text-transform-{none,uppercase,capitalize}` strings
 * that consumers can plug into `var()` inside `text-transform: …` when
 * desired. Either path resolves to the same CSS keyword.
 */
export const textTransform = {
  none: 'none',
  uppercase: 'uppercase',
  capitalize: 'capitalize',
} as const

export type TextTransform = typeof textTransform
export type TextTransformKey = keyof typeof textTransform

// Predefined text styles for common use cases
export const textStyles = {
  // Display styles
  display: {
    '2xl': {
      fontSize: typography.fontSize['7xl'],
      fontWeight: typography.fontWeight.extrabold,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.tighter,
    },
    xl: {
      fontSize: typography.fontSize['6xl'],
      fontWeight: typography.fontWeight.extrabold,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.tighter,
    },
    lg: {
      fontSize: typography.fontSize['5xl'],
      fontWeight: typography.fontWeight.bold,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.tight,
    },
  },

  // Heading styles
  heading: {
    h1: {
      fontSize: typography.fontSize['5xl'],
      fontWeight: typography.fontWeight.bold,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.tight,
    },
    h2: {
      fontSize: typography.fontSize['4xl'],
      fontWeight: typography.fontWeight.bold,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.tight,
    },
    h3: {
      fontSize: typography.fontSize['3xl'],
      fontWeight: typography.fontWeight.semibold,
      lineHeight: typography.lineHeight.snug,
      letterSpacing: typography.letterSpacing.normal,
    },
    h4: {
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.semibold,
      lineHeight: typography.lineHeight.snug,
      letterSpacing: typography.letterSpacing.normal,
    },
    h5: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      lineHeight: typography.lineHeight.snug,
      letterSpacing: typography.letterSpacing.normal,
    },
    h6: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.normal,
    },
  },

  // Body text styles
  body: {
    xl: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.normal,
      lineHeight: typography.lineHeight.relaxed,
      letterSpacing: typography.letterSpacing.normal,
    },
    lg: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.normal,
      lineHeight: typography.lineHeight.relaxed,
      letterSpacing: typography.letterSpacing.normal,
    },
    base: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.normal,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.normal,
    },
    sm: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.normal,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.normal,
    },
    xs: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.normal,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.wide,
    },
  },

  // Label styles
  label: {
    lg: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.normal,
    },
    base: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.normal,
    },
    sm: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.wide,
    },
  },

  // Code styles
  code: {
    // Inline code is intentionally web-specific — `'0.875em'` is parent-relative.
    // RN consumers should treat inline code as `typography.fontSize.sm` (14px).
    inline: {
      fontSize: '0.875em',
      fontWeight: typography.fontWeight.normal,
      fontFamily: typography.fontFamily.mono,
      lineHeight: typography.lineHeight.normal,
    },
    block: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.normal,
      fontFamily: typography.fontFamily.mono,
      lineHeight: typography.lineHeight.relaxed,
    },
  },
} as const

// Type exports
export type Typography = typeof typography
export type TextStyles = typeof textStyles
export type FontSize = keyof typeof typography.fontSize
export type FontWeight = keyof typeof typography.fontWeight
export type LineHeight = keyof typeof typography.lineHeight
export type LetterSpacing = keyof typeof typography.letterSpacing
