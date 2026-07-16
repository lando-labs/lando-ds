# Lando DS — Contributor & Agent Guide

**A self-describing, AI-native design system for React** — production-ready components, semantic OKLCH design tokens, and a structured `meta.json` artifact that an AI assistant can ground itself against in milliseconds.

This file orients human contributors and AI coding agents working **inside this repository**. If you just want to *consume* the published package in your own app, start with the [README](./README.md) and [`reference/integrating-with-nextjs.md`](./reference/integrating-with-nextjs.md).

---

## What this repository is

This repo is the **distributable library itself** — components, design tokens, the headless hooks library, and the self-describing `meta.json` artifact. It is **library-only**: there is intentionally **no in-repo showcase or dev server** (`npm run dev` does not exist). Components are exercised through their test suites and verified visually by consuming the built package from a host application (see [`examples/next-app-router`](./examples/next-app-router)).

Everything ships as an npm package with full TypeScript definitions, CSS Modules keyed on design tokens, and tree-shakeable exports.

---

## Architecture at a glance

> Full architecture reference: [`.claude/sprints/architecture/architecture.md`](./.claude/sprints/architecture/architecture.md) — feature areas, shared systems, decisions, and the build/distribution pipeline. Version history: [`CHANGELOG.md`](./CHANGELOG.md).

- **CSS Modules + design tokens.** Every component is styled with a scoped `*.module.css` that references CSS-variable design tokens — never hard-coded values. Tokens are the single theming surface. See [`reference/design-tokens-implementation.md`](./reference/design-tokens-implementation.md).
- **OKLCH color system.** Semantic tokens (`--color-primary`, `--color-surface`, …) resolve to OKLCH values; the library ships brand-neutral by default and is designed to be re-skinned by overriding tokens at any ancestor. See [`reference/theme-presets.md`](./reference/theme-presets.md).
- **`meta.json` is the source of truth.** On every build, [`scripts/emit-meta.mjs`](./scripts/emit-meta.mjs) emits `dist/meta.json` (+ `meta.verbose.json`): per-component prop tables, capabilities (RSC-safe / client-only / polymorphic / ref-forwarding), the hooks surface, tokens, and theme presets. This is what makes the library *self-describing* to AI agents and MCP servers.
- **Cascade layers.** Published CSS is wrapped in `@layer` so consumer styles win predictably; there is a documented unlayered escape hatch. See [`reference/css-layers.md`](./reference/css-layers.md).
- **RSC-native.** Components are annotated server-safe vs. client-only, enforced through the build and captured in `meta.capabilities`. See [`reference/rsc-boundary-matrix.md`](./reference/rsc-boundary-matrix.md).

---

## The contracts (documented **and** CI-enforced)

The library commits to a set of contracts. Each is documented and, where possible, enforced by a `validate:*` gate so it stays true:

| Contract | Doc | Enforcement |
|---|---|---|
| **Uncontrolled-first state** — every stateful component ships `defaultX` + `X`/`onXChange` via a shared `useControllableState` | [`state-contract.md`](./reference/state-contract.md) | `npm run validate:state` |
| **Composition** — `as` (element swap on primitives) vs. `asChild` (universal via `Slot`), grounded in `meta.polymorphic` | [`composition-contract.md`](./reference/composition-contract.md) | build + meta |
| **Hooks discoverability** — every hook is in `meta.hooks` with a canonical signature | [`hooks.md`](./reference/hooks.md) | `npm run validate:hooks` |
| **Cascade-layer override order** | [`css-layers.md`](./reference/css-layers.md) | published `@layer` order |
| **CSP compatibility** | [`csp.md`](./reference/csp.md) | — |
| **`meta.json` shape** | schema in `src/meta/` | `npm run validate:meta` |

Further API references: [`components.md`](./reference/components.md) (full component API, plus layout-primitive and typography guidance), [`component-authoring.md`](./reference/component-authoring.md) (how to add a component — interaction/animation patterns and the component checklist), and [`integrating-with-nextjs.md`](./reference/integrating-with-nextjs.md) (App Router setup + app shell).

---

## Component library

The design system exports <!-- BEGIN:GENERATED:component-count -->
**127 components**
<!-- END:GENERATED:component-count --> from `src/components/index.ts`, all with TypeScript definitions and token-keyed CSS Modules.

> **Maintainers**: the count, inventory, and test-coverage numbers below are **generated** from `src/components/index.ts` (plus a real count of `src/components/**/*.test.tsx`) by [`scripts/sync-docs.mjs`](./scripts/sync-docs.mjs). After adding or removing a component, run `npm run sync-docs`; `npm run sync-docs:check` fails CI if these regions drift. Only the regions between the `GENERATED` markers are rewritten — edit prose freely outside them. The same script also emits `COMPONENTS.md`.

<!-- BEGIN:GENERATED:component-inventory -->
The design system exports **127 components** from `src/components/index.ts`, grouped below by role. This count and list are generated from the barrel file and match the set published to `dist/meta.json`. All components ship with TypeScript definitions and CSS Modules keyed on design tokens. The related sub-exports (e.g. `CardHeader`, `useToast`) live alongside each component; see `COMPONENTS.md` for the per-directory breakdown and `/reference/components.md` for the full API reference.

**Layout Primitives** (11): Divider, Container, Grid, GridItem, Stack, Inline, Box, AspectRatio, Center, Spacer, ScrollArea

**Typography** (5): Heading, Text, Kbd, Code, Mark

**Core & Form** (23): Button, Input, NumberInput, FileInput, Select, Combobox, MultiSelect, Checkbox, Radio, RadioGroup, Switch, Slider, Textarea, TagInput, Form, Field, IconButton, SegmentedControl, ColorSwatch, DateDisplay, Calendar, DatePicker, DateRangePicker

**Data Display** (26): Card, CardHeader, CardBody, CardFooter, CardTitle, CardMedia, Badge, Chip, Avatar, Table, DataTable, DataTableStatic, List, ListItem, StatCard, TaskCard, DetailCard, Timeline, TimelineItem, TimelineGroup, ApprovalCard, ArticleCard, Byline, Lede, PullQuote, AvatarGroup

**Feedback & Status** (10): AlertDialog, Progress, StepProgress, Alert, Callout, Banner, Skeleton, Spinner, StatusDot, EmptyState

**Overlay & Interactive** (21): Modal, Drawer, Toast, ToastContainer, ToastProvider, Tooltip, Tabs, TabList, Tab, TabPanel, Accordion, AccordionItem, Portal, Slot, Dropdown, DropdownItem, Popover, CommandPalette, CommandPaletteGroup, CommandPaletteItem, Collapsible

**Navigation & Chrome** (14): Breadcrumb, BreadcrumbItem, Pagination, StickyBar, Header, Sidebar, SidebarNavItem, Footer, BottomNav, BottomNavItem, PageHeader, AppShell, NavTabs, NavTabsItem

**Content Display** (3): CodeBlock, Markdown, VisuallyHidden

**Communication** (4): Chat, ChatMessage, ChatInput, ChatThinkingIndicator

**Theming** (2): ThemeBuilder, ThemeScope

**Data Visualization** (8): Chart, LineChart, BarChart, AreaChart, PieChart, DonutChart, FunnelChart, Sparkline

> The `Icon` wrapper and the curated lucide-react icon set are re-exported via `export * from './Icon'`; being a wildcard re-export they are not counted in the 127 figure above.
<!-- END:GENERATED:component-inventory -->

### Quick start (consuming the package)

```tsx
import { Stack, Inline, Button, Input, Heading, Text, Card, CardBody, Badge } from '@lando-labs/lando-ds'

<Stack gap="md">
  <Heading level={1} size="2xl">Page Title</Heading>
  <Text variant="body">Clean vertical layout — layout primitives replace most flexbox CSS.</Text>
  <Inline gap="sm" justify="between">
    <Button variant="primary" loading={isLoading}>Save</Button>
    <Badge variant="success">Active</Badge>
  </Inline>
</Stack>
```

---

## Hooks

The library ships a headless, dependency-free hooks library alongside the components — **reach for these before hand-rolling.** Import from the package root or the `/hooks` subpath:

```tsx
import { useDisclosure, useMediaQuery } from '@lando-labs/lando-ds'
// or: import { useDisclosure } from '@lando-labs/lando-ds/hooks'
```

All hooks are client-side (`'use client'`), dependency-free beyond React, and SSR-safe (they never touch `window`/`document` during render). Every hook is queryable from `meta.json`'s `hooks` section with its canonical signature. See [`reference/hooks.md`](./reference/hooks.md).

<!-- BEGIN:GENERATED:hook-inventory -->
The design system exports **19 hooks** from `src/hooks/index.ts`, importable from the package root or the `/hooks` subpath, and queryable from `meta.json`'s `hooks` section (schema 1.3+).

**a11y** (1): useFocusTrap

**browser** (3): useClipboard, useMediaQuery, useViewportSize

**dom** (6): useClickOutside, useEventListener, useHover, useIntersection, useResizeObserver, useWindowScroll

**keyboard** (1): useKeyPress

**layout** (1): usePortalPosition

**lifecycle** (1): useMounted

**state** (4): useDebouncedValue, useDisclosure, useLocalStorage, useToggle

**timing** (2): useInterval, useTimeout
<!-- END:GENERATED:hook-inventory -->

---

## Development

```bash
npm ci               # install (runs the build via the prepare lifecycle)
npm run typecheck    # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint         # eslint, zero warnings
npm test -- --run    # vitest
npm run build        # vite library build → dist/ (+ emit tokens/meta, unlayered CSS)
npm run sync-docs    # regenerate COMPONENTS.md + CLAUDE.md generated regions
```

### The gate

Every change must pass, in this order, the same checks CI runs: **typecheck → lint → test → build**, plus `validate:meta`, `validate:state`, `validate:hooks`, and the `sync-docs` drift guard. CI additionally type-checks a real consumer of the packed tarball ([`examples/consumer-smoke`](./examples/consumer-smoke)) and runs an RSC `next build` proof ([`examples/next-app-router`](./examples/next-app-router)).

> **Judging pass/fail:** check each command's exit code directly. Do **not** pipe these through `tail`/`grep` — the pipe's exit code is the tail's, which masks a real failure.

`dist/` is **not committed** (it is rebuilt on demand by `prepare` and by publish CI); the packed/published tarball ships the full fresh build. The tarball type-resolution smoke test is the CI guarantee that a consumer's types resolve.

---

## Component features & status

All components share: CSS Modules wired to design tokens, full TypeScript definitions, dark-mode support, deceleration-curved animations (150–300ms), mobile-first responsive defaults, and loading/error states where relevant.

**Accessibility**: targeting WCAG 2.1 AA. Components are built with accessibility in mind (keyboard support, ARIA on overlays, focus management on Modal/Dropdown), and a systematic audit is ongoing — do not assume full AA conformance yet.

<!-- BEGIN:GENERATED:test-coverage -->
**Test coverage status**: Test infrastructure (Vitest + Testing Library) is wired up. **96 of 96** component directories have at least one `*.test.tsx` file (106 test files in total under `src/components`). Depth still varies — many are smoke-level — and backfill is ongoing. This line is generated by `scripts/sync-docs.mjs` from a real count of `src/components/**/*.test.tsx`.
<!-- END:GENERATED:test-coverage -->

---

## Conventions

- **Components** are `*.module.css` + design tokens, fully typed, with a `*.test.tsx` beside them. Never hard-code a color/spacing value that a token exists for.
- **Design decisions** that affect the public API are worth capturing as short ADRs.
- **Generated regions** (component inventory, test coverage, hooks) are machine-written — never hand-edit between `GENERATED` markers; run `npm run sync-docs`.
- **Commits** are scoped and atomic: `[scope] type: description`.
- **No new runtime dependencies** without discussion — the hooks library and most primitives are intentionally dependency-free.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, the gate, and PR expectations. Security reports: see [`SECURITY.md`](./SECURITY.md).

## Agents

This repo ships a few [Claude Code](https://claude.com/claude-code) agents under [`.claude/agents/`](./.claude/agents) for building with and maintaining the DS:

- **`nextjs-lando-ds`** — builds Next.js / React UI *with* the design system, grounding on the shipped `meta.json` (or the DS MCP) instead of hardcoding the inventory.
- **`design-system-security-auditor`** — reviews component-library security surfaces: content rendering (`Markdown`/`CodeBlock`/`Chat`), portal overlays, `className`/`style` passthrough, CSP compatibility, and bundle hygiene.
- **`accessibility-auditor`** — WCAG 2.1 audits: semantic HTML, ARIA, keyboard navigation, and focus management.
