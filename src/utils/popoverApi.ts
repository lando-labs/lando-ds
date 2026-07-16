/**
 * Popover API Capability Helpers (#273 step 2)
 *
 * The Popover API (`popover` attribute + `showPopover()`/`hidePopover()` /
 * `togglePopover()`) is Baseline since Jan 2025 in evergreen browsers, but
 * jsdom (test environment) and older browsers don't implement it. These
 * helpers gate top-layer promotion behind capability detection so component
 * code can opt in without forking implementations.
 *
 * Why we use `popover="manual"` everywhere (not "auto"):
 *
 * `popover="auto"` triggers browser-managed light-dismiss — clicks outside
 * the popover OR Escape close it via a `beforetoggle` event. Our overlay
 * components already expose controlled state (`isOpen` / `isVisible` props
 * with `useState`-backed mirrors), and the auto-mode `beforetoggle` event
 * fires AFTER the browser has already started dismissing, racing our state
 * setters. Reconciling that race correctly requires either preventing every
 * `beforetoggle` (which defeats the API) or treating it as authoritative
 * (which yanks control away from consumers). Neither is a clean migration.
 *
 * Manual mode keeps US authoritative: the controlled isOpen prop, the
 * existing useClickOutside / useKeyPress hooks, and the React render are
 * the single source of truth. The Popover API only contributes top-layer
 * promotion — i.e. the element paints above any future top-layer ancestor
 * regardless of CSS stacking contexts.
 *
 * Future work: a clean Popover-API-`auto` adoption pairs with anchor
 * positioning (#273 step 3) and probably a small controlled→uncontrolled
 * shim. Not in scope for the platform-foundation sweep.
 */

let _supportCache: boolean | null = null

/**
 * Detect Popover API support. Cached after the first call (the answer cannot
 * change in a running browser context). Returns `false` in jsdom and any
 * pre-Popover-API browser.
 */
export function supportsPopoverApi(): boolean {
  if (_supportCache !== null) return _supportCache
  if (typeof HTMLElement === 'undefined') {
    _supportCache = false
    return false
  }
  _supportCache = typeof (HTMLElement.prototype as unknown as {
    showPopover?: unknown
  }).showPopover === 'function'
  return _supportCache
}

/**
 * Reflect `isOpen` onto a Popover-API element: open by calling `showPopover()`,
 * close by calling `hidePopover()`. Idempotent — calling open on an already-
 * open popover (or close on an already-closed one) is a silent no-op, defended
 * by the matches(':popover-open') check below.
 *
 * Defensive: wraps the native calls in try/catch because both throw an
 * InvalidStateError if the element's open state has changed under us between
 * the matches check and the call (rare; concurrent dismissal e.g. Esc).
 *
 * The caller is responsible for the `supportsPopoverApi()` gate — this helper
 * doesn't double-check so callers can pull the capability check out of a hot
 * loop. Calling it without the gate in jsdom would throw.
 */
export function syncPopoverState(
  element: HTMLElement | null,
  isOpen: boolean
): void {
  if (!element) return
  // `matches(':popover-open')` is the spec-defined state query; in supported
  // browsers it returns true exactly when the popover is in the top layer.
  const popoverOpen = element.matches(':popover-open')

  if (isOpen && !popoverOpen) {
    try {
      element.showPopover()
    } catch {
      // No-op — defensive against InvalidStateError if the popover was just
      // closed by a concurrent native dismissal. React will re-sync on the
      // next render cycle.
    }
  } else if (!isOpen && popoverOpen) {
    try {
      element.hidePopover()
    } catch {
      // No-op — see above.
    }
  }
}

/** Reset the support cache. Test-only — production code should not need this. */
export function __resetPopoverApiCache(): void {
  _supportCache = null
}
