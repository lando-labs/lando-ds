// @vitest-environment jsdom

/**
 * useClipboard tests (#504).
 *
 * Covers: the happy-path copy + auto-reset after the timeout, the
 * absent-Clipboard-API guard (jsdom has none by default), a denied/rejected
 * write surfacing via `error` (never throwing), `reset`, and clearing the
 * pending auto-reset timer on unmount.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from './useClipboard'

/** Install a stub `navigator.clipboard.writeText`, returning the spy. */
function stubClipboard(impl: () => Promise<void>) {
  const writeText = vi.fn(impl)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  })
  return writeText
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  // Remove any clipboard we defined so the next test starts from jsdom's default.
  if ('clipboard' in navigator) {
    // @ts-expect-error — deleting the configurable stub we installed above.
    delete navigator.clipboard
  }
})

describe('useClipboard', () => {
  it('copies text and auto-resets `copied` after the timeout', async () => {
    vi.useFakeTimers()
    const writeText = stubClipboard(() => Promise.resolve())
    const { result } = renderHook(() => useClipboard(2000))

    await act(async () => {
      await result.current.copy('hello')
    })
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(result.current.copied).toBe(true)
    expect(result.current.error).toBeNull()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.copied).toBe(false)
  })

  it('sets `error` (and does not throw) when the Clipboard API is unavailable', async () => {
    // jsdom exposes no navigator.clipboard — leave it undefined.
    expect('clipboard' in navigator ? navigator.clipboard : undefined).toBeUndefined()
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await expect(result.current.copy('x')).resolves.toBeUndefined()
    })
    expect(result.current.copied).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('sets `error` when writeText rejects (permission denied)', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('x')
    })
    expect(result.current.copied).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('denied')
  })

  it('reset() clears copied and error', async () => {
    stubClipboard(() => Promise.resolve())
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('hi')
    })
    expect(result.current.copied).toBe(true)

    act(() => result.current.reset())
    expect(result.current.copied).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('clears the pending auto-reset timer on unmount', async () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    stubClipboard(() => Promise.resolve())
    const { result, unmount } = renderHook(() => useClipboard(2000))

    await act(async () => {
      await result.current.copy('hi')
    })
    expect(result.current.copied).toBe(true) // a reset timer is now pending

    unmount()
    expect(clearSpy).toHaveBeenCalled()
    // Advancing past the timeout must not attempt a post-unmount state update.
    expect(() => act(() => vi.advanceTimersByTime(5000))).not.toThrow()
  })
})
