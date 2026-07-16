'use client'

/**
 * Focus Trap Hook
 *
 * Traps focus within a container element for modals, dropdowns, etc.
 * Handles Tab and Shift+Tab navigation and returns focus to trigger on cleanup.
 *
 * @category a11y
 *
 * @example
 * const dialogRef = useRef<HTMLDivElement>(null)
 * useFocusTrap(dialogRef, true)
 */

import { useEffect } from 'react'

/**
 * Selector for elements that can receive keyboard focus. Exported so the focus
 * trap's coverage can be unit-tested directly. The list mirrors the set of
 * natively-focusable elements the platform recognises; the runtime filter in
 * `getFocusableElements` additionally drops anything whose computed `tabIndex`
 * is `-1` (e.g. an explicit `tabindex="-1"`).
 */
export const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"])',
  'audio[controls]',
  'video[controls]',
  'details > summary:first-of-type',
  'iframe',
].join(',')

export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive || !ref.current) return

    const container = ref.current
    const previousActiveElement = document.activeElement as HTMLElement

    // Get all focusable elements
    const getFocusableElements = (): HTMLElement[] => {
      const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS)
      return Array.from(elements).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
      )
    }

    // Focus first element
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0]?.focus()
    }

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement

      // Shift + Tab (backwards)
      if (e.shiftKey) {
        if (activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      }
      // Tab (forwards)
      else {
        if (activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    // Cleanup: return focus to previous element
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement && previousActiveElement.focus) {
        previousActiveElement.focus()
      }
    }
  }, [ref, isActive])
}
