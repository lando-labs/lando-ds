---
"@lando-labs/lando-ds": minor
---

Fix consumer-reported visible defects (v0.58.0).

- **Overlays inside a Modal are now interactive.** `Select`, `Combobox`, `MultiSelect`, `Dropdown`, and `Popover` opened inside a `Modal` previously rendered behind the dialog (or, once promoted to the top layer, painted above it but could not be hovered or clicked — `showModal()` marks everything outside the `<dialog>` subtree inert). They now render into a container within the open Modal's dialog, so they are fully usable inside modals, with no consumer-side changes. Standalone (non-modal) usage is unchanged. (#14)
- **`Select` Escape** now only closes the listbox when it is open, so pressing Escape no longer traps a parent `Modal` open. (#14)
- **`Button variant="outline"`** now meets WCAG AA contrast in the dark theme (border ≥ 3:1, label ≥ 4.5:1); light theme unchanged. (#9)
- **`Switch`** off-state track is now visible in dark mode (≥ 3:1 non-text contrast) instead of blending into the surface. (#12)
- **`Dropdown` and click-triggered `Popover`** now close when you click their trigger again, instead of briefly closing and re-opening (a click-outside / trigger-click double-fire). `useClickOutside` gained an optional `ignoreRefs` parameter to support this.

Adds a real-browser (Playwright) end-to-end suite covering overlay interaction inside modals, wired into CI on pull requests.
