// @vitest-environment jsdom

/**
 * useWindowScroll tests (#504).
 *
 * `requestAnimationFrame` is stubbed so frames can be flushed deterministically
 * — which is what makes the coalescing claim testable rather than merely stated.
 * Pinned here:
 *   - the FIRST render is always {0, 0} (what the server renders — no hydration
 *     mismatch), with the real offset synced in the mount effect;
 *   - a burst of scroll events schedules exactly ONE frame;
 *   - an offset that has not moved does not re-render;
 *   - on unmount the listener is removed AND a pending frame is cancelled.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'

import { useWindowScroll } from './useWindowScroll'

/** Local mirror of the hook's inline offset shape, for typing the fixtures. */
type WindowScroll = { x: number; y: number }

/** Frames scheduled via the stubbed rAF, pending a manual flush. */
let frames: FrameRequestCallback[] = []
let nextFrameId = 0
const cancelFrame = vi.fn()

/** jsdom never scrolls; shadow the offsets with own properties instead. */
function setWindowScroll(x: number, y: number) {
  Object.defineProperty(window, 'scrollX', { value: x, configurable: true, writable: true })
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
}

function flushFrames() {
  for (const frame of frames.splice(0)) frame(0)
}

function scroll(x: number, y: number) {
  setWindowScroll(x, y)
  window.dispatchEvent(new Event('scroll'))
}

beforeEach(() => {
  frames = []
  nextFrameId = 0
  cancelFrame.mockClear()
  setWindowScroll(0, 0)

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return ++nextFrameId
  })
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useWindowScroll', () => {
  describe('server-safe initial value', () => {
    it('starts at {x: 0, y: 0}', () => {
      const { result } = renderHook(() => useWindowScroll())
      expect(result.current).toEqual({ x: 0, y: 0 })
    })

    it('renders {0, 0} FIRST, then syncs the real offset in an effect', () => {
      // The page is already scrolled before mount — a restored scroll position,
      // or a #hash jump. The first render must still match the server's HTML.
      setWindowScroll(5, 120)

      const seen: WindowScroll[] = []
      function Probe() {
        seen.push(useWindowScroll())
        return null
      }
      render(<Probe />)

      expect(seen[0]).toEqual({ x: 0, y: 0 })
      expect(seen[seen.length - 1]).toEqual({ x: 5, y: 120 })
    })
  })

  describe('scrolling', () => {
    it('reports the offset after the coalescing frame runs', () => {
      const { result } = renderHook(() => useWindowScroll())

      act(() => {
        scroll(0, 300)
      })
      // Still the old value: the read is deferred to the next frame.
      expect(result.current).toEqual({ x: 0, y: 0 })

      act(() => {
        flushFrames()
      })
      expect(result.current).toEqual({ x: 0, y: 300 })

      act(() => {
        scroll(40, 900)
        flushFrames()
      })
      expect(result.current).toEqual({ x: 40, y: 900 })
    })

    it('coalesces a burst of scroll events into a single frame', () => {
      renderHook(() => useWindowScroll())
      expect(frames).toHaveLength(0)

      act(() => {
        for (let i = 1; i <= 5; i += 1) scroll(0, i * 10)
      })

      // Five events, one scheduled read.
      expect(frames).toHaveLength(1)

      act(() => {
        flushFrames()
      })

      // ...and the next burst schedules a fresh frame.
      act(() => {
        scroll(0, 999)
      })
      expect(frames).toHaveLength(1)
    })

    it('hands React back the SAME offset object when the position has not moved', () => {
      const seen: WindowScroll[] = []
      function Probe() {
        seen.push(useWindowScroll())
        return null
      }
      render(<Probe />)

      act(() => {
        scroll(0, 250)
        flushFrames()
      })
      const afterScroll = seen[seen.length - 1]
      expect(afterScroll).toEqual({ x: 0, y: 250 })

      // A scroll event reporting the same offset (e.g. a rubber-band settle):
      // the updater returns `prev`, so the reference is preserved and React can
      // bail out of committing.
      act(() => {
        scroll(0, 250)
        flushFrames()
      })
      expect(seen[seen.length - 1]).toBe(afterScroll)
    })

    it('does not re-render once PER no-op scroll (a burst is bounded)', () => {
      const seen: WindowScroll[] = []
      function Probe() {
        seen.push(useWindowScroll())
        return null
      }
      render(<Probe />)

      act(() => {
        scroll(0, 250)
        flushFrames()
      })
      const rendersAfterScroll = seen.length

      // Ten same-offset scrolls. A naive `setScroll({x, y})` would re-render ten
      // times; returning `prev` bounds it to at most a single trailing render.
      act(() => {
        for (let i = 0; i < 10; i += 1) {
          scroll(0, 250)
          flushFrames()
        }
      })

      expect(seen.length - rendersAfterScroll).toBeLessThanOrEqual(1)
    })
  })

  describe('cleanup', () => {
    it('removes the listener and cancels a pending frame on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const { unmount } = renderHook(() => useWindowScroll())

      act(() => {
        scroll(0, 100)
      })
      expect(frames).toHaveLength(1)

      unmount()

      expect(removeSpy.mock.calls.filter((call) => call[0] === 'scroll')).toHaveLength(1)
      // The frame scheduled just above was cancelled, by id.
      expect(cancelFrame).toHaveBeenCalledTimes(1)
      expect(cancelFrame).toHaveBeenCalledWith(1)

      // And no leak: a post-unmount scroll schedules nothing.
      frames.splice(0)
      act(() => {
        scroll(0, 500)
      })
      expect(frames).toHaveLength(0)
    })

    it('does not cancel a frame when none is pending', () => {
      const { unmount } = renderHook(() => useWindowScroll())
      unmount()
      expect(cancelFrame).not.toHaveBeenCalled()
    })
  })
})
