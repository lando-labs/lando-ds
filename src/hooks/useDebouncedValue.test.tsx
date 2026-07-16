// @vitest-environment jsdom

/**
 * useDebouncedValue contract tests (#504).
 *
 * Pins the debounce itself (the value only settles after a quiet period), and
 * the two failure modes that make a hand-rolled debounce leak: a rapid burst of
 * changes must NOT queue a backlog of timers that each emit in turn, and an
 * unmount must leave no pending timer behind to emit into a dead component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Advance fake time inside act() so the timer's state update flushes. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('useDebouncedValue', () => {
  it('returns the initial value immediately (nothing to settle from)', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 300))
    expect(result.current).toBe('a')
  })

  it('withholds a new value until it has been stable for `delay`', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    expect(result.current).toBe('a') // still the old value

    advance(299)
    expect(result.current).toBe('a') // one millisecond short

    advance(1)
    expect(result.current).toBe('b') // settled
  })

  it('emits only the FINAL value of a rapid burst, never the intermediates', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })

    // Type "b", "c", "d" faster than the delay. Each change must cancel the
    // pending emit — a leaked timer per keystroke would surface 'b' and 'c' too.
    rerender({ value: 'b' })
    advance(100)
    rerender({ value: 'c' })
    advance(100)
    rerender({ value: 'd' })
    advance(100)

    expect(result.current).toBe('a') // 300ms elapsed, but never 300ms of QUIET
    expect(vi.getTimerCount()).toBe(1) // exactly one pending timer, not three

    advance(300)
    expect(result.current).toBe('d')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restarts the clock when `delay` changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    )

    rerender({ value: 'b', delay: 300 })
    advance(200)

    rerender({ value: 'b', delay: 1000 }) // new delay → the pending timer is replaced
    advance(300)
    expect(result.current).toBe('a') // the old 300ms deadline is gone

    advance(700)
    expect(result.current).toBe('b')
  })

  it('clears the pending timer on unmount (no leak, no stale emit)', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'b' })
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0) // cleanup ran

    // Nothing left to fire: advancing past the deadline must not emit into the
    // unmounted component (which React would flag as a state update on an
    // unmounted component).
    advance(1000)
    expect(result.current).toBe('a')
  })
})
