---
"@lando-labs/lando-ds": patch
---

Fix WCAG SC 1.4.11 (non-text contrast) failures in the light theme, the light-mode counterpart to Sprint 1's dark-only fixes.

- **`Button variant="outline"`** resting border now clears ≥3:1 in light mode (was 1.53:1 vs `--color-surface`, 1.39:1 vs `--color-neutral-50`) — measured 3.61:1 / 3.45:1. Dark theme (#9) unchanged. (#71)
- **`Switch`** off-state track now clears ≥3:1 in light mode (was 1.53:1 vs `--color-surface`) — measured 3.61:1, with the white thumb now distinguishable from the track by color, not just its box-shadow. `Switch`'s light-mode hover step was also re-tuned (mixing further toward black from the new resting color) so hover stays visually more prominent than resting, matching the pre-existing dark-mode convention. Dark theme (#12) and the on/checked state are unchanged. (#72)

Both share a root cause: `--color-border-emphasis` (`src/styles/tokens.css`) identity-aliased `--color-border-strong` in light mode, and the comment on that alias claimed the un-fixed rung already cleared AA at "9.53:1" — a transposed mis-measurement (the real value is ~1.91:1). `--color-border-emphasis` now carries a light-tuned `oklch(0.62 0.0184 229.07)` value (same hue/chroma as `--color-border-strong`, darkened to clear 3:1 against `--color-surface`, `--color-neutral-50`, and `--color-surface-elevated`), and both components' light-mode rules now read that token instead of `--color-border-default` directly — mirroring how the dark-mode fixes already worked. `--color-border-default` itself is untouched, so the many other components reading that rung are unaffected.
