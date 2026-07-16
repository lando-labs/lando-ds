// @vitest-environment jsdom

/**
 * useTimeout contract tests (#504).
 *
 * Mirrors the useInterval suite, for the fire-once case:
 *   - fires exactly once, on the deadline,
 *   - a re-render must NOT re-arm a pending timeout (the classic bug: a
 *     component re-rendering every 100ms would push a 500ms deadline out forever
 *     and never fire),
 *   - the LATEST callback closure fires, not the one it mounted with,
 *   - `delay: null` cancels, and a real delay arms a fresh one,
 *   - changing `delay` restarts,
 *   - unmount cancels the pending timeout.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimeout } from './useTimeout'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Advance fake time inside act() so any state the callback sets flushes. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('useTimeout — firing', () => {
  it('fires once on the deadline, and only once', () => {
    const callback = vi.fn()
    renderHook(() => useTimeout(callback, 500))

    advance(499)
    expect(callback).not.toHaveBeenCalled()

    advance(1)
    expect(callback).toHaveBeenCalledTimes(1)

    advance(10_000)
    expect(callback).toHaveBeenCalledTimes(1) // a timeout, not an interval
    expect(vi.getTimerCount()).toBe(0)
  })

  it('treats `delay: 0` as an armed timeout, not a cancellation', () => {
    const callback = vi.fn()
    renderHook(() => useTimeout(callback, 0))

    advance(0)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('useTimeout — cancelling', () => {
  it('does not schedule anything while `delay` is null', () => {
    const callback = vi.fn()
    renderHook(() => useTimeout(callback, null))

    expect(vi.getTimerCount()).toBe(0)
    advance(10_000)
    expect(callback).not.toHaveBeenCalled()
  })

  it('cancels a pending timeout when `delay` flips to null', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(({ delay }) => useTimeout(callback, delay), {
      initialProps: { delay: 500 as number | null },
    })

    advance(400)
    rerender({ delay: null }) // cancel with 100ms still on the clock
    expect(vi.getTimerCount()).toBe(0)

    advance(10_000)
    expect(callback).not.toHaveBeenCalled()

    // …and a real delay arms a fresh one.
    rerender({ delay: 500 })
    advance(500)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('useTimeout — timer identity', () => {
  it('does NOT re-arm a pending timeout on re-render', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(() => useTimeout(callback, 500))

    advance(400)

    // A component re-rendering (with a fresh inline callback) must not push the
    // deadline out. If it did, the 100ms below would never reach it.
    rerender()
    rerender()

    advance(100) // t = 500
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('invokes the LATEST callback, never a stale closure', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useTimeout(cb, 500), {
      initialProps: { cb: first },
    })

    advance(400)
    rerender({ cb: second }) // swap the callback with the timeout still pending
    advance(100)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('restarts the timeout when `delay` changes', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(({ delay }) => useTimeout(callback, delay), {
      initialProps: { delay: 500 },
    })

    advance(400)
    rerender({ delay: 1000 }) // new delay → old timer cleared, clock restarts

    advance(100) // t = 500 overall — the ORIGINAL deadline, now gone
    expect(callback).not.toHaveBeenCalled()

    advance(900) // 1000ms into the new period
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('useTimeout — cleanup', () => {
  it('clears the pending timeout on unmount (no leak, no stale fire)', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useTimeout(callback, 500))

    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0) // cleanup ran

    advance(10_000)
    expect(callback).not.toHaveBeenCalled() // never fires into a dead component
  })
})
