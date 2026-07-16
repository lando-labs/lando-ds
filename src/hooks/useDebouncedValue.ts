'use client'

/**
 * Debounced Value Hook
 *
 * Returns `value` only once it has stopped changing for `delay` milliseconds —
 * the standard way to keep an expensive reaction (a search request, a filter
 * pass over a large table, a validation round-trip) off the keystroke path while
 * the input itself stays fully responsive.
 *
 * This debounces the VALUE, not a callback: the input stays controlled and
 * re-renders on every keystroke, while the returned value lags behind and only
 * settles when typing pauses. The pending timer is cleared whenever `value` (or
 * `delay`) changes and on unmount, so a fast typist never queues a backlog of
 * timers, and an unmounted component never emits a stale value.
 *
 * @category state
 *
 * @example Debounced search
 * const [query, setQuery] = useState('')
 * const debouncedQuery = useDebouncedValue(query, 300)
 *
 * useEffect(() => {
 *   if (debouncedQuery) search(debouncedQuery)
 * }, [debouncedQuery])
 *
 * <Input value={query} onChange={(e) => setQuery(e.target.value)} />
 */

import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delay: number): T {
  // Seeded with the current value: the FIRST value is never debounced (there is
  // nothing to settle from), only subsequent changes are.
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delay)

    // Runs before the next effect AND on unmount. Re-running on every new
    // `value` is what makes this a debounce rather than a queue of timers: each
    // change cancels the pending emit and starts the clock over.
    return () => clearTimeout(timeoutId)
  }, [value, delay])

  return debouncedValue
}
