/**
 * Lando Labs Design System - Color Tokens
 *
 * v0.36.0 OSS-prep (#421): the library ships brand-neutral by default. The
 * `ocean` and `teal` palettes are retained as raw tokens (consumers may pin
 * against them; the opt-in `lando` theme preset routes the semantic layer
 * back through them for the historical Lando look), but the SEMANTIC layer
 * defaults to neutral gray + universally-recognizable status hues.
 *
 * The four families:
 *   - `ocean`   — legacy Lando brand palette (blues), opt-in via `lando` preset
 *   - `teal`    — legacy Lando supporting palette, opt-in via `lando` preset
 *   - `neutral` — cool-tinted grays, the default chrome
 *   - `semantic` — success (green), warning (amber), error (red), info (blue)
 */

export const colors = {
  // Legacy Lando brand palette - kept defined so consumers can pin against it
  // and so the opt-in `lando` theme preset can route the semantic layer back
  // through these rungs. v0.36.0+ defaults DO NOT consume this directly.
  ocean: {
    lightest: '#E6F4F7',    // Shallow water, subtle backgrounds
    lighter: '#B3DDE8',     // Surface shimmer, hover states
    light: '#66C2D9',       // Bright ocean, secondary actions
    base: '#2BA3D4',        // Bright accent
    medium: '#1B7FA8',      // Medium brand
    dark: '#136080',        // Pressed states
    darker: '#0D4358',      // Depths
    darkest: '#082A38',     // Abyss, dark backgrounds
  },

  // Legacy Lando supporting palette - opt-in via `lando` preset (see above).
  teal: {
    lightest: '#E6F7F7',    // Soft teal background
    lighter: '#B3EBEB',     // Light teal hover
    light: '#66D9D9',       // Bright teal
    base: '#2DBFBF',        // Teal bright
    medium: '#1A9999',      // Medium teal
    dark: '#127373',        // Dark teal
    darker: '#0C4D4D',      // Darker teal
    darkest: '#062929',     // Deepest teal
  },

  // Neutrals - Cool-tinted grays
  neutral: {
    white: '#FFFFFF',
    50: '#F8FAFB',          // Lightest background
    100: '#F1F5F7',         // Light background
    200: '#E1E8ED',         // Borders, dividers
    300: '#C7D3DB',         // Disabled backgrounds
    400: '#B0BEC5',         // Disabled text, placeholder
    500: '#90A4AE',         // Secondary text
    // #4 — darkened from #607D8B (4.37:1 on white, sub-AA down to 3.53:1 on
    // --color-surface-hover) so --color-text-secondary clears WCAG AA
    // (>=4.5:1) on EVERY default light-mode surface it renders on, including
    // the darkest one (surface-hover). Worst case now 4.78:1. See
    // src/tokens/chrome-contrast.test.ts.
    600: '#4C6876',         // Body text (light mode) — WCAG AA text tier
    700: '#455A64',         // Headings (light mode)
    800: '#37474F',         // Dark text
    900: '#263238',         // Darkest text
    black: '#000000',
  },

  // Semantic Colors — universally-recognizable status hues. v0.36.0 OSS-prep
  // (#421): success shifted from teal → emerald-green and info shifted from
  // ocean → true blue, so the semantic layer reads as standard status colors
  // without carrying Lando brand identity. The `lando` preset overrides these
  // back to teal/ocean for consumers wanting the legacy look.
  semantic: {
    // Success - Growth, positive outcomes (emerald green)
    success: {
      lightest: '#D1FAE5',
      light: '#6EE7B7',
      base: '#10B981',      // Emerald-500
      dark: '#047857',
      darkest: '#064E3B',
    },

    // Warning - Caution, important info (amber - unchanged)
    warning: {
      lightest: '#FEF3E2',
      light: '#FCD980',
      base: '#F59E0B',      // Amber
      dark: '#D97706',
      darkest: '#92400E',
    },

    // Error - Danger, critical issues (red - unchanged)
    error: {
      lightest: '#FEE2E2',
      light: '#FCA5A5',
      base: '#EF4444',      // Red
      dark: '#DC2626',
      darkest: '#7F1D1D',
    },

    // Info - Informational, neutral highlights (true blue)
    info: {
      lightest: '#DBEAFE',
      light: '#93C5FD',
      base: '#3B82F6',      // Blue-500
      dark: '#1D4ED8',
      darkest: '#1E3A8A',
    },
  },

  // Dark Mode Palette
  dark: {
    // Background layers
    bg: {
      base: '#0A1929',      // Midnight blue - darkest background
      elevated: '#082A38',  // Slightly lighter for cards
      hover: '#0D4358',     // Hover state
    },

    // Text colors
    text: {
      primary: '#F8FAFB',   // High contrast
      secondary: '#B3DDE8', // Medium contrast
      tertiary: '#66C2D9',  // Low contrast
      disabled: '#455A64',  // Disabled state
    },

    // Borders and dividers
    border: {
      subtle: '#136080',    // Subtle borders
      default: '#1B7FA8',   // Default borders
      strong: '#2BA3D4',    // Emphasized borders
    },
  },
} as const

// Export individual color scales for convenience
export const ocean = colors.ocean
export const teal = colors.teal
export const neutral = colors.neutral
export const semantic = colors.semantic
export const dark = colors.dark

// Type exports
export type ColorScale = typeof colors.ocean
export type Colors = typeof colors

// ---------------------------------------------------------------------------
// Typed color paths (issue #252)
// ---------------------------------------------------------------------------
//
// Components accept `color` as a dotted token path (`ocean.base`,
// `semantic.success.lightest`, `neutral.500`). Historically those props were
// typed `string`, so invalid paths like `ocean.500` compiled and rendered
// as `undefined` at runtime, falling back to inherited black. The 2026-05-20
// RN lab audit caught this on `<Text color="ocean.500">` in production code.
//
// `ColorPath` derives the union of valid paths from the `colors` object
// using a recursive template-literal helper. Consumers can type their
// `color` prop as `ColorPath` (strict) or `ColorPath | string` (back-compat
// with CSS strings like `var(--custom)`).

/**
 * Recursive helper that produces a union of dotted paths to every string
 * leaf in `T`. Skips non-string leaves and non-object branches.
 *
 * @example `PathTo<{ a: { b: '#fff'; c: '#000' } }>` => `'a.b' | 'a.c'`
 */
type PathTo<T, Prefix extends string = ''> = {
  [K in keyof T & (string | number)]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends object
      ? PathTo<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & (string | number)]

/**
 * Union of all valid dotted token paths into the color palette.
 *
 * Includes top-level palette paths (`ocean.base`, `teal.medium`,
 * `neutral.500`), semantic aliases (`semantic.success.lightest`), and
 * dark-mode tokens (`dark.bg.elevated`).
 *
 * @example
 * ```ts
 * const ok: ColorPath = 'ocean.base'                  // ✓
 * const ok2: ColorPath = 'semantic.success.lightest'  // ✓
 * const ok3: ColorPath = 'neutral.500'                // ✓
 *
 * // @ts-expect-error — ocean palette has no numeric scale
 * const bad: ColorPath = 'ocean.500'
 * // @ts-expect-error — typo
 * const bad2: ColorPath = 'oceans.base'
 * ```
 *
 * For props that should also accept arbitrary CSS strings (e.g.
 * `var(--custom)` or `#ff0000`), declare as `ColorPath | string` to
 * preserve the typed completion while keeping the escape hatch.
 */
export type ColorPath = PathTo<typeof colors>

/**
 * Resolve a dotted color path to its actual hex string by walking the
 * `colors` object. Returns `undefined` if the path doesn't exist — the
 * `ColorPath` type prevents this at compile time for typed paths, but
 * runtime callers handling user input may still hit it.
 *
 * @example
 * ```ts
 * resolveColorPath('ocean.base')                // '#2BA3D4'
 * resolveColorPath('semantic.success.lightest') // '#E6F7F7'
 * resolveColorPath('neutral.500')               // '#90A4AE'
 * ```
 */
export function resolveColorPath(path: ColorPath): string | undefined {
  const parts = path.split('.')
  let current: unknown = colors
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

// ---------------------------------------------------------------------------
// Semantic anchor hexes (#379)
// ---------------------------------------------------------------------------
//
// Named hex constants for the four semantic ramp anchors that downstream
// theme tooling (OKLCH math, contrast checkers, swatch grids) needs as
// JS values rather than CSS custom properties. Mirrors the
// `--color-success-base` / `--color-warning-base` / etc. token naming so
// the JS and CSS surfaces line up name-for-name.
//
// A consumer app's theme tooling hardcoded these as `SUCCESS_ANCHOR='#2DBFBF'`
// constants, duplicating the DS source of truth. The
// constants below give downstream theme tooling a single import line
// against the DS palette.
//
// These deliberately re-state the existing `colors.semantic.<X>.base`
// values rather than computing from them, so they are also exportable
// as named identifiers in `.d.ts` (typed as `string`, not `'#2DBFBF'`
// literals — runtime hex strings, not template-literal types).

/** Hex anchor for the success ramp. Pairs with `--color-success-base`. */
export const SUCCESS_BASE: string = colors.semantic.success.base

/** Hex anchor for the warning ramp. Pairs with `--color-warning-base`. */
export const WARNING_BASE: string = colors.semantic.warning.base

/** Hex anchor for the error ramp. Pairs with `--color-error-base`. */
export const ERROR_BASE: string = colors.semantic.error.base

/** Hex anchor for the info ramp. Pairs with `--color-info-base`. */
export const INFO_BASE: string = colors.semantic.info.base
