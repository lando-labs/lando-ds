# Changelog

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
