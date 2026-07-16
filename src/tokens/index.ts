/**
 * Lando Labs Design System - Token Index
 * Centralized export for all design tokens
 *
 * Usage:
 * import { colors, spacing, typography } from '@lando-labs/lando-ds/tokens'
 * import { tokens } from '@lando-labs/lando-ds/tokens' // All tokens
 */

// Export individual token modules
export { colors, ocean, teal, neutral, semantic, dark, resolveColorPath } from './colors'
export type { Colors, ColorScale, ColorPath } from './colors'

// Semantic anchor hexes (#379) — named JS constants alongside the OKLCH
// helpers so downstream theme tooling can import a single source of truth
// instead of hardcoding `'#2DBFBF'` etc.
export { SUCCESS_BASE, WARNING_BASE, ERROR_BASE, INFO_BASE } from './colors'

// OKLCH color-conversion helpers (#286). Published TypeScript twin of
// scripts/lib/oklch.mjs so consumers stop forking the sRGB <-> OKLCH math.
export * from './oklch'

// WCAG contrast math (#288). Companion to the OKLCH helpers: derive a theme,
// then verify it still clears AA. Used by the brand-tinted-chrome harness.
export * from './contrast'

export { typography, textStyles, fontFamilyPrimary, textTransform } from './typography'
export type {
  Typography,
  TextStyles,
  FontSize,
  FontWeight,
  LineHeight,
  LetterSpacing,
  TextTransform,
  TextTransformKey,
} from './typography'

export { spacing, componentSpacing, layout } from './spacing'
export type { Spacing, SpacingValue, ComponentSpacing, Layout } from './spacing'

export { radius, componentRadius } from './radius'
export type { Radius, RadiusValue, ComponentRadius } from './radius'

// Border-width primitives (#375) — pairs with --color-border-* and the
// componentRadius scale to give consumers a tokenized stroke width.
export { borderWidth } from './border'
export type { BorderWidth, BorderWidthKey } from './border'

// Sizing primitives (#375) — popover/panel min/max for floating overlays.
export { sizing, popoverSize } from './sizing'
export type { Sizing, PopoverSize } from './sizing'

export { shadows, elevation, componentShadows } from './shadows'
export type { Shadows, Elevation, ComponentShadows, ShadowLevel, ShadowLayer, ShadowValue } from './shadows'

export { animation, transitions, keyframes, animationPresets } from './animation'
export type { Animation, Transitions, Keyframes, AnimationPresets, Duration, Easing, EasingBezier } from './animation'

export { breakpoints, devices, containerMaxWidth, createMediaQuery } from './breakpoints'
export type { Breakpoints, BreakpointKey, Devices, ContainerMaxWidth } from './breakpoints'

export { containerQueries, createContainerQuery } from './containerQueries'
export type { ContainerQueries, ContainerName } from './containerQueries'

export { zIndex, componentZIndex } from './zIndex'
export type { ZIndex, ZIndexValue, ComponentZIndex } from './zIndex'

export { themePresets, getThemePreset, landoTheme, oceanTheme, midnightTheme, sunsetTheme, forestTheme, roseTheme, slateTheme, DEFAULT_THEME_PRESET } from './themePresets'
export type { ThemePreset } from './themePresets'

// Unified tokens object (for contexts, providers, etc.)
import { colors } from './colors'
import { typography, textStyles, textTransform } from './typography'
import { spacing, componentSpacing, layout } from './spacing'
import { radius, componentRadius } from './radius'
import { shadows, elevation, componentShadows } from './shadows'
import { animation, transitions, keyframes, animationPresets } from './animation'
import { breakpoints, devices, containerMaxWidth } from './breakpoints'
import { containerQueries } from './containerQueries'
import { zIndex, componentZIndex } from './zIndex'
import { borderWidth } from './border'
import { sizing } from './sizing'

export const tokens = {
  colors,
  typography,
  textStyles,
  textTransform,
  spacing,
  componentSpacing,
  layout,
  radius,
  componentRadius,
  borderWidth,
  shadows,
  elevation,
  componentShadows,
  animation,
  transitions,
  keyframes,
  animationPresets,
  breakpoints,
  devices,
  containerMaxWidth,
  containerQueries,
  zIndex,
  componentZIndex,
  sizing,
} as const

export type Tokens = typeof tokens

// Multi-brand architecture support
// These interfaces allow product-specific themes to override tokens
//
// Security (#323): override VALUES are written to CSS custom properties at
// runtime by `ThemeProvider`'s `applyTheme`. Before each write the composed
// value is screened by `isSafeTokenValue`; values carrying a CSS-injection
// vector (`;`, `url(`, `@import`, `<`, …) are rejected and skipped (fail-safe —
// the token keeps its DS default). Keys remain DS-controlled and are not
// type-narrowed here so consumers can pass arbitrary semantic token keys.

/**
 * Mode-aware product token value (#370). Lets a single product theme carry
 * BOTH a light value and a dark value for a token; `ThemeProvider` picks the
 * side that matches the active `data-theme` and re-applies on mode toggle.
 *
 * Flat values (a single string) remain supported — that's the legacy shape and
 * the most common case. Reach for `{ light, dark }` only when a product theme
 * needs to override surface/background/text tokens that need to differ between
 * light and dark mode (without it, those overrides freeze the app into one
 * mode after `setProductTheme`).
 *
 * The shape lives here next to `ThemeTokens` so consumers can import it from
 * `@lando-labs/lando-ds/tokens`. The runtime resolver lives in
 * `ThemeProvider` and is re-exported from the package root.
 */
export interface ModeAwareTokenValue<T = string> {
  light: T
  dark: T
}

export interface ThemeTokens {
  /**
   * Flat semantic color overrides, applied as `--color-<key>` (#286, #370).
   * Each value is EITHER:
   *
   *   - A flat string (legacy): `{ primary: '#1B7FA8' }`. Applied verbatim in
   *     both light and dark mode.
   *   - A `{ light, dark }` pair (mode-aware, #370):
   *     `{ background: { light: '#FFFFFF', dark: '#011219' } }`. `ThemeProvider`
   *     picks the side that matches the active mode and re-applies on toggle.
   *
   * Prefer the flat shape for ramp re-skins (overriding a base color re-skins
   * its ramp + states via OKLCH derivation). Use the mode-aware shape for
   * tokens that legitimately need to differ between modes (e.g. `background`,
   * `surface`, `text-*`, `border-*`) — without it, those overrides freeze the
   * app into whatever mode was active when the theme was applied.
   */
  color?: Record<string, string | ModeAwareTokenValue<string>>
  /** Nested raw-palette overrides (ocean/teal/semantic ramps). Rarely needed. */
  colors?: Partial<typeof colors>
  /**
   * Typography overrides. Applied to the vars components actually consume —
   * `--font-family-*`, `--font-size-*`, `--font-weight-*`, `--line-height-*`,
   * `--letter-spacing-*` — NOT `--typography-*` (#480). Shape is nested by
   * primitive group, e.g.
   * `{ fontFamily: { base: 'Inter, sans-serif' }, fontSize: { lg: '1.2rem' }, fontWeight: { bold: 700 } }`.
   * Values may be CSS strings OR the DS's native numeric shape — numbers compose
   * with the correct unit per group (`fontWeight`/`lineHeight` unitless,
   * `letterSpacing` in `em`, `fontSize` in `px`); `fontFamily` takes a string.
   * The composite type scales (`display`,
   * `heading`, `body`, `label`, `code`) are not plain custom properties and are
   * ignored on this path.
   */
  typography?: Partial<typeof typography>
  /**
   * Non-color category overrides. The mode-aware `{ light, dark }` shape is
   * supported only on the flat `color` field above — DO NOT pass `{ light, dark }`
   * for spacing / radius / shadows / typography values. The runtime resolver is
   * shape-blind and will unwrap a `{ light, dark }` here, but the resulting
   * single string lands in a slot that expects `box-shadow` / `px` / etc., which
   * is inert but undefined behavior. Express per-mode variation in `color` only.
   *
   * Var mapping (#480): `spacing`/`radius` are 1:1 (`--spacing-*`/`--radius-*`);
   * `shadows` maps to the SINGULAR `--shadow-*` with a per-key `ShadowLayer[]`
   * value (e.g. `{ md: [{ x: 0, y: 4, blur: 6, spread: -1, color: 'rgba(0,0,0,.1)' }] }`);
   * `animation` is nested → `--duration-*` (ms numbers) and `--easing-*`
   * (cubic-bezier 4-tuples), and its keyframe presets are ignored.
   */
  spacing?: Partial<typeof spacing>
  radius?: Partial<typeof radius>
  shadows?: Partial<typeof shadows>
  animation?: Partial<typeof animation>
}

export interface ProductTheme {
  name: string
  tokens: ThemeTokens
}
