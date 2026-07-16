// @vitest-environment jsdom

/**
 * useEventListener tests (#504).
 *
 * The load-bearing claims, each pinned below:
 *   - defaults to `window`, and an explicit `null` target attaches NOTHING
 *     (i.e. `null` must not silently fall back to `window`);
 *   - the handler is ref-held, so a fresh inline function every render does not
 *     churn the subscription — but the LATEST handler is the one invoked;
 *   - options are keyed by VALUE, so an inline `{ passive: true }` literal does
 *     not re-attach on every render;
 *   - the listener is re-attached when `type`/`target`/an option value changes;
 *   - the listener is removed on unmount — asserted on the spy AND behaviorally.
 */

import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'

import { useEventListener } from './useEventListener'

/** Only the registrations for `type` — React registers listeners of its own. */
function callsFor(spy: { mock: { calls: unknown[][] } }, type: string): unknown[][] {
  return spy.mock.calls.filter((call) => call[0] === type)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useEventListener', () => {
  describe('targets', () => {
    it('listens on window by default', () => {
      const handler = vi.fn((_event: KeyboardEvent) => {})
      renderHook(() => useEventListener('keydown', handler))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0]?.[0]?.key).toBe('Escape')
    })

    it('listens on a raw element target', () => {
      const element = document.createElement('div')
      document.body.appendChild(element)
      const handler = vi.fn()

      renderHook(() => useEventListener('click', handler, element))

      act(() => {
        element.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).toHaveBeenCalledTimes(1)

      element.remove()
    })

    it('listens on a ref target', () => {
      const handler = vi.fn()

      function Harness() {
        const ref = useRef<HTMLButtonElement>(null)
        useEventListener('click', handler, ref)
        return (
          <button ref={ref} data-testid="btn">
            go
          </button>
        )
      }

      const { getByTestId } = render(<Harness />)

      act(() => {
        getByTestId('btn').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('listens on document', () => {
      const handler = vi.fn()
      renderHook(() => useEventListener('click', handler, document))

      act(() => {
        document.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('attaches nothing when the target is null (no silent fallback to window)', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const handler = vi.fn()

      renderHook(() => useEventListener('click', handler, null))

      expect(callsFor(addSpy, 'click')).toHaveLength(0)

      act(() => {
        window.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('the handler is ref-held (no useCallback needed)', () => {
    it('does not re-attach when only the handler identity changes, and calls the latest one', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const first = vi.fn()
      const second = vi.fn()

      const { rerender } = renderHook(
        ({ handler }: { handler: () => void }) => useEventListener('click', handler),
        { initialProps: { handler: first } }
      )
      expect(callsFor(addSpy, 'click')).toHaveLength(1)

      rerender({ handler: second })

      // Same subscription: the ref was swapped, the listener was not.
      expect(callsFor(addSpy, 'click')).toHaveLength(1)
      expect(callsFor(removeSpy, 'click')).toHaveLength(0)

      act(() => {
        window.dispatchEvent(new MouseEvent('click'))
      })
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledTimes(1)
    })
  })

  describe('re-attaches on dep change', () => {
    it('re-attaches when the event type changes', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const handler = vi.fn()

      const { rerender } = renderHook(
        ({ type }: { type: 'click' | 'keydown' }) => useEventListener(type, handler),
        { initialProps: { type: 'click' as 'click' | 'keydown' } }
      )
      expect(callsFor(addSpy, 'click')).toHaveLength(1)

      rerender({ type: 'keydown' })

      expect(callsFor(removeSpy, 'click')).toHaveLength(1)
      expect(callsFor(addSpy, 'keydown')).toHaveLength(1)

      // The old subscription is genuinely gone.
      act(() => {
        window.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).not.toHaveBeenCalled()

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
      })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('re-attaches when the target changes', () => {
      const first = document.createElement('div')
      const second = document.createElement('div')
      document.body.append(first, second)
      const handler = vi.fn()

      const { rerender } = renderHook(
        ({ target }: { target: HTMLElement }) => useEventListener('click', handler, target),
        { initialProps: { target: first } }
      )

      act(() => {
        first.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).toHaveBeenCalledTimes(1)

      rerender({ target: second })

      // Detached from the old target...
      act(() => {
        first.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).toHaveBeenCalledTimes(1)

      // ...and attached to the new one.
      act(() => {
        second.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).toHaveBeenCalledTimes(2)

      first.remove()
      second.remove()
    })

    it('re-attaches when an option VALUE changes', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      const { rerender } = renderHook(
        ({ capture }: { capture: boolean }) =>
          useEventListener('click', () => {}, undefined, { capture }),
        { initialProps: { capture: false } }
      )
      expect(callsFor(addSpy, 'click')).toHaveLength(1)

      rerender({ capture: true })

      expect(callsFor(removeSpy, 'click')).toHaveLength(1)
      expect(callsFor(addSpy, 'click')).toHaveLength(2)
    })

    it('does NOT re-attach when an inline options object keeps the same values', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      // A brand-new object literal on every render: identity churns, values do not.
      const { rerender } = renderHook(() =>
        useEventListener('scroll', () => {}, undefined, { passive: true })
      )
      expect(callsFor(addSpy, 'scroll')).toHaveLength(1)

      rerender()
      rerender()

      expect(callsFor(addSpy, 'scroll')).toHaveLength(1)
    })
  })

  describe('cleanup', () => {
    it('removes the listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const handler = vi.fn()

      const { unmount } = renderHook(() => useEventListener('click', handler))

      unmount()

      expect(callsFor(removeSpy, 'click')).toHaveLength(1)

      // And no leak: the handler is genuinely detached.
      act(() => {
        window.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).not.toHaveBeenCalled()
    })

    it('removes an element listener on unmount', () => {
      const element = document.createElement('div')
      document.body.appendChild(element)
      const removeSpy = vi.spyOn(element, 'removeEventListener')
      const handler = vi.fn()

      const { unmount } = renderHook(() => useEventListener('click', handler, element))
      unmount()

      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function), expect.anything())

      act(() => {
        element.dispatchEvent(new MouseEvent('click'))
      })
      expect(handler).not.toHaveBeenCalled()

      element.remove()
    })
  })
})
