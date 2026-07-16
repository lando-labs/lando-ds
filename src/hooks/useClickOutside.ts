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
 */

import { useEffect } from 'react'

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  callback: (event: MouseEvent | TouchEvent) => void,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive) return

    const handleClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement

      // Don't trigger if clicking inside the ref element
      if (ref.current && ref.current.contains(target)) {
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
  }, [ref, callback, isActive])
}
