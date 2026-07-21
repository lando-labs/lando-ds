'use client'

/**
 * Popover Component
 *
 * A flexible popover that displays rich content on hover or click.
 * Features smart positioning, arrow pointer, and portal rendering.
 *
 * ## Positioning contract
 *
 * Popover honors the consumer's `placement` prop (top / bottom / left / right)
 * with viewport-aware flip-to-opposite fallback, using the shared
 * `calculatePosition` utility. The measurement timing mirrors the shared
 * `usePortalPosition` hook used by Dropdown / Select / Tooltip — a
 * `useLayoutEffect` + `requestAnimationFrame` retry loop that keeps trying
 * until both trigger and overlay refs are attached to the DOM.
 *
 * - **No flash at (0, 0)**: overlay starts at off-screen coords with
 *   `visibility: hidden` until the first successful measurement.
 * - **Mount-robust measurement**: up to 10 rAF attempts handle the case where
 *   the Portal has not yet attached to the DOM on the first tick — including
 *   when Popover is nested inside another portalled parent (e.g. Modal).
 *   Historical bug (#37) — the bespoke single-rAF implementation this
 *   replaces would get stuck at `isPositioned = false` and leave the overlay
 *   invisible forever.
 * - **Capture-phase scroll tracking**: reposition fires on ancestor scrolls
 *   (e.g. overflow scrolling inside a Card or Modal body).
 *
 * ## Stacking
 *
 * Renders at `--z-index-popover: 1200`, above `--z-index-modal: 1000` so a
 * Popover opened inside a Modal paints above the Modal backdrop. See the
 * "Nested Overlay Contract" in `reference/components.md`.
 *
 * @example
 * <Popover
 *   content={<div>Popover content here</div>}
 *   placement="top"
 *   triggerOn="hover"
 *   trigger={<button>Hover me</button>}
 * />
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  cloneElement,
} from 'react'
import { Portal } from '../Portal'
import { useModalPortalContainer } from '../Modal/ModalPortalContext'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useKeyPress } from '../../hooks/useKeyPress'
import { useAnchoredPosition } from '../../hooks/useAnchoredPosition'
import { calculatePosition } from '../../utils/positioning'
import { supportsPopoverApi, syncPopoverState } from '../../utils/popoverApi'
import styles from './Popover.module.css'

export interface PopoverProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'content'> {
  /** Element that triggers the popover */
  trigger: React.ReactNode
  /** Popover content */
  content: React.ReactNode
  /** Preferred placement */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Trigger mode */
  triggerOn?: 'hover' | 'click'
  /** Distance from trigger in pixels */
  offset?: number
  /** Show arrow pointer */
  showArrow?: boolean
  /** Additional CSS class */
  className?: string
  /**
   * Controlled-open state (#329). When provided, Popover becomes a
   * controlled component — `open` drives visibility and the consumer
   * is responsible for flipping it via `onOpenChange`. Pair with
   * `onOpenChange` so internal triggers (click/hover/Escape) can
   * report state back.
   */
  open?: boolean
  /**
   * Initial open state for uncontrolled mode (#329). Ignored when
   * `open` is set.
   *
   * @default false
   */
  defaultOpen?: boolean
  /**
   * Open/close callback (#329). Fires for both controlled and
   * uncontrolled mode whenever the popover would change visibility
   * (trigger click, hover enter/leave, Escape, outside click).
   */
  onOpenChange?: (open: boolean) => void
}

type ResolvedPlacement = 'top' | 'bottom' | 'left' | 'right'

interface PopoverPosition {
  top: number
  left: number
  placement: ResolvedPlacement
  isReady: boolean
}

const OFFSCREEN: PopoverPosition = {
  top: -9999,
  left: -9999,
  placement: 'top',
  isReady: false,
}

/**
 * Four-direction popover positioning. #331 — now a thin wrapper over the shared
 * {@link useAnchoredPosition} lifecycle (off-screen init + rAF-retry mount
 * measurement + capture-phase scroll/resize), delegating geometry to
 * `calculatePosition`. The previous bespoke measurement loop is gone; behavior
 * is unchanged.
 */
function usePopoverPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  overlayRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  preferred: ResolvedPlacement,
  offset: number
): PopoverPosition {
  return useAnchoredPosition<PopoverPosition>(
    triggerRef,
    overlayRef,
    isOpen,
    (triggerEl, overlayEl) => {
      const result = calculatePosition(triggerEl, overlayEl, preferred, offset)
      return { top: result.top, left: result.left, placement: result.position }
    },
    OFFSCREEN
  )
}

// Narrowing type for the cloned trigger — HTML attribute handlers plus a
// ref attribute so cloneElement can re-attach our internal positioning ref.
type PopoverTriggerProps = React.HTMLAttributes<HTMLElement> &
  React.RefAttributes<HTMLElement>

type PopoverTriggerElement = React.ReactElement<PopoverTriggerProps>

export const Popover = React.forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  {
    trigger,
    content,
    placement = 'top',
    triggerOn = 'hover',
    offset = 8,
    showArrow = true,
    className = '',
    open: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    style,
    ...rest
  },
  forwardedRef
) {
  // Controlled-mode bridge (#329). If `open` prop is provided, treat it as
  // the source of truth and ignore internal state. Otherwise track our own.
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isVisible = isControlled ? controlledOpen : uncontrolledOpen

  // Wrapper that updates uncontrolled state (if any) and always fires
  // onOpenChange so consumers in either mode see transitions.
  const setIsVisible = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next)
      }
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )

  const triggerRef = useRef<HTMLElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | undefined>(undefined)

  // Stable, collision-free id for aria-describedby (#330). Hardcoded
  // "popover-content" produced duplicate IDs whenever two Popovers were on
  // the same page.
  const autoId = useId()
  const popoverId = `popover-content-${autoId}`

  // Merge the external forwarded ref with the internal popoverRef so consumers
  // can ref the visible popover surface (matching the typed HTMLDivElement
  // contract). The internal positioning hook continues to read via popoverRef.
  const setPopoverRef = (node: HTMLDivElement | null) => {
    popoverRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  const { top, left, placement: actualPlacement, isReady } = usePopoverPosition(
    triggerRef,
    popoverRef,
    isVisible,
    placement,
    offset
  )

  // Close on outside click (for click mode)
  useClickOutside(
    popoverRef,
    () => {
      if (triggerOn === 'click') {
        setIsVisible(false)
      }
    },
    isVisible && triggerOn === 'click'
  )

  // Close on Escape key.
  // Previously only wired for `triggerOn="click"`. Keyboard users with
  // focus-triggered hover popovers had no dismissal path, which is a WCAG
  // 2.1.1 failure. Always honor Escape when the popover is visible.
  useKeyPress(
    'Escape',
    () => {
      setIsVisible(false)
    },
    isVisible
  )

  // Nearest enclosing OPEN Modal's in-dialog portal container (#14
  // follow-up — see the long comment at the top of Modal.tsx). Non-null
  // means: render the popover as a descendant of that Modal's <dialog>
  // instead of document.body — that's what actually makes it interactive,
  // not just visible (a document.body-portaled popover is inert-by-ancestry
  // once the Modal goes showModal(), regardless of top-layer paint order —
  // verified live in Chromium).
  const modalPortalContainer = useModalPortalContainer()

  // Popover API top-layer promotion (#273 step 2) — STANDALONE path only.
  // Behind capability detection — no-op in jsdom and pre-2024 browsers,
  // where the existing JS shim chain remains the only path. Manual mode (not
  // auto) keeps OUR controlled state authoritative; the platform only
  // contributes the top-layer paint. Skipped entirely when nested in an
  // open Modal (`modalPortalContainer` non-null): the popover is already a
  // dialog descendant there, exempt from inertness by DOM ancestry — see the
  // JSX below for why the `popover` attribute itself is also omitted then.
  useEffect(() => {
    if (modalPortalContainer) return
    if (!supportsPopoverApi()) return
    syncPopoverState(popoverRef.current, isVisible && isReady)
  }, [isVisible, isReady, modalPortalContainer])

  const showPopover = () => {
    if (triggerOn === 'hover') {
      timeoutRef.current = window.setTimeout(() => {
        setIsVisible(true)
      }, 300)
    } else {
      setIsVisible(!isVisible)
    }
  }

  const hidePopover = () => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current)
    }
    if (triggerOn === 'hover') {
      setIsVisible(false)
    }
  }

  // Hover popovers keep the content visible while the pointer is over the
  // popover itself (so users can select text, click links inside, etc.).
  // We also cancel any pending hide on mouse-enter and re-arm the hide on
  // mouse-leave of the content.
  const handleContentMouseEnter = () => {
    if (triggerOn !== 'hover') return
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current)
    }
  }

  const handleContentMouseLeave = () => {
    if (triggerOn !== 'hover') return
    setIsVisible(false)
  }

  // Keyboard-equivalent show/hide for hover mode. Without onFocus/onBlur the
  // hover trigger is unreachable for keyboard and screen-reader users —
  // WCAG 2.1.1 (Keyboard). Show immediately on focus (no 300ms delay, to
  // avoid perceived lag when tabbing through) and hide on blur.
  const handleKeyboardFocus = () => {
    if (triggerOn !== 'hover') return
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(true)
  }

  const handleKeyboardBlur = () => {
    if (triggerOn !== 'hover') return
    setIsVisible(false)
  }

  // Clone trigger and add event handlers
  let triggerElement: React.ReactNode = trigger
  if (React.isValidElement(trigger)) {
    const triggerEl = trigger as PopoverTriggerElement
    const originalProps = triggerEl.props
    // `ref` is typed as a property on ReactElement separately; cloneElement
    // accepts it in its second argument and react re-attaches it for us.
    const hoverHandlers = {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        showPopover()
        const original = originalProps.onMouseEnter
        if (original) original(e)
      },
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        hidePopover()
        const original = originalProps.onMouseLeave
        if (original) original(e)
      },
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        handleKeyboardFocus()
        const original = originalProps.onFocus
        if (original) original(e)
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        handleKeyboardBlur()
        const original = originalProps.onBlur
        if (original) original(e)
      },
    }
    const clickHandlers = {
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault()
        showPopover()
        const original = originalProps.onClick
        if (original) original(e)
      },
    }
    triggerElement = cloneElement(triggerEl, {
      ref: triggerRef,
      ...(triggerOn === 'hover' ? hoverHandlers : clickHandlers),
      'aria-describedby': isVisible ? popoverId : undefined,
    })
  }

  const popoverClasses = [
    styles.popover,
    styles[actualPlacement],
    isVisible && isReady ? styles.visible : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {triggerElement}
      {isVisible && (
        // `container={modalPortalContainer}` — `null` falls through to
        // Portal's own `container || document.body` default, a no-op for
        // the standalone case; only changes behavior nested in an open
        // Modal (#14 follow-up).
        <Portal container={modalPortalContainer}>
          <div
            ref={setPopoverRef}
            // Consumer passthrough (#423) lands on the popover surface (the
            // visual root), not the trigger. `{...rest}` spreads BEFORE the
            // `id`/`role` and the hover-keep-open handlers so a consumer can't
            // clobber the popover semantics or the mouse-enter/leave behavior.
            {...rest}
            id={popoverId}
            role="tooltip"
            className={popoverClasses}
            style={{
              // Consumer style first so positioning + visibility stay
              // authoritative (they are behavioral, not decorative).
              ...style,
              top: `${top}px`,
              left: `${left}px`,
              // Hide until positioned to prevent flash at off-screen (-9999)
              // coords. Matches Dropdown/Select/Tooltip behavior.
              visibility: isReady ? 'visible' : 'hidden',
            }}
            data-placement={actualPlacement}
            data-portal-content
            // Popover API opt-in (#273 step 2) — STANDALONE path only (see
            // the useEffect above). Omitted when nested in an open Modal:
            // the UA stylesheet hides `[popover]:not(:popover-open)` and we
            // never call showPopover() in that branch.
            popover={modalPortalContainer ? undefined : 'manual'}
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            {content}
            {showArrow && <div className={styles.arrow} />}
          </div>
        </Portal>
      )}
    </>
  )
})

Popover.displayName = 'Popover'
