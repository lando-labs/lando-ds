'use client'

/**
 * Viewport Size Hook
 *
 * Tracks the browser viewport dimensions, updating on `resize` and
 * `orientationchange`. SSR-safe: returns `{ width: 0, height: 0 }` on the
 * server and on the first client render, then the real `window.innerWidth` /
 * `innerHeight` after mount. A burst of resize events is coalesced with
 * `requestAnimationFrame` so state updates at most once per frame. Listeners
 * and any pending frame are cleaned up on unmount.
 *
 * @category browser
 *
 * @example
 * const { width, height } = useViewportSize()
 */

import { useEffect, useState } from 'react'

export function useViewportSize(): { width: number; height: number } {
  // SSR-safe seed: 0×0 until the browser reports real dimensions after mount.
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    let frame = 0

    const read = () => {
      frame = 0
      const width = window.innerWidth
      const height = window.innerHeight
      // Return the previous object identity when nothing changed so React bails
      // out of the re-render — matching useWindowScroll / useResizeObserver.
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      )
    }

    // Coalesce bursts of resize/orientation events into one update per frame.
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(read)
    }

    // Sync immediately on mount (moves off the 0×0 SSR seed).
    read()

    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
    }
  }, [])

  return size
}
