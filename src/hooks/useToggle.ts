'use client'

/**
 * Toggle Hook
 *
 * Cycles a value through a fixed list. With no arguments it is a plain boolean
 * toggle (`[false, true]`); given a list, it advances through it and wraps at the
 * end — which is what most "cycle the theme", "cycle the sort direction" or
 * "step through a status" controls actually want, without the modular arithmetic
 * at the call site.
 *
 * The returned setter is referentially STABLE and doubles as both operations:
 * called with no argument it advances to the next value in the cycle; called
 * with an explicit value it jumps straight to it. It stays stable even when the
 * caller passes a fresh inline array on every render (`useToggle(['a', 'b'])`),
 * because the list is read through a ref at call time rather than closed over.
 *
 * Two contract notes: `values` must be non-empty (an empty cycle has no value to
 * return, and throws), and `undefined` cannot be a member of the cycle — the
 * setter reads it as "no argument given, advance".
 *
 * @category state
 *
 * @example Boolean toggle
 * const [isOn, toggle] = useToggle()
 * <Switch checked={isOn} onChange={() => toggle()} />
 *
 * @example Cycle through a list, or jump to a value
 * const [theme, cycleTheme] = useToggle(['light', 'dark', 'system'] as const)
 * <Button onClick={() => cycleTheme()}>Theme: {theme}</Button>
 * <Button onClick={() => cycleTheme('dark')}>Force dark</Button>
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The default cycle. Only ever reached when the caller passes no `values`, which
 * is only type-correct when `T` is left at its `boolean` default — hence the
 * assertion, which is confined to this one constant rather than smeared through
 * the implementation. (TypeScript cannot express "this default applies only at
 * the default instantiation of `T`".)
 */
const DEFAULT_VALUES = [false, true] as unknown as readonly never[]

export function useToggle<T = boolean>(
  values: readonly T[] = DEFAULT_VALUES
): [T, (value?: T) => void] {
  const [index, setIndex] = useState(0)

  // `values` is typically a fresh array literal on every render. Reading it
  // through a ref at call time (the `useCallbackRef` pattern from
  // useControllableState) is what lets the setter below keep empty deps — and
  // therefore a stable identity — while still cycling through the LATEST list.
  const valuesRef = useRef(values)
  useEffect(() => {
    valuesRef.current = values
  })

  const toggle = useCallback((value?: T) => {
    const list = valuesRef.current
    setIndex((prevIndex) => {
      if (value === undefined) {
        // No argument → advance one step, wrapping at the end of the cycle.
        return list.length === 0 ? 0 : (prevIndex + 1) % list.length
      }
      // Explicit value → jump to it. A value that isn't in the cycle is a no-op
      // rather than a desync: we hold position instead of inventing an index.
      const nextIndex = list.indexOf(value)
      return nextIndex === -1 ? prevIndex : nextIndex
    })
  }, [])

  // `noUncheckedIndexedAccess`: this read is genuinely `T | undefined`. It misses
  // when the index outlives a `values` that shrank between renders — recoverable,
  // so we clamp to the first entry — or when `values` is empty, which is not
  // recoverable: there is no inhabitant of `T` to return. Fail loudly at the
  // cause rather than handing back an `undefined` masquerading as a `T` that
  // would surface as a mystery somewhere downstream.
  const value = values[index] ?? values[0]
  if (value === undefined) {
    throw new Error(
      'useToggle: `values` must be a non-empty array that does not contain `undefined`.'
    )
  }

  return [value, toggle]
}
