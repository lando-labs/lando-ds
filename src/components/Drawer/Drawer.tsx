'use client'

/**
 * Drawer / SlideOver Component
 *
 * A panel that slides in from the right, left, or bottom edge of the viewport.
 * Distinct from Modal (centered), Sidebar (nav-only), and Popover (tooltip-scale).
 *
 * Reuses Modal's overlay infrastructure:
 *   - `<Portal>` mount target
 *   - `useFocusTrap` for keyboard containment (Tab / Shift+Tab cycle)
 *   - `useKeyPress('Escape')` for keyboard dismiss
 *   - `useClickOutside` for backdrop dismissal
 *   - body scroll-lock on open
 *
 * Distinct from Modal:
 *   - Slides from a viewport edge (right / left / bottom) instead of centering
 *   - Full-height for `right` / `left`, fixed-height for `bottom`
 *   - Width (or height) is parameterized via `size`
 *   - z-index sits on the same `--z-index-drawer` (1000) tier as Modal
 *
 * @example
 * <Drawer
 *   isOpen={open}
 *   onClose={handleClose}
 *   placement="right"
 *   size="md"
 *   title="Version History"
 * >
 *   <VersionHistoryPanel />
 * </Drawer>
 */

import React, { useRef, useEffect, useId, useState } from 'react'
import { Portal } from '../Portal'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useKeyPress } from '../../hooks/useKeyPress'
import styles from './Drawer.module.css'

export type DrawerPlacement = 'right' | 'left' | 'bottom'
export type DrawerSize = 'sm' | 'md' | 'lg' | number

export interface DrawerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Whether the drawer is open */
  isOpen: boolean
  /** Callback when the drawer should close */
  onClose: () => void
  /**
   * Edge the drawer slides in from.
   * - `right` (default): full-height panel pinned to the right edge
   * - `left`: full-height panel pinned to the left edge
   * - `bottom`: full-width panel pinned to the bottom edge (size controls
   *   height, not width)
   */
  placement?: DrawerPlacement
  /**
   * Drawer size. For `right`/`left` placement this is the panel WIDTH; for
   * `bottom` placement it is the panel HEIGHT.
   * - `sm`: 320px (clamps to 80% of viewport on mobile)
   * - `md` (default): 480px (clamps to 90% on mobile)
   * - `lg`: 640px (clamps to 95% on mobile)
   * - `number`: explicit pixel value
   */
  size?: DrawerSize
  /** Optional drawer title rendered in the sticky header */
  title?: string
  /** Close drawer when clicking the backdrop (default true) */
  closeOnBackdropClick?: boolean
  /** Close drawer when pressing Escape (default true) */
  closeOnEscape?: boolean
  /** Show close button in the header (default true) */
  showCloseButton?: boolean
  /** Drawer content */
  children: React.ReactNode
  /** Additional CSS class on the drawer root */
  className?: string
}

/**
 * Map a `DrawerSize` value into the CSS custom property the panel reads
 * for its width/height. Numeric sizes override the named-size class via an
 * inline custom property so callers can pass any pixel value without
 * authoring new CSS.
 */
function resolveSizeStyle(size: DrawerSize): React.CSSProperties | undefined {
  if (typeof size === 'number') {
    return { ['--drawer-size' as string]: `${size}px` }
  }
  return undefined
}

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(function Drawer(
  {
    isOpen,
    onClose,
    placement = 'right',
    size = 'md',
    title,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    showCloseButton = true,
    children,
    className = '',
    style,
    ...rest
  },
  forwardedRef
) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // `<Portal>` returns `null` on its first render (its mountNode is set in a
  // post-commit `useEffect`). That means on the first render of <Drawer
  // isOpen>, the panel hasn't actually been inserted into the DOM yet, so
  // `panelRef.current` is null when our other effects (`useFocusTrap`,
  // `useClickOutside`) fire. Their dep arrays don't include `panelRef.current`
  // (a ref object is stable), so without a re-trigger they would never see
  // the mounted panel. We track a `panelMounted` flag set from the callback
  // ref and pass it into the dependent hooks' `isActive` flags so they
  // re-evaluate once the Portal has actually committed the panel. This is
  // the same class of issue Dropdown solves with `usePortalPosition`'s rAF
  // retry loop, expressed simpler here because Drawer doesn't need
  // measurement — just "is the ref live yet". */
  const [panelMounted, setPanelMounted] = useState(false)

  // Merge external (forwarded) ref with internal panelRef so consumers can
  // measure / focus the dialog root while internal hooks keep working.
  const setPanelRef = (node: HTMLDivElement | null) => {
    panelRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
    // Sync mount state — flips true on first attach, false on detach
    // (Drawer close path already returns null which detaches the ref).
    setPanelMounted(node !== null)
  }

  // Stable, collision-free aria-labelledby id (matches Modal's pattern).
  const autoId = useId()
  const titleId = `drawer-title-${autoId}`

  // Lock body scroll while open (mirrors Modal). Restoring exact prior values
  // — not just clearing — preserves any host page styles that already set
  // overflow / padding-right.
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight

    // Compensate for the disappearing scrollbar so layout doesn't shift on
    // open. Browsers without a visible scrollbar (mobile, overlay scrollbars)
    // return 0 — that's fine, the conditional skips the extra padding.
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [isOpen])

  // Focus trap (Tab / Shift+Tab cycle within the drawer). Reuses the same
  // shared hook Modal uses — no behavioural divergence between overlays.
  // Gating on `panelMounted` (not just `isOpen`) ensures the trap attaches
  // AFTER Portal commits the panel into the DOM — see the `panelMounted`
  // comment above for the full reasoning.
  useFocusTrap(panelRef, isOpen && panelMounted)

  // Backdrop click → onClose. Configurable via `closeOnBackdropClick`.
  useClickOutside(
    panelRef,
    () => {
      if (closeOnBackdropClick) {
        onClose()
      }
    },
    isOpen && panelMounted
  )

  // Escape → onClose. Configurable via `closeOnEscape`.
  useKeyPress(
    'Escape',
    () => {
      if (closeOnEscape) {
        onClose()
      }
    },
    isOpen
  )

  if (!isOpen) return null

  const drawerClasses = [
    styles.drawer,
    styles[placement],
    typeof size === 'string' ? styles[size] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const sizeStyle = resolveSizeStyle(size)

  return (
    <Portal>
      <div className={styles.backdrop} ref={backdropRef}>
        <div
          className={drawerClasses}
          ref={setPanelRef}
          // Consumer passthrough (#423) lands on the panel (the visual root),
          // not the portal/backdrop wrapper. `{...rest}` spreads BEFORE the
          // role/aria-modal contract so a consumer can't clobber the dialog
          // semantics; consumer `style` merges over the internal size var so
          // the numeric-`size` custom property survives unless deliberately
          // overridden.
          {...rest}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          style={{ ...sizeStyle, ...style }}
          data-placement={placement}
        >
          {(title || showCloseButton) && (
            <div className={styles.header}>
              {title && (
                <h2 id={titleId} className={styles.title}>
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={onClose}
                  aria-label="Close drawer"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M15 5L5 15M5 5L15 15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </Portal>
  )
})

Drawer.displayName = 'Drawer'
