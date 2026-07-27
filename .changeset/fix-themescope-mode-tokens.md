---
"@lando-labs/lando-ds": patch
---

`ThemeScope` now re-derives the mode-dependent BASE tokens (not just the #11 ramp/state formulas) for its own resolved mode, fixing nested-opposite-mode scoping (#92) and DetailCard's illegible default field row in dark mode (#93).

Follow-on to #11 (PR #86): that fix re-derived the tonal-ramp/interaction-state `color-mix()` FORMULAS on a `ThemeScope` wrapper. This issue is the other half — tokens whose value simply *differs* by mode (`--color-surface-elevated`, `--color-text-primary`, `--shadow-md`, …) are declared once at `:root` and once more inside `[data-theme="dark"]` in `src/styles/tokens.css`. Neither real CSS rule ever matches a non-root `ThemeScope` wrapper, so a nested scope whose `mode` differs from the ambient page rendered these tokens with the ambient page's mode, not its own — even though the scope's own `data-theme` attribute (and therefore any `[data-theme='dark'] .foo`-gated component rule) was already correct.

**Two compounding causes (both diagnosed in #92):**
1. Mode-dependent BASE tokens are only ever declared at `:root` / the real `[data-theme="dark"]` block — a `ThemeScope` wrapper never re-declares them, so they resolve via ordinary CSS inheritance from whichever ancestor happens to declare them (the page's mode, not necessarily the scope's).
2. ~43 components gate mode styling on `[data-theme='dark'] .foo` ANCESTOR selectors, which no CSS-only scope override can fully cancel — a real (but separate) architectural issue, deliberately **out of scope** for this fix (documented as follow-up work; see the PR description). This patch is (a) from the issue's own diagnosis: it's sufficient for the reported cases because most of those dark rules only swap *which* token is read — if the token itself now resolves to the scope's mode, the rendered result is correct even when the ancestor-gated rule still matches.

**The fix:**
- New module `src/utils/scopedModeTokens.ts` — mechanically derived from `tokens.css`, mirroring two token shapes: (1) tokens whose literal value differs between `:root` and `[data-theme="dark"]` (excluding `--color-primary-base`, already owned end-to-end by `colorDerivation.ts`/#11 as a formula), and (2) tokens declared once at `:root` as a pure `var(--other)` indirection to one of those base tokens (`--color-surface-secondary`/`-tertiary`, `--color-bg-*`, `--color-editorial-*`, …) — the exact mechanism behind #93 (DetailCard's default `.field` row reads `--color-surface-tertiary`, never the base token directly).
- `computeThemeAttrs`'s existing `deriveScopedTokens` flag (already opt-in, ThemeScope-only) now seeds `vars` with `getScopedModeTokenVars(mode)` alongside the #11 ramp formulas, at the same low precedence — an explicit preset/product-theme override still wins. The root `ThemeProvider`/`applyTheme` path is unchanged (`:root`'s real CSS already covers `document.documentElement` directly).
- **Drift-proofed**: `src/test/scoped-mode-tokens-lockstep.test.ts` parses `tokens.css` directly and fails CI, in both directions, if `scopedModeTokens.ts` drifts — a new mode-dependent token or alias added to `tokens.css` without updating the mirror, or a stale entry the mirror still tracks after `tokens.css` stopped varying it by mode.
- New unit coverage in `ThemeScope.test.tsx` pins the new emission for both modes, the alias re-declaration, precedence against a product-theme override, and that the root path stays byte-for-byte unchanged.
- New real-browser regression coverage in `tests/e2e/themescope-mode-tokens.spec.ts` (Playwright, against `examples/next-app-router`) proves both directions in a real cascade: a `mode="light"` scope nested in an ambient dark page renders Accordion/Switch chrome with light tokens (and vice versa), and a DetailCard default field row is genuinely legible (dark background, light text) inside a dark scope nested in a light page — explicitly closing #93.

Closes #92, closes #93.
