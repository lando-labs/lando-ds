/**
 * Scoped mode-dependent BASE token re-derivation (#92).
 *
 * Follow-on to #11 (`colorDerivation.ts`), which re-declares the tonal-ramp /
 * interaction-state `color-mix()` FORMULAS on a `ThemeScope` wrapper so they
 * recompute against the scope's own (possibly overridden) `--color-primary`.
 * This module closes the OTHER half of #92: tokens whose value simply
 * DIFFERS between `:root` (light) and the top-level `[data-theme="dark"]`
 * block in `src/styles/tokens.css` — `--color-surface-elevated`,
 * `--color-text-primary`, `--shadow-md`, etc. — are declared ONCE each, at
 * `:root` and again inside `[data-theme="dark"]`. Both declarations target
 * real selectors that only ever match `document.documentElement` (the root
 * `ThemeProvider`/`applyTheme` path) or an element that IS `:root`.
 *
 * A `ThemeScope` wrapper is neither. It carries `data-theme="dark"` as a
 * plain HTML attribute — `[data-theme="dark"]` (not `:root[data-theme=
 * "dark"]`) DOES match it directly, so a component CSS rule gated on that
 * selector fires correctly. But the mode-dependent BASE tokens the matched
 * rule reads (e.g. Accordion's `.trigger` background:
 * `var(--color-surface-elevated)`) are declared only at `:root`/the real
 * `[data-theme="dark"]` block — a `ThemeScope` wrapper never declares them
 * itself, so they resolve via ordinary CSS *inheritance* from whatever mode
 * the nearest ANCESTOR that does declare them is in. Nest a `mode="light"`
 * scope inside a dark page (or vice versa) and the token silently keeps the
 * ancestor's mode value even though the scope's own `data-theme` attribute
 * is correct — see the "Two compounding causes" section of #92 for the full
 * diagnosis (this module fixes cause 1 only; cause 2 — ~43 components
 * gating on `[data-theme='dark'] .foo` ancestor selectors — is out of scope,
 * see the #92 PR description).
 *
 * ## Two token shapes, one module
 *
 * 1. {@link MODE_TOKEN_VARS} — tokens with a GENUINELY different literal
 *    value per mode (an OKLCH color, an rgba() shadow, …). Emitted as the
 *    literal value for the scope's `resolvedMode`.
 *
 *    `--color-primary-base` is deliberately EXCLUDED even though it differs
 *    by mode in `[data-theme="dark"]` (#73) — it is already owned end-to-end
 *    by `colorDerivation.ts`'s `SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES`,
 *    which emits it as a `color-mix()` FORMULA (not a literal), so a scope
 *    that also overrides `--color-primary` keeps tracking it. Duplicating it
 *    here with a literal would silently un-derive that formula.
 *
 * 2. {@link MODE_ALIAS_VARS} — tokens declared ONLY ONCE at `:root`, as a
 *    pure single-level indirection to one of the tokens in (1) — e.g.
 *    `--color-surface-tertiary: var(--color-surface-hover);` (no
 *    `[data-theme="dark"]` override exists for the alias itself; dark mode
 *    "just works" at `:root` because the aliased token's OWN `:root`
 *    declaration is what a real `:root[data-theme="dark"]`-adjacent element
 *    resolves). The SAME formula string is re-declared on the scope
 *    regardless of mode — what makes it correct per-mode is that it now
 *    references a SIBLING custom property on the very same element (the
 *    scope's own re-declared `--color-surface-hover` from (1)), exactly
 *    mirroring how `colorDerivation.ts`'s ramp formulas re-resolve against a
 *    scope's own `--color-primary`. This is what fixes #93 (DetailCard's
 *    default `.field` row reads `--color-surface-secondary` /
 *    `-tertiary`, never the base token directly).
 *
 * Both maps are derived mechanically from `tokens.css` — see the header
 * comment of `src/test/scoped-mode-tokens-lockstep.test.ts` for the parsing
 * rules the lockstep guard enforces in both directions, so this module can't
 * silently drift from tokens.css.
 *
 * Deliberately scoped to the top-level `:root` / `[data-theme="dark"]`
 * blocks only — NOT the opt-in `[data-tint-chrome]` / `[data-theme="dark"]
 * [data-tint-chrome]` compound blocks. `ThemeScope` doesn't expose a
 * `tintChrome` prop (see the doc comment in `ThemeScope.tsx`: "a scoped
 * re-tint of chrome inside an island doesn't make sense"), so there is no
 * scope-level tint state for those blocks to re-derive against.
 */

/** Resolved light/dark mode, mirroring `ResolvedTheme` without importing it
 * (keeps this module dependency-free / avoids a cycle with ThemeProvider). */
export type ScopedModeTokenMode = 'light' | 'dark'

/**
 * Tokens whose LITERAL value differs between `:root` and `[data-theme="dark"]`
 * in `tokens.css`. Light-mode side — mirrors the `:root` declarations
 * verbatim (excluding `--color-primary-base`; see the module doc comment).
 */
export const LIGHT_MODE_TOKEN_VARS: Readonly<Record<string, string>> = {
  '--color-background': 'var(--color-neutral-50)',
  '--color-surface': 'var(--color-neutral-white)',
  '--color-surface-elevated': 'var(--color-neutral-100)',
  '--color-surface-hover': 'var(--color-neutral-200)',

  '--color-text-primary': 'var(--color-neutral-800)',
  '--color-text-secondary': 'var(--color-neutral-600)',
  '--color-text-tertiary': 'var(--color-neutral-550)',
  '--color-text-disabled': 'var(--color-neutral-400)',
  '--color-text-inverse': 'var(--color-neutral-white)',

  '--color-border-subtle': 'var(--color-neutral-200)',
  '--color-border-default': 'var(--color-neutral-300)',
  '--color-border-strong': 'var(--color-neutral-400)',
  '--color-border-emphasis': 'oklch(0.62 0.0184 229.07)',

  '--color-surface-disabled': 'var(--color-neutral-100)',
  '--color-text-on-disabled': 'var(--color-neutral-500)',
  '--color-border-disabled': 'var(--color-neutral-200)',

  '--focus-ring-shadow': '0 0 0 3px color-mix(in oklab, var(--color-primary), transparent 75%)',

  '--shadow-xs': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
  '--shadow-sm': '0 1px 3px 0 rgba(15, 23, 42, 0.1), 0 1px 2px -1px rgba(15, 23, 42, 0.1)',
  '--shadow-md': '0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1)',
  '--shadow-lg': '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.1)',
  '--shadow-xl': '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
  '--shadow-2xl': '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
  '--shadow-inner': 'inset 0 2px 4px 0 rgba(15, 23, 42, 0.05)',
  '--shadow-outline': '0 0 0 3px rgba(100, 116, 139, 0.5)',
}

/**
 * Same token set, dark-mode side — mirrors the `[data-theme="dark"]`
 * declarations verbatim.
 */
export const DARK_MODE_TOKEN_VARS: Readonly<Record<string, string>> = {
  '--color-background': 'oklch(0.18 0.005 250)',
  '--color-surface': 'oklch(0.21 0.005 250)',
  '--color-surface-elevated': 'oklch(0.26 0.005 250)',
  '--color-surface-hover': 'oklch(0.31 0.005 250)',

  '--color-text-primary': 'var(--color-neutral-50)',
  '--color-text-secondary': 'var(--color-neutral-200)',
  '--color-text-tertiary': 'var(--color-neutral-300)',
  '--color-text-disabled': 'var(--color-neutral-700)',
  '--color-text-inverse': 'var(--color-neutral-900)',

  '--color-border-subtle': 'oklch(0.31 0.005 250)',
  '--color-border-default': 'oklch(0.38 0.008 250)',
  '--color-border-strong': 'oklch(0.5 0.012 250)',
  '--color-border-emphasis': 'oklch(0.58 0.012 250)',

  '--color-surface-disabled': 'oklch(0.16 0.005 250)',
  '--color-text-on-disabled': 'oklch(0.45 0.008 250)',
  '--color-border-disabled': 'oklch(0.24 0.005 250)',

  '--focus-ring-shadow': '0 0 0 3px color-mix(in oklab, var(--color-primary), transparent 55%)',

  '--shadow-xs': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  '--shadow-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
  '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
  '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
  '--shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
  '--shadow-2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  '--shadow-inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
  '--shadow-outline': '0 0 0 3px rgba(100, 116, 139, 0.4)',
}

/**
 * Tokens declared exactly ONCE at `:root` in tokens.css, as a pure
 * single-level `var(--other)` indirection to a token in
 * {@link LIGHT_MODE_TOKEN_VARS} / {@link DARK_MODE_TOKEN_VARS}. Mode-
 * INVARIANT formula (same string both directions) — see the module doc
 * comment for why re-declaring it on the scope regardless of mode is still
 * the fix (it re-resolves against the scope's own sibling declaration of the
 * aliased token).
 */
export const MODE_ALIAS_VARS: Readonly<Record<string, string>> = {
  '--color-border': 'var(--color-border-default)',
  '--color-surface-secondary': 'var(--color-surface-elevated)',
  '--color-surface-tertiary': 'var(--color-surface-hover)',
  '--color-bg-primary': 'var(--color-surface)',
  '--color-bg-secondary': 'var(--color-surface-hover)',
  '--color-bg-tertiary': 'var(--color-surface-elevated)',
  '--color-editorial-ink-primary': 'var(--color-text-primary)',
  '--color-editorial-ink-secondary': 'var(--color-text-secondary)',
  '--color-editorial-ink-muted': 'var(--color-text-tertiary)',
  '--color-editorial-rule': 'var(--color-border-subtle)',
}

/**
 * Resolve the full mode-dependent BASE token set (the direct set for `mode`
 * PLUS the mode-invariant alias indirections) for a `ThemeScope` wrapper.
 * Returns a fresh object each call (caller may merge it under other var
 * sources — see `computeThemeAttrs`'s merge order, which layers preset/
 * product-theme overrides ON TOP of this so an explicit consumer override
 * still wins).
 */
export function getScopedModeTokenVars(mode: ScopedModeTokenMode): Record<string, string> {
  const base = mode === 'dark' ? DARK_MODE_TOKEN_VARS : LIGHT_MODE_TOKEN_VARS
  return { ...base, ...MODE_ALIAS_VARS }
}
