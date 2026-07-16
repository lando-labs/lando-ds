<!--
AI-Generated Documentation
Created by: react-specialist
Date: 2026-07-12
Purpose: Next.js App Router integration for the DS anti-flash theme init (#80) — the static `dist/theme-init.js` + `themeScriptPath`, when to use it vs. the inline `themeScript()`, and the copy/rewrite step to serve it.
-->

# Integrating with Next.js (App Router)

This guide covers the **anti-flash theme initialization** — running a tiny script
before hydration so the page paints the correct theme (mode, preset, and any
persisted product theme) on the first frame instead of flashing the base palette.

There are three integration shapes. Pick by what your app actually needs.

## TL;DR

| You need… | Use | Warning-free on nav? |
|---|---|---|
| Mode (dark/light) only | Server-resolve from a cookie → `data-theme` on `<html>` | ✅ (no script) |
| Preset / product-theme colors, zero-flash on reload | **Static `dist/theme-init.js` via `next/script`** (#80) | ✅ |
| Strict CSP with a nonce | `themeScript({ nonce })` inline | ⚠️ inline |
| First-visit default-brand zero-flash | `themeScript({ defaultPreset })` inline | ⚠️ inline |

## Why a static file (the #80 path)

`themeScript()` returns a JS string meant for inline injection:

```tsx
<script dangerouslySetInnerHTML={{ __html: themeScript() }} />
```

That works, but in **Next.js 15/16 App Router + React 19** rendering an inline
`<script>` in the RSC tree fires React's *"Encountered a script tag while
rendering"* dev warning on **every client navigation**. A real external
`<script src>` warns at most once at hydration and never on navigation.

Historically that forced you to hand-copy the DS script body into your own
`public/theme-init.js` — a copy that silently drifts from DS internals as the
theme system evolves (new storage keys, preset color replay, etc.).

**#80 fixes this:** the DS build ships that exact body as a standalone file,
`dist/theme-init.js`, generated from the live `themeScript()` export so it can
never drift. You reference the DS artifact instead of maintaining a copy.

## Serving the static file

Next.js App Router does **not** web-serve arbitrary `node_modules` files, so the
DS file must reach a served URL. Use the `themeScriptPath` export (a resolvable
specifier, `@lando-labs/lando-ds/theme-init.js`) with **one** of these.

### Option 1 — copy into `public/` at build time (recommended)

A tiny prebuild script resolves the DS file and copies it to `public/`:

```js
// scripts/copy-theme-init.mjs
import { createRequire } from 'node:module'
import { copyFileSync } from 'node:fs'
import { themeScriptPath } from '@lando-labs/lando-ds'

const from = createRequire(import.meta.url).resolve(themeScriptPath)
copyFileSync(from, new URL('../public/lando-theme-init.js', import.meta.url))
console.log('[theme-init] copied', from, '→ public/lando-theme-init.js')
```

```jsonc
// package.json
"scripts": { "prebuild": "node scripts/copy-theme-init.mjs", "predev": "node scripts/copy-theme-init.mjs" }
```

The copy is a build artifact — add `public/lando-theme-init.js` to `.gitignore`.
Because it is regenerated from the pinned DS version on every build, it tracks
the DS automatically (no manual mirror).

### Option 2 — Route Handler (no copy)

If you'd rather not copy into `public/`, serve the DS file from an App Router
Route Handler. It reads the resolved file once at module load and returns it as
a statically-cached JS response:

```ts
// app/lando-theme-init.js/route.ts
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { themeScriptPath } from '@lando-labs/lando-ds'

// Resolved from your pinned DS version at build; no file to gitignore.
const body = readFileSync(createRequire(import.meta.url).resolve(themeScriptPath), 'utf8')

export const dynamic = 'force-static' // prerender to a static asset at build

export function GET() {
  return new Response(body, {
    headers: { 'content-type': 'application/javascript; charset=utf-8' },
  })
}
```

The folder name **is** the route, so this serves at `/lando-theme-init.js`. It
runs on the Node.js runtime (it needs `fs`), not the Edge runtime.

> **Not via `rewrites()`.** A Next.js rewrite `destination` must be an internal
> route or an external URL — it cannot point at a `node_modules` file path (that
> resolves to a non-existent route → 404). Use the copy (Option 1) or this Route
> Handler; Option 1 is the most portable.

## Wiring it into the layout

Load the served file with `next/script` and `strategy="beforeInteractive"` so it
runs before hydration. Pair it with a server-resolved `initialMode` and
`<ThemeProvider>` so SSR and the first client render agree:

```tsx
// app/layout.tsx
import Script from 'next/script'
import { ThemeProvider } from '@lando-labs/lando-ds'
import '@lando-labs/lando-ds/styles'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script src="/lando-theme-init.js" strategy="beforeInteractive" />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

What the script does before paint: resolves mode (persisted → system), sets
`data-theme` + `color-scheme`, replays a persisted `data-theme-preset`, and
replays a persisted product theme's screened `--color-*` custom properties
(so a saved product theme paints correctly on the first frame). Values are
injection-screened by a mirror of the runtime `isSafeTokenValue` guard.

## The inline variants (still supported)

The static file is one fixed artifact, so the per-request options stay inline:

- **`themeScript({ nonce })`** — returns a complete `<script nonce="…">…</script>`
  tag for a strict `script-src 'nonce-…'` CSP. See [`csp.md`](./csp.md).
- **`themeScript({ defaultPreset: 'lando' })`** — inlines a default preset's
  `--color-*` vars applied on **first visit only** (no persisted preset), for
  zero-flash default-brand. Pair with `<ThemeProvider preset="lando">` using the
  same id. See [`theme-presets.md`](./theme-presets.md).

Both remain the right tool when you need a nonce or first-visit default-brand;
the static file is the right tool for the warning-free persisted-state replay.

## App shell in the App Router

`<AppShell>` slots `header`, `sidebar`, `footer`, and `children` (main) into a
stable, responsive CSS grid — no hand-written grid layout, media queries, scroll
containers, or keyboard handlers required. It's the happy path for wrapping every
page in the App Router.

```tsx
// app/layout.tsx
import { AppShell, Header, Footer } from '@lando-labs/lando-ds'
import '@lando-labs/lando-ds/styles.css'
import { NavList } from './_components/NavList'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell
          header={<Header logo={<Logo />} sticky />}
          sidebar={<NavList />}
          footer={<Footer copyright="© 2026 Lando Labs" variant="simple" />}
          sidebarPersistKey="lando-app-sidebar"
        >
          {children}
        </AppShell>
      </body>
    </html>
  )
}
```

**Notes:**

- `<AppShell>` has `"use client"` internally (keyboard shortcut + state hooks).
  That's fine inside a Server Component `layout.tsx` — React handles the boundary
  automatically.
- If you need the wrapper itself on the server (e.g. for SSR-stable initial
  paint), wrap it in your own Client Component shell file:

```tsx
// app/_shell/ClientShell.tsx
'use client'
import { AppShell } from '@lando-labs/lando-ds'

export function ClientShell({ children }: { children: React.ReactNode }) {
  return <AppShell /* props */>{children}</AppShell>
}
```

The full `AppShell` and `Sidebar` prop APIs (controlled/uncontrolled/persisted
sidebar state, `contentPadding`/`contentMaxWidth`, the collapsed rail slot, and
CSS-variable overrides) are documented in
[`components.md`](./components.md#appshell).

## See also

- [`csp.md`](./csp.md) — CSP directives and the `themeScript({ nonce })` path.
- [`theme-presets.md`](./theme-presets.md) — preset ids and `defaultPreset`.
- [`css-layers.md`](./css-layers.md) — cascade-layer override contract for consumers.
