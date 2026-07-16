'use client'

/**
 * Timeout Hook
 *
 * Runs `callback` once, `delay` milliseconds after the timer starts, and cleans
 * up after itself. Pass `delay: null` to CANCEL a pending timeout — nothing
 * fires, and supplying a number again arms a fresh one. The auto-dismiss of a
 * Toast, a delayed empty state, a "still loading…" hint: all of them become one
 * prop rather than a `setTimeout` plus a cleanup plus a ref to the handle.
 *
 * The declarative counterpart to `useInterval`, and it shares its guarantee: the
 * callback lives in a ref refreshed on every render, so it fires with the LATEST
 * closure (current props and state, never a stale capture) while the timer
 * depends only on `delay`. A re-render therefore never re-arms a pending
 * timeout — the deadline is honored as scheduled — changing `delay` restarts it,
 * and unmounting cancels it.
 *
 * @category timing
 *
 * @example Auto-dismiss, cancellable on hover
 * useTimeout(onDismiss, isHovered ? null : 5000)
 *
 * @example Delay a spinner so a fast response never flashes one
 * const [showSpinner, setShowSpinner] = useState(false)
 * useTimeout(() => setShowSpinner(true), isLoading ? 500 : null)
 */

import { useEffect, useRef } from 'react'

export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback)

  // Refresh the ref rather than the timer. Keeping the latest callback out of
  // the timer effect's dependencies is what stops a re-render (with a fresh
  // inline callback) from re-arming a pending timeout and pushing its deadline
  // out — a component that re-renders every 100ms would otherwise never fire a
  // 500ms timeout at all.
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    // `null` cancels. Compared strictly, so `delay: 0` (fire on the next tick of
    // the event loop) stays a real, armed timeout rather than a cancellation.
    if (delay === null) return

    const timeoutId = setTimeout(() => savedCallback.current(), delay)
    return () => clearTimeout(timeoutId)
  }, [delay])
}
