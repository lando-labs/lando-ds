/**
 * Lando Labs Design System - Breakpoint Tokens
 * Mobile-first responsive design system
 *
 * Philosophy:
 * - Mobile-first approach (design for small screens, enhance for larger)
 * - Standard breakpoints aligned with common device sizes
 * - Fluid typography and spacing between breakpoints
 *
 * Single source of truth (#454):
 * - `breakpoints.px` below is the ONLY hand-maintained numeric table. The
 *   `up` / `down` / `between` media-query strings, `devices`, and
 *   `containerMaxWidth` are all DERIVED from it, and both
 *   `containerQueries.px` (./containerQueries) and the Sidebar's JS breakpoint
 *   constants reference `breakpoints.px` — so a tier only ever changes here.
 * - There is intentionally NO `--breakpoint-*` CSS custom-property mirror: CSS
 *   custom properties are illegal inside `@media (min-width: …)` by spec, so a
 *   CSS copy would be dead and misleading. Authored `@media` rules in
 *   `*.module.css` hardcode these px/rem values by necessity and must match
 *   this table (see `breakpoints.test.ts` for the guard).
 */

/** 1rem = 16px — the base used to convert the px source of truth to rem. */
const REM_BASE = 16

/** px → rem string with no trailing zeros, e.g. 768 → '48rem', 375 → '23.4375rem'. */
const rem = (value: number): string => `${value / REM_BASE}rem`

/** Mobile-first `min-width` media query at `value` px. */
const minWidth = (value: number): string => `@media (min-width: ${rem(value)})`

/** Desktop-first `max-width` media query at `value` px (callers pass tier − 1). */
const maxWidth = (value: number): string => `@media (max-width: ${rem(value)})`

/** Inclusive range between two px bounds. */
const rangeWidth = (minValue: number, maxValue: number): string =>
  `@media (min-width: ${rem(minValue)}) and (max-width: ${rem(maxValue)})`

/**
 * Pixel values — the SINGLE numeric source of truth for every responsive
 * threshold in the system. Everything else in this file (and the breakpoint
 * references in ./containerQueries and Sidebar) derives from these numbers.
 */
const px = {
  xs: 375,     // Small phones
  sm: 640,     // Large phones
  md: 768,     // Tablets
  lg: 1024,    // Small laptops
  xl: 1280,    // Laptops
  '2xl': 1536, // Desktops
  '3xl': 1920, // Large desktops
} as const

export const breakpoints = {
  // Pixel values (the source of truth — see `px` above)
  px,

  // Media query strings (mobile-first: min-width) — derived from `px`
  up: {
    xs: minWidth(px.xs),       // 375px
    sm: minWidth(px.sm),       // 640px
    md: minWidth(px.md),       // 768px
    lg: minWidth(px.lg),       // 1024px
    xl: minWidth(px.xl),       // 1280px
    '2xl': minWidth(px['2xl']), // 1536px
    '3xl': minWidth(px['3xl']), // 1920px
  },

  // Media query strings (desktop-first: max-width, one px below the tier)
  down: {
    xs: maxWidth(px.xs - 1),       // 374px
    sm: maxWidth(px.sm - 1),       // 639px
    md: maxWidth(px.md - 1),       // 767px
    lg: maxWidth(px.lg - 1),       // 1023px
    xl: maxWidth(px.xl - 1),       // 1279px
    '2xl': maxWidth(px['2xl'] - 1), // 1535px
    '3xl': maxWidth(px['3xl'] - 1), // 1919px
  },

  // Media query strings (range between consecutive tiers)
  between: {
    xsToSm: rangeWidth(px.xs, px.sm - 1),
    smToMd: rangeWidth(px.sm, px.md - 1),
    mdToLg: rangeWidth(px.md, px.lg - 1),
    lgToXl: rangeWidth(px.lg, px.xl - 1),
    xlTo2xl: rangeWidth(px.xl, px['2xl'] - 1),
    '2xlTo3xl': rangeWidth(px['2xl'], px['3xl'] - 1),
  },
} as const

// Device categories (semantic breakpoints)
export const devices = {
  mobile: breakpoints.down.md,      // < 768px
  tablet: breakpoints.between.mdToLg, // 768px - 1023px
  desktop: breakpoints.up.lg,       // >= 1024px
  wide: breakpoints.up['2xl'],      // >= 1536px
} as const

// Container max-widths for each breakpoint (numeric part derived from `px`)
export const containerMaxWidth = {
  xs: '100%',              // Full width on mobile
  sm: `${px.sm}px`,        // 640px
  md: `${px.md}px`,        // 768px
  lg: `${px.lg}px`,        // 1024px
  xl: `${px.xl}px`,        // 1280px
  '2xl': `${px['2xl']}px`, // 1536px
} as const

// Helper function to create media queries
export const createMediaQuery = (
  breakpoint: keyof typeof breakpoints.px,
  type: 'up' | 'down' = 'up',
): string => {
  const value = breakpoints.px[breakpoint]
  return type === 'up' ? minWidth(value) : maxWidth(value - 1)
}

// Type exports
export type Breakpoints = typeof breakpoints
export type BreakpointKey = keyof typeof breakpoints.px
export type Devices = typeof devices
export type ContainerMaxWidth = typeof containerMaxWidth
