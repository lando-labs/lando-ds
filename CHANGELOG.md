# Changelog

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
