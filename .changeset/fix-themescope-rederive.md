---
"@lando-labs/lando-ds": minor
---

`ThemeScope` now re-derives the tonal ramp and interaction-state tokens for a scoped theme override (#11).

`src/styles/tokens.css` derives `--color-primary-hover` / `-active` / `-disabled` and the full `-lightest…-darkest` ramp (same for `secondary`, plus the `error`/`danger` state tints) from their base role token via `color-mix()` — but only declares those formulas on `:root`. A `var()` inside a declaration resolves at the DECLARING element's scope, so overriding `--color-primary` on a `<ThemeScope>` wrapper changed the base color but left every derived token (ramp swatches, hover/active/subtle-fill states) resolving `:root`'s default primary/secondary/error — a themed `Button` inside a scoped preview kept the default hover.

- `ThemeScope` now re-declares those same `color-mix()` FORMULAS (not pre-computed colors) inline on its own wrapper, so they recompute against the scope's own overridden base token — the same mechanism `:root`'s CSS already gives the root `ThemeProvider` path, extended to a non-root element. New module `src/utils/colorDerivation.ts` is the single source of truth for the mirrored formula set, guarded against drift from `tokens.css` by `src/test/scoped-color-derivation-lockstep.test.ts`.
- The dark-mode-specific `--color-primary-base` override (#73, a heavier white-mix for WCAG AA on the dark outline-button label) is preserved: `getScopedDerivedColorVars` swaps in the dark formula when the scope's resolved mode is `'dark'`, matching what the `[data-theme="dark"]` attribute selector in `tokens.css` already gave a dark `ThemeScope` island via ordinary cascade.
- `computeThemeAttrs` gains a 5th, opt-in `deriveScopedTokens` parameter that only `ThemeScope` passes — the root `ThemeProvider`/`applyTheme` path is unchanged, since `:root`'s real CSS rule already covers `document.documentElement` directly.
- New tests in `ThemeScope.test.tsx` pin a scoped `--color-primary` override propagating to `--color-primary-hover` (and the rest of the ramp), the secondary/error/danger state tints, and the dark-mode `--color-primary-base` formula.
