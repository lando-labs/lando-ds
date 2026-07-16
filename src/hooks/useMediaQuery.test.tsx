// @vitest-environment jsdom

/**
 * useMediaQuery tests (#504).
 *
 * Covers: the SSR/first-render default (hydration safety), syncing to the real
 * matchMedia value after mount, reacting to `change` events, listener cleanup
 * on unmount, and the absent-`matchMedia` guard (jsdom has none by default).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useMediaQuery } from './useMediaQuery'

/** A controllable MediaQueryList stub with add/remove spies and a manual emit. */
function stubMatchMedia(initialMatches: boolean) {
  let handler: ((event: MediaQueryListEvent) => void) | null = null
  const addEventListener = vi.fn((_type: string, cb: EventListenerOrEventListenerObject) => {
    handler = cb as (event: MediaQueryListEvent) => void
  })
  const removeEventListener = vi.fn()
  const mql = {
    matches: initialMatches,
    media: '',
    onchange: null,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  const matchMedia = vi.fn().mockReturnValue(mql)
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    matchMedia,
    addEventListener,
    removeEventListener,
    emit: (matches: boolean) => handler?.({ matches } as MediaQueryListEvent),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('returns defaultValue on the server / first render (hydration-safe)', () => {
    // Even with matchMedia present and matching, the first render (no effects)
    // must yield the default so client hydration agrees with the server.
    stubMatchMedia(true)
    function Probe() {
      return <span>{String(useMediaQuery('(min-width: 1024px)', false))}</span>
    }
    expect(renderToString(<Probe />)).toContain('false')
  })

  it('syncs to the real matchMedia result after mount', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(true)
  })

  it('updates when the media query change event fires', () => {
    const mock = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(false)
    act(() => mock.emit(true))
    expect(result.current).toBe(true)
    act(() => mock.emit(false))
    expect(result.current).toBe(false)
  })

  it('removes its change listener on unmount', () => {
    const mock = stubMatchMedia(true)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(mock.addEventListener).toHaveBeenCalledTimes(1)
    unmount()
    expect(mock.removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('re-subscribes when the query changes', () => {
    const mock = stubMatchMedia(true)
    const { rerender } = renderHook(({ q }) => useMediaQuery(q), {
      initialProps: { q: '(min-width: 1024px)' },
    })
    expect(mock.matchMedia).toHaveBeenLastCalledWith('(min-width: 1024px)')
    rerender({ q: '(min-width: 480px)' })
    // Old subscription torn down, new one created for the new query.
    expect(mock.removeEventListener).toHaveBeenCalledTimes(1)
    expect(mock.matchMedia).toHaveBeenLastCalledWith('(min-width: 480px)')
  })

  it('falls back to defaultValue when matchMedia is unavailable (no crash)', () => {
    // jsdom ships no window.matchMedia — leave it unstubbed.
    expect(typeof window.matchMedia).toBe('undefined')
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)', true))
    expect(result.current).toBe(true)
  })
})
