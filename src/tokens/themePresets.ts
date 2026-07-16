/**
 * Lando Labs Design System - Theme Presets
 * Predefined theme variations layered over the brand-neutral default.
 *
 * Architecture: each preset overrides specific color tokens via
 * `<ThemeProvider preset="<id>">`; everything else (spacing, typography,
 * radius, animation, derived ramps, dark-mode chrome) inherits the default
 * tokens. v0.36.0 OSS-prep (#421): the default is now brand-neutral; the
 * `lando` preset restores the historical Lando ocean+teal palette.
 *
 * The declarative `preset` prop (#440) applies the preset on first render
 * (SSR-safe); a persisted user preset wins after hydration. For zero-flash on
 * the default-brand case, pair it with the anti-flash script:
 * `themeScript({ defaultPreset: 'lando' })` in `<head>` inlines the preset's
 * `--color-*` before first paint (first visit only). The preset.colors →
 * `--color-*` mapping is centralized in `presetColorVars`.
 */

export interface ThemePreset {
  /** Unique identifier for the preset */
  id: string
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Color overrides for this preset */
  colors: {
    // Primary colors
    primary?: string
    primaryHover?: string
    primaryActive?: string

    /**
     * Secondary brand base. Mirror of `primary` for the supporting ramp —
     * `--color-secondary-*` shade derivations + state tints (hover/active/
     * disabled) all re-skin automatically when this single token moves.
     */
    secondary?: string

    // Accent colors (if different from primary)
    accent?: string
    accentLight?: string
    accentDark?: string

    // Optional: Semantic color overrides
    success?: string
    warning?: string
    error?: string
    info?: string
  }
}

/**
 * Lando Theme — restores the historical Lando ocean+teal palette.
 *
 * v0.36.0 OSS-prep (#421): the library ships brand-neutral by default. Apply
 * declaratively via `<ThemeProvider preset="lando">` (SSR-safe first render,
 * #440) or imperatively via `setThemePreset('lando')`. Overrides primary +
 * secondary + accent + status base colors; all derived ramps and state tints
 * re-skin automatically via the existing OKLCH derivation layer.
 *
 * Consumers wanting the legacy Lando look on >v0.36.0 can opt in here. Pre-
 * v0.36.0 consumers upgrading and wanting no visual change: opt into this
 * preset OR override `--color-primary` to `#1B7FA8` at :root.
 *
 * @example Declarative (recommended)
 * ```tsx
 * <ThemeProvider preset="lando">
 *   <App />
 * </ThemeProvider>
 * ```
 *
 * @example Zero-flash SSR (Next.js App Router) — pair with the anti-flash script
 * ```tsx
 * // in <head>, so the preset colors paint on the first frame (first visit):
 * <head dangerouslySetInnerHTML={{ __html: themeScript({ defaultPreset: 'lando' }) }} />
 * // in <body>:
 * <ThemeProvider preset="lando">{children}</ThemeProvider>
 * ```
 */
export const landoTheme: ThemePreset = {
  id: 'lando',
  name: 'Lando',
  description: 'Historical Lando ocean+teal palette (pre-v0.36.0 default)',
  colors: {
    primary: '#1B7FA8',      // ocean-medium
    secondary: '#2DBFBF',    // teal-base — drives the secondary ramp
    accent: '#2BA3D4',       // ocean-base
    accentLight: '#66C2D9',  // ocean-light
    accentDark: '#0D4358',   // ocean-darker
    success: '#2DBFBF',      // teal-base (the historical success was teal, not green)
    info: '#2BA3D4',         // ocean-base (the historical info was ocean, not blue)
  }
}

/**
 * Ocean Theme — alias of {@link landoTheme} for backwards compatibility.
 *
 * The pre-v0.36.0 `ocean` preset existed but only re-skinned primary + accent.
 * The new `lando` preset covers the full Lando palette (primary + secondary +
 * accent + status colors). `ocean` is kept as a legacy alias so existing
 * `setThemePreset('ocean')` callers continue to work; new code should reach
 * for `landoTheme` / `'lando'`.
 */
export const oceanTheme: ThemePreset = {
  ...landoTheme,
  id: 'ocean',
  name: 'Ocean',
  description: 'Alias of the `lando` preset (historical name).',
}

/**
 * Midnight Theme
 * Deep purples and indigos - sophisticated and mysterious
 * Evokes: depth, wisdom, creativity, night ocean
 */
export const midnightTheme: ThemePreset = {
  id: 'midnight',
  name: 'Midnight',
  description: 'Deep purples and indigos for sophisticated interfaces',
  colors: {
    primary: '#6366F1',      // Indigo-500
    accent: '#8B5CF6',        // Violet-500
    accentLight: '#A78BFA',   // Violet-400
    accentDark: '#7C3AED',    // Violet-600
    info: '#6366F1',          // Indigo for info
  }
}

/**
 * Sunset Theme
 * Warm corals and oranges - energetic and optimistic
 * Evokes: warmth, creativity, energy, beach sunset
 */
export const sunsetTheme: ThemePreset = {
  id: 'sunset',
  name: 'Sunset',
  description: 'Warm corals and oranges for vibrant, energetic feel',
  colors: {
    primary: '#F97316',      // Orange-500
    accent: '#F59E0B',        // Amber-500
    accentLight: '#FCD34D',   // Amber-300
    accentDark: '#D97706',    // Amber-600
    warning: '#FBBF24',       // Amber-400 (slightly different)
  }
}

/**
 * Forest Theme
 * Rich greens and emeralds - natural and growth-oriented
 * Evokes: nature, growth, balance, forest canopy
 */
export const forestTheme: ThemePreset = {
  id: 'forest',
  name: 'Forest',
  description: 'Rich greens and emeralds for natural, calming interfaces',
  colors: {
    primary: '#10B981',      // Emerald-500
    accent: '#14B8A6',        // Teal-500
    accentLight: '#5EEAD4',   // Teal-300
    accentDark: '#0D9488',    // Teal-600
    success: '#10B981',       // Emerald-500
  }
}

/**
 * Rose Theme
 * Soft pinks and magentas - elegant and welcoming
 * Evokes: elegance, warmth, wellness, beauty
 */
export const roseTheme: ThemePreset = {
  id: 'rose',
  name: 'Rose',
  description: 'Soft pinks and magentas for elegant, welcoming interfaces',
  colors: {
    primary: '#EC4899',      // Pink-500
    accent: '#F43F5E',        // Rose-500
    accentLight: '#FB7185',   // Rose-400
    accentDark: '#E11D48',    // Rose-600
    info: '#EC4899',          // Pink for info
  }
}

/**
 * Slate Theme
 * Cool grays and blues - professional and modern
 * Evokes: professionalism, clarity, minimalism
 */
export const slateTheme: ThemePreset = {
  id: 'slate',
  name: 'Slate',
  description: 'Cool grays and subtle blues for professional, minimal feel',
  colors: {
    primary: '#64748B',      // Slate-500
    accent: '#0EA5E9',        // Sky-500
    accentLight: '#38BDF8',   // Sky-400
    accentDark: '#0284C7',    // Sky-600
    info: '#0EA5E9',          // Sky-500
  }
}

/**
 * All available theme presets.
 *
 * Order matters for selector UI (the lab's theme picker iterates this array):
 * `lando` first since it's the only one most users will reach for; the
 * decorative presets follow. `oceanTheme` is a legacy alias of `landoTheme`
 * and is intentionally NOT in this array (it would be a visual duplicate).
 */
export const themePresets: ThemePreset[] = [
  landoTheme,
  midnightTheme,
  sunsetTheme,
  forestTheme,
  roseTheme,
  slateTheme,
]

/**
 * Get theme preset by ID. Accepts both `'lando'` and the legacy `'ocean'`
 * alias; both resolve to the historical Lando palette.
 */
export function getThemePreset(id: string): ThemePreset | undefined {
  // Legacy alias — 'ocean' was the pre-v0.36.0 default preset id.
  if (id === 'ocean') return oceanTheme
  return themePresets.find(preset => preset.id === id)
}

/**
 * Default theme preset ID.
 *
 * v0.36.0 OSS-prep (#421): no default preset is applied at boot — the library
 * ships brand-neutral, and consumers opt into a preset explicitly via
 * `<ThemeProvider preset="lando">`. The empty-string sentinel signals "no
 * preset" while keeping the type `string` for legacy callers.
 */
export const DEFAULT_THEME_PRESET = ''
