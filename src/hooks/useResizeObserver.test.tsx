// @vitest-environment jsdom

/**
 * useResizeObserver tests (#504).
 *
 * jsdom ships no ResizeObserver, so one is stubbed in via `vi.stubGlobal` and
 * driven by hand. Pinned here:
 *   - the size starts at {0, 0} (the value the server renders) and is filled in
 *     when the observer first reports;
 *   - the element is observed, and the observer is DISCONNECTED on unmount;
 *   - a no-op measurement returns the SAME object, so React bails out of the
 *     re-render instead of looping — asserted via the per-render size log.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'

import { useResizeObserver } from './useResizeObserver'

/** Local mirror of the hook's inline size shape, for typing the fixtures. */
type ElementSize = { width: number; height: number }

type ResizeCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void

/** A recording ResizeObserver stub — jsdom has none. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = []

  readonly callback: ResizeCallback
  readonly observed: Element[] = []

  observe = vi.fn((element: Element) => {
    this.observed.push(element)
  })
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(callback: ResizeCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }

  /** Report one or more content-box measurements, as the browser would. */
  emit(...sizes: ElementSize[]) {
    const entries = sizes.map(
      (size) => ({ contentRect: { ...size } }) as unknown as ResizeObserverEntry
    )
    this.callback(entries, this as unknown as ResizeObserver)
  }
}

/** The nth constructed observer. */
function observerAt(index: number): MockResizeObserver {
  const instance = MockResizeObserver.instances[index]
  if (!instance) throw new Error(`No ResizeObserver constructed at index ${index}`)
  return instance
}

/** The size seen on each render — its length is the render count. */
let seen: ElementSize[] = []

function Box() {
  const [ref, size] = useResizeObserver<HTMLDivElement>()
  seen.push(size)
  return (
    <div ref={ref} data-testid="box">
      {size.width}x{size.height}
    </div>
  )
}

beforeEach(() => {
  MockResizeObserver.instances = []
  seen = []
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useResizeObserver', () => {
  describe('happy path', () => {
    it('starts at {width: 0, height: 0}', () => {
      const { result } = renderHook(() => useResizeObserver<HTMLDivElement>())

      expect(result.current[1]).toEqual({ width: 0, height: 0 })
      expect(result.current[0].current).toBeNull()
      // No element → nothing to observe.
      expect(MockResizeObserver.instances).toHaveLength(0)
    })

    it('observes the element the ref is attached to', () => {
      render(<Box />)

      expect(MockResizeObserver.instances).toHaveLength(1)
      expect(observerAt(0).observe).toHaveBeenCalledTimes(1)
      expect(observerAt(0).observed[0]).toBe(screen.getByTestId('box'))
    })

    it('reports the measured content-box size', () => {
      render(<Box />)
      expect(screen.getByTestId('box')).toHaveTextContent('0x0')

      act(() => {
        observerAt(0).emit({ width: 120, height: 40 })
      })
      expect(screen.getByTestId('box')).toHaveTextContent('120x40')

      act(() => {
        observerAt(0).emit({ width: 300, height: 90 })
      })
      expect(screen.getByTestId('box')).toHaveTextContent('300x90')
    })

    it('keeps the LATEST entry when one callback carries several', () => {
      render(<Box />)

      act(() => {
        observerAt(0).emit({ width: 10, height: 10 }, { width: 64, height: 32 })
      })

      expect(screen.getByTestId('box')).toHaveTextContent('64x32')
    })
  })

  describe('no-op measurements', () => {
    it('hands React back the SAME size object across a no-op measurement', () => {
      const { result } = renderHook(() => useResizeObserver<HTMLDivElement>())
      // renderHook has no DOM element, so drive a rendered instance instead and
      // read identity through the hook's own state.
      const probe: { size: ElementSize | null } = { size: null }
      function IdentityBox() {
        const [ref, size] = useResizeObserver<HTMLDivElement>()
        probe.size = size
        return <div ref={ref} data-testid="idbox" />
      }
      render(<IdentityBox />)

      act(() => {
        observerAt(0).emit({ width: 120, height: 40 })
      })
      const afterChange = probe.size
      expect(afterChange).toEqual({ width: 120, height: 40 })

      // Same box reported again: the updater returns `prev`, so the reference is
      // preserved (Object.is-equal) and React can bail out of committing.
      act(() => {
        observerAt(0).emit({ width: 120, height: 40 })
      })
      expect(probe.size).toBe(afterChange)

      // renderHook instance never received an element.
      expect(result.current[1]).toEqual({ width: 0, height: 0 })
    })

    it('does not re-render once PER no-op event (a burst is bounded)', () => {
      render(<Box />)
      act(() => {
        observerAt(0).emit({ width: 120, height: 40 })
      })
      const rendersAfterChange = seen.length

      // Ten identical reports. A naive `setSize({width, height})` would create a
      // fresh object each time and re-render ten times; returning `prev` bounds
      // it to at most a single trailing render.
      act(() => {
        for (let i = 0; i < 10; i += 1) observerAt(0).emit({ width: 120, height: 40 })
      })

      expect(seen.length - rendersAfterChange).toBeLessThanOrEqual(1)
    })
  })

  describe('cleanup', () => {
    it('disconnects the observer on unmount', () => {
      const { unmount } = render(<Box />)
      expect(observerAt(0).disconnect).not.toHaveBeenCalled()

      unmount()

      expect(observerAt(0).disconnect).toHaveBeenCalledTimes(1)
    })

    it('re-observes a fresh element on remount', () => {
      const first = render(<Box />)
      first.unmount()

      render(<Box />)

      expect(MockResizeObserver.instances).toHaveLength(2)
      expect(observerAt(1).observed[0]).toBe(screen.getByTestId('box'))
    })
  })

  describe('environments without ResizeObserver', () => {
    it('stays inert rather than throwing', () => {
      vi.unstubAllGlobals()
      // jsdom has no ResizeObserver once the stub is gone — the same shape as an
      // old browser. The hook must not construct one.
      expect(() => render(<Box />)).not.toThrow()
      expect(screen.getByTestId('box')).toHaveTextContent('0x0')
    })
  })
})
