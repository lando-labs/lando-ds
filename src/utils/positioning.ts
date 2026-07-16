/**
 * Positioning Utilities
 *
 * Calculate optimal positioning for popovers, tooltips, and dropdowns.
 * Handles viewport boundaries and auto-positioning.
 */

export type Position = 'top' | 'bottom' | 'left' | 'right' | 'auto'

export interface PositionResult {
  top: number
  left: number
  position: Exclude<Position, 'auto'>
  transformOrigin: string
}

const VIEWPORT_PADDING = 8 // Minimum distance from viewport edge

/**
 * Calculate the optimal position for a popover element
 */
export function calculatePosition(
  triggerEl: HTMLElement,
  popoverEl: HTMLElement,
  preferredPosition: Position = 'auto',
  offset: number = 8
): PositionResult {
  const triggerRect = triggerEl.getBoundingClientRect()
  const popoverRect = popoverEl.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Calculate available space in each direction
  const spaceAbove = triggerRect.top
  const spaceBelow = viewportHeight - triggerRect.bottom
  const spaceLeft = triggerRect.left
  const spaceRight = viewportWidth - triggerRect.right

  // Determine actual position (resolve 'auto')
  let actualPosition: Exclude<Position, 'auto'> = 'bottom'

  if (preferredPosition === 'auto') {
    // Choose position with most space
    const spaces = {
      top: spaceAbove,
      bottom: spaceBelow,
      left: spaceLeft,
      right: spaceRight,
    }
    actualPosition = Object.entries(spaces).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0] as Exclude<Position, 'auto'>
  } else {
    actualPosition = preferredPosition
  }

  // Calculate coordinates based on position
  let top = 0
  let left = 0
  let transformOrigin = 'center center'

  switch (actualPosition) {
    case 'top':
      // Check if there's enough space above
      if (spaceAbove < popoverRect.height + offset + VIEWPORT_PADDING) {
        // Flip to bottom if not enough space
        actualPosition = 'bottom'
        top = triggerRect.bottom + offset
        transformOrigin = 'top center'
      } else {
        top = triggerRect.top - popoverRect.height - offset
        transformOrigin = 'bottom center'
      }
      left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2
      break

    case 'bottom':
      // Check if there's enough space below
      if (spaceBelow < popoverRect.height + offset + VIEWPORT_PADDING) {
        // Flip to top if not enough space
        actualPosition = 'top'
        top = triggerRect.top - popoverRect.height - offset
        transformOrigin = 'bottom center'
      } else {
        top = triggerRect.bottom + offset
        transformOrigin = 'top center'
      }
      left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2
      break

    case 'left':
      // Check if there's enough space on left
      if (spaceLeft < popoverRect.width + offset + VIEWPORT_PADDING) {
        // Flip to right if not enough space
        actualPosition = 'right'
        left = triggerRect.right + offset
        transformOrigin = 'left center'
      } else {
        left = triggerRect.left - popoverRect.width - offset
        transformOrigin = 'right center'
      }
      top = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2
      break

    case 'right':
      // Check if there's enough space on right
      if (spaceRight < popoverRect.width + offset + VIEWPORT_PADDING) {
        // Flip to left if not enough space
        actualPosition = 'left'
        left = triggerRect.left - popoverRect.width - offset
        transformOrigin = 'right center'
      } else {
        left = triggerRect.right + offset
        transformOrigin = 'left center'
      }
      top = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2
      break
  }

  // Constrain to viewport bounds
  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, viewportWidth - popoverRect.width - VIEWPORT_PADDING)
  )
  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, viewportHeight - popoverRect.height - VIEWPORT_PADDING)
  )

  return {
    top,
    left,
    position: actualPosition,
    transformOrigin,
  }
}

/** Horizontal alignment of a portal overlay relative to its trigger. */
export type PortalAlign = 'left' | 'right' | 'center'

/** Geometry inputs for {@link computePortalPosition}. */
export interface PortalGeometryOptions {
  /**
   * Horizontal alignment of the overlay relative to the trigger.
   * - `left` (default): overlay's left edge aligns with trigger's left edge
   * - `right`: overlay's right edge aligns with trigger's right edge
   * - `center`: overlay is horizontally centered on the trigger
   */
  align?: PortalAlign
  /** Vertical gap (px) between trigger and overlay. Defaults to 4. */
  offset?: number
}

/** Result of {@link computePortalPosition}. */
export interface PortalGeometryResult {
  /** Top (px) for a `position: fixed` overlay. */
  top: number
  /** Left (px) for a `position: fixed` overlay. */
  left: number
  /** Trigger width (px), for consumers that width-match the overlay. */
  width: number
  /** Whether the overlay was flipped above the trigger (space-below insufficient). */
  placement: 'above' | 'below'
}

/**
 * Below/above vertical-flip + horizontal-align geometry for portal overlays
 * (Dropdown/Select/TagInput). This is the pure geometry SoT for the
 * below-or-above family — {@link usePortalPosition} delegates to it via
 * {@link useAnchoredPosition}. Kept DISTINCT from {@link calculatePosition}
 * (the four-direction family used by Tooltip/Popover) on purpose: the two use
 * intentionally different flip thresholds (this one flips only when there is
 * insufficient room below AND more room above, with no viewport-padding term),
 * so they are NOT interchangeable and must not be merged.
 *
 * Reads `window.innerWidth/innerHeight`, so call it at measurement time from the
 * client (never during SSR import). Mirrors {@link calculatePosition}, which
 * also reads the viewport in its body.
 *
 * @param triggerEl The anchor element.
 * @param overlayEl The overlay element (measured for flip + horizontal clamp).
 * @param options `{ align, offset }` — see {@link PortalGeometryOptions}.
 */
export function computePortalPosition(
  triggerEl: HTMLElement,
  overlayEl: HTMLElement,
  options: PortalGeometryOptions = {}
): PortalGeometryResult {
  const { align = 'left', offset = 4 } = options
  const triggerRect = triggerEl.getBoundingClientRect()
  const overlayRect = overlayEl.getBoundingClientRect()

  const spaceBelow = window.innerHeight - triggerRect.bottom
  const spaceAbove = triggerRect.top

  // Flip above only when insufficient room below AND more room above.
  let top: number
  let placement: 'above' | 'below'
  if (spaceBelow >= overlayRect.height + offset || spaceBelow >= spaceAbove) {
    top = triggerRect.bottom + offset
    placement = 'below'
  } else {
    top = triggerRect.top - overlayRect.height - offset
    placement = 'above'
  }

  // Horizontal alignment.
  let left: number
  switch (align) {
    case 'right':
      left = triggerRect.right - overlayRect.width
      break
    case 'center':
      left = triggerRect.left + (triggerRect.width - overlayRect.width) / 2
      break
    case 'left':
    default:
      left = triggerRect.left
      break
  }

  // Clamp inside viewport horizontally (8px margin).
  const maxLeft = window.innerWidth - overlayRect.width - 8
  left = Math.max(8, Math.min(left, maxLeft))

  return { top, left, width: triggerRect.width, placement }
}

/**
 * Clamp a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}
