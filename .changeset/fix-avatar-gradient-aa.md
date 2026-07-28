---
"@lando-labs/lando-ds": patch
---

`Avatar` gradient-initials now clear WCAG AA (SC 1.4.3, 4.5:1) for white text at every size, in both light and dark mode, and across the brand-neutral default and the `lando` theme preset (#83).

Measured against every color stop of every gradient variant (`.gradient`, `.gradient-0`…`.gradient-6`, light + `[data-theme='dark']`), the `-light`/`-base` rungs of both `--color-primary-*` and `--color-secondary-*` fail everywhere — as low as **1.75:1** (`--color-secondary-light`, `lando` preset, light mode) — and `--color-secondary-medium` additionally fails under the `lando` preset (3.45:1). The specific pairing the issue reported, brand-neutral default dark-mode `--color-primary-base`, measured **3.23:1**. `--color-primary-base` itself cannot move: its dark value is CI-locked by the #73 fix (Button outline-label AA on an elevated surface), so this had to be solved at the Avatar layer, not the shared token.

**Three directions were weighed** (see the `#83` comment block in `Avatar.module.css`):
1. **Darken the failing stops per-slot, staying within each slot's own hue family. CHOSEN.** Only `-medium`, `-dark`, and `-darker` clear 4.5:1 against white in every mode/preset measured; every stop below the floor is swapped for the nearest safe same-family rung (with a few slots reordered or bumped an extra rung to avoid two stops colliding onto the same color). Stops that already passed — and slots that had no failing stop at all — are left untouched, so they stay exactly as vibrant as before.
2. A uniform darkening scrim composited under the initials, over the gradient paint (a single `color-mix` custom property layered as a second `background-image` on all 16 gradient rules). Initially implemented, then **rejected after a real-browser preview**: it crushed every slot toward the same near-black circle, defeating the "richly-colored, not 20 identical circles" intent from #59 — a worse regression than the one being fixed. (A plain `text-shadow` remains rejected on its own merits too: not WCAG-credited, since a shadow isn't a computable solid background.)
3. A minimum avatar size below which initials aren't shown — rejected: an API/behavior change with no justification once option 1 closes the gap without breaking any existing consumer.

Worst-case ratio after the fix is **4.5183:1** (`--color-primary-medium` under the `lando` preset) — a genuine but thin pass, safe to ship because it's now covered by a drift guard rather than a one-time measurement.

Drift-proof test `Avatar.contrast.test.ts` parses the real `Avatar.module.css` for every gradient rule's color-stop tokens, resolves them against the real `tokens.css`, and asserts white ≥ 4.5:1 against every stop directly, across both brand scenarios and both modes — so a future gradient edit that reintroduces a sub-AA stop fails loudly instead of shipping quietly.

Closes #83.
