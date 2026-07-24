<!--
AI-Generated Documentation
Created by: design-system-specialist
Date: 2026-06-23
Purpose: CSS cascade-layers contract — published layer order, override rules, escape hatch, semver/browser promise, critical-CSS note (#267/#268); `app`/`app-reset` load-order robustness + honest limits (#13)
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
@layer app-reset, ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app;
```

Declaring the order up front fixes precedence regardless of the order the
underlying rules happen to land in the bundle. Two of these seven names —
`app-reset` and `app` — are **consumer-opt-in**: the DS itself never puts
rules in them. They exist purely to reserve a fixed, correct slot in the
precedence order (below and above the five DS layers, respectively) for
whatever the consumer chooses to put there. If you never write
`@layer app-reset { … }` or `@layer app { … }`, they're empty and invisible.

| Layer           | Priority | Contents                                                                 |
| --------------- | -------- | ------------------------------------------------------------------------ |
| `app-reset`     | lowest   | **Consumer-owned, opt-in.** A consumer reset that must not clobber DS component spacing — see "Consuming alongside a CSS reset" below |
| `ll.reset`      | ↓        | Box-sizing + margin/padding reset; stripped browser defaults (lists, images, button chrome) |
| `ll.tokens`     | ↓        | Design-token custom properties — `:root`, `[data-theme="dark"]`, `@media` token overrides |
| `ll.base`       | ↓        | Opinionated, token-driven base element styling — `body` type, `a`, headings, `code`, `table`, selection, scrollbars, `@media print` |
| `ll.components` | ↓        | **Every `*.module.css`** — all component styles (`Button`, `Card`, `Input`, …) |
| `ll.utilities`  | ↓        | DS utility classes — `.container`, `.sr-only`, `.skip-to-content`, `.visually-hidden` |
| `app`           | highest  | **Consumer-owned, opt-in.** Deliberate overrides that must beat every DS layer but stay beatable by the consumer's own unlayered CSS — see "Escape hatch" below |

Within this group, **later layers win**. So the consumer's `app` layer beats
a DS utility class, which beats a DS component style, which beats DS base
element styling, which beats the reset, which beats the consumer's
`app-reset`.

### The rule that matters most

```
unlayered consumer CSS  >  app  >  ll.utilities  >  ll.components  >  ll.base  >  ll.tokens  >  ll.reset  >  app-reset
```

**Anything you author outside a layer beats all of the above.** Per the CSS
cascade, unlayered styles are treated as a higher-priority origin than any
named layer, so selector specificity and import order between *your* CSS and
the *DS* CSS stop mattering for overrides.

`app`/`app-reset` are just as reliable as the five `ll.*` layers **as long as
the DS stylesheet is the first CSS containing an `@layer` construct that the
browser parses** — see "Load-order caveat" below for the one scenario where
that isn't automatically true.

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

### Fix A (recommended) — put your reset in the `app-reset` layer

`@lando-labs/lando-ds/styles` declares `app-reset` (lowest priority) and
`app` (highest DS-adjacent priority) itself — see "The published layer order"
above — so you don't need a separate order statement for the basic case. Just
import the DS stylesheet, then bucket your reset and your overrides into the
layers it already reserved for you:

```css
@import '@lando-labs/lando-ds/styles';

@layer app-reset {
  /* Your reset now sits BELOW the DS layers, so it no longer clobbers
     component spacing. */
  * { margin: 0; padding: 0; box-sizing: border-box; }
}

@layer app {
  /* Deliberate overrides that should beat DS components but stay beatable by
     your page-level unlayered CSS. */
}
```

```tsx
// or from JS
import '@lando-labs/lando-ds/styles'
import './globals.css' // contains the @layer app-reset / @layer app blocks above
```

This works because `app-reset` and `app` are already-known layer names by the
time your blocks run — declaring rules for an already-positioned layer never
moves it, per the cascade-layers spec. See "Load-order caveat" below for the
one condition this depends on (the DS stylesheet must be the first CSS with
an `@layer` construct that the browser parses) and what to do if your bundler
can't guarantee that.

**Optional, stricter guarantee — the standalone primer.** If you want
`app-reset`/`app`'s position fixed even *before* the DS stylesheet itself has
loaded (e.g. you're hand-assembling critical CSS, or your bundler's chunk
order is genuinely unpredictable), import the primer first instead:

```css
@import '@lando-labs/lando-ds/layer-order.css'; /* the @layer …; primer */
@import '@lando-labs/lando-ds/styles';
```

```tsx
// or from JS, before the styles import
import '@lando-labs/lando-ds/layer-order.css'
import '@lando-labs/lando-ds/styles'
```

The primer contains only the order statement — no rules — so it's inert
except for fixing precedence as early as possible. Importing it is never
wrong, even now that it's redundant with the main stylesheet's own statement:
re-declaring an already-positioned layer is a documented no-op.

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

**Automated real-browser proof (#13).** The structural check above proves the
*shape* of the CSS but cannot prove the *cascade actually resolves* the way
the shape implies — `jsdom` doesn't implement `@layer` precedence at all, and
a real consumer's bundler can chunk/order CSS differently than the library's
own build does. `tests/e2e/layer-override.spec.ts` closes that gap: it drives
a real Chromium browser against the built package (via the `examples/next-app-router`
fixture at `/e2e/layer-override`, consumed through the same `file:`-symlinked
`dist/` as every other e2e fixture) and asserts `getComputedStyle` for both a
`@layer app` override and an unlayered override, proving both actually beat
the DS component rule — not just that the CSS is shaped correctly. Run it with
`npm run test:e2e` (see `tests/e2e/playwright.config.ts` for the one-time
setup).

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

## Load-order caveat (#13)

CSS cascade-layer order is fixed by **first appearance** — the first time the
browser encounters a `@layer` statement or block naming a given layer,
anywhere across every stylesheet on the page, that layer's relative position
is locked in for the rest of the document. Everything in this doc follows
from that rule, and it's also the one way the `app`/`app-reset` contract can
fail silently:

**If a consumer's own `@layer app { … }` block is physically encountered by
the browser *before* the DS stylesheet's order statement, `app` gets fixed
at whatever position it's first seen in — which, for a plain `@layer app {}`
with no preceding order statement, is the very bottom (lowest priority),
because nothing else has been positioned yet.** When the DS stylesheet's own
statement runs afterward, `ll.reset` … `ll.utilities` (all new names at that
point) get appended *after* `app`, and the override that was supposed to beat
DS components now loses to them instead — with no error, no warning, just an
override that mysteriously doesn't apply.

For a normal `<link>`/`@import` chain where the DS stylesheet is imported
before the consumer's own CSS, this can't happen — the DS statement is
processed first, so `app` is new when the DS statement runs and gets
appended *after* `ll.utilities`, exactly as intended (this is what "The
published layer order" above and the e2e proof in `tests/e2e/layer-override.spec.ts`
verify). The residual risk is entirely at the **bundler** layer: some
bundlers' CSS chunking/code-splitting can concatenate or `<link>` stylesheets
in an order that doesn't match your source import order — most plausibly when
a component-level stylesheet is promoted into a shared/vendor chunk that
loads before route-specific CSS. The DS cannot detect or prevent that from
inside a published `.css` file; there is no CSS-only mechanism that forces
"my stylesheet loads first" against an uncooperative bundler.

**What to do if you suspect this:**

1. **Make the DS stylesheet load as early as possible** — import it (or the
   `layer-order.css` primer, which is even lighter) at the very top of your
   root/global CSS entry, before any of your own `@layer`-using CSS.
2. **Verify it, don't assume it** — open DevTools → Elements → check the
   `<head>` for the order your stylesheets actually landed in, or use the
   manual proof recipe above against your real app (not just this repo's
   example).
3. **If your bundler genuinely can't guarantee load order** (some
   code-splitting configurations can't), the `app`/`app-reset` layers are not
   a reliable override path for you. Fall back to **unlayered CSS**, which
   wins regardless of load order because unlayered is a higher-priority
   *origin* than any layer, full stop — or consume
   `@lando-labs/lando-ds/styles.unlayered.css` (Fix B above) so nothing on
   the DS side is layered either. Both of those are load-order-proof by
   construction, unlike named-layer overrides.

This is the honest limit of the contract: **unlayered CSS always wins, no
exceptions. `@layer app` wins whenever the DS stylesheet is the first CSS
with an `@layer` construct the browser parses — true by default for a normal
import chain, but not something a stylesheet can force against a bundler that
reorders chunks.**

---

## Stability & browser support promise

- **Semver.** The seven layer names — `app-reset`, `ll.reset`, `ll.tokens`,
  `ll.base`, `ll.components`, `ll.utilities`, `app` — and their relative order
  are a **public contract**. They will not be renamed or reordered outside a
  **major** version bump. `app-reset` and `app` are consumer-owned (the DS
  never puts rules in them) but their *position* in the order statement is
  part of the same contract. Adding a *new* DS-owned layer (always slotted so
  existing precedence is preserved) is a minor change. The CI guard
  `src/test/css-layers.test.ts` fails the build if the published order ever
  drifts from this document, and `tests/e2e/layer-override.spec.ts` fails CI
  if a real browser ever resolves the cascade differently than this document
  promises.
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
@layer app-reset, ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app;
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
- `src/styles/layer-order.css` — the standalone primer (redundant with, but harmless alongside, the main stylesheet's own statement)
- `vite.config.ts` — the `wrapModulesInComponentLayer` PostCSS plugin that wraps every `*.module.css` in `ll.components`
- `src/test/css-layers.test.ts` — the structural anti-drift CI guard (jsdom; shape of the CSS)
- `tests/e2e/layer-override.spec.ts` — the real-browser CI guard (Playwright; the cascade actually resolves as promised)
