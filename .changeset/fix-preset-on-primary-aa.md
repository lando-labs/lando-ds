---
"@lando-labs/lando-ds": patch
---

Fix WCAG AA contrast failures on Button `variant="primary"` for 4 of 6 shipped theme presets (#10).

`--color-on-primary` (the text/icon color on a `primary`-filled surface) was declared exactly once, globally, in `tokens.css` — a preset could re-skin `--color-primary` but had no way to express a matching on-color, so every preset inherited white text regardless of how light its `primary` was.

- **`ThemePreset['colors']`** (`src/tokens/themePresets.ts`) gains an optional `onPrimary?: string`, emitted as `--color-on-primary` by `presetColorVars` (`src/utils/themeScript.ts`) — the single mapping shared by both the runtime `applyTheme` and the pre-hydration `themeScript()` inline script, so both paths pick it up with no drift.
- **`midnight`, `sunset`, `forest`, `rose`** now set `onPrimary: '#000000'` (black — the same value as `--color-neutral-black`), fixing measured ratios of 4.47, 2.80, 2.54, and 3.53 (all below the 4.5:1 AA floor) to 4.70, 7.49, 8.28, and 5.95 respectively. Black text on an orange/green/pink/indigo fill is a legitimate design choice, not a compromise — it was the *inherited default (white)* that was wrong for these, not the brand color.
- **`lando`** (4.52:1) and **`slate`** (4.76:1) already cleared AA against the inherited white default and are unchanged — including `lando`'s historical `primary` hex, left untouched to avoid breaking the documented pre-v0.36.0 exact-parity claim several other places in the codebase assert. This is a deliberate trade-off: `lando`'s margin (0.02 above the floor) is real but slim; see `reference/theme-presets.md` for the full reasoning and a note on the deferred follow-up.
- **New guard test** `src/tokens/theme-preset-contrast.test.ts` loops over every `themePresets` entry (plus the brand-neutral default) and asserts `primary` vs. its resolved `onPrimary` clears WCAG AA — so a future preset that ships a light `primary` without an `onPrimary` override fails CI instead of shipping unreadable button text.

`reference/theme-presets.md` documents the new field, the measured before/after numbers for all six presets, and updated guidance for authoring new presets.
