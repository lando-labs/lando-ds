// @vitest-environment jsdom

/**
 * useLocalStorage tests (#504).
 *
 * Covers: the SSR/first-render default (hydration safety), hydrating a stored
 * value after mount, value + functional-updater writes that persist, remove,
 * corrupt-JSON fallback, cross-tab `storage` sync, tolerating localStorage
 * throwing on read AND write, and listener cleanup on unmount.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useLocalStorage } from './useLocalStorage'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('useLocalStorage', () => {
  it('returns defaultValue on the server / first render even when a value is stored', () => {
    window.localStorage.setItem('k', JSON.stringify('stored'))
    function Probe() {
      const [v] = useLocalStorage('k', 'default')
      return <span>{v}</span>
    }
    // First render (no effects) must be the default → hydration-safe.
    const html = renderToString(<Probe />)
    expect(html).toContain('default')
    expect(html).not.toContain('stored')
  })

  it('hydrates the persisted value after mount', () => {
    window.localStorage.setItem('k', JSON.stringify('stored'))
    const { result } = renderHook(() => useLocalStorage('k', 'default'))
    expect(result.current[0]).toBe('stored')
  })

  it('defaults when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('missing', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('persists a written value as JSON', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'a'))
    act(() => result.current[1]('b'))
    expect(result.current[0]).toBe('b')
    expect(JSON.parse(window.localStorage.getItem('k') as string)).toBe('b')
  })

  it('supports a functional updater against the persisted value', () => {
    window.localStorage.setItem('n', JSON.stringify(1))
    const { result } = renderHook(() => useLocalStorage('n', 0))
    act(() => result.current[1]((prev) => prev + 1))
    act(() => result.current[1]((prev) => prev + 1))
    expect(result.current[0]).toBe(3)
    expect(JSON.parse(window.localStorage.getItem('n') as string)).toBe(3)
  })

  it('remove() clears storage and resets to defaultValue', () => {
    window.localStorage.setItem('k', JSON.stringify('x'))
    const { result } = renderHook(() => useLocalStorage('k', 'def'))
    expect(result.current[0]).toBe('x')
    act(() => result.current[2]())
    expect(result.current[0]).toBe('def')
    expect(window.localStorage.getItem('k')).toBeNull()
  })

  it('falls back to defaultValue on corrupt JSON', () => {
    window.localStorage.setItem('k', '{not valid json')
    const { result } = renderHook(() => useLocalStorage('k', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('syncs across tabs via the storage event', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'a'))
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'k', newValue: JSON.stringify('fromOtherTab') })
      )
    })
    expect(result.current[0]).toBe('fromOtherTab')

    // A null newValue (removed in another tab) resets to the default.
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'k', newValue: null }))
    })
    expect(result.current[0]).toBe('a')
  })

  it('ignores storage events for other keys', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'a'))
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'other', newValue: JSON.stringify('nope') })
      )
    })
    expect(result.current[0]).toBe('a')
  })

  it('tolerates localStorage throwing on read (Safari private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const { result } = renderHook(() => useLocalStorage('k', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('tolerates localStorage throwing on write (quota exceeded) and keeps state', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useLocalStorage('k', 'a'))
    expect(() => act(() => result.current[1]('b'))).not.toThrow()
    expect(result.current[0]).toBe('b') // in-memory state still updates
  })

  it('removes the storage listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useLocalStorage('k', 'a'))
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function))
  })
})
