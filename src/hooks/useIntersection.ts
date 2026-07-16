'use client'

/**
 * Intersection Observer Hook
 *
 * Tracks when a referenced element enters or leaves the viewport (or a custom
 * `root`), exposing the latest `IntersectionObserverEntry` — so `isIntersecting`,
 * `intersectionRatio` and the measured rects are all in reach. Lazy-loaded media,
 * infinite scroll, scroll-spy navigation and reveal-on-scroll animations all
 * build on this.
 *
 * The entry is `null` until the observer first reports. The observer is created
 * inside an effect (never during render, so the hook is server-safe) and is
 * disconnected on unmount. Options are keyed by VALUE rather than identity: an
 * inline `{ threshold: [0, 1] }` literal is a new object every render, and
 * rebuilding the observer each time would re-report the entry, set state and
 * re-render — an infinite loop. Only a real change of `root`, `rootMargin` or
 * `threshold` rebuilds the observer.
 *
 * @category dom
 *
 * @example
 * const [ref, entry] = useIntersection<HTMLDivElement>({ threshold: 0.5 })
 * const isVisible = entry?.isIntersecting ?? false
 * return <div ref={ref}>{isVisible ? 'On screen' : 'Off screen'}</div>
 */

import { useEffect, useMemo, useRef, useState } from 'react'

export function useIntersection<T extends Element = Element>(
  options?: IntersectionObserverInit
): [React.RefObject<T | null>, IntersectionObserverEntry | null] {
  const ref = useRef<T>(null)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)

  // `root` is normalized so an omitted root (`undefined`) and an explicit `null`
  // root (the viewport) are the same dependency.
  const root = options?.root ?? null
  const rootMargin = options?.rootMargin
  const threshold = options?.threshold

  // Serialize the threshold so an inline array literal is compared by value.
  const thresholdKey = Array.isArray(threshold) ? threshold.join(',') : String(threshold)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Deliberately keyed on the SERIALIZED threshold: re-memo when the value changes, not when a caller's inline array gets a new identity.
  const stableThreshold = useMemo(() => threshold, [thresholdKey])

  useEffect(() => {
    // Copied to a local so the observer is wired to the element we captured.
    const element = ref.current
    // Nothing to observe, or an environment without IntersectionObserver (the
    // server, jsdom, a very old browser) — stay inert rather than throw.
    if (!element || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        // The most recent entry wins: one callback can carry several when
        // multiple thresholds are crossed inside a single frame.
        const latest = entries[entries.length - 1]
        if (latest) setEntry(latest)
      },
      { root, rootMargin, threshold: stableThreshold }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [root, rootMargin, stableThreshold])

  return [ref, entry]
}
