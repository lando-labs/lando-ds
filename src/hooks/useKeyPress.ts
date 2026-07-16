'use client'

/**
 * Key Press Hook
 *
 * Detects when specific keyboard keys are pressed and triggers callbacks.
 * Supports multiple keys and modifier keys.
 *
 * @category keyboard
 *
 * @example
 * useKeyPress('Escape', () => setIsOpen(false))
 * useKeyPress(['ArrowUp', 'ArrowDown'], (key) => navigate(key))
 */

import { useEffect } from 'react'

export function useKeyPress(
  targetKeys: string | string[],
  callback: (key: string, event: KeyboardEvent) => void,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive) return

    const keys = Array.isArray(targetKeys) ? targetKeys : [targetKeys]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (keys.includes(event.key)) {
        callback(event.key, event)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [targetKeys, callback, isActive])
}
