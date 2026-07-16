'use client'

/**
 * Resize Observer Hook
 *
 * Measures a referenced element and keeps its content-box `width`/`height` in
 * state as it resizes — for any reason, not just a viewport change: a sibling
 * growing, a font loading, a panel collapsing. This is what container-query-style
 * logic, responsive charts and auto-sizing virtualized lists are built on.
 *
 * The size starts at `{ width: 0, height: 0 }` — the value the server renders and
 * the client hydrates with — and is filled in once the observer first reports.
 * The observer is created inside an effect (never during render, so the hook is
 * server-safe) and disconnected on unmount. A measurement that does not actually
 * change the box returns the SAME size object, so React bails out of the
 * re-render instead of looping.
 *
 * @category dom
 *
 * @example
 * const [ref, { width, height }] = useResizeObserver<HTMLDivElement>()
 * return (
 *   <div ref={ref}>
 *     {width > 480 ? <WideLayout /> : <NarrowLayout />}
 *   </div>
 * )
 */

import { useEffect, useRef, useState } from 'react'

export function useResizeObserver<T extends Element = Element>(): [
  React.RefObject<T | null>,
  { width: number; height: number },
] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    // Copied to a local so the observer is wired to the element we captured.
    const element = ref.current
    // Nothing to measure, or an environment without ResizeObserver (the server,
    // jsdom, a very old browser) — stay inert rather than throw.
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      // The most recent entry is the current size; a burst can deliver several.
      const latest = entries[entries.length - 1]
      if (!latest) return

      const { width, height } = latest.contentRect
      // No-op measurements are common (a resize that doesn't change this box).
      // Returning the previous object lets React skip the re-render entirely.
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      )
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, size]
}
