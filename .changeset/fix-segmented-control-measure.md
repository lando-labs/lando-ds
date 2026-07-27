---
'@lando-labs/lando-ds': patch
---

**SegmentedControl:** fix the sliding selection indicator being mis-sized and mis-positioned on first paint until an interaction forced a re-measure (#91).

The indicator geometry was measured once in a plain `useEffect` on mount, with no `ResizeObserver`. If the active option's final width wasn't yet in effect when that effect ran — late-applied CSS, a web-font swap, or a container resize — the indicator cached stale geometry and never corrected itself until a click (or any other re-render) happened to re-run the effect. On a control that reflects a default selection the user never touches, it could stay visibly wrong for the whole session.

Measurement now runs in an SSR-safe `useLayoutEffect` (pre-paint, so no one-frame flash of the wrong geometry) and a `ResizeObserver` on both the container and the active option re-derives the geometry whenever layout settles later, with an additional `document.fonts.ready` re-measure to catch font-swap reflow.
