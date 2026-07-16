<!--
AI-Generated Documentation
Created by: design-system-specialist
Date: 2026-06-23
Purpose: CSS cascade-layers contract — published layer order, override rules, escape hatch, semver/browser promise, critical-CSS note (#267/#268)
-->

# CSS Cascade Layers

The Lando Labs Design System publishes **all** of its CSS inside named
[CSS cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer).
This is the mechanism that lets consumers override DS components **predictably,
without `!important`, and without depending on stylesheet load order.**

> **TL;DR** — Write normal (unlayered) CSS and it always beats DS component
> styles. That's the entire contract. Everything below is detail.

---

## Why layers

Before layers, every DS rule was a flat `(0,1,0)` specificity class selector,
so **bundle source order alone decided override winners**. A consumer who
wanted to recolor a `Button` had to either out-specify the DS selector, reach
for `!important`, or ensure their stylesheet loaded *after* the DS stylesheet —
all fragile. Some DS rules even depended on intra-file source order to win ties.

Cascade layers replace that with an explicit, declared precedence order. And
critically, **unlayered CSS outranks every layer**, so the consumer's own
styles win by construction.

---

## The published layer order

The DS stylesheet emits this statement **first**, before any rule, at the very
top of the bundled `design-system.css`:

```css
@layer ll.reset, ll.tokens, ll.base, ll.components, ll.utilities;
```

Declaring the order up front fixes precedence regardless of the order the
underlying rules happen to land in the bundle.

| Layer           | Priority | Contents                                                                 |
| --------------- | -------- | ------------------------------------------------------------------------ |
| `ll.reset`      | lowest   | Box-sizing + margin/padding reset; stripped browser defaults (lists, images, button chrome) |
| `ll.tokens`     | ↓        | Design-token custom properties — `:root`, `[data-theme="dark"]`, `@media` token overrides |
| `ll.base`       | ↓        | Opinionated, token-driven base element styling — `body` type, `a`, headings, `code`, `table`, selection, scrollbars, `@media print` |
| `ll.components` | ↓        | **Every `*.module.css`** — all component styles (`Button`, `Card`, `Input`, …) |
| `ll.utilities`  | highest  | DS utility classes — `.container`, `.sr-only`, `.skip-to-content`, `.visually-hidden` |

Within this group, **later layers win**. So a DS utility class beats a DS
component style, which beats DS base element styling, which beats the reset.

### The rule that matters most

```
unlayered consumer CSS  >  ll.utilities  >  ll.components  >  ll.base  >  ll.tokens  >  ll.reset
```

**Anything you author outside a layer beats all of the above.** Per the CSS
cascade, unlayered styles are treated as a higher-priority origin than any
named layer, so selector specificity and import order between *your* CSS and
the *DS* CSS stop mattering for overrides.

---

## Consuming alongside a CSS reset

The override rule cuts **both ways**. "Unlayered CSS beats every layer" is
exactly what makes your overrides win — but it also means a consumer's
**unlayered reset** beats the DS's *layered* component styles. The most common
form is the reset that `create-next-app` drops into `globals.css`:

```css
/* globals.css — UNLAYERED, so it beats ll.components */
* { margin: 0; padding: 0; box-sizing: border-box; }
```

That `*` selector is unlayered, so it outranks every DS layer and **zeroes out
the padding and margins of every DS component** — buttons collapse, cards lose
their inset, inputs go flush. Nothing is "broken" in the DS; the cascade is
doing precisely what the layer contract promises. The reset just happens to be
unlayered, and unlayered always wins.

There are two supported fixes.

### Fix A (recommended) — give your reset a layer, before the DS layers

Declare a layer order that places your reset in a layer **below** the DS layers,
and keep your real app overrides in a layer **above** them (or unlayered).
Because layer precedence is fixed by **first appearance**, this order statement
must come before the first `@layer NAME { … }` block anywhere — put it at the
very top of your global CSS, ahead of the DS stylesheet import:

```css
/* Declared FIRST — establishes precedence low → high, left → right */
@layer app-reset, ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app;

@layer app-reset {
  /* Your reset now sits BELOW the DS layers, so it no longer clobbers
     component spacing. */
  * { margin: 0; padding: 0; box-sizing: border-box; }
}

/* Then import the DS. Its own `@layer …;` statement is a no-op re-declaration
   now that the order is already fixed above. */
@import '@lando-labs/lando-ds/styles';

@layer app {
  /* Deliberate overrides that should beat DS components but stay beatable by
     your page-level unlayered CSS. */
}
```

The DS ships this exact order statement as an importable one-liner so you don't
have to hand-copy (and risk drifting from) the five DS layer names:

```css
@import '@lando-labs/lando-ds/layer-order.css'; /* the @layer …; primer */
@import '@lando-labs/lando-ds/styles';
```

```tsx
// or from JS, before the styles import
import '@lando-labs/lando-ds/layer-order.css'
import '@lando-labs/lando-ds/styles'
```

The primer contains only the order statement above — no rules — so it's inert
except for fixing precedence. After it, `app-reset` is the lowest-priority
layer, the DS layers sit in the middle, and `app` (plus anything unlayered)
wins.

### Fix B — use the flattened, unlayered DS bundle

If you'd rather not think about layer order at all, import the opt-in
**unlayered** build instead of `…/styles`. It's the same CSS with every
`@layer` wrapper stripped, so precedence falls back to ordinary specificity and
source order:

```css
@import '@lando-labs/lando-ds/styles.unlayered.css';
```

Trade-off: you lose the no-`!important` override contract (your overrides now
have to win on specificity/order like any pre-layers stylesheet), but a stray
unlayered reset no longer erases DS spacing, because the DS rules are unlayered
too. This is the pragmatic path for apps that can't control their global reset.

### A note on Tailwind

Tailwind's `@tailwind base` emits an **unlayered** Preflight reset — the same
category of unlayered `*`/element reset described above — so a default
Tailwind + default DS setup hits this exact collision. The DS uses cascade
layers **by design** (they are the AI-native, `!important`-free override
contract), and we accept being **Tailwind-incompatible out of the box** as a
deliberate trade. To coexist you must either declare the layer order (Fix A —
put Tailwind's `base` in a layer below `ll.*`, e.g.
`@layer tailwind-base, ll.reset, …`) or consume the flattened bundle (Fix B).
The DS will not drop layers to accommodate Tailwind.

---

## The basic override (no `!important`)

A plain class selector beats a DS `<Button>`, because your class is unlayered
and the DS rule lives in `ll.components`:

```tsx
import { Button } from '@lando-labs/lando-ds'
import './overrides.css'

<Button className="buy">Buy now</Button>
```

```css
/* overrides.css — NOT inside any @layer, so it wins */
.buy {
  background: rebeccapurple;
  color: white;
}
```

The override wins purely because unlayered CSS outranks `ll.components`. No
`!important`, no specificity bump, no `import`-order juggling.

### Manual proof (for a visual/preview check)

1. Render `<Button className="foo">Click</Button>`.
2. Add unlayered CSS `.foo { background: red; }`.
3. The button is red.
4. Open DevTools → Styles. The DS rule
   `@layer ll.components { .Button-module_…{ background: … } }` appears
   **struck through / lower** than your unlayered `.foo { background: red }`.

This is asserted structurally in CI by `src/test/css-layers.test.ts`, which
proves the Button rule is emitted inside `@layer ll.components` (the precise
condition the spec derives the override win from). `jsdom`'s CSSOM does not
resolve `@layer` precedence, so the runtime "is it red?" check belongs in a
real browser — hence the manual recipe above.

---

## Escape hatch — writing *into* the DS layers

Sometimes you want a rule that sits **below** your app's unlayered CSS but is
still organized relative to the DS layers — for example, a theme pack that
should be overridable by page-level styles but should beat the DS component
defaults. You can append to a DS layer by name:

```css
/* Your rule goes INTO ll.components, so it ties with DS component styles and
   is resolved by normal specificity/source-order WITHIN that layer — and is
   still beaten by your unlayered app CSS. */
@layer ll.components {
  .Button-module_button_ /* not real — illustrative */ ,
  .my-theme-button {
    border-radius: 0; /* squared buttons for this theme */
  }
}
```

More commonly you'll define your **own** layer and slot it relative to the DS
layers by extending the order statement:

```css
/* Declare your layer AFTER the DS layers so it beats them, but keep it a
   layer (not unlayered) so page-level unlayered CSS can still override it. */
@layer ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app.theme;

@layer app.theme {
  .buy { background: rebeccapurple; }
}
```

Because `app.theme` is declared after `ll.components`, it beats DS components;
because it's still a layer, your unlayered CSS beats `app.theme`. This gives
you a clean three-tier model: **DS defaults < your theme layer < your page
overrides.**

> Note: the hashed class names in `ll.components` (e.g.
> `.Button-module_button_x1y2z`) are **not** a stable API — they change between
> builds. Target your own classes/elements; reach into `ll.components` by layer
> name, not by guessing DS selectors.

---

## Stability & browser support promise

- **Semver.** The five layer names — `ll.reset`, `ll.tokens`, `ll.base`,
  `ll.components`, `ll.utilities` — and their relative order are a **public
  contract**. They will not be renamed or reordered outside a **major** version
  bump. Adding a *new* layer (always slotted so existing precedence is
  preserved) is a minor change. The CI guard `src/test/css-layers.test.ts`
  fails the build if the published order ever drifts from this document.
- **Browser floor.** Cascade layers are
  [Baseline 2022](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) —
  supported in all current evergreen browsers (Chrome/Edge 99+, Firefox 97+,
  Safari 15.4+). **Pre-2022 browsers do not understand `@layer` and will drop
  every layered rule**, meaning they get unstyled DS components. The DS targets
  modern, Baseline-2022 browsers; if you must support older engines, you would
  need a build-time tool (e.g. PostCSS) that flattens `@layer` back to
  specificity hacks — the DS does not do this for you.

---

## Critical-CSS note

If you extract and inline **critical CSS** (above-the-fold styles in a
`<style>` tag in the document `<head>`), you **must** emit the layer order
statement *first* in that inlined block:

```css
@layer ll.reset, ll.tokens, ll.base, ll.components, ll.utilities;
/* …your inlined critical rules, including any layered DS rules… */
```

Why: layer precedence is established by **first appearance**. A layer named in
a `@layer name { … }` block before any order statement takes its priority from
that first encounter. If your critical-CSS extractor pulls a few
`@layer ll.components { … }` blocks into the head **without** the order
statement, those layers get an ad-hoc order that may not match the full
stylesheet loaded later — producing a flash of mis-prioritized styles. Always
ship the one-line order statement at the very top of any inlined DS CSS. (The
full `design-system.css` already does this; the caveat is only for hand-rolled
critical-CSS pipelines.)

---

## Related

- [README — Customizing & overriding styles](../README.md#customizing--overriding-styles)
- [reference/design-tokens-implementation.md](./design-tokens-implementation.md) — the token layer (`ll.tokens`) in depth
- `src/styles/index.css` — the order statement (source of truth)
- `src/styles/tokens.css` / `src/styles/global.css` — hand-authored base-layer mapping
- `vite.config.ts` — the `wrapModulesInComponentLayer` PostCSS plugin that wraps every `*.module.css` in `ll.components`
- `src/test/css-layers.test.ts` — the anti-drift CI guard
