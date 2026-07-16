# RSC Boundary Matrix

**Sprint v0.18.0 — issue #265 / #276**

This document records the Server vs Client classification of every component source file (`.tsx` / `.ts`, excluding index barrels, tests, and stories). Classification is derived mechanically: a file that opens with a `'use client'` directive is **Client**; all others are **Server**.

The build uses `preserveModules` + `rollup-plugin-preserve-directives`, so each source file's directive (or absence thereof) is preserved 1:1 into its own dist file. A server-safe leaf genuinely ships with zero client JS to an RSC consumer — provided they import that leaf directly (deep import). Barrel imports still pull the full surface; the deep-import path that makes the zero-JS benefit reachable shipped in v0.22.0 (#276) — see the "Deep Imports" section below.

---

## Server-Safe Leaves

Files that carry **no** `'use client'` directive. These components can be imported in a React Server Component and render with zero client JS payload (via deep imports — see Known Limitation).

| File | Component(s) | Notes |
|------|-------------|-------|
| `src/components/ArticleCard/ArticleCard.tsx` | `ArticleCard` | Editorial card — pure markup |
| `src/components/ArticleCard/Byline.tsx` | `Byline` | Author / date line |
| `src/components/ArticleCard/Lede.tsx` | `Lede` | Introductory paragraph |
| `src/components/ArticleCard/PullQuote.tsx` | `PullQuote` | Block quote primitive |
| `src/components/Badge/Badge.tsx` | `Badge` | Status label — pure markup |
| `src/components/BottomNav/BottomNav.tsx` | `BottomNav` | Mobile nav shell |
| `src/components/BottomNav/BottomNavItem.tsx` | `BottomNavItem` | Mobile nav item |
| `src/components/Box/Box.tsx` | `Box` | Layout wrapper |
| `src/components/Callout/Callout.tsx` | `Callout` | Inline callout block |
| `src/components/Card/Card.tsx` | `Card` | Card container |
| `src/components/Card/CardBody.tsx` | `CardBody` | Card body region |
| `src/components/Card/CardFooter.tsx` | `CardFooter` | Card footer region |
| `src/components/Card/CardHeader.tsx` | `CardHeader` | Card header region |
| `src/components/Card/CardTitle.tsx` | `CardTitle` | Card title text |
| `src/components/Chart/Chart.tsx` | `Chart` (base) | Base chart wrapper — no recharts dep at this layer |
| `src/components/Chart/types.ts` | chart types | Type definitions only |
| `src/components/Chart/utils.ts` | chart utilities | Pure utility functions |
| `src/components/Chat/ChatMessage.tsx` | `ChatMessage` | Static message bubble |
| `src/components/Chat/ChatThinkingIndicator.tsx` | `ChatThinkingIndicator` | Animated thinking dots |
| `src/components/Chat/types.ts` | chat types | Type definitions only |
| `src/components/Chip/Chip.tsx` | `Chip` | Tag / filter chip |
| `src/components/Container/Container.tsx` | `Container` | Max-width page container |
| `src/components/Divider/Divider.tsx` | `Divider` | Horizontal / vertical rule |
| `src/components/EmptyState/EmptyState.tsx` | `EmptyState` | Empty-view layout |
| `src/components/Footer/Footer.tsx` | `Footer` | Page footer |
| `src/components/Grid/Grid.tsx` | `Grid` | CSS grid wrapper |
| `src/components/Heading/Heading.tsx` | `Heading` | Semantic h1–h6 |
| `src/components/Icon/Icon.tsx` | `Icon` | Lucide icon wrapper |
| `src/components/IconButton/IconButton.tsx` | `IconButton` | Icon-only button |
| `src/components/Inline/Inline.tsx` | `Inline` | Horizontal flex row |
| `src/components/Kbd/shortcut-parser.ts` | shortcut-parser | Pure utility |
| `src/components/List/List.tsx` | `List` | List container |
| `src/components/Markdown/Markdown.tsx` | `Markdown` | Markdown renderer |
| `src/components/NavTabs/NavTabs.tsx` | `NavTabs` | Anchor-based nav tabs — pure markup (#377) |
| `src/components/PageHeader/PageHeader.tsx` | `PageHeader` | Page-level header section |
| `src/components/Progress/Progress.tsx` | `Progress` | Linear progress bar |
| `src/components/Sidebar/SidebarNavItem.tsx` | `SidebarNavItem` | Individual nav item |
| `src/components/Skeleton/Skeleton.tsx` | `Skeleton` | Loading placeholder |
| `src/components/Spinner/Spinner.tsx` | `Spinner` | Indeterminate spinner |
| `src/components/Stack/Stack.tsx` | `Stack` | Vertical stack layout |
| `src/components/StatCard/StatCard.tsx` | `StatCard` | Dashboard metric card |
| `src/components/StatusDot/StatusDot.tsx` | `StatusDot` | Status indicator dot |
| `src/components/StepProgress/StepProgress.tsx` | `StepProgress` | Multi-step progress |
| `src/components/Text/Text.tsx` | `Text` | Polymorphic text primitive |
| `src/components/Toast/ToastContainer.tsx` | `ToastContainer` | Toast container (layout only) |

**Server-safe file count: 52** (authoritative — the mechanical count of non-test `src/components/**/*.tsx` files whose first real line of code is **not** `'use client'`, as of Sprint v0.37.0).

> The table above enumerates representative server-safe leaves; it is not a line-for-line mirror of all 52 files. The count is the source of truth — re-derive it by classifying every non-test `.tsx` under `src/components/` with the same first-real-line rule the boundary guard uses (`src/test/use-client-boundary.test.ts`).

> `Chart/Chart.tsx` is server-safe at the base-wrapper level, but the chart primitive itself requires a client boundary when consuming recharts chart types (LineChart, BarChart, etc.). The base wrapper can render loading/error/empty states on the server.

---

## Client Components

Files that declare `'use client'` at the top. These require a client boundary and are not safe to import directly in a React Server Component without wrapping in a `'use client'` file.

| File | Component(s) | Reason |
|------|-------------|--------|
| `src/components/Accordion/Accordion.tsx` | `Accordion` | `useState` (open/close state) |
| `src/components/Accordion/AccordionItem.tsx` | `AccordionItem` | `useContext` (Accordion context) |
| `src/components/Alert/Alert.tsx` | `Alert` | `useState` (dismiss state) |
| `src/components/AppShell/AppShell.tsx` | `AppShell` | Composes Header + Sidebar (both client) |
| `src/components/ApprovalCard/ApprovalCard.tsx` | `ApprovalCard` | Event handler wiring (second-tier, allowlisted) |
| `src/components/AreaChart/AreaChart.tsx` | `AreaChart` | Recharts (client-only DOM measurement) |
| `src/components/Avatar/Avatar.tsx` | `Avatar` | `useState` (image error fallback) |
| `src/components/Banner/Banner.tsx` | `Banner` | Event handler wiring (second-tier, allowlisted) |
| `src/components/BarChart/BarChart.tsx` | `BarChart` | Recharts (client-only DOM measurement) |
| `src/components/Breadcrumb/Breadcrumb.tsx` | `Breadcrumb` | `useRef` |
| `src/components/Breadcrumb/BreadcrumbItem.tsx` | `BreadcrumbItem` | Composes Breadcrumb context |
| `src/components/Button/Button.tsx` | `Button` | `useRef`, ripple effect (`addEventListener`) |
| `src/components/Card/CardMedia.tsx` | `CardMedia` | `useState` (image load state) |
| `src/components/Chat/Chat.tsx` | `Chat` | `useState`, `useRef` (scroll, message list) |
| `src/components/Chat/ChatInput.tsx` | `ChatInput` | `useState`, `useRef` (textarea auto-resize) |
| `src/components/Checkbox/Checkbox.tsx` | `Checkbox` | `useId`, `useState` |
| `src/components/CodeBlock/CodeBlock.tsx` | `CodeBlock` | `useState` (copy state), `document.execCommand` |
| `src/components/CommandPalette/CommandPalette.tsx` | `CommandPalette` | `useState`, `useRef`, composes `Modal` (portal, focus trap) (#378) |
| `src/components/DetailCard/DetailCard.tsx` | `DetailCard` | Event handler wiring (second-tier, allowlisted) |
| `src/components/DonutChart/DonutChart.tsx` | `DonutChart` | Recharts (client-only DOM measurement) |
| `src/components/Drawer/Drawer.tsx` | `Drawer` | `useState`, focus trap, `document` |
| `src/components/Dropdown/Dropdown.tsx` | `Dropdown` | `useState`, `useRef`, portal, `document` |
| `src/components/Dropdown/DropdownItem.tsx` | `DropdownItem` | Event handler wiring (second-tier, allowlisted) |
| `src/components/FunnelChart/FunnelChart.tsx` | `FunnelChart` | Recharts (client-only DOM measurement) |
| `src/components/Header/Header.tsx` | `Header` | `useState` (mobile menu), `useRef` |
| `src/components/Input/Input.tsx` | `Input` | `useState`, `useRef` (char count, password toggle) |
| `src/components/Kbd/Kbd.tsx` | `Kbd` | `useEffect` (platform detection) |
| `src/components/LineChart/LineChart.tsx` | `LineChart` | Recharts (client-only DOM measurement) |
| `src/components/List/ListItem.tsx` | `ListItem` | Event handler wiring (second-tier, allowlisted) |
| `src/components/MarkdownEditor/MarkdownEditor.tsx` | `MarkdownEditor` | `@uiw/react-md-editor` (browser-only, `document` at module eval) |
| `src/components/Modal/Modal.tsx` | `Modal` | `useEffect`, focus trap, portal, `document` |
| `src/components/Pagination/Pagination.tsx` | `Pagination` | Event handler wiring (second-tier, allowlisted) |
| `src/components/PieChart/PieChart.tsx` | `PieChart` | Recharts (client-only DOM measurement) |
| `src/components/Popover/Popover.tsx` | `Popover` | `useState`, `useRef`, portal, placement |
| `src/components/Portal/Portal.tsx` | `Portal` | `document.createElement` (portal primitive) |
| `src/components/Radio/Radio.tsx` | `Radio` | `useContext` (RadioGroup context) |
| `src/components/Radio/RadioGroup.tsx` | `RadioGroup` | `useState`, `createContext` |
| `src/components/SegmentedControl/SegmentedControl.tsx` | `SegmentedControl` | `useState`, `useRef` (sliding indicator) |
| `src/components/Select/Select.tsx` | `Select` | `useState`, `useRef`, portal dropdown |
| `src/components/Sidebar/Sidebar.tsx` | `Sidebar` | `useState` (collapse), `useRef` |
| `src/components/Slot/Slot.tsx` | `Slot` | Ref-merging asChild primitive (allowlisted) |
| `src/components/Sparkline/Sparkline.tsx` | `Sparkline` | Module-level `gradientIdCounter` (see SSR hazards) |
| `src/components/StickyBar/StickyBar.tsx` | `StickyBar` | `useEffect`, `IntersectionObserver` |
| `src/components/Switch/Switch.tsx` | `Switch` | `useState`, `useId` |
| `src/components/Table/Table.tsx` | `Table` | `useState` (sort state) |
| `src/components/Tabs/Tab.tsx` | `Tab` | `useContext` (Tabs context) |
| `src/components/Tabs/TabList.tsx` | `TabList` | `useContext`, keyboard nav |
| `src/components/Tabs/TabPanel.tsx` | `TabPanel` | `useContext` (Tabs context) |
| `src/components/Tabs/Tabs.tsx` | `Tabs` | `useState`, `createContext` |
| `src/components/TagInput/TagInput.tsx` | `TagInput` | `useState`, `useRef` |
| `src/components/TaskCard/TaskCard.tsx` | `TaskCard` | Event handler wiring (second-tier, allowlisted) |
| `src/components/Textarea/Textarea.tsx` | `Textarea` | `useState`, `useRef` (auto-resize) |
| `src/components/ThemeBuilder/ThemeBuilder.tsx` | `ThemeBuilder` | `useState`, `useEffect`, `document` |
| `src/components/Timeline/Timeline.tsx` | `Timeline` | `Date.now()` at render (see SSR hazards) |
| `src/components/Toast/Toast.tsx` | `Toast` | `useState`, `useEffect`, `Date.now()` (see SSR hazards) |
| `src/components/Toast/ToastProvider.tsx` | `ToastProvider` | `useState`, `createContext` |
| `src/components/Toast/useToast.ts` | `useToast` | `useContext` hook |
| `src/components/Tooltip/Tooltip.tsx` | `Tooltip` | `useState`, `useRef`, portal |

**Client component file count: 72** (authoritative — the mechanical count of non-test `src/components/**/*.tsx` files whose first real line of code **is** `'use client'`, as of Sprint v0.37.0).

> As with the server-safe list, the table enumerates representative client components rather than mirroring all 72 files 1:1. The count is the source of truth; re-derive it with the boundary guard's first-real-line rule (`src/test/use-client-boundary.test.ts`).

---

## SSR-Hazard Client Components

These client components have patterns that would cause hydration mismatches or crashes if accidentally used without a `'use client'` boundary in an SSR context:

| Component | Hazard | Details |
|-----------|--------|---------|
| `AreaChart`, `BarChart`, `DonutChart`, `FunnelChart`, `LineChart`, `PieChart` | **Recharts DOM measurement** | Recharts uses `ResizeObserver` and DOM measurement internally. These are never safe to render on the server — always require a client boundary, and in Next.js App Router should be wrapped with `next/dynamic({ ssr: false })` for full safety. |
| `Timeline` | **`Date.now()` at render** | `Timeline.tsx:138` calls `Date.now()` during render to compute relative timestamps ("2 minutes ago"). If server and client render at different instants, React will emit a hydration mismatch warning. Pass explicit, stable timestamp values or wrap with `suppressHydrationWarning`. |
| `Toast` | **`Date.now()` in effect** | `Toast.tsx:58,62` calls `Date.now()` inside an animation/timing effect. This is inside `useEffect` (client-only) so it does not affect SSR output, but it means the component depends on wall-clock timing that cannot be replicated server-side. |
| `Sparkline` | **Module-level `gradientIdCounter`** | `Sparkline.tsx:179` declares `let gradientIdCounter = 0` at module scope. This counter increments on each render. In an RSC streaming scenario, server and client can assign different IDs to SVG gradient elements, causing a `<linearGradient id>` mismatch and broken gradients. Use only behind a client boundary. |
| `MarkdownEditor` | **`document` at module eval** | Transitively imports `@uiw/react-md-editor`, which calls `document.createElement` during module evaluation (not just render). This crashes Next.js App Router during server render even if the component itself is never rendered. Import only via the dedicated subpath `@lando-labs/lando-ds/markdown-editor` and always with `next/dynamic({ ssr: false })`. |
| `ThemeBuilder` | **`document` at render** | Reads and writes CSS custom properties on `document.documentElement` during render and effects. Not safe for SSR. |

---

## Deep Imports — Reaching the Zero-JS Path

**Issue #276 — shipped in v0.22.0**

The `preserveModules` build (v0.18.0) emits a per-module mirror of `src/` into `dist/`, so every `'use client'` boundary is preserved 1:1 and each server-safe leaf genuinely carries no client JS **at the `dist/` level**. The barrel entry `@lando-labs/lando-ds`, however, re-exports the entire surface from one module — so importing *any* leaf through the barrel makes the RSC bundler treat every module (all recharts chart wrappers, `ThemeBuilder`, `Chat`, `CodeBlock`, …) as reachable. A server page that imports only server-safe leaves **via the barrel** still shipped ~**316–324 kB** of unrendered First Load JS.

v0.22.0 makes the zero-JS path **reachable by consumers** by adding a `./components/*` wildcard to `package.json#exports` that maps each per-module file (types + ESM + CJS):

```jsonc
"./components/*": {
  "types":   "./dist/components/*.d.ts",
  "import":  "./dist/components/*.js",
  "require": "./dist/components/*.cjs"
}
```

### The deep-import specifier (tree-mirror form)

The wildcard is a **tree-mirror**: the `*` captures the full sub-path after `components/`, so the specifier is `components/<Dir>/<Module>` — i.e. the directory **and** the module file. This is intentional and load-bearing:

```tsx
// Server-safe — ships ZERO client JS for these components:
import { Badge } from '@lando-labs/lando-ds/components/Badge/Badge'
import { Card } from '@lando-labs/lando-ds/components/Card/Card'
import { CardBody } from '@lando-labs/lando-ds/components/Card/CardBody'
import { StatusDot } from '@lando-labs/lando-ds/components/StatusDot/StatusDot'

// NOT server-safe — pulls the entire client surface onto the page:
import { Badge, Card, StatusDot } from '@lando-labs/lando-ds'
```

**Why the doubled `<Dir>/<Module>` segment** (and not the prettier `components/Badge`): the build keeps **compound components as separate modules**. `dist/components/Card/Card.js` exports only `Card`; `CardBody`, `CardHeader`, `CardTitle`, `CardFooter`, `CardMedia` are each their own file (`Card/CardBody.js`, …). The aggregate `Card/index` is a **types-only** barrel — Rollup's `preserveModules` tree-shaking collapses the pure re-export `index.ts` files, so there is **no** `Card/index.js` at runtime. A single-`*` "clean" map (`./dist/components/*/*.js`, consumed as `components/Card`) cannot reach `CardBody` and breaks on any sub-path containing a slash. The tree-mirror form reaches **every** emitted module, including compound sub-parts, with zero build change — which is exactly what the proof harness needs. Correctness over specifier prettiness.

**Update (v0.53.0, #283) — the clean `components/<Name>` form now ALSO works.** Rather than change the tree-mirror map, the build now (a) forces each per-component barrel to emit at `dist/components/<Name>/index.js` (every `src/components/*/index.ts` is a build entry, so Rollup no longer collapses it) and (b) writes a flat `dist/components/<Name>.{js,cjs,d.ts}` shim beside the dir (`scripts/emit-component-shims.mjs`). The **unchanged** `./components/*` map then serves BOTH: single-segment `components/Card` → the flat shim (full barrel: `Card` + `CardBody` + …), and multi-segment `components/Card/CardBody` → the deep module (v0.22.0, intact). The flat shim re-exports the real Rollup barrel, so compound namespaces (`DataTable.Static`) and external re-exports (`Icon` → lucide-react) carry through for free. **Measured bundle-equivalent:** `components/Card` and `components/Card/Card` both build to **103 kB** First Load JS in `examples/next-app-router` (identical tree-shaking; no barrel/recharts bloat). Verified additive — every pre-existing dist file is byte-identical.

> **Rule of thumb:** the deep specifier is `components/<ComponentDir>/<ExportFile>`, where `<ExportFile>` is the file that actually declares the symbol. For single-export components these are the same word (`Badge/Badge`). For compound components, name the sub-module (`Card/CardBody`, `ArticleCard/Byline`). Consult the `dist/components/<Dir>/` tree — each `.js`/`.d.ts` (excluding `*.module.css.*` and the types-only `index.d.ts`) is an importable deep path.

### `optimizePackageImports` — available, but not a substitute here

Next.js exposes `experimental.optimizePackageImports`, which can auto-rewrite a flat barrel into per-export deep imports:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['@lando-labs/lando-ds'],
  experimental: {
    optimizePackageImports: ['@lando-labs/lando-ds'],
  },
}
```

**Measured caveat (v0.22.0):** enabling `optimizePackageImports` on this package did **not**, on its own, drop the First Load JS of a barrel-importing server page — `/` stayed at 316 kB with recharts still in the bundle. The optimizer targets a package's *own* top-level barrel shape, and the DS barrel re-exports through a nested `components/index.ts` layer that the transform does not rewrite onto the new `./components/*` subpaths. **The reliable win comes from writing the explicit deep imports** shown above, not from the flag. Treat `optimizePackageImports` as a possible future convenience, not the mechanism — and always verify the actual First Load JS (resolution ≠ payload drop).

**Re-confirmed (v0.53.0, #283):** adding the per-component `index.js` barrels + flat `components/<Name>` shims did **not** make `optimizePackageImports` deliver either. With the flag enabled, a **barrel**-importing page still shipped **348 kB** First Load JS (recharts included), while the same components imported via the clean `components/<Name>` specifier shipped **104 kB**. Next's optimizer still doesn't rewrite through the nested `components/index.ts` onto the `./components/*` subpaths. Conclusion stands: the per-component specifier (clean or deep) is the mechanism; the flag is not.

### Proof (measured in `examples/next-app-router`)

The zero-JS path is validated end-to-end by the RSC proof harness. `app/page.tsx` renders the same server-safe leaf set two ways; only the import style differs:

| Server page `/` | Imports | Route Size | **First Load JS** | recharts in bundle? |
|---|---|---|---|---|
| Before (v0.21.0) | barrel `@lando-labs/lando-ds` | 202 kB | **316 kB** | yes (1 chunk) |
| After (v0.22.0) | deep `…/components/<Dir>/<Module>` | 1.49 kB | **102 kB** | **no (0 chunks)** |

That is a **−214 kB (−68%) First Load JS** drop, landing the server page at the same 102 kB baseline as `/_not-found` (essentially shared-runtime only, ~1.5 kB page-specific). `ThemeBuilder` is likewise absent, and the prerendered HTML still contains every rendered component — so the drop is real payload elimination, not a render regression. The barrel entry and all other existing exports (`.`, `./tokens`, `./components`, `./markdown-editor`, `./styles`, `./fonts.css`) are unchanged; this release is purely additive.

---

## RSC Proof Harness

The proof harness at `examples/next-app-router/` validates this boundary matrix end-to-end:

- **`app/page.tsx`** — Server Component (no `'use client'`). Imports the server-safe leaf set via **deep imports** (`…/components/<Dir>/<Module>`, v0.22.0). Passes `next build` at **102 kB First Load JS** with no recharts/`ThemeBuilder` in the bundle — see the Deep Imports proof table above. (Pre-v0.22.0 this page imported from the barrel and shipped ~316–324 kB.)
- **`app/interactive/page.tsx`** — Client Component (`'use client'`). Imports genuinely-client components (Button, Modal, Tabs, Accordion, etc.) and verifies they work correctly behind a proper client boundary.
- **`src/test/rsc-smoke.test.ts`** — Node-env vitest test. Imports each server-safe leaf individually and asserts `renderToStaticMarkup` completes without throwing, proving no browser API is called at render time.

### Regression Detection Mechanism

Three layers protect the server-safe boundary:

**Layer 1 — Static guard (`use-client-boundary.test.ts`):** If a server-safe leaf gains a `'use client'` directive without a corresponding client-runtime signal (hook, `createContext`, ref, browser global), the test fails. This catches copy-paste regressions where a new presentational component accidentally inherits the directive.

**Layer 2 — Node-env render smoke test (`rsc-smoke.test.ts`):** Imports each server-safe leaf in a Node environment (no DOM) and calls `renderToStaticMarkup`. If any leaf calls `window`, `document`, `navigator`, or any browser-only API at render time, the test throws immediately. This proves the component is genuinely safe for server-side rendering.

**Layer 3 — Next.js RSC boundary enforcement:** Confirmed via live test during harness development. A server component (no `'use client'`) that imports and calls a React hook (e.g., `useState`) fails `next build` with the explicit error:

```
Error: You're importing a component that needs `useState`. This React hook
only works in a client component. To fix, mark the file (or its parent)
with the `"use client"` directive.
```

This test was performed by temporarily placing `import { useState } from 'react'` in `app/page.tsx`, confirming `next build` fails, then reverting to the clean state. The example app is left building green with only server-safe leaves in `app/page.tsx`.

Note: importing a client component (e.g., `Button`) via the barrel into a server page does NOT trigger this error — Next.js 15 allows client components to be imported and rendered from server components (they just add to the client bundle). The RSC error is specifically triggered by calling client-only React APIs (hooks) directly in server component code.
