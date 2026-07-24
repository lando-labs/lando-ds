# Changelog

## 0.59.0

### Minor Changes

- [#88](https://github.com/lando-labs/lando-ds/pull/88) [`ab93f95`](https://github.com/lando-labs/lando-ds/commit/ab93f954cd1387cc36f12633ec89a79c61b3e550) Thanks [@Lando8604](https://github.com/Lando8604)! - Fix the documented `@layer app` override contract so it reliably beats DS component styles.

  `reference/css-layers.md` promises that a consumer's `@layer app { … }` rule (declared above the DS's `ll.*` layers) overrides DS component styles with no `!important`. In practice, `app`'s position was only guaranteed when a consumer separately imported the opt-in `@lando-labs/lando-ds/layer-order.css` primer — the main `@lando-labs/lando-ds/styles` entry's own `@layer …;` order statement never named `app` at all, so its position depended silently on CSS load order between the consumer's own `@layer app { … }` rule and the DS stylesheet. A consumer who skipped the primer got no error, just an override that mysteriously didn't apply.

  `@lando-labs/lando-ds/styles`'s order statement now declares the full, public seven-layer order itself — `app-reset, ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app` — so `@layer app { … }` reliably outranks `ll.components` as soon as a consumer imports the DS stylesheet, with no separate primer import required. `app-reset`/`app` are consumer-owned opt-in slots (the DS never puts rules in them); their _position_ is now part of the same public layer-order contract as the five `ll.*` names. This is a **minor** change (not patch) because it changes the published layer output in a way that could affect a consumer's cascade if they happened to already be using `app`/`app-reset` as their own, unrelated layer names.

  The separate `layer-order.css` primer still exists (for consumers who need `app`'s position fixed before the DS stylesheet itself loads, e.g. hand-rolled critical CSS) — importing both is a harmless no-op, since re-declaring an already-positioned layer never moves it.

  `reference/css-layers.md` gains a "Load-order caveat" section that states the contract's real, honest limit: `@layer app` wins whenever the DS stylesheet is the first CSS with an `@layer` construct the browser parses (true by default for a normal import chain, and now true without the primer too) — but no CSS-only mechanism can force that against a bundler that reorders CSS chunks. For that residual case, the doc now points at the two load-order-proof paths that already existed: unlayered CSS, or the flattened `styles.unlayered.css` bundle.

  Adds real-browser proof that was previously missing: `tests/e2e/layer-override.spec.ts` (via the `examples/next-app-router` fixture at `/e2e/layer-override`) asserts, with Playwright against a real Chromium, that both a `@layer app` override and an unlayered override actually beat a DS `<Button>` rule — not just that the built CSS is shaped correctly, which is all the existing jsdom structural test (`src/test/css-layers.test.ts`, itself updated for the new seven-layer statement) can prove. Wired into the existing `e2e-overlays` CI job, which now runs every spec under `tests/e2e/`.

  Refs: [#13](https://github.com/lando-labs/lando-ds/issues/13)

- [#86](https://github.com/lando-labs/lando-ds/pull/86) [`281bbc5`](https://github.com/lando-labs/lando-ds/commit/281bbc5a6c22e2bdce681b342afa418e8438734c) Thanks [@Lando8604](https://github.com/Lando8604)! - `ThemeScope` now re-derives the tonal ramp and interaction-state tokens for a scoped theme override ([#11](https://github.com/lando-labs/lando-ds/issues/11)).

  `src/styles/tokens.css` derives `--color-primary-hover` / `-active` / `-disabled` and the full `-lightest…-darkest` ramp (same for `secondary`, plus the `error`/`danger` state tints) from their base role token via `color-mix()` — but only declares those formulas on `:root`. A `var()` inside a declaration resolves at the DECLARING element's scope, so overriding `--color-primary` on a `<ThemeScope>` wrapper changed the base color but left every derived token (ramp swatches, hover/active/subtle-fill states) resolving `:root`'s default primary/secondary/error — a themed `Button` inside a scoped preview kept the default hover.

  - `ThemeScope` now re-declares those same `color-mix()` FORMULAS (not pre-computed colors) inline on its own wrapper, so they recompute against the scope's own overridden base token — the same mechanism `:root`'s CSS already gives the root `ThemeProvider` path, extended to a non-root element. New module `src/utils/colorDerivation.ts` is the single source of truth for the mirrored formula set, guarded against drift from `tokens.css` by `src/test/scoped-color-derivation-lockstep.test.ts`.
  - The dark-mode-specific `--color-primary-base` override ([#73](https://github.com/lando-labs/lando-ds/issues/73), a heavier white-mix for WCAG AA on the dark outline-button label) is preserved: `getScopedDerivedColorVars` swaps in the dark formula when the scope's resolved mode is `'dark'`, matching what the `[data-theme="dark"]` attribute selector in `tokens.css` already gave a dark `ThemeScope` island via ordinary cascade.
  - `computeThemeAttrs` gains a 5th, opt-in `deriveScopedTokens` parameter that only `ThemeScope` passes — the root `ThemeProvider`/`applyTheme` path is unchanged, since `:root`'s real CSS rule already covers `document.documentElement` directly.
  - New tests in `ThemeScope.test.tsx` pin a scoped `--color-primary` override propagating to `--color-primary-hover` (and the rest of the ramp), the secondary/error/danger state tints, and the dark-mode `--color-primary-base` formula.

  `ThemeScope` also fixes an SSR hydration mismatch this same re-derivation work would otherwise have widened ([#501](https://github.com/lando-labs/lando-ds/issues/501)): a `ThemeScope` with no explicit `mode` prop, nested under a `system`-mode `ThemeProvider` (no `initialMode`/`forcedTheme`), rendered `light` on the server and the real OS preference on the client's very first hydration render — `ThemeProvider`'s `theme` state seeds from `resolveTheme('system')`, which reads `window.matchMedia` inside a `useState` initializer, so it's already resolved before any effect runs. This hit `data-theme`, `color-scheme`, and every derived `--*` var (including the new `--color-primary-base` dark-mode override above). Worse, React does not repatch mismatched attribute/style props after hydration (only text nodes get corrected), so the scope stayed stuck on the server's `light` guess for the life of the page.

  - `ThemeScope` now detects this specific case (no `mode` prop, inherited raw mode is `'system'` — a signal that's itself SSR-stable, unlike the resolved `theme`) and renders the same deterministic `light` placeholder on both the server and the client's first hydration pass — byte-for-byte identical, so there is no mismatch to warn about. A `useEffect` then swaps in the real resolved mode, forcing a genuine second commit that actually repatches the DOM (not a same-value no-op, since the placeholder made the fiber's recorded value differ from the real one).
  - Every SSR-stable input — an explicit `mode` prop on the scope, or an inherited mode from a provider given `initialMode`/`forcedTheme` — is unaffected and stays correct from first paint ([#428](https://github.com/lando-labs/lando-ds/issues/428)), with one documented, narrow exception: `forcedTheme` combined with a `ThemeProvider` left at its default `defaultMode="system"` triggers one harmless extra post-mount commit, since `ThemeScope` can't distinguish that from the genuinely unstable case without widening `ThemeProvider`'s context shape (out of scope for this ThemeScope-only fix). Pass `mode={forcedTheme}` explicitly on the scope to skip it.
  - New real-browser regression coverage in `tests/e2e/themescope-hydration.spec.ts` (Playwright, against `examples/next-app-router`) asserts zero hydration-mismatch console errors AND that the settled `data-theme`/`--color-primary-base` match the real client `matchMedia` preference for both a dark- and light-preferring browser — pinning both the "no mismatch" and the "not stuck" halves of the fix. A jsdom companion in `ThemeScope.test.tsx` pins the placeholder/settle gating logic directly.
  - Docs: `ThemeScope.tsx`'s doc comment and `reference/rsc-boundary-matrix.md` now document this exception to the [#428](https://github.com/lando-labs/lando-ds/issues/428) "SSR-correct from first paint" claim.

### Patch Changes

- [#85](https://github.com/lando-labs/lando-ds/pull/85) [`5fd5a69`](https://github.com/lando-labs/lando-ds/commit/5fd5a692005c6afd009754b6b62f9ae4f9d6ea36) Thanks [@Lando8604](https://github.com/Lando8604)! - Fix WCAG AA contrast failures on Button `variant="primary"` for 4 of 6 shipped theme presets ([#10](https://github.com/lando-labs/lando-ds/issues/10)).

  `--color-on-primary` (the text/icon color on a `primary`-filled surface) was declared exactly once, globally, in `tokens.css` — a preset could re-skin `--color-primary` but had no way to express a matching on-color, so every preset inherited white text regardless of how light its `primary` was.

  - **`ThemePreset['colors']`** (`src/tokens/themePresets.ts`) gains an optional `onPrimary?: string`, emitted as `--color-on-primary` by `presetColorVars` (`src/utils/themeScript.ts`) — the single mapping shared by both the runtime `applyTheme` and the pre-hydration `themeScript()` inline script, so both paths pick it up with no drift.
  - **`midnight`, `sunset`, `forest`, `rose`** now set `onPrimary: '#000000'` (black — the same value as `--color-neutral-black`), fixing measured ratios of 4.47, 2.80, 2.54, and 3.53 (all below the 4.5:1 AA floor) to 4.70, 7.49, 8.28, and 5.95 respectively. Black text on an orange/green/pink/indigo fill is a legitimate design choice, not a compromise — it was the _inherited default (white)_ that was wrong for these, not the brand color.
  - **`lando`** (4.52:1) and **`slate`** (4.76:1) already cleared AA against the inherited white default and are unchanged — including `lando`'s historical `primary` hex, left untouched to avoid breaking the documented pre-v0.36.0 exact-parity claim several other places in the codebase assert. This is a deliberate trade-off: `lando`'s margin (0.02 above the floor) is real but slim; see `reference/theme-presets.md` for the full reasoning and a note on the deferred follow-up.
  - **New guard test** `src/tokens/theme-preset-contrast.test.ts` loops over every `themePresets` entry (plus the brand-neutral default) and asserts `primary` vs. its resolved `onPrimary` clears WCAG AA — so a future preset that ships a light `primary` without an `onPrimary` override fails CI instead of shipping unreadable button text.

  `reference/theme-presets.md` documents the new field, the measured before/after numbers for all six presets, and updated guidance for authoring new presets.

## 0.58.1

### Patch Changes

- [#81](https://github.com/lando-labs/lando-ds/pull/81) [`072568d`](https://github.com/lando-labs/lando-ds/commit/072568db2b15f6b77d6a768e1cdf52b727bb86c9) Thanks [@Lando8604](https://github.com/Lando8604)! - Fix two default-theme WCAG AA contrast gaps at the token rung, both discovered during the Sprint 2 theming-AA audit.

  - **Default chrome text tiers now guarantee AA.** `--color-text-secondary` and `--color-text-tertiary` previously dropped below the 4.5:1 SC 1.4.3 floor on some default light-mode surfaces — worst case `text-secondary` at 3.53:1 and `text-tertiary` at 4.24:1, both against `--color-surface-hover`. The underlying rungs (`neutral-600` and the dedicated `neutral-550` AA tier) are darkened just enough to clear 4.5:1 against every default surface (`--color-background` / `--color-surface` / `--color-surface-elevated` / `--color-surface-hover`), in both untinted and brand-tinted chrome. The corresponding `BASELINE_SUB_AA` exemptions in `src/tokens/chrome-contrast.test.ts` (which held these pairs to the lower 3:1 bar) are deleted, not relaxed — dark mode was already clear and two stale dark-mode entries are removed along with it. ([#4](https://github.com/lando-labs/lando-ds/issues/4))
  - **`Button variant="outline"` dark label now clears AA on card/elevated surfaces too.** The Sprint 1 fix ([#9](https://github.com/lando-labs/lando-ds/issues/9)) verified the dark outline label against `--color-surface` (4.78:1) but not `--color-surface-elevated` — a `Card` interior, and also the background the dark `:hover`/`:active` rules paint as the button fill — where it measured only 4.19:1, under the 4.5:1 floor. `--color-primary-base`'s dark-only white-mix is nudged from 23% to 30%, now 5.50:1 vs `--color-surface` and 4.83:1 vs `--color-surface-elevated`. Scoped to dark mode only; the border rung and light theme are unchanged. ([#73](https://github.com/lando-labs/lando-ds/issues/73))

- [#79](https://github.com/lando-labs/lando-ds/pull/79) [`2d38725`](https://github.com/lando-labs/lando-ds/commit/2d38725904cf4da7e171684e50a9708b5b264cfe) Thanks [@Lando8604](https://github.com/Lando8604)! - Fix WCAG SC 1.4.11 (non-text contrast) failures in the light theme, the light-mode counterpart to Sprint 1's dark-only fixes.

  - **`Button variant="outline"`** resting border now clears ≥3:1 in light mode (was 1.53:1 vs `--color-surface`, 1.39:1 vs `--color-neutral-50`) — measured 3.61:1 / 3.45:1. Dark theme ([#9](https://github.com/lando-labs/lando-ds/issues/9)) unchanged. ([#71](https://github.com/lando-labs/lando-ds/issues/71))
  - **`Switch`** off-state track now clears ≥3:1 in light mode (was 1.53:1 vs `--color-surface`) — measured 3.61:1, with the white thumb now distinguishable from the track by color, not just its box-shadow. `Switch`'s light-mode hover step was also re-tuned (mixing further toward black from the new resting color) so hover stays visually more prominent than resting, matching the pre-existing dark-mode convention. Dark theme ([#12](https://github.com/lando-labs/lando-ds/issues/12)) and the on/checked state are unchanged. ([#72](https://github.com/lando-labs/lando-ds/issues/72))

  Both share a root cause: `--color-border-emphasis` (`src/styles/tokens.css`) identity-aliased `--color-border-strong` in light mode, and the comment on that alias claimed the un-fixed rung already cleared AA at "9.53:1" — a transposed mis-measurement (the real value is ~1.91:1). `--color-border-emphasis` now carries a light-tuned `oklch(0.62 0.0184 229.07)` value (same hue/chroma as `--color-border-strong`, darkened to clear 3:1 against `--color-surface`, `--color-neutral-50`, and `--color-surface-elevated`), and both components' light-mode rules now read that token instead of `--color-border-default` directly — mirroring how the dark-mode fixes already worked. `--color-border-default` itself is untouched, so the many other components reading that rung are unaffected.

## 0.58.0

### Minor Changes

- [#75](https://github.com/lando-labs/lando-ds/pull/75) [`a1e12fd`](https://github.com/lando-labs/lando-ds/commit/a1e12fdaa72fc514ddd5221490102f89179b0859) Thanks [@Lando8604](https://github.com/Lando8604)! - Fix consumer-reported visible defects (v0.58.0).

  - **Overlays inside a Modal are now interactive.** `Select`, `Combobox`, `MultiSelect`, `Dropdown`, and `Popover` opened inside a `Modal` previously rendered behind the dialog (or, once promoted to the top layer, painted above it but could not be hovered or clicked — `showModal()` marks everything outside the `<dialog>` subtree inert). They now render into a container within the open Modal's dialog, so they are fully usable inside modals, with no consumer-side changes. Standalone (non-modal) usage is unchanged. ([#14](https://github.com/lando-labs/lando-ds/issues/14))
  - **`Select` Escape** now only closes the listbox when it is open, so pressing Escape no longer traps a parent `Modal` open. ([#14](https://github.com/lando-labs/lando-ds/issues/14))
  - **`Button variant="outline"`** now meets WCAG AA contrast in the dark theme (border ≥ 3:1, label ≥ 4.5:1); light theme unchanged. ([#9](https://github.com/lando-labs/lando-ds/issues/9))
  - **`Switch`** off-state track is now visible in dark mode (≥ 3:1 non-text contrast) instead of blending into the surface. ([#12](https://github.com/lando-labs/lando-ds/issues/12))
  - **`Dropdown` and click-triggered `Popover`** now close when you click their trigger again, instead of briefly closing and re-opening (a click-outside / trigger-click double-fire). `useClickOutside` gained an optional `ignoreRefs` parameter to support this.

  Adds a real-browser (Playwright) end-to-end suite covering overlay interaction inside modals, wired into CI on pull requests.

All notable changes to `@lando-labs/lando-ds` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project follows [Semantic Versioning](https://semver.org/)
(currently in the `0.x` pre-1.0 series — minor versions may include refinements to APIs that are still stabilizing).

> The library was developed privately before its public release; the `v0.56.0`-and-earlier entries below are summarized
> from that development history. Going forward, releases are managed with [Changesets](https://github.com/changesets/changesets)
> and this file is updated automatically on each release.

## v0.57.0 — First public release

- First public release of `@lando-labs/lando-ds` on npm. No component or API changes from v0.56.0 — this is the public debut, with documentation reorganized and trimmed for public consumption (the contracts, the component API reference, and the contributor guide).

## v0.56.0 — Discoverable hooks library

- **Added** a headless, dependency-free hooks library (19 hooks) — `useDisclosure`, `useMediaQuery`, `useClipboard`, `useLocalStorage`, `useDebouncedValue`, `useIntersection`, and more — importable from the package root or the `/hooks` subpath.
- Every hook is now queryable from `meta.json`'s `hooks` section (schema 1.3) with a canonical signature, and a `validate:hooks` gate blocks any hook that ships undocumented.

## v0.55.0 — Composition contract

- **Added** a documented composition model: `as` (element swap on primitives) vs. `asChild` (universal composition via `Slot`), grounded in `meta.polymorphic`.
- **Fixed** an accessibility gap where `asChild` triggers dropped disabled/loading semantics.
- Consolidated overlapping surfaces (Alert / Callout / Banner and the Card family) into intentional, documented sets.

## v0.54.0 — Uncontrolled-first state contract

- **Changed** every stateful component to support the uncontrolled case out of the box (`defaultX`) alongside controlled (`X` + `onXChange`), via a shared `useControllableState` primitive.
- **Added** a `validate:state` CI gate that fails the build if a stateful component is missing its pair.

## v0.53.0 — Per-component import specifiers

- **Added** flat per-component entry points so `./components/<Name>` resolves cleanly for tighter tree-shaking.

## v0.52.0 — Positioning consolidation

- **Changed** overlay positioning onto a single shared `usePortalPosition` path across Dropdown, Popover, Tooltip, and the date pickers.

## v0.51.0 — Static theme initialization

- **Added** a packaged, static `theme-init.js` so consumers can prevent theme flash-of-incorrect-color on first paint without shipping their own script.

## v0.50.0 — Claims enforcement

- **Changed** documentation to be CI-verified: generated inventories, token parity, and meta conformance are checked so documented claims stay true.

## v0.49.0 — Apache-2.0 license

- **Changed** the license to Apache-2.0 in preparation for open source.

## v0.48.0 — Consumer theming correctness

- **Fixed** token-override propagation so a consumer re-skin reaches tinted backgrounds, gradients, and shadows — not just borders and text.

## v0.47.0 — Open-source readiness

- **Changed** metadata, docs, and packaging in preparation for a public release.

## v0.46.0 — Build hygiene & type safety

- **Changed** to a "commit-none" `dist/` policy (the build is rebuilt on demand and validated by a packed-tarball type-resolution smoke test).
- **Changed** TypeScript to `noUncheckedIndexedAccess`; unified breakpoints to a single source of truth.

## v0.45.0 — Fixes & install unblock

- **Fixed** StatCard, SegmentedControl, and Sidebar issues surfaced by real consumers.

## v0.44.0 — Cascade-layer golden path

- **Added** a documented layer-order primer and an unlayered escape-hatch bundle so a consumer's global CSS reset can't zero out DS component styling.

## v0.43.0 — Self-describing meta enablement

- **Added** the `meta.json` schema at version 1.2 and standalone meta/schema subpackages, so AI agents and MCP servers can ground on the library's real API surface.

## v0.42.0 — Spacing token migration

- **Changed** hardcoded padding/margins onto spacing tokens across components.

## v0.41.0 — Token single source of truth

- **Changed** design tokens to a single generated source (`emit-tokens`), keeping CSS variables and the TypeScript token exports in lockstep.

## v0.40.0 / v0.40.1 — Hardening & RSC boundaries

- **Fixed** theme SSR-safety and toast de-duplication.
- **Changed** components to declare server-safe vs. client-only boundaries, captured in `meta.capabilities`.

## v0.39.0 — Full customizability

- **Added** the complete override stack on every component: tokens, variants, `className`/`style` passthrough, cascade layers, deep CSS-Module exports, composition slots, and polymorphic `as`.

## v0.38.0 — Trust & claims enforcement

- **Added** CI guards that keep documented component counts, coverage, and capabilities honest.

## v0.37.0 — Override gap closure

- **Fixed** silent `className`/`style` passthrough gaps across the component set.

## v0.36.0 — Brand-neutral by default

- **Changed** the library to ship brand-neutral out of the box; the original palette is now opt-in via `<ThemeProvider preset="lando">`. This positions Lando DS as foundation infrastructure any project can adopt and skin.

## v0.30.0 – v0.35.0 — Component surface expansion

- **Added** CommandPalette and NavTabs (v0.30); Icon curation and RSC-safe theme scripting (v0.31); the Sidebar subsystem (v0.32); Slider, NumberInput, Combobox, MultiSelect, AlertDialog (v0.33); DataTable, Form/Field, ScrollArea, FileInput (v0.34); and the Calendar / DatePicker / DateRangePicker family (v0.35).

## v0.1.0 – v0.29.0 — Foundational development

- **Added** the initial component set and core systems: layout primitives and typography; the form suite; navigation and app-shell components (Header, Sidebar, Footer); feedback, data-display, editorial, and chart components; the OKLCH design-token system with a two-layer semantic-alias contract; the theming runtime with dark mode; the icon system; and the initial build, test, and distribution pipeline.
- **Changed** accessibility, type safety, and Next.js/App-Router compatibility iteratively across these releases.
