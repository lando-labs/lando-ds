'use client'

/**
 * Tooltip Component
 *
 * A lightweight tooltip with smart positioning and customizable appearance.
 * Automatically adjusts position to stay within viewport boundaries.
 *
 * ## Positioning & overflow contract
 *
 * - Rendered via `<Portal>` into `document.body`, so Tooltips **escape ancestor
 *   `overflow: hidden` / `overflow: auto` containers and transformed stacking
 *   contexts**. Tooltipping a cell inside a scrollable `Card` is not clipped.
 * - Stacks at `--z-index-tooltip` (1250), above all overlays except the toast
 *   layer. See the Z-index Layering Contract for the full scale.
 * - Uses the shared `usePortalPosition` hook for `top` / `bottom` / `auto` —
 *   same rAF-retry measurement loop, off-screen init, and capture-phase scroll
 *   listeners as Dropdown and Select, so positioning behavior is consistent.
 * - For `left` / `right`, an inline measurement loop mirrors the same pattern
 *   (rAF retry, off-screen init, capture-phase scroll) so all four directions
 *   share the same correctness guarantees.
 *
 * ## Anchoring against arbitrary elements (SVG, refs you already own)
 *
 * Pass `anchorRef` to tooltip against an element you control directly instead
 * of having `Tooltip` clone refs onto its child. This is required for SVG
 * children (`<rect>`, `<circle>`, etc.) because React's `cloneElement` can't
 * reliably forward refs to SVG nodes in all consumer shapes, and generally
 * useful when wrapping the target in a `<span>` isn't feasible.
 *
 * @example
 * // Normal usage — Tooltip wraps the child and attaches a ref itself:
 * <Tooltip content="This is a helpful tip">
 *   <button>Hover me</button>
 * </Tooltip>
 *
 * @example
 * // SVG / external anchor — consumer owns the ref, Tooltip just reads its rect:
 * const rectRef = useRef<SVGRectElement>(null)
 * return (
 *   <svg>
 *     <rect ref={rectRef} x={10} y={10} width={20} height={40} />
 *     <Tooltip content="15 events · Apr 14 — Apr 15" anchorRef={rectRef}>
 *       <></>
 *     </Tooltip>
 *   </svg>
 * )
 */

import React, { useState, useRef, useEffect, useId, cloneElement } from 'react'
import { Portal } from '../Portal'
import { usePortalPosition } from '../../hooks/usePortalPosition'
import { useAnchoredPosition } from '../../hooks/useAnchoredPosition'
import { calculatePosition, Position } from '../../utils/positioning'
import { supportsPopoverApi, syncPopoverState } from '../../utils/popoverApi'
import styles from './Tooltip.module.css'

export interface TooltipProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'content'> {
  /**
   * Tooltip content, rendered as-is in a portal.
   *
   * Trust boundary (#325): pass plain strings or DS components. If the content is
   * UNTRUSTED (AI / CMS / user-supplied), route it through `<Markdown>` (which
   * sanitizes) rather than passing raw HTML or arbitrary nodes.
   */
  content: React.ReactNode
  /** Preferred position (auto adjusts if doesn't fit) */
  position?: Position
  /** Delay in ms before showing tooltip */
  delay?: number
  /**
   * Child element to attach tooltip to. When `anchorRef` is provided this is
   * still rendered (so consumers can pass their SVG/HTML node as children and
   * reference it via the ref) but `Tooltip` does **not** attach its own ref or
   * event handlers via `cloneElement`. Pass `<></>` if you're anchoring fully
   * externally.
   */
  children: React.ReactElement
  /**
   * Optional external anchor. When provided, `Tooltip` positions against this
   * ref's element and does not clone event handlers onto `children`. The
   * consumer is responsible for wiring up show/hide triggers (e.g. via
   * `onMouseEnter` on the anchored element, and calling nothing — see the
   * `open` prop for controlled visibility in the future). This is the
   * recommended path for SVG trigger elements.
   *
   * Widened to `Element` to accept both `HTMLElement` and `SVGElement` refs.
   */
  anchorRef?: React.RefObject<Element | null>
  /** Dark variant with inverted colors */
  dark?: boolean
  /** Maximum width in pixels */
  maxWidth?: number
  /** Disable the tooltip */
  disabled?: boolean
}

type ResolvedPosition = Exclude<Position, 'auto'>

// Map a Position to the `align` option for usePortalPosition. Tooltip's
// default for top/bottom is horizontally centered on the trigger.
const centerAlign = 'center' as const

/**
 * Result shape for Tooltip's `left` / `right` placements. #331 — the horizontal
 * path now reuses the shared {@link useAnchoredPosition} lifecycle with a compute
 * that delegates to `calculatePosition`, so all four directions share one
 * off-screen-init + rAF-retry + capture-phase-scroll implementation (top/bottom
 * goes through `usePortalPosition`, itself built on the same primitive). The
 * previous bespoke `useHorizontalTooltipPosition` hook is gone.
 */
interface HorizontalPosition {
  top: number
  left: number
  placement: ResolvedPosition
  isReady: boolean
}

const OFFSCREEN_HORIZONTAL: HorizontalPosition = {
  top: -9999,
  left: -9999,
  placement: 'left',
  isReady: false,
}

/**
 * Detect whether a React child is an SVG element. SVG children can't always
 * receive refs or event handlers cleanly via `cloneElement`, so when we see
 * one without an explicit `anchorRef`, we wrap it in a `<span>` so the
 * Tooltip's measurement/event system has a stable HTML anchor.
 */
function isSvgElement(element: React.ReactElement): boolean {
  if (typeof element.type !== 'string') return false
  // SVG element tag names — the common set; extend as needed.
  const svgTags = new Set([
    'svg', 'circle', 'ellipse', 'g', 'line', 'path', 'polygon',
    'polyline', 'rect', 'text', 'tspan', 'defs', 'use', 'symbol',
    'mask', 'clipPath', 'foreignObject',
  ])
  return svgTags.has(element.type)
}

// Narrowing type for the cloned child — HTML attribute handlers plus a ref
// attribute so cloneElement can re-attach our internal trigger ref.
type TooltipChildProps = React.HTMLAttributes<HTMLElement> &
  React.RefAttributes<HTMLElement>

type TooltipChildElement = React.ReactElement<TooltipChildProps>

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  {
    content,
    position = 'top',
    delay = 300,
    children,
    anchorRef,
    dark = false,
    maxWidth = 280,
    disabled = false,
    style,
    ...rest
  },
  forwardedRef
) {
  const [isVisible, setIsVisible] = useState(false)
  // Local ref used when the consumer doesn't supply `anchorRef`. We either
  // attach it to the child via cloneElement (normal HTML case) or to an
  // automatically-inserted wrapping <span> (SVG children case).
  const internalTriggerRef = useRef<HTMLElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | undefined>(undefined)

  // Stable, collision-free id for aria-describedby (#330). Hardcoded "tooltip"
  // produced duplicate IDs whenever two Tooltips were on the same page.
  const autoId = useId()
  const tooltipId = `tooltip-${autoId}`

  // Merge the external forwarded ref with the internal tooltipRef so the
  // positioning hook keeps reading from tooltipRef while consumers still
  // receive a ref to the tooltip surface.
  const setTooltipRef = (node: HTMLDivElement | null) => {
    tooltipRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  // The ref we position against. External anchor wins; otherwise our internal.
  const activeTriggerRef: React.RefObject<Element | null> =
    anchorRef ?? internalTriggerRef

  // Vertical positioning (top / bottom / auto) delegates to the shared hook.
  // For left/right we fall back to our local rAF-retry effect below.
  const isVertical = position === 'top' || position === 'bottom' || position === 'auto'

  const verticalPosition = usePortalPosition(
    // usePortalPosition types triggerRef as HTMLElement but reads it via
    // getBoundingClientRect, which is an Element API. Safe to cast for SVG.
    activeTriggerRef as unknown as React.RefObject<HTMLElement | null>,
    isVisible && isVertical,
    {
      align: centerAlign,
      offset: 8,
      overlayRef: tooltipRef,
    }
  )

  const horizontalPosition = useAnchoredPosition<HorizontalPosition>(
    // activeTriggerRef may hold an SVGElement; useAnchoredPosition reads it via
    // getBoundingClientRect (an Element API), so the cast is safe.
    activeTriggerRef as unknown as React.RefObject<HTMLElement | null>,
    tooltipRef,
    isVisible && !isVertical,
    (triggerEl, overlayEl) => {
      const preferred = position === 'right' ? 'right' : 'left'
      // calculatePosition owns viewport clamping + flip + transform origin; we
      // take only its horizontal left/right result. If it ever flipped vertically
      // (it shouldn't for left/right input), fall back to the preferred side.
      const result = calculatePosition(triggerEl, overlayEl, preferred, 8)
      const placement: ResolvedPosition =
        result.position === 'left' || result.position === 'right'
          ? result.position
          : preferred
      return { top: result.top, left: result.left, placement }
    },
    OFFSCREEN_HORIZONTAL
  )

  // Normalize the result of either positioning path.
  const { top, left, isReady, actualPosition } = isVertical
    ? {
        top: verticalPosition.top,
        left: verticalPosition.left,
        isReady: verticalPosition.isReady,
        // `above` → arrow on bottom → CSS class `.bottom` (arrow points down)
        // `below` → arrow on top    → CSS class `.top`    (arrow points up)
        // The class name describes which side of the tooltip holds the arrow,
        // which is the opposite of the tooltip's placement relative to trigger.
        actualPosition: (verticalPosition.placement === 'above' ? 'top' : 'bottom') as ResolvedPosition,
      }
    : {
        top: horizontalPosition.top,
        left: horizontalPosition.left,
        isReady: horizontalPosition.isReady,
        actualPosition: horizontalPosition.placement,
      }

  const showTooltip = () => {
    if (disabled) return
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  // Popover API top-layer promotion (#273 step 2). Behind capability
  // detection — no-op in jsdom and pre-2024 browsers, where the existing JS
  // shim chain remains the only path. Manual mode keeps OUR controlled state
  // authoritative; the platform only contributes top-layer paint. Sync on
  // both visibility and ready so we don't promote a -9999-offscreen tooltip.
  useEffect(() => {
    if (!supportsPopoverApi()) return
    syncPopoverState(tooltipRef.current, isVisible && isReady)
  }, [isVisible, isReady])

  // When anchorRef is supplied, the consumer owns the anchored element and is
  // responsible for wiring up hover/focus triggers. We listen on the anchor
  // element directly so SVG children still get hover tooltips without the
  // consumer having to add their own handlers.
  useEffect(() => {
    if (!anchorRef) return
    const el = anchorRef.current
    if (!el) return

    const onEnter = () => showTooltip()
    const onLeave = () => hideTooltip()
    const onFocus = () => showTooltip()
    const onBlur = () => hideTooltip()

    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('focus', onFocus, true)
    el.addEventListener('blur', onBlur, true)

    return () => {
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('focus', onFocus, true)
      el.removeEventListener('blur', onBlur, true)
    }
    // anchorRef.current is a ref so it doesn't trigger re-runs, but we do want
    // to re-attach when `disabled` flips (showTooltip early-returns otherwise).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorRef, disabled])

  // Validate children before cloning
  if (!children || !React.isValidElement(children)) {
    console.warn('Tooltip: children must be a valid React element')
    return <>{children}</>
  }

  // Decide how to render the trigger:
  //  1. anchorRef supplied → render children as-is; Tooltip uses the external ref.
  //  2. Child is an SVG element → wrap in <span> so we have a stable HTML
  //     anchor for ref + event handlers. (If this is undesirable, pass anchorRef.)
  //  3. Otherwise → cloneElement the child and attach ref + event handlers.
  let trigger: React.ReactNode

  if (anchorRef) {
    // Consumer owns the anchor; just render their tree.
    trigger = children
  } else if (isSvgElement(children as React.ReactElement)) {
    // SVG children are wrapped so the tooltip can attach a ref and bubble
    // hover events. `display: contents` keeps the layout identical to the
    // unwrapped SVG element (no extra box in the flow), but the span itself
    // is still a valid event target.
    trigger = (
      <span
        ref={internalTriggerRef as React.RefObject<HTMLSpanElement>}
        style={{ display: 'contents' }}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </span>
    )
  } else {
    // Standard HTML child — clone and merge handlers/ref.
    const childEl = children as TooltipChildElement
    const originalProps = childEl.props
    trigger = cloneElement(childEl, {
      ref: internalTriggerRef,
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        showTooltip()
        const original = originalProps.onMouseEnter
        if (original) original(e)
      },
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        hideTooltip()
        const original = originalProps.onMouseLeave
        if (original) original(e)
      },
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        showTooltip()
        const original = originalProps.onFocus
        if (original) original(e)
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        hideTooltip()
        const original = originalProps.onBlur
        if (original) original(e)
      },
      'aria-describedby': isVisible ? tooltipId : undefined,
    })
  }

  const tooltipClasses = [
    styles.tooltip,
    styles[actualPosition],
    dark ? styles.dark : '',
    isVisible && isReady ? styles.visible : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {trigger}
      {isVisible && (
        <Portal>
          <div
            ref={setTooltipRef}
            // Consumer passthrough (#423) lands on the tooltip surface (the
            // visual root), not the trigger. `{...rest}` spreads BEFORE the
            // `id`/`role="tooltip"` contract so a consumer can't clobber the
            // tooltip semantics or the aria-describedby wiring.
            {...rest}
            id={tooltipId}
            role="tooltip"
            className={tooltipClasses}
            style={{
              // Consumer style first so positioning + visibility stay
              // authoritative (they are behavioral, not decorative).
              ...style,
              top: `${top}px`,
              left: `${left}px`,
              maxWidth: `${maxWidth}px`,
              // Hide until positioned to prevent flash at off-screen (-9999)
              // coords. Matches Dropdown/Select behavior.
              visibility: isReady ? 'visible' : 'hidden',
            }}
            data-placement={actualPosition}
            data-portal-content
            // Popover API opt-in (#273 step 2). Silently ignored by browsers
            // without Popover API support; the effect above only calls
            // showPopover() when supported.
            popover="manual"
          >
            {content}
            <div className={styles.arrow} />
          </div>
        </Portal>
      )}
    </>
  )
})

Tooltip.displayName = 'Tooltip'
