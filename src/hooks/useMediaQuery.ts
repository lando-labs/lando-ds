'use client'

/**
 * Media Query Hook
 *
 * Subscribes to a CSS media query and reports whether it currently matches.
 * SSR-safe: returns `defaultValue` (default `false`) on the server and on the
 * first client render, then switches to the real `matchMedia` result after
 * mount — so the first client render always agrees with the server markup and
 * hydration never mismatches. Re-subscribes when `query` changes and removes
 * its `change` listener on unmount.
 *
 * @category browser
 *
 * @example
 * const isDesktop = useMediaQuery('(min-width: 1024px)')
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', false)
 */

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string, defaultValue: boolean = false): boolean {
  // Start from the SSR-safe default so server and first client render agree.
  const [matches, setMatches] = useState<boolean>(defaultValue)

  useEffect(() => {
    // Absent in SSR and non-browser runtimes — bail out and keep the default.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mql = window.matchMedia(query)

    // Sync once on mount: the real value may differ from `defaultValue`, and the
    // media state can change between first render and this effect firing.
    setMatches(mql.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mql.addEventListener('change', handleChange)
    return () => {
      mql.removeEventListener('change', handleChange)
    }
  }, [query])

  return matches
}
