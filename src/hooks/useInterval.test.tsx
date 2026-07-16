// @vitest-environment jsdom

/**
 * useInterval contract tests (#504).
 *
 * The whole point of the ref'd-callback pattern is timer correctness, so that is
 * what this pins:
 *   - a re-render must NOT restart a running interval (the classic bug: a
 *     component that re-renders faster than `delay` never ticks at all),
 *   - each tick must invoke the LATEST callback closure, not the one it mounted
 *     with (the bug the naive `[callback, delay]` fix trades down for),
 *   - `delay: null` pauses, and a real delay resumes,
 *   - changing `delay` DOES restart,
 *   - unmount clears the timer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInterval } from './useInterval'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Advance fake time inside act() so any state a tick sets flushes. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('useInterval — ticking', () => {
  it('fires repeatedly on the delay', () => {
    const callback = vi.fn()
    renderHook(() => useInterval(callback, 1000))

    expect(callback).not.toHaveBeenCalled() // nothing fires before the first period

    advance(1000)
    expect(callback).toHaveBeenCalledTimes(1)

    advance(2000)
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('treats `delay: 0` as a running interval, not a pause (strict null check)', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useInterval(callback, 0))

    // The guard is `delay === null`, not `!delay`, so a falsy-but-valid `0` must
    // still arm a timer. We assert it was ARMED rather than firing it: a 0ms
    // *repeating* interval cannot be safely advanced under fake timers (there is
    // always another timer at the current instant → the runner loops until OOM),
    // and firing it isn't what this guards anyway.
    expect(vi.getTimerCount()).toBe(1) // a pause (`return`) would arm nothing
    unmount() // clear it WITHOUT advancing
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('useInterval — pausing', () => {
  it('does not schedule anything while `delay` is null', () => {
    const callback = vi.fn()
    renderHook(() => useInterval(callback, null))

    expect(vi.getTimerCount()).toBe(0)
    advance(10_000)
    expect(callback).not.toHaveBeenCalled()
  })

  it('pauses on null and resumes when a delay returns', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(({ delay }) => useInterval(callback, delay), {
      initialProps: { delay: 1000 as number | null },
    })

    advance(1000)
    expect(callback).toHaveBeenCalledTimes(1)

    rerender({ delay: null }) // pause
    expect(vi.getTimerCount()).toBe(0)
    advance(5000)
    expect(callback).toHaveBeenCalledTimes(1) // still 1 — nothing fired while paused

    rerender({ delay: 1000 }) // resume
    advance(1000)
    expect(callback).toHaveBeenCalledTimes(2)
  })
})

describe('useInterval — timer identity', () => {
  it('does NOT restart a running interval on re-render', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(() => useInterval(callback, 1000))

    advance(600) // 600ms into the period

    // Re-render (with a fresh inline callback identity, as a real component
    // would). If this tore down and re-armed the timer, the deadline would slide
    // to 1600ms and the tick below would never happen.
    rerender()
    rerender()

    advance(400) // t = 1000
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('invokes the LATEST callback, never a stale closure', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useInterval(cb, 1000), {
      initialProps: { cb: first },
    })

    // Swap the callback mid-period: the timer keeps running (no restart) AND the
    // tick that lands at t=1000 must call the NEW callback.
    advance(600)
    rerender({ cb: second })
    advance(400)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('restarts the timer when `delay` changes', () => {
    const callback = vi.fn()
    const { rerender } = renderHook(({ delay }) => useInterval(callback, delay), {
      initialProps: { delay: 1000 },
    })

    advance(600)
    rerender({ delay: 500 }) // new delay → the old timer is cleared, clock restarts

    advance(400) // t = 1000 overall, but only 400ms into the NEW 500ms period
    expect(callback).not.toHaveBeenCalled()

    advance(100) // 500ms into the new period
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('useInterval — cleanup', () => {
  it('clears the interval on unmount (no leak, no ticks after teardown)', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useInterval(callback, 1000))

    advance(1000)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1) // the interval is still armed

    unmount()
    expect(vi.getTimerCount()).toBe(0) // cleanup ran

    advance(10_000)
    expect(callback).toHaveBeenCalledTimes(1) // no ticks after unmount
  })
})
