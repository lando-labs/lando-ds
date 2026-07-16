'use client'

/**
 * Interval Hook
 *
 * Runs `callback` every `delay` milliseconds, and cleans up after itself. Pass
 * `delay: null` to PAUSE the interval — the timer is cleared, and re-supplying a
 * number restarts it. That makes the pause/resume of a polling loop, a carousel
 * or a countdown a matter of flipping one prop, with no imperative timer handles
 * at the call site.
 *
 * The declarative version of `setInterval` (Dan Abramov's pattern): the callback
 * is held in a ref that is refreshed on every render, so each tick invokes the
 * LATEST closure — it always sees current props and state — while the timer
 * itself only depends on `delay`. A re-render therefore never restarts a running
 * interval (which would starve a fast-rendering component of ticks entirely),
 * changing `delay` does restart it, and unmounting clears it.
 *
 * @category timing
 *
 * @example Poll while a job is running, pause when it isn't
 * useInterval(() => refetch(), isRunning ? 5000 : null)
 *
 * @example Countdown — the tick always sees the current `count`
 * const [count, setCount] = useState(10)
 * useInterval(() => setCount(count - 1), count > 0 ? 1000 : null)
 */

import { useEffect, useRef } from 'react'

export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback)

  // Refresh the ref rather than the timer. Keeping the latest callback out of
  // the timer effect's dependencies is precisely what stops a re-render (with a
  // fresh inline callback) from tearing down and restarting the interval.
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    // `null` pauses. Compared strictly, so `delay: 0` (tick as fast as the
    // event loop allows) stays a valid, running interval rather than a pause.
    if (delay === null) return

    const intervalId = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(intervalId)
  }, [delay])
}
