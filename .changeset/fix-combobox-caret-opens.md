---
'@lando-labs/lando-ds': patch
---

**Combobox:** clicking the caret/chevron now opens the listbox (#74).

The chevron was a decorative `<span>` with no click handler, and it's a flex sibling of the input rather than an overlay over it — so clicking the caret (or the inner `<svg>`) did nothing, and you had to click the input text to open. `Select` opens from its caret because its trigger is a single `<button>`; `Combobox` now matches that affordance. The chevron carries an `onMouseDown` toggle that opens/closes the listbox and keeps focus on the input (and fires even when the click lands on the inner `<svg>`, since the event bubbles to the span). Keyboard/AT users are unaffected — the chevron stays `aria-hidden` and non-focusable; they open via the input's own focus/keyboard handling.
