/**
 * Lando Labs Design System - Shadow Tokens
 * Ocean-tinted shadows with subtle blue tones
 *
 * Philosophy:
 * - Shadows evoke depth like ocean layers
 * - Subtle blue tint maintains ocean theme
 * - Elevation levels from subtle to prominent
 * - Different shadow sets for light and dark modes
 *
 * Platform-agnostic primitives:
 * - Shadows are arrays of `ShadowLayer` (or `'none'`) so multi-layer
 *   compositions translate to both web (`box-shadow`) and structured RN
 *   shadow props.
 * - The web rendering path composes `box-shadow` CSS strings via
 *   {@link composeBoxShadow} (see ../utils/tokens-web.ts).
 * - React Native consumers map each layer to its iOS shadow props
 *   (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`) and
 *   approximate elevation on Android. `inset` layers have no native
 *   equivalent — RN consumers should choose a fallback (background tint or
 *   inner border) for inset values.
 */

/** A single shadow layer. Multiple layers compose into one box-shadow on web. */
export interface ShadowLayer {
  /** Horizontal offset in px. Positive = right. */
  x: number
  /** Vertical offset in px. Positive = down. */
  y: number
  /** Blur radius in px. */
  blur: number
  /** Spread radius in px. Negative spreads shrink the shadow. */
  spread: number
  /** Color in any web-compatible string format (`rgba()`, `#RRGGBB`, etc.). */
  color: string
  /** If true, render as an inset shadow (web only). */
  inset?: boolean
}

/** Sentinel for "no shadow". Distinct from an empty array so types stay narrow. */
export type ShadowValue = readonly ShadowLayer[] | 'none'

export const shadows = {
  // Light mode shadows (with subtle ocean tint)
  light: {
    none: 'none' as const,

    // Subtle shadows
    xs: [{ x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(27, 127, 168, 0.05)' }],
    sm: [
      { x: 0, y: 1, blur: 3, spread: 0, color: 'rgba(27, 127, 168, 0.1)' },
      { x: 0, y: 1, blur: 2, spread: -1, color: 'rgba(27, 127, 168, 0.1)' },
    ],

    // Default shadows
    md: [
      { x: 0, y: 4, blur: 6, spread: -1, color: 'rgba(27, 127, 168, 0.1)' },
      { x: 0, y: 2, blur: 4, spread: -2, color: 'rgba(27, 127, 168, 0.1)' },
    ],
    lg: [
      { x: 0, y: 10, blur: 15, spread: -3, color: 'rgba(27, 127, 168, 0.1)' },
      { x: 0, y: 4, blur: 6, spread: -4, color: 'rgba(27, 127, 168, 0.1)' },
    ],

    // Prominent shadows
    xl: [
      { x: 0, y: 20, blur: 25, spread: -5, color: 'rgba(27, 127, 168, 0.1)' },
      { x: 0, y: 8, blur: 10, spread: -6, color: 'rgba(27, 127, 168, 0.1)' },
    ],
    '2xl': [{ x: 0, y: 25, blur: 50, spread: -12, color: 'rgba(27, 127, 168, 0.25)' }],

    // Special shadows
    inner: [{ x: 0, y: 2, blur: 4, spread: 0, color: 'rgba(27, 127, 168, 0.05)', inset: true }],
    // Focus ring — render as a single layer "shadow" with no offset/blur.
    // RN consumers should ignore this and use the platform focus mechanism.
    // Neutral slate-500 ring, matching the shipped CSS `--shadow-outline` (#455).
    outline: [{ x: 0, y: 0, blur: 0, spread: 3, color: 'rgba(100, 116, 139, 0.5)' }],
  },

  // Dark mode shadows (stronger, with deeper ocean tones)
  dark: {
    none: 'none' as const,

    // Subtle shadows
    xs: [{ x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(0, 0, 0, 0.3)' }],
    sm: [
      { x: 0, y: 1, blur: 3, spread: 0, color: 'rgba(0, 0, 0, 0.4)' },
      { x: 0, y: 1, blur: 2, spread: -1, color: 'rgba(0, 0, 0, 0.4)' },
    ],

    // Default shadows
    md: [
      { x: 0, y: 4, blur: 6, spread: -1, color: 'rgba(0, 0, 0, 0.4)' },
      { x: 0, y: 2, blur: 4, spread: -2, color: 'rgba(0, 0, 0, 0.4)' },
    ],
    lg: [
      { x: 0, y: 10, blur: 15, spread: -3, color: 'rgba(0, 0, 0, 0.4)' },
      { x: 0, y: 4, blur: 6, spread: -4, color: 'rgba(0, 0, 0, 0.4)' },
    ],

    // Prominent shadows
    xl: [
      { x: 0, y: 20, blur: 25, spread: -5, color: 'rgba(0, 0, 0, 0.5)' },
      { x: 0, y: 8, blur: 10, spread: -6, color: 'rgba(0, 0, 0, 0.5)' },
    ],
    '2xl': [{ x: 0, y: 25, blur: 50, spread: -12, color: 'rgba(0, 0, 0, 0.6)' }],

    // Special shadows
    inner: [{ x: 0, y: 2, blur: 4, spread: 0, color: 'rgba(0, 0, 0, 0.3)', inset: true }],
    outline: [{ x: 0, y: 0, blur: 0, spread: 3, color: 'rgba(100, 116, 139, 0.4)' }],
  },

  // Colored shadows (semantic hover/active glows).
  //
  // These mirror the brand-NEUTRAL default the DS renders. The live web source
  // is `--shadow-<fam>` in tokens.css, which is `color-mix(in oklab,
  // var(--color-<fam>[-base]), transparent 61%)` — i.e. the semantic base at
  // 0.39 alpha, following the active theme. The concrete rgba() below is that
  // expression resolved against the v0.36 brand-neutral defaults (kept in sync
  // with meta.shadows.colored, which emit-meta resolves the same way — #455).
  // Non-default themes/overrides recolor the CSS var at render time; this
  // snapshot is the default reference for RN/platform-agnostic consumers.
  colored: {
    primary: [{ x: 0, y: 4, blur: 14, spread: 0, color: 'rgba(126, 134, 142, 0.39)' }],
    success: [{ x: 0, y: 4, blur: 14, spread: 0, color: 'rgba(16, 185, 129, 0.39)' }],
    warning: [{ x: 0, y: 4, blur: 14, spread: 0, color: 'rgba(245, 158, 11, 0.39)' }],
    error: [{ x: 0, y: 4, blur: 14, spread: 0, color: 'rgba(239, 68, 68, 0.39)' }],
  },
} as const

// Elevation presets (semantic shadows for common scenarios)
export const elevation = {
  flat: shadows.light.none,           // No elevation
  raised: shadows.light.sm,           // Slightly elevated (cards at rest)
  floating: shadows.light.md,         // Floating above (dropdowns, popovers)
  lifted: shadows.light.lg,           // Lifted high (modals, dialogs)
  hovering: shadows.light.xl,         // Interactive hover state
  elevated: shadows.light['2xl'],     // Maximum elevation
} as const

// Component-specific shadow presets
export const componentShadows = {
  // Cards
  card: {
    rest: shadows.light.sm,
    hover: shadows.light.md,
    active: shadows.light.xs,
  },

  // Buttons
  button: {
    rest: shadows.light.xs,
    hover: shadows.light.sm,
    active: shadows.light.inner,
  },

  // Overlays
  modal: shadows.light['2xl'],
  popover: shadows.light.lg,
  dropdown: shadows.light.md,
  tooltip: shadows.light.sm,

  // Navigation
  navbar: shadows.light.sm,
  sidebar: shadows.light.md,

  // Focus states
  focus: shadows.light.outline,
} as const

// Type exports
export type Shadows = typeof shadows
export type Elevation = typeof elevation
export type ComponentShadows = typeof componentShadows
export type ShadowLevel = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'inner' | 'outline'
