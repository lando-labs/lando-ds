'use client'

/**
 * Click Outside Hook
 *
 * Detects clicks outside a referenced element and triggers a callback.
 * Useful for closing modals, dropdowns, tooltips, etc.
 *
 * @category dom
 *
 * @example
 * const dropdownRef = useRef<HTMLDivElement>(null)
 * useClickOutside(dropdownRef, () => setIsOpen(false))
 *
 * @example
 * // Toggle triggers (Dropdown/Popover): pass the trigger's own ref via
 * // `ignoreRefs` so the trigger's click doesn't ALSO get treated as an
 * // "outside" click. Without this, a click on an open trigger both (a)
 * // closes via this hook's `mousedown` listener and (b) re-opens via the
 * // trigger's own `onClick` toggle — a double-fire that nets "stays open"
 * // (#14 v3).
 * useClickOutside(dropdownRef, () => setIsOpen(false), isOpen, [triggerRef])
 */

import { useEffect } from 'react'

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  callback: (event: MouseEvent | TouchEvent) => void,
  isActive: boolean = true,
  ignoreRefs: React.RefObject<HTMLElement | null>[] = []
) {
  useEffect(() => {
    if (!isActive) return

    const handleClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement

      // Don't trigger if clicking inside the ref element
      if (ref.current && ref.current.contains(target)) {
        return
      }

      // Don't trigger if clicking inside one of the caller's ignored elements
      // (typically the trigger that opens/toggles the overlay this hook is
      // dismissing — see the toggle-trigger example above).
      if (ignoreRefs.some((ignoreRef) => ignoreRef.current && ignoreRef.current.contains(target))) {
        return
      }

      // Don't trigger if clicking certain UI elements that render via Portal
      // Check the target and its parents for exclusion data attributes
      let element: HTMLElement | null = target
      while (element) {
        if (element.hasAttribute) {
          // Sidebar toggle buttons
          if (element.hasAttribute('data-sidebar-toggle')) {
            return
          }
          // Portal-rendered dropdowns (Select, Popover, etc.)
          if (element.hasAttribute('data-portal-content')) {
            return
          }
        }
        element = element.parentElement
      }

      // Trigger callback if we made it here
      callback(event)
    }

    // Add listeners with a slight delay to prevent immediate closing
    // (e.g., when opening by clicking a trigger button)
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('touchstart', handleClick)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [ref, callback, isActive, ignoreRefs])
}
