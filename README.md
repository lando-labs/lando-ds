# Lando DS

**A self-describing, AI-native design system for React.** 127 production-ready components, semantic OKLCH design tokens, first-class React Server Components support, and a structured `meta.json` artifact your AI assistant reads in milliseconds — so it grounds itself on your real API surface instead of guessing.

[![Apache 2.0 License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

> **License:** Apache-2.0 · **Package:** `@lando-labs/lando-ds` · **AI grounding:** ships `meta.json` + `llms.txt`

## Built for AI-assisted development

Every release of `@lando-labs/lando-ds` ships with `dist/meta.json` — a structured artifact describing the entire library. Component names, prop signatures, defaults, tokens, icons, RSC compatibility, polymorphic types, the whole API surface, in one file your editor's AI agent reads in milliseconds.

```json
// dist/meta.json (truncated)
{
  "$schemaVersion": "1.3",
  "components": { "Button": { "props": {...}, "ref": "HTMLButtonElement", ... } },
  "tokens": { ... },
  "capabilities": { "rscSafe": [...], "clientOnly": [...] }
}
```

What this means in practice:

- **Your AI agent grounds itself instantly.** No guessing prop names. No wrong imports. No stale answers.
- **Updates automatically.** Every release, every change. Your tools stay current.
- **Schema-versioned + public.** `@lando-labs/lando-ds/meta-schema` is the source of truth.

Pair with the `llms.txt` shipped in the package for LLM discovery.

## Why we built it this way

Most design systems are documented for humans. Reading them with AI tools is a scrape-and-pray exercise. We thought: **What if your library could describe itself?**

Lando DS is that.

---

- **Component API reference:** see [`reference/components.md`](./reference/components.md)
- **Theming presets** (incl. the opt-in `lando` palette): see [`reference/theme-presets.md`](./reference/theme-presets.md)
- **Customizing & overriding styles:** see [`reference/css-layers.md`](./reference/css-layers.md)

---

## Installation

```bash
npm install @lando-labs/lando-ds
```

Peer dependencies (most React apps already have these): `react` and `react-dom`
(v18 or v19), plus `lucide-react` if you use icons.

```bash
npm install react react-dom lucide-react
```

### Quick start

Import the stylesheet once at your app root, wrap your tree in `ThemeProvider`,
and start composing. This renders a themed card out of the box:

```tsx
import {
  ThemeProvider,
  Stack, Heading, Text, Button, Card, CardBody, Badge,
} from '@lando-labs/lando-ds'
import '@lando-labs/lando-ds/styles' // once, at your app root

export default function App() {
  return (
    <ThemeProvider>
      <Card variant="elevated">
        <CardBody>
          <Stack gap="md">
            <Heading level={1} size="2xl">Hello, Lando DS</Heading>
            <Text variant="body">
              127 components, self-describing meta, brand-neutral by default.
            </Text>
            <Badge variant="success">Ready</Badge>
            <Button variant="primary">Get started</Button>
          </Stack>
        </CardBody>
      </Card>
    </ThemeProvider>
  )
}
```

The DS ships **brand-neutral** — opt into the original Lando palette with
`<ThemeProvider preset="lando">`, or override any token to match your brand
(see [Customizing & overriding styles](#customizing--overriding-styles) and
[`reference/theme-presets.md`](./reference/theme-presets.md)).

---

## Usage

### Import path

Import components, tokens, hooks, and utilities from the **root package
entry** — everything is re-exported there:

```tsx
import { Button, Card, CardBody, Heading, Text } from '@lando-labs/lando-ds'
import { colors, spacing } from '@lando-labs/lando-ds'
import '@lando-labs/lando-ds/styles' // once, at your app root
```

The package also exposes narrower subpath entries for consumers that
want tighter scoping:

- `@lando-labs/lando-ds/components` — components only
- `@lando-labs/lando-ds/tokens` — design tokens only
- `@lando-labs/lando-ds/styles` — compiled CSS
- `@lando-labs/lando-ds/fonts.css` — optional Inter + JetBrains Mono loader (non-Next consumers)

These subpaths are supported and stable. The root entry is canonical for
most apps; prefer it unless you have a reason to scope.

---

## Customizing & overriding styles

The design system ships **all** of its CSS inside named
[CSS cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer).
This means **your own styles override DS components without `!important` and
without worrying about stylesheet load order.** Any CSS you write *outside* a
layer (i.e. normal CSS — which is what you almost always write) automatically
wins over every DS rule.

### The seven layers

The DS stylesheet declares this layer order, once, at the very top of the
bundle:

```css
@layer app-reset, ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app;
```

| Layer           | What's in it                                                        |
| --------------- | ------------------------------------------------------------------- |
| `app-reset`     | **Consumer-owned, opt-in** — a reset you want below every DS layer  |
| `ll.reset`      | Box-sizing + margin/padding reset, stripped browser defaults        |
| `ll.tokens`     | Design-token custom properties (`:root`, `[data-theme="dark"]`, …)  |
| `ll.base`       | Opinionated, token-driven base element styling (`body`, `a`, `code`)|
| `ll.components` | **Every component's styles** (`Button`, `Card`, `Input`, …)         |
| `ll.utilities`  | DS utility classes (`.container`, `.sr-only`, `.skip-to-content`)   |
| `app`           | **Consumer-owned, opt-in** — overrides you want above every DS layer|

`app-reset` and `app` are reserved slots the DS never puts rules in — they
exist so `@layer app { … }` reliably beats every DS layer as soon as you
import `@lando-labs/lando-ds/styles`, with no separate setup required. Layers
earlier in that list have **lower** priority than layers later in the list.
And the one rule that matters most:

> **Unlayered CSS beats every layer.** Your application's normal (unlayered)
> styles always win over DS component styles — regardless of selector
> specificity or import order.

> ⚠️ **Shipping a global CSS reset? Read this first.** That same rule cuts both
> ways: an **unlayered** reset — notably the create-next-app default
> `globals.css` with `* { margin: 0; padding: 0 }` — also beats the DS's
> *layered* component styles and **zeroes out the padding/margins of every DS
> component.** The fix is one import: the layer-order primer
> `@lando-labs/lando-ds/layer-order.css`, loaded before your reset and the
> DS styles, which puts your reset in a layer *below* the DS. (Or skip layers
> entirely with the flattened `@lando-labs/lando-ds/styles.unlayered.css`
> bundle.) Full recipe — including Tailwind coexistence — in
> [reference/css-layers.md → "Consuming alongside a CSS reset"](./reference/css-layers.md#consuming-alongside-a-css-reset).

### Override a component (no `!important`)

A plain class selector beats a DS `<Button>` because your class is unlayered:

```tsx
import { Button } from '@lando-labs/lando-ds'
import './my-overrides.css'

export function BuyButton() {
  return <Button className="buy">Buy now</Button>
}
```

```css
/* my-overrides.css — NOT inside any @layer, so it wins */
.buy {
  background: rebeccapurple; /* beats Button's ll.components background */
  color: white;
}
```

No `!important`. No higher specificity. No `import`-order juggling. The override
wins purely because unlayered CSS outranks the `ll.components` layer.

For **consuming alongside a CSS reset** (the create-next-app / Tailwind
gotcha above), the importable layer-order primer, the flattened
`styles.unlayered.css` bundle, the advanced escape hatch (deliberately writing
*into* the DS layers to slot a rule between DS and your app), the
semver/browser-support promise, and a critical-CSS note, see
**[reference/css-layers.md](./reference/css-layers.md)**.

---

## Fonts

The design system's typography tokens (`--font-family-base`,
`--font-family-mono`) declare **Inter** and **JetBrains Mono** as the
canonical brand faces. The DS does **not** bundle font binaries — it's
the consumer's job to load them. Without a loader wired up, text falls
back silently to the system sans-serif stack and the brand feel is lost.

Pick the path that matches your framework.

### Next.js (recommended)

`next/font/google` self-hosts the binaries at build time, preloads them,
and eliminates Cumulative Layout Shift (CLS). It's strictly better than
any CDN-based approach.

The trick is to use `next/font`'s `variable` option to bind the font to
the **same CSS variables the DS tokens already reference**. Once that's
wired up, every component inherits Inter automatically — no component-
level changes required.

```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google'
import '@lando-labs/lando-ds/styles'

const inter = Inter({
  variable: '--font-family-base',
  subsets: ['latin'],
  display: 'swap',
})

const mono = JetBrains_Mono({
  variable: '--font-family-mono',
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

**How the override works.** `tokens.css` declares the font-family tokens
on `:root` as a fallback, **inside the `ll.tokens` cascade layer**.
`next/font` emits a class on `<html>` that redefines `--font-family-base`
and `--font-family-mono` to the self-hosted faces it generated. That class
is **unlayered**, and unlayered CSS outranks every DS layer — so the
`next/font` values win regardless of stylesheet load order (no more relying
on "loads after the DS stylesheet"). This is the same contract described in
[Customizing & overriding styles](#customizing--overriding-styles): your CSS
beats the DS layers. Every `var(--font-family-base)` reference in a
component then picks up Inter automatically.

**Verify it worked.** In the browser DevTools, inspect any body text
and look at Computed → `font-family`. You should see something like:

```
font-family: "__Inter_abc123", "__Inter_Fallback_abc123", -apple-system, ...
```

If you see the raw `"Inter", -apple-system, ...` fallback stack, the
class didn't reach `<html>` — double-check both variables are applied
on the `<html>` element, not `<body>`.

### Next.js 16+ scroll-behavior attribute

The DS global stylesheet sets `scroll-behavior: smooth` on `<html>`. Next.js 16 warns about this unless you explicitly confirm it with the `data-scroll-behavior="smooth"` attribute. Add it to your root layout:

```tsx
// app/layout.tsx
<html lang="en" data-scroll-behavior="smooth" className={/* ... */}>
```

Without the attribute, Next.js disables smooth scroll during route transitions and prints a console warning. Harmless but noisy.

### Non-Next.js consumers

For plain Vite, CRA, Remix, or static HTML — anywhere `next/font` isn't
available — the DS ships an optional `fonts.css` entry point that
`@import`s Inter and JetBrains Mono from Google Fonts:

```tsx
import '@lando-labs/lando-ds/fonts.css'
import '@lando-labs/lando-ds/styles'
```

Or from a CSS file:

```css
@import '@lando-labs/lando-ds/fonts.css';
@import '@lando-labs/lando-ds/styles';
```

**CLS trade-off.** `fonts.css` pulls from the Google Fonts CDN at
runtime, which blocks render and introduces layout shift. It exists as
a one-line convenience for prototypes and frameworks without a
first-party font helper. For production Next.js apps, always prefer
`next/font` — it's self-hosted, preloaded, and CLS-free.

### Self-hosting (advanced)

If you want Next.js-level CLS behavior outside of Next.js, download the
Inter and JetBrains Mono WOFF2 files from
[rsms.me/inter](https://rsms.me/inter/) and
[jetbrains.com/lp/mono](https://www.jetbrains.com/lp/mono/), serve them
from your own CDN, and declare `@font-face` rules that map them to the
`--font-family-base` / `--font-family-mono` variables. The DS doesn't
prescribe a file layout for this path — wire it up to match your
hosting setup.

### Buttons with icons

The `<Button>` component uses **`leftIcon`** and **`rightIcon`** props —
not `iconLeft` / `iconRight`. This is the single most common source of
TypeScript errors for new consumers. Copy-paste the snippets below to
get it right the first time.

**Icon before the label (`leftIcon`):**

```tsx
import { Button } from '@lando-labs/lando-ds'
import { Plus } from 'lucide-react'

<Button variant="primary" leftIcon={<Plus size={16} />}>
  New Task
</Button>
```

**Icon after the label (`rightIcon`):**

```tsx
import { Button } from '@lando-labs/lando-ds'
import { ArrowRight } from 'lucide-react'

<Button variant="primary" rightIcon={<ArrowRight size={16} />}>
  Continue
</Button>
```

**Ghost / outline variants with icons:**

```tsx
import { Button } from '@lando-labs/lando-ds'
import { Trash2, Download } from 'lucide-react'

<Button variant="ghost" leftIcon={<Trash2 size={16} />}>
  Delete
</Button>

<Button variant="outline" rightIcon={<Download size={16} />}>
  Export CSV
</Button>
```

**Icon-only button (accessibility):** always supply an `aria-label` when
there is no visible text.

```tsx
import { Button } from '@lando-labs/lando-ds'
import { Settings } from 'lucide-react'

<Button variant="ghost" aria-label="Settings">
  <Settings size={16} />
</Button>
```

> **Common mistake:** `iconLeft` and `iconRight` are **not** valid props.
> Use `leftIcon` and `rightIcon`.

For the full Button API and all variants, see
[`reference/components.md#button`](./reference/components.md#button).

---

## Forms with Server Actions

`<Select>` is a custom dropdown — it renders no native `<select>` element,
so the browser does not include its value in `FormData` automatically.
Pass the `name` prop and a hidden input is rendered inside the component,
giving Server Actions access via `FormData`.

### Single-select

```tsx
// app/settings/actions.ts
'use server'

export async function updateProfile(formData: FormData) {
  const language = formData.get('language') // e.g. 'en'
  // ...
}
```

```tsx
// app/settings/page.tsx
'use client'
import { Select, Button } from '@lando-labs/lando-ds'
import { useActionState } from 'react'
import { updateProfile } from './actions'

export default function SettingsPage() {
  const [state, formAction, isPending] = useActionState(updateProfile, null)
  const [language, setLanguage] = useState('en')

  return (
    <form action={formAction}>
      <Select
        label="Language"
        name="language"
        options={[
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Español' },
          { value: 'fr', label: 'Français' },
        ]}
        value={language}
        onChange={(v) => setLanguage(v as string)}
        searchable
      />
      <Button type="submit" variant="primary" loading={isPending}>
        Save
      </Button>
    </form>
  )
}
```

In the Server Action, `formData.get('language')` returns the selected
string value (`'en'`, `'es'`, etc.).

### Multi-select

Multi-select emits **one hidden input per selected value**, mirroring the
standard HTML `<select multiple>` contract. Use `FormData.getAll(name)` to
read the array:

```tsx
<Select
  label="Tags"
  name="tags"
  multiple
  options={tagOptions}
  value={selectedTags}
  onChange={(v) => setSelectedTags(v as string[])}
/>
```

```ts
// Server Action
const tags = formData.getAll('tags') // string[], e.g. ['design', 'frontend']
```

### Serialization notes

- **Single-select:** one hidden input; value is `String(value ?? '')`. When
  no option is selected the input is still present with an empty string, so
  `formData.get(name)` is never `null` when `name` is set.
- **Multi-select:** N hidden inputs (one per selected value). When nothing
  is selected, zero inputs are emitted and `formData.getAll(name)` returns
  `[]`.
- Value coercion uses `String(val)` — string, number, and boolean option
  values all round-trip correctly.

---

## For maintainers & contributors

- **Contributing** (setup, the gate, conventions): [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Releases** use [Changesets](https://github.com/changesets/changesets); publishing to npm runs from CI with provenance.

---

## Links & references

- **Component API reference:** [`reference/components.md`](./reference/components.md)
- **Theming presets** (incl. the opt-in `lando` palette): [`reference/theme-presets.md`](./reference/theme-presets.md)
- **CSS cascade layers & overrides:** [`reference/css-layers.md`](./reference/css-layers.md)
- **Design tokens:** [`reference/design-tokens-implementation.md`](./reference/design-tokens-implementation.md)
- **AI grounding:** import `@lando-labs/lando-ds/meta` (`meta.json`), or use the bundled `llms.txt`
- **License:** [Apache-2.0](./LICENSE) · **Contributing:** [`CONTRIBUTING.md`](./CONTRIBUTING.md)
