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
 * ## SSR-correct from first paint (#428) — EXCEPT one inherited-mode case (#501)
 *
 * The scope's attributes (`data-theme` / `data-theme-preset` / `data-product`)
 * and its `--*` custom properties are computed during RENDER (via the pure
 * `computeThemeAttrs`) and emitted inline as JSX — NOT applied in a client
 * `useEffect`. That means the scope is present in server-rendered HTML and is
 * correct on the very first frame for every SSR-STABLE input: an explicit
 * `mode` prop, an inherited mode from a provider given `initialMode` /
 * `forcedTheme` (or a non-`'system'` `defaultMode`), or no provider at all.
 *
 * Because the `style` object and the `data-*` props are React-controlled,
 * swapping the `theme` / `preset` / `mode` prop re-renders a fresh style object
 * and attribute set: React removes any `--*` var (and any `data-*`) absent from
 * the new render, so stale keys are dropped with no bookkeeping ref needed.
 *
 * **The exception (#501):** a scope with NO `mode` prop, inheriting from a
 * surrounding `ThemeProvider` whose raw `mode` is `'system'` (the default),
 * is NOT SSR-stable. `ThemeProvider`'s `theme` state seeds from
 * `resolveTheme('system')`, which reads `window.matchMedia` inside the
 * `useState` initializer itself — `window === undefined` on the server
 * (→ `'light'`), but already defined by the time React hydrates on the
 * client, so `surroundingTheme.theme` is the REAL OS preference from the
 * client's very first render, before any effect runs. Emitting that value
 * straight into this scope's JSX would make the client's first render differ
 * from the server's — a hydration mismatch on `data-theme` / `color-scheme` /
 * every derived `--*` var (including `--color-primary-base`, #11's dark
 * override). Worse, React does not repatch mismatched attribute/style props
 * once hydration completes (only text nodes get corrected) — without an
 * explicit later commit, the scope stays stuck on the server's `'light'`
 * guess for the life of the page. See the "Inherited-mode SSR guard" section
 * below for the fix.
 *
 * ## Sink invariant
 *
 * Values still flow through the pure `computeThemeAttrs`, which screens every
 * value with `isSafeTokenValue` before it can reach the `style` object — the
 * same chokepoint the runtime `applyTheme` uses. React writes the style object
 * property-by-property (no `cssText` re-parse), so the #323 single-value sink
 * shape is preserved. `ThemeScope.test.tsx` pins the no-re-parsing-sink guard.
 *
 * ## Tonal-ramp / interaction-state re-derivation (#11)
 *
 * `src/styles/tokens.css` derives `--color-primary-hover` / `-active` /
 * `-disabled` and the full `-lightest…-darkest` ramp (same for `secondary`,
 * plus the `error`/`danger` state tints) from their base role token via
 * `color-mix()` — but only declares those formulas on `:root`. A `var()`
 * inside a declaration resolves at the DECLARING element's scope, so a
 * `ThemeScope` wrapper that overrides `--color-primary` does not, by itself,
 * cause `--color-primary-hover` to recompute — it inherits `:root`'s already-
 * resolved value. `computeThemeAttrs(mode, theme, preset, tintChrome, true)`
 * re-declares those same formulas (as literal `color-mix()` STRINGS, mirrored
 * in `../../utils/colorDerivation.ts`) inline on THIS wrapper, so they
 * recompute against the scope's own (possibly overridden) base token — the
 * scope opts in via the 5th `computeThemeAttrs` argument below. The root
 * `ThemeProvider`/`applyTheme` path does not pass it: `:root`'s real CSS rule
 * already covers `document.documentElement` directly, so root behavior is
 * unchanged.
 *
 * ## Inherited-mode SSR guard (#501)
 *
 * Chose option (a) from the investigation — a placeholder-then-correct
 * "client reconcile gate", mirroring the root `ThemeProvider`'s OWN pattern
 * of deferring the real `prefers-color-scheme` read past first paint — over
 * option (b) "resolve mode only from an SSR-stable source, never the live
 * system read". (b) can't actually FIX the stuck-forever bug: it would mean
 * an inherited `system`-mode scope simply never resolves to the real OS
 * preference at all (permanently `'light'`), trading one bug (wrong-then-
 * stuck) for another (wrong-forever-by-design). (a) is also the smaller
 * diff: it reuses `computeThemeAttrs`/`getScopedDerivedColorVars` unchanged
 * and touches nothing in `ThemeProvider.tsx` or `applyTheme`'s root path.
 *
 * Mechanism: `surroundingTheme.mode` (the RAW `'light' | 'dark' | 'system'`
 * request) is SSR-stable — unlike `.theme`, its seed (`initialMode ??
 * defaultMode`) never reads `window`. So "no `mode` prop AND the surrounding
 * raw mode is `'system'`" is a side-effect-free signal, true identically on
 * the server and on the client's first hydration pass, that `.theme` MAY be
 * window-dependent. When that signal is true, this scope renders the SAME
 * deterministic `'light'` placeholder (matching what `getSystemTheme()`
 * falls back to server-side) on BOTH the server render and the client's
 * first hydration render — byte-for-byte identical, so there is no mismatch
 * to warn about in the first place. A `useEffect` (which never runs during
 * SSR or during hydration itself — only after) then flips a `hasMounted`
 * flag, forcing a SECOND, perfectly ordinary client render that swaps in the
 * real `surroundingTheme.theme` value. Because that second render's value
 * genuinely DIFFERS from the placeholder still recorded in React's fiber
 * (not a same-value no-op — see the next paragraph for why that distinction
 * matters), React performs a real diff and patches `data-theme` /
 * `color-scheme` / every `--*` var for real.
 *
 * Why not just "force a re-render" without a placeholder? Because
 * `surroundingTheme.theme` is ALREADY the real OS value on the client's
 * VERY FIRST render (it's computed synchronously in `ThemeProvider`'s
 * `useState` initializer, not in an effect) — so a naive re-render with that
 * same already-current value is a no-op: React's fiber already "believes"
 * the DOM shows that value (from the mismatched hydration pass) and skips
 * patching, leaving the ACTUAL DOM stuck on the server's stale guess. The
 * placeholder is what makes the fiber's recorded value (and the real DOM)
 * agree on `'light'` first, so the later swap to the real value is a
 * genuine change React must — and does — commit, unsticking the DOM.
 *
 * Known gap: `surroundingTheme.mode` can't distinguish "genuinely
 * window-dependent" from "`forcedTheme` is set but `defaultMode` was left at
 * its default `'system'`" — that combo IS SSR-stable (`theme: forcedTheme ||
 * theme` always resolves to the same `forcedTheme` value both sides) but
 * still trips this guard, costing one extra (harmless, same-target) commit
 * instead of true first-paint stability. Distinguishing them would require
 * exposing `forcedTheme` on `ThemeContextValue`, which is out of scope for
 * this ThemeScope-only fix. Workaround: pass `mode={forcedTheme}` explicitly
 * on the scope to skip the guard entirely.
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
   *
   * Passing this prop explicitly is always SSR-stable (correct from first
   * paint, no exceptions). When omitted AND the surrounding provider is in
   * `'system'` mode, see the "Inherited-mode SSR guard" doc block above —
   * the scope momentarily renders `'light'` and corrects itself post-mount
   * rather than risking a hydration mismatch.
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

  // #501 — see the "Inherited-mode SSR guard" doc block above for the full
  // reasoning. `surroundingTheme.mode` (raw request) is SSR-stable even
  // though `surroundingTheme.theme` (resolved) is not, for a `'system'`
  // provider with no `initialMode`/non-`'system'` `defaultMode`. That makes
  // "no explicit `mode` prop AND the surrounding raw mode is `'system'`" a
  // reliable, side-effect-free proxy for "the inherited `.theme` MAY be
  // window-dependent" — computed identically on the server and on the
  // client's first hydration pass.
  const inheritsUnstableSystemMode = mode === undefined && surroundingTheme?.mode === 'system'

  // Gate flips true in an effect — i.e. strictly AFTER the render that
  // produced the hydrated DOM, never during SSR or during hydration itself.
  // Irrelevant (and inert) for every SSR-stable input combination.
  const [hasSettledInheritedMode, setHasSettledInheritedMode] = React.useState(false)
  React.useEffect(() => {
    if (inheritsUnstableSystemMode) setHasSettledInheritedMode(true)
  }, [inheritsUnstableSystemMode])

  const resolvedMode: ResolvedTheme =
    mode ??
    (inheritsUnstableSystemMode && !hasSettledInheritedMode
      ? 'light' // SSR-stable placeholder — identical to the server's guess,
      // so the first client (hydration) render matches server HTML exactly.
      : (surroundingTheme?.theme ?? 'light'))

  // Compute the scope's attribute set + `--*` var map during render — no DOM
  // writes. `tintChrome` is intentionally not exposed on ThemeScope: it's a
  // root-only chrome attribute gating page-level chrome tokens; a scoped
  // re-tint of chrome inside an island doesn't make sense.
  //
  // #11 — `deriveScopedTokens: true` re-declares the tonal-ramp +
  // interaction-state `color-mix()` formulas on THIS wrapper (see
  // `colorDerivation.ts`). Without it, `--color-primary-hover` and friends
  // silently keep resolving `:root`'s default primary/secondary/error even
  // when this scope overrides the base role — the `:root`-only CSS rule in
  // tokens.css can never match a non-root element.
  const { attributes, vars, colorScheme } = computeThemeAttrs(
    resolvedMode,
    productTheme,
    preset,
    false,
    true,
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
