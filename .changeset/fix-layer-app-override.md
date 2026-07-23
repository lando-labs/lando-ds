---
'@lando-labs/lando-ds': minor
---

Fix the documented `@layer app` override contract so it reliably beats DS component styles.

`reference/css-layers.md` promises that a consumer's `@layer app { … }` rule (declared above the DS's `ll.*` layers) overrides DS component styles with no `!important`. In practice, `app`'s position was only guaranteed when a consumer separately imported the opt-in `@lando-labs/lando-ds/layer-order.css` primer — the main `@lando-labs/lando-ds/styles` entry's own `@layer …;` order statement never named `app` at all, so its position depended silently on CSS load order between the consumer's own `@layer app { … }` rule and the DS stylesheet. A consumer who skipped the primer got no error, just an override that mysteriously didn't apply.

`@lando-labs/lando-ds/styles`'s order statement now declares the full, public seven-layer order itself — `app-reset, ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app` — so `@layer app { … }` reliably outranks `ll.components` as soon as a consumer imports the DS stylesheet, with no separate primer import required. `app-reset`/`app` are consumer-owned opt-in slots (the DS never puts rules in them); their *position* is now part of the same public layer-order contract as the five `ll.*` names. This is a **minor** change (not patch) because it changes the published layer output in a way that could affect a consumer's cascade if they happened to already be using `app`/`app-reset` as their own, unrelated layer names.

The separate `layer-order.css` primer still exists (for consumers who need `app`'s position fixed before the DS stylesheet itself loads, e.g. hand-rolled critical CSS) — importing both is a harmless no-op, since re-declaring an already-positioned layer never moves it.

`reference/css-layers.md` gains a "Load-order caveat" section that states the contract's real, honest limit: `@layer app` wins whenever the DS stylesheet is the first CSS with an `@layer` construct the browser parses (true by default for a normal import chain, and now true without the primer too) — but no CSS-only mechanism can force that against a bundler that reorders CSS chunks. For that residual case, the doc now points at the two load-order-proof paths that already existed: unlayered CSS, or the flattened `styles.unlayered.css` bundle.

Adds real-browser proof that was previously missing: `tests/e2e/layer-override.spec.ts` (via the `examples/next-app-router` fixture at `/e2e/layer-override`) asserts, with Playwright against a real Chromium, that both a `@layer app` override and an unlayered override actually beat a DS `<Button>` rule — not just that the built CSS is shaped correctly, which is all the existing jsdom structural test (`src/test/css-layers.test.ts`, itself updated for the new seven-layer statement) can prove. Wired into the existing `e2e-overlays` CI job, which now runs every spec under `tests/e2e/`.

Refs: #13
