'use client'

/**
 * usePortalPosition Hook
 *
 * Shared positioning logic for portal-rendered overlays (Dropdown, Select, TagInput, etc).
 * Handles the common pain points when positioning a portaled element relative to a trigger:
 *
 * - **No flash-at-(0,0)**: Returns off-screen coordinates (-9999) until the element has
 *   been measured. Consumers should apply `visibility: hidden` (or respect `isReady`)
 *   while `isReady === false`.
 * - **Reliable mount measurement**: Uses `useLayoutEffect` + a `requestAnimationFrame`
 *   retry loop so positioning is calculated synchronously before paint, even when the
 *   Portal has not yet attached the element to the DOM on the first tick.
 * - **Viewport-aware flipping**: Places the overlay below the trigger when there is
 *   sufficient room; otherwise flips above. Reports `placement` so consumers can adjust
 *   their animation origin.
 * - **Responsive**: Recalculates on scroll (capture phase, to catch ancestor scrolls)
 *   and resize while the overlay is open.
 *
 * #331 — this hook is now a thin wrapper: the measurement lifecycle lives in the shared
 * {@link useAnchoredPosition} primitive and the below/above geometry lives in
 * {@link computePortalPosition} (the geometry SoT in `utils/positioning`). Its public
 * API (signature, options, return shape, behavior) is unchanged.
 *
 * @category layout
 *
 * @example
 * const triggerRef = useRef<HTMLDivElement>(null)
 * const [isOpen, setIsOpen] = useState(false)
 * const overlayRef = useRef<HTMLDivElement>(null)
 * const position = usePortalPosition(triggerRef, isOpen, {
 *   align: 'left',
 *   offset: 4,
 *   overlayRef,
 * })
 *
 * return (
 *   <>
 *     <div ref={triggerRef}>{trigger}</div>
 *     {isOpen && (
 *       <Portal>
 *         <div
 *           ref={overlayRef}
 *           style={{
 *             position: 'fixed',
 *             top: position.top,
 *             left: position.left,
 *             visibility: position.isReady ? 'visible' : 'hidden',
 *           }}
 *         >
 *           {children}
 *         </div>
 *       </Portal>
 *     )}
 *   </>
 * )
 */

import { useAnchoredPosition } from './useAnchoredPosition'
import { computePortalPosition } from '../utils/positioning'

export interface UsePortalPositionOptions {
  /**
   * Horizontal alignment of the overlay relative to the trigger.
   * - `left` (default): overlay's left edge aligns with trigger's left edge
   * - `right`: overlay's right edge aligns with trigger's right edge
   * - `center`: overlay is horizontally centered on the trigger
   */
  align?: 'left' | 'right' | 'center'
  /** Vertical gap (in px) between trigger and overlay. Defaults to 4. */
  offset?: number
  /**
   * Ref to the overlay element itself. Required for measuring the overlay's dimensions
   * so we can compute accurate flip / horizontal-clamp behavior.
   */
  overlayRef: React.RefObject<HTMLElement | null>
  /**
   * When true, the overlay width should be forced to match the trigger width.
   * Consumers apply this themselves using the returned `width` (Select, Combobox,
   * MultiSelect, TagInput). Accepted here for call-site ergonomics; it does not
   * affect the computed coordinates. Defaults to false.
   */
  matchTriggerWidth?: boolean
}

export interface PortalPosition {
  /** Top (px) for `position: fixed` overlay */
  top: number
  /** Left (px) for `position: fixed` overlay */
  left: number
  /** Trigger width (px), for consumers that want width-matching */
  width: number
  /** Whether overlay was flipped above the trigger (space-below insufficient) */
  placement: 'above' | 'below'
  /**
   * False until the first measurement completes. Consumers should hide the overlay
   * (e.g. `visibility: hidden`) while false to prevent a flash at the initial
   * off-screen coordinates.
   */
  isReady: boolean
}

const OFFSCREEN_POSITION: PortalPosition = {
  top: -9999,
  left: -9999,
  width: 0,
  placement: 'below',
  isReady: false,
}

/**
 * Measure a trigger and overlay, and compute viewport-aware fixed-position coordinates.
 * Returns off-screen coords with `isReady: false` until both refs are mounted.
 */
export function usePortalPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  options: UsePortalPositionOptions
): PortalPosition {
  // `align`/`offset` are read here and passed to the geometry SoT. They are
  // captured fresh on every render by useAnchoredPosition (which stores the
  // compute callback in a ref), so a live align/offset change is honored without
  // re-subscribing the scroll/resize listeners. `overlayRef` selects the overlay;
  // `matchTriggerWidth` is consumer-applied (see its doc) and not used here.
  const { align = 'left', offset = 4, overlayRef } = options
  return useAnchoredPosition<PortalPosition>(
    triggerRef,
    overlayRef,
    isOpen,
    (triggerEl, overlayEl) => computePortalPosition(triggerEl, overlayEl, { align, offset }),
    OFFSCREEN_POSITION
  )
}
