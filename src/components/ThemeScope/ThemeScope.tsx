'use client'

/**
 * ThemeScope (#395)
 *
 * Apply a DS theme to a SUB-TREE only — without stomping `:root`.
 *
 * The default `ThemeProvider` is a global singleton: every `setProductTheme`
 * write lands on `document.documentElement.style`. That's correct for the
 * vast majority of apps, but it makes per-section theme previews ("hover the
 * hue slider to re-theme just THIS hero") and multi-brand pages
 * impossible — every change re-themes the whole document.
 *
 * `<ThemeScope>` solves that by writing the same tokens / attributes that
 * `ThemeProvider` writes, but to a WRAPPER ELEMENT instead of `:root`.
 * CSS custom properties inherit through the cascade, so descendants pick up
 * the scoped overrides automatically — and the rest of the page is
 * undisturbed.
 *
 * @example Per-section theme preview
 * ```tsx
 * <ThemeProvider>            {/* global; writes to :root *\/}
 *   <Header />
 *   <ThemeScope theme={liveDemoTheme}>   {/* scoped; writes to wrapper *\/}
 *     <LandingHero />        {/* re-themes without touching :root *\/}
 *   </ThemeScope>
 *   <Footer />
 * </ThemeProvider>
 * ```
 *
 * @example Dark island inside a light app
 * ```tsx
 * <ThemeProvider defaultMode="light">
 *   <App />
 *   <ThemeScope mode="dark">
 *     <PromoSection />     {/* renders in dark mode for this subtree *\/}
 *   </ThemeScope>
 * </ThemeProvider>
 * ```
 *
 * ## SSR-correct from first paint (#428)
 *
 * The scope's attributes (`data-theme` / `data-theme-preset` / `data-product`)
 * and its `--*` custom properties are computed during RENDER (via the pure
 * `computeThemeAttrs`) and emitted inline as JSX — NOT applied in a client
 * `useEffect`. That means the scope is present in server-rendered HTML and is
 * correct on the very first frame, so a forced-mode island no longer flashes
 * the surrounding page's theme before hydration.
 *
 * Because the `style` object and the `data-*` props are React-controlled,
 * swapping the `theme` / `preset` / `mode` prop re-renders a fresh style object
 * and attribute set: React removes any `--*` var (and any `data-*`) absent from
 * the new render, so stale keys are dropped with no bookkeeping ref needed.
 *
 * ## Sink invariant
 *
 * Values still flow through the pure `computeThemeAttrs`, which screens every
 * value with `isSafeTokenValue` before it can reach the `style` object — the
 * same chokepoint the runtime `applyTheme` uses. React writes the style object
 * property-by-property (no `cssText` re-parse), so the #323 single-value sink
 * shape is preserved. `ThemeScope.test.tsx` pins the no-re-parsing-sink guard.
 */

import React from 'react'
import type { ProductTheme } from '../../tokens'
import {
  computeThemeAttrs,
  useOptionalTheme,
  type ResolvedTheme,
} from '../../utils/ThemeProvider'

export interface ThemeScopeProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Product theme to apply within this subtree only. Same shape as
   * `ThemeProvider`'s `defaultProductTheme`. Mode-aware `{ light, dark }`
   * values resolve against this scope's `mode` (which may differ from the
   * surrounding ThemeProvider's resolved theme).
   */
  theme?: ProductTheme

  /**
   * Override the resolved mode for this subtree (e.g. a "dark island" inside
   * a light page). When omitted, the scope inherits the mode from the
   * surrounding `ThemeProvider`. When no `ThemeProvider` is mounted, defaults
   * to `'light'`.
   */
  mode?: ResolvedTheme

  /**
   * Override the theme preset for this subtree. Same string ids as
   * `setThemePreset` (`'forest'`, `'midnight'`, …). When omitted, no preset
   * attribute is set on the wrapper.
   */
  preset?: string

  /**
   * Children rendered inside the scoped wrapper.
   */
  children: React.ReactNode
}

export const ThemeScope = React.forwardRef<HTMLDivElement, ThemeScopeProps>(function ThemeScope(
  { theme: productTheme, mode, preset, children, style, ...rest },
  ref,
) {
  // Inherit the surrounding ThemeProvider's resolved mode when no `mode` prop
  // is given. `useOptionalTheme` returns `undefined` when no provider is
  // mounted, so a standalone ThemeScope falls back to `'light'`. (This hook is
  // why ThemeScope is a client component; the scope itself renders inline.)
  const surroundingTheme = useOptionalTheme()
  const resolvedMode: ResolvedTheme = mode ?? surroundingTheme?.theme ?? 'light'

  // Compute the scope's attribute set + `--*` var map during render — no DOM
  // writes. `tintChrome` is intentionally not exposed on ThemeScope: it's a
  // root-only chrome attribute gating page-level chrome tokens; a scoped
  // re-tint of chrome inside an island doesn't make sense.
  const { attributes, vars, colorScheme } = computeThemeAttrs(
    resolvedMode,
    productTheme,
    preset,
    false,
  )

  // Merge order (matches the historical effect behavior):
  //   consumer style → scope vars → color-scheme
  // Scope vars win over a consumer `--*` of the same name (the old effect ran
  // AFTER render and `setProperty`'d them on top). React replaces this whole
  // object each render, so swapping a prop drops any var absent from the new
  // map — no cleanup ref needed.
  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(vars as React.CSSProperties),
    colorScheme,
  }

  // ORDERING CONTRACT: spread `{...rest}` BEFORE the scope attributes so a
  // consumer can never clobber the DS scope attributes
  // (`data-theme` / `data-theme-preset` / `data-product`). `style` is pulled
  // out of `rest` above and merged explicitly so scope vars always apply.
  return (
    <div ref={ref} {...rest} {...attributes} style={mergedStyle}>
      {children}
    </div>
  )
})

ThemeScope.displayName = 'ThemeScope'
