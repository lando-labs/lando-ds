'use client'

/**
 * Clipboard Hook
 *
 * Copies text to the system clipboard and tracks the outcome. `copied` flips to
 * `true` on success and auto-resets to `false` after `timeout` ms (default
 * 2000). Failures — an unavailable Clipboard API (SSR, insecure context) or a
 * denied permission — populate `error` instead of throwing, so `copy` never
 * rejects and a consumer never needs a try/catch. `reset` clears both flags,
 * and the pending auto-reset timer is cleared on unmount.
 *
 * @category browser
 *
 * @example
 * const { copy, copied, error, reset } = useClipboard()
 * <button onClick={() => copy('hello')}>{copied ? 'Copied!' : 'Copy'}</button>
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export function useClipboard(timeout: number = 2000): {
  copy: (text: string) => Promise<void>
  copied: boolean
  error: Error | null
  reset: () => void
} {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    setCopied(false)
    setError(null)
  }, [clearTimer])

  const copy = useCallback(
    async (text: string): Promise<void> => {
      clearTimer()
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
          throw new Error('Clipboard API is unavailable in this environment')
        }
        await navigator.clipboard.writeText(text)
        setError(null)
        setCopied(true)
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          setCopied(false)
        }, timeout)
      } catch (err) {
        // Never surface a rejection to the consumer — expose it via `error`.
        setCopied(false)
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    },
    [clearTimer, timeout]
  )

  // Clear any pending auto-reset timer when the consumer unmounts.
  useEffect(() => clearTimer, [clearTimer])

  return { copy, copied, error, reset }
}
