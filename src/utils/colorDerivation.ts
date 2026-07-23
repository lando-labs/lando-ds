/**
 * Scoped color-derivation formulas (#11).
 *
 * `src/styles/tokens.css` derives the tonal ramp (`--color-primary-lightest`
 * … `-darkest`, same for `--color-secondary`) and the interaction-state tints
 * (`-hover` / `-active` / `-disabled`, plus the `--color-danger-*` aliases of
 * `--color-error-*`) from their base role token via `color-mix()` — but ONLY
 * declares those formulas on `:root` (the ramp) and `:root` + a handful of
 * `[data-theme="dark"]` overrides (the state tints). Per the CSS custom-
 * property spec, `var()` inside a declaration resolves at the DECLARING
 * element's scope, not at the point of use — so an element that is not
 * `:root` never re-runs these formulas, even if it shadows the base token
 * (`--color-primary`) with its own value.
 *
 * `ThemeProvider` never hits this: it writes its overrides onto
 * `document.documentElement`, which the `:root` selector in tokens.css
 * targets directly, so the real CSS derivation applies. `ThemeScope` (#395)
 * writes to an arbitrary WRAPPER element instead — `:root`'s formulas never
 * match it, so its ramp/state tokens silently keep resolving `:root`'s
 * default primary/secondary/error instead of the scope's override.
 *
 * The fix: re-declare the same formulas as literal `color-mix()` STRINGS
 * (not pre-computed colors) as inline custom properties on the scope
 * wrapper. A custom property can reference a sibling custom property
 * declared on the very same element, so once `--color-primary` is shadowed
 * inline, these formulas recompute against the shadowed value — exactly
 * mirroring what `:root`'s CSS already does for the root case.
 *
 * This module is the single source of truth for that mirrored formula set.
 * It MUST stay byte-for-byte in lockstep with the GENERATED:COLOR-RAMPS
 * block in `src/styles/tokens.css` (plus the dark-mode `--color-primary-base`
 * override in `[data-theme="dark"]`) — enforced by
 * `src/test/scoped-color-derivation-lockstep.test.ts`, which parses
 * tokens.css and diffs the formula strings against the maps below. If you
 * change a mix percentage or add a ramp/state token in tokens.css, update
 * this module (and its own doc comment) in the same change.
 *
 * Deliberately scoped to what tokens.css's GENERATED:COLOR-RAMPS block
 * declares — the primary/secondary tonal ramp and the primary/secondary/
 * error(+danger) interaction-state tints. Other `color-mix()`-derived tokens
 * (`--focus-ring-shadow`, `--shadow-primary`, `--color-primary-alpha-40`,
 * chrome tinting) are effect/chrome tokens outside the ramp/state contract
 * #11 covers, and are not re-derived here.
 */

/** Resolved light/dark mode, mirroring `ResolvedTheme` without importing it
 * (keeps this module dependency-free / avoids a cycle with ThemeProvider). */
export type ScopedDerivationMode = 'light' | 'dark'

/**
 * Mirrors the GENERATED:COLOR-RAMPS block in `src/styles/tokens.css`
 * (light-mode formulas — the ones declared unconditionally at `:root`).
 */
export const SCOPED_DERIVED_COLOR_VARS: Readonly<Record<string, string>> = {
  '--color-primary-lightest': 'color-mix(in oklab, var(--color-primary), white 90%)',
  '--color-primary-lighter': 'color-mix(in oklab, var(--color-primary), white 70%)',
  '--color-primary-light': 'color-mix(in oklab, var(--color-primary), white 45%)',
  '--color-primary-base': 'color-mix(in oklab, var(--color-primary), white 23%)',
  '--color-primary-medium': 'var(--color-primary)',
  '--color-primary-dark': 'color-mix(in oklab, var(--color-primary), black 18%)',
  '--color-primary-darker': 'color-mix(in oklab, var(--color-primary), black 36%)',
  '--color-primary-darkest': 'color-mix(in oklab, var(--color-primary), black 52.5%)',

  '--color-secondary-lightest': 'color-mix(in oklab, var(--color-secondary), white 86%)',
  '--color-secondary-lighter': 'color-mix(in oklab, var(--color-secondary), white 61.5%)',
  '--color-secondary-light': 'color-mix(in oklab, var(--color-secondary), white 29%)',
  '--color-secondary-base': 'var(--color-secondary)',
  '--color-secondary-medium': 'color-mix(in oklab, var(--color-secondary), black 15%)',
  '--color-secondary-dark': 'color-mix(in oklab, var(--color-secondary), black 31%)',
  '--color-secondary-darker': 'color-mix(in oklab, var(--color-secondary), black 48%)',
  '--color-secondary-darkest': 'color-mix(in oklab, var(--color-secondary), black 65%)',

  '--color-primary-hover': 'color-mix(in oklab, var(--color-primary), white 22%)',
  '--color-primary-active': 'color-mix(in oklab, var(--color-primary), black 18%)',
  '--color-primary-disabled': 'color-mix(in oklab, var(--color-primary), var(--color-surface) 60%)',

  '--color-secondary-hover': 'color-mix(in oklab, var(--color-secondary), white 18%)',
  '--color-secondary-active': 'color-mix(in oklab, var(--color-secondary), black 18%)',
  '--color-secondary-disabled': 'color-mix(in oklab, var(--color-secondary), var(--color-surface) 60%)',

  '--color-error-hover': 'color-mix(in oklab, var(--color-error), black 7.5%)',
  '--color-error-active': 'color-mix(in oklab, var(--color-error), black 38%)',
  '--color-error-disabled': 'color-mix(in oklab, var(--color-error), var(--color-surface) 60%)',

  '--color-danger-hover': 'var(--color-error-hover)',
  '--color-danger-active': 'var(--color-error-active)',
  '--color-danger-disabled': 'var(--color-error-disabled)',
}

/**
 * Mirrors the ONE dark-mode-specific override inside `[data-theme="dark"]`
 * in tokens.css (#73): `--color-primary-base` uses a heavier white-mix
 * (30% vs. light's 23%) so Button's dark outline label clears WCAG AA against
 * both `--color-surface` and `--color-surface-elevated`. Everything else in
 * the ramp/state layer is mode-invariant (`:root`'s formula holds in dark
 * mode too, because `--color-primary` itself doesn't change with mode).
 *
 * Note: `[data-theme="dark"]` in tokens.css is a plain attribute selector
 * (not `:root[data-theme="dark"]`), so it already matches a `ThemeScope`
 * wrapper carrying that attribute directly — which is why the dark override
 * for `--color-primary-base` already "just worked" for scoped dark islands
 * before this fix, via ordinary CSS cascade. Applying THIS light-mode-only
 * module's formula unconditionally would ironically regress that (an inline
 * style always outranks a selector), so `getScopedDerivedColorVars` swaps
 * this override in for `mode === 'dark'`.
 */
export const SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES: Readonly<Record<string, string>> = {
  '--color-primary-base': 'color-mix(in oklab, var(--color-primary), white 30%)',
}

/**
 * Resolve the full scoped ramp/state formula set for a mode. Returns a fresh
 * object each call (caller may merge it under other var sources).
 */
export function getScopedDerivedColorVars(mode: ScopedDerivationMode): Record<string, string> {
  if (mode === 'dark') {
    return { ...SCOPED_DERIVED_COLOR_VARS, ...SCOPED_DERIVED_COLOR_VARS_DARK_OVERRIDES }
  }
  return { ...SCOPED_DERIVED_COLOR_VARS }
}
