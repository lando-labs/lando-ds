// @vitest-environment jsdom

/**
 * useIntersection tests (#504).
 *
 * jsdom ships no IntersectionObserver, so one is stubbed in via `vi.stubGlobal`
 * and driven by hand — which also lets us assert the lifecycle directly:
 *   - the element is observed, and the latest entry is surfaced;
 *   - the observer is DISCONNECTED on unmount (no leak);
 *   - a changed option value rebuilds the observer;
 *   - an inline options literal with unchanged VALUES does NOT rebuild it — the
 *     guard against the classic observe → report → setState → re-render →
 *     re-observe infinite loop.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'

import { useIntersection } from './useIntersection'

type IntersectionCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver
) => void

/** A recording IntersectionObserver stub — jsdom has none. */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  readonly callback: IntersectionCallback
  readonly options: IntersectionObserverInit | undefined
  readonly observed: Element[] = []

  root: Element | Document | null = null
  rootMargin = ''
  thresholds: readonly number[] = []

  observe = vi.fn((element: Element) => {
    this.observed.push(element)
  })
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [] as IntersectionObserverEntry[])

  constructor(callback: IntersectionCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.options = options
    MockIntersectionObserver.instances.push(this)
  }

  /** Drive the observer the way the browser would. */
  emit(...entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(
      entries as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver
    )
  }
}

/** The nth constructed observer (these tests only ever build a handful). */
function observerAt(index: number): MockIntersectionObserver {
  const instance = MockIntersectionObserver.instances[index]
  if (!instance) throw new Error(`No IntersectionObserver constructed at index ${index}`)
  return instance
}

/** Minimal harness: a div observed by the hook, reporting its visibility. */
function Watcher({ options }: { options?: IntersectionObserverInit }) {
  const [ref, entry] = useIntersection<HTMLDivElement>(options)
  return (
    <div ref={ref} data-testid="target">
      {entry?.isIntersecting ? 'visible' : 'hidden'}
    </div>
  )
}

beforeEach(() => {
  MockIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useIntersection', () => {
  describe('happy path', () => {
    it('starts with a null entry, and observes nothing until the ref is attached', () => {
      const { result } = renderHook(() => useIntersection<HTMLDivElement>())

      expect(result.current[1]).toBeNull()
      expect(result.current[0].current).toBeNull()
      // No element → nothing to observe.
      expect(MockIntersectionObserver.instances).toHaveLength(0)
    })

    it('observes the element the ref is attached to', () => {
      render(<Watcher />)

      expect(MockIntersectionObserver.instances).toHaveLength(1)
      expect(observerAt(0).observe).toHaveBeenCalledTimes(1)
      expect(observerAt(0).observed[0]).toBe(screen.getByTestId('target'))
    })

    it('surfaces the reported entry', () => {
      render(<Watcher />)
      expect(screen.getByTestId('target')).toHaveTextContent('hidden')

      act(() => {
        observerAt(0).emit({ isIntersecting: true, intersectionRatio: 1 })
      })
      expect(screen.getByTestId('target')).toHaveTextContent('visible')

      act(() => {
        observerAt(0).emit({ isIntersecting: false, intersectionRatio: 0 })
      })
      expect(screen.getByTestId('target')).toHaveTextContent('hidden')
    })

    it('passes the options through to the observer', () => {
      render(<Watcher options={{ rootMargin: '10px', threshold: 0.5 }} />)

      expect(observerAt(0).options).toMatchObject({
        root: null,
        rootMargin: '10px',
        threshold: 0.5,
      })
    })

    it('keeps the LATEST entry when one callback carries several', () => {
      render(<Watcher />)

      act(() => {
        observerAt(0).emit(
          { isIntersecting: false, intersectionRatio: 0 },
          { isIntersecting: true, intersectionRatio: 0.75 }
        )
      })

      expect(screen.getByTestId('target')).toHaveTextContent('visible')
    })
  })

  describe('rebuilds on dep change', () => {
    it('rebuilds the observer when an option value changes', () => {
      const { rerender } = render(<Watcher options={{ threshold: 0.5 }} />)
      expect(MockIntersectionObserver.instances).toHaveLength(1)

      rerender(<Watcher options={{ threshold: 1 }} />)

      expect(MockIntersectionObserver.instances).toHaveLength(2)
      expect(observerAt(0).disconnect).toHaveBeenCalledTimes(1)
      expect(observerAt(1).options).toMatchObject({ threshold: 1 })
      expect(observerAt(1).observed[0]).toBe(screen.getByTestId('target'))
    })

    it('does NOT rebuild when an inline options literal keeps the same values', () => {
      // Same VALUES, brand-new object + array identity on every render — the
      // infinite-loop footgun this hook is built to avoid.
      const { rerender } = render(<Watcher options={{ threshold: [0, 1] }} />)
      expect(MockIntersectionObserver.instances).toHaveLength(1)

      rerender(<Watcher options={{ threshold: [0, 1] }} />)
      rerender(<Watcher options={{ threshold: [0, 1] }} />)

      expect(MockIntersectionObserver.instances).toHaveLength(1)
      expect(observerAt(0).disconnect).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('disconnects the observer on unmount', () => {
      const { unmount } = render(<Watcher />)
      expect(observerAt(0).disconnect).not.toHaveBeenCalled()

      unmount()

      expect(observerAt(0).disconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('environments without IntersectionObserver', () => {
    it('stays inert rather than throwing', () => {
      vi.unstubAllGlobals()
      // jsdom has no IntersectionObserver once the stub is gone — the same shape
      // as an old browser. The hook must not construct one.
      expect(() => render(<Watcher />)).not.toThrow()
      expect(screen.getByTestId('target')).toHaveTextContent('hidden')
    })
  })
})
