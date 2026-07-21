'use client'

/**
 * Dropdown Component
 *
 * A flexible dropdown menu with portal rendering, keyboard navigation,
 * and smart positioning that adapts to viewport constraints.
 *
 * Platform-native enhancement (#273 step 2): the menu opts in to the
 * Popover API (`popover` attribute + `showPopover()`/`hidePopover()`) when
 * the browser supports it, which promotes the menu into the top layer. The
 * existing controlled-state model (`isOpen` + click-outside + Escape) remains
 * the source of truth so the migration is invisible in unsupported browsers
 * (and jsdom). The benefit in supported browsers is structural correctness:
 * the menu paints above any future top-layer ancestor regardless of CSS
 * stacking-context games.
 *
 * Why `popover="manual"` and not `"auto"`: see src/utils/popoverApi.ts —
 * auto-mode's browser-managed light-dismiss races our controlled state via
 * `beforetoggle`, which would require yielding dismissal control to the
 * browser. Manual mode keeps the React render authoritative; only top-layer
 * promotion comes from the platform.
 *
 * @example
 * <Dropdown trigger={<Button>Menu</Button>}>
 *   <DropdownItem icon={<UserIcon />}>Profile</DropdownItem>
 *   <DropdownItem divider />
 *   <DropdownItem destructive>Delete</DropdownItem>
 * </Dropdown>
 */

import React, { useState, useRef, useEffect } from 'react'
import { Portal } from '../Portal'
import { useModalPortalContainer } from '../Modal/ModalPortalContext'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useKeyPress } from '../../hooks/useKeyPress'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { usePortalPosition } from '../../hooks/usePortalPosition'
import { supportsPopoverApi, syncPopoverState } from '../../utils/popoverApi'
import styles from './Dropdown.module.css'

export interface DropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Element that triggers the dropdown */
  trigger: React.ReactNode
  /** Alignment of dropdown relative to trigger */
  align?: 'left' | 'right' | 'center'
  /** Dropdown menu items */
  children: React.ReactNode
  /** Additional CSS class */
  className?: string
}

type TriggerElement = React.ReactElement<
  React.HTMLAttributes<HTMLElement> & {
    'aria-haspopup'?: React.AriaAttributes['aria-haspopup']
    'aria-expanded'?: React.AriaAttributes['aria-expanded']
  }
>

type DropdownChildElement = React.ReactElement<{
  onClick?: () => void
  onSelect?: () => void
}>

export const Dropdown = React.forwardRef<HTMLDivElement, DropdownProps>(function Dropdown(
  { trigger, align = 'left', children, className = '', style, ...rest },
  forwardedRef
) {
  const [isOpen, setIsOpen] = useState(false)

  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const setTriggerRef = (node: HTMLDivElement | null) => {
    triggerRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  const position = usePortalPosition(triggerRef, isOpen, {
    align,
    offset: 4,
    overlayRef: dropdownRef,
  })
  const isPositioned = position.isReady

  useClickOutside(
    dropdownRef,
    () => {
      setIsOpen(false)
    },
    isOpen
  )

  useKeyPress(
    'Escape',
    () => {
      setIsOpen(false)
    },
    isOpen
  )

  useFocusTrap(dropdownRef, isOpen)

  // Nearest enclosing OPEN Modal's in-dialog portal container (#14
  // follow-up — see the long comment at the top of Modal.tsx). Non-null
  // means: render the menu as a descendant of that Modal's <dialog> instead
  // of document.body — that's what actually makes it interactive, not just
  // visible (a document.body-portaled popover is inert-by-ancestry once the
  // Modal goes showModal(), regardless of top-layer paint order — verified
  // live in Chromium).
  const modalPortalContainer = useModalPortalContainer()

  // Promote the menu into the top layer via the Popover API when supported —
  // STANDALONE path only. Behind capability detection — jsdom and pre-2024
  // browsers don't implement showPopover/hidePopover, in which case we fall
  // through to the existing JS shim chain (no behavioral change). Re-runs on
  // `isPositioned` because the ref doesn't exist until after the Portal
  // mounts and the position settles. Skipped entirely when nested in an open
  // Modal (`modalPortalContainer` non-null): the menu is already a dialog
  // descendant there, so it's exempt from inertness by DOM ancestry and
  // doesn't need top-layer promotion — see the JSX below for why the
  // `popover` attribute itself is also omitted in that branch.
  useEffect(() => {
    if (modalPortalContainer) return
    if (!supportsPopoverApi()) return
    syncPopoverState(dropdownRef.current, isOpen && isPositioned)
  }, [isOpen, isPositioned, modalPortalContainer])

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  let triggerElement: React.ReactNode = trigger
  if (React.isValidElement(trigger)) {
    // Clone trigger and add click handler + a11y props (issue #13).
    const triggerEl = trigger as TriggerElement
    const originalProps = triggerEl.props
    const originalOnClick = originalProps.onClick
    triggerElement = React.cloneElement(triggerEl, {
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault()
        toggleDropdown()
        if (originalOnClick) originalOnClick(e)
      },
      'aria-haspopup': originalProps['aria-haspopup'] ?? 'menu',
      'aria-expanded': originalProps['aria-expanded'] ?? isOpen,
    })
  }

  const dropdownClasses = [
    styles.dropdown,
    isPositioned && styles.animated,
    className
  ].filter(Boolean).join(' ')

  return (
    <>
      <div ref={setTriggerRef} className={styles.trigger}>
        {triggerElement}
      </div>

      {isOpen && (
        // `container={modalPortalContainer}` — `null` falls through to
        // Portal's own `container || document.body` default, a no-op for
        // the standalone case; only changes behavior nested in an open
        // Modal (#14 follow-up).
        <Portal container={modalPortalContainer}>
          <div
            ref={dropdownRef}
            className={dropdownClasses}
            // Consumer passthrough (#423) lands on the menu (the visual root),
            // not the portal wrapper. `{...rest}` spreads BEFORE the
            // `role="menu"`/`aria-orientation` contract so a consumer can't
            // clobber the menu semantics.
            {...rest}
            style={{
              // Consumer style first so positioning + visibility + the
              // pre-position opacity guard stay authoritative (behavioral).
              ...style,
              top: `${position.top}px`,
              left: `${position.left}px`,
              // Hide dropdown until position is calculated to prevent flash
              // at off-screen (-9999, -9999) initial coords.
              visibility: isPositioned ? 'visible' : 'hidden',
              // Prevent animation from starting until positioned
              opacity: isPositioned ? undefined : 0,
            }}
            data-placement={position.placement}
            data-portal-content
            // Popover API opt-in (#273 step 2) — STANDALONE path only (see
            // the useEffect above). Omitted when nested in an open Modal:
            // the UA stylesheet hides `[popover]:not(:popover-open)` and we
            // never call showPopover() in that branch.
            popover={modalPortalContainer ? undefined : 'manual'}
            role="menu"
            aria-orientation="vertical"
          >
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                const childEl = child as DropdownChildElement
                // Inject onSelect so the menu closes after a click. We do NOT
                // re-invoke the child's onClick here — DropdownItem.handleClick
                // already calls it directly. (Pre-fix this re-invocation caused
                // every consumer onClick to fire twice per click; surfaced by
                // Sprint 18 ApprovalCard workflow integration.)
                return React.cloneElement(childEl, {
                  onSelect: () => {
                    setIsOpen(false)
                  },
                })
              }
              return child
            })}
          </div>
        </Portal>
      )}
    </>
  )
})

Dropdown.displayName = 'Dropdown'
