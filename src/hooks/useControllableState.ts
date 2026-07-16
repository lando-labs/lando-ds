/**
 * useControllableState — the canonical controlled/uncontrolled state primitive
 * behind the design system's uncontrolled-first state contract (issue #508).
 *
 * Every stateful component in the library supports BOTH:
 *   - **uncontrolled**: `defaultValue` seeds internal state the component owns.
 *   - **controlled**:   `value` + `onChange` — the consumer owns the state.
 *
 * Passing `value !== undefined` makes the component controlled; otherwise it is
 * uncontrolled and seeds from `defaultValue`. `onChange` fires on every change
 * in BOTH modes, so a consumer can observe changes without taking ownership.
 *
 * Semantics are modeled on the battle-tested Radix `useControllableState`, but
 * this is a dependency-free in-house implementation — the DS ships no new
 * runtime dependencies (see `reference/state-contract.md`).
 *
 * @example Uncontrolled with an observer
 * const [value, setValue] = useControllableState({
 *   value: undefined,
 *   defaultValue: 'a',
 *   onChange: (v) => analytics.track(v),
 * })
 *
 * @example Controlled
 * const [value, setValue] = useControllableState({
 *   value: props.value,          // defined → controlled
 *   defaultValue: undefined,
 *   onChange: props.onChange,
 * })
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/** A functional updater, mirroring React's `(prev) => next` setter form. */
type SetStateFn<T> = (prev: T) => T

export interface UseControllableStateParams<T> {
  /**
   * The controlled value. When it is anything other than `undefined` the
   * component is controlled and this hook never mutates internal state — the
   * consumer is expected to flip the value via `onChange`.
   */
  value: T | undefined
  /**
   * The initial value for the uncontrolled case. Ignored entirely when `value`
   * is provided (controlled mode).
   */
  defaultValue: T | undefined
  /**
   * Fires on every change, in both controlled and uncontrolled modes. In
   * controlled mode it is the only signal (the consumer owns the state); in
   * uncontrolled mode it is an optional observer that fires after commit.
   */
  onChange?: (value: T) => void
  /**
   * Explicit controlled-ness. When omitted, the component is controlled iff
   * `value !== undefined` (React's native convention).
   *
   * Pass `'value' in props` when `undefined` is a MEANINGFUL controlled value —
   * e.g. a clearable `Select` whose cleared single-select state is `undefined`
   * (#328). Without this, setting the controlled value to `undefined` would be
   * mistaken for "uncontrolled" and the component would silently fall back to
   * stale internal state, breaking the controlled contract.
   */
  controlled?: boolean
}

/**
 * A stable wrapper around the latest callback: the returned function's identity
 * never changes across renders, but it always invokes the most recent
 * `callback`. This keeps `setValue` referentially stable even when a consumer
 * passes a new inline `onChange` on every render.
 */
function useCallbackRef<Args extends unknown[], R>(
  callback: ((...args: Args) => R) | undefined
): (...args: Args) => R | undefined {
  const ref = useRef(callback)
  useEffect(() => {
    ref.current = callback
  })
  return useCallback((...args: Args) => ref.current?.(...args), [])
}

/**
 * Internal uncontrolled backing store. Owns a `useState` seeded from
 * `defaultValue` and fires `onChange` from an effect whenever the committed
 * value actually changes — this is what lets a functional updater (which React
 * resolves) still surface the resolved value to the observer.
 */
function useUncontrolledState<T>({
  defaultValue,
  onChange,
}: {
  defaultValue: T | undefined
  onChange?: (value: T) => void
}): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
  const state = useState<T | undefined>(defaultValue)
  const [value] = state
  const prevValueRef = useRef(value)
  const handleChange = useCallbackRef(onChange)

  useEffect(() => {
    if (prevValueRef.current !== value) {
      handleChange(value as T)
      prevValueRef.current = value
    }
  }, [value, handleChange])

  return state
}

/**
 * @returns a `[value, setValue]` tuple. `setValue` accepts either a next value
 * or a functional updater `(prev) => next`, mirroring React's `useState` setter.
 */
export function useControllableState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
  controlled,
}: UseControllableStateParams<T>): [T, (next: T | SetStateFn<T>) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useUncontrolledState({
    defaultValue,
    onChange,
  })
  // `?? ` (not `||`) so an explicit `controlled: false` is honored. When the
  // override is omitted, fall back to React's native `value !== undefined` rule.
  const isControlled = controlled ?? controlledValue !== undefined
  const value = (isControlled ? controlledValue : uncontrolledValue) as T
  const handleChange = useCallbackRef(onChange)

  const setValue = useCallback(
    (next: T | SetStateFn<T>) => {
      if (isControlled) {
        // We don't own the state in controlled mode. Resolve a functional
        // updater against the current controlled value and notify the consumer,
        // who is responsible for flipping `value`. Skip no-op changes so an
        // idempotent set doesn't spam `onChange`.
        const resolved =
          typeof next === 'function'
            ? (next as SetStateFn<T>)(controlledValue as T)
            : next
        if (resolved !== controlledValue) handleChange(resolved)
      } else {
        // Uncontrolled: React owns the update; the effect in
        // useUncontrolledState surfaces the resolved value to `onChange`.
        setUncontrolledValue(next as SetStateAction<T | undefined>)
      }
    },
    [isControlled, controlledValue, handleChange, setUncontrolledValue]
  )

  return [value, setValue]
}
