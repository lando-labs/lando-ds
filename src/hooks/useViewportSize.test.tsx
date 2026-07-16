// @vitest-environment jsdom

/**
 * useViewportSize tests (#504).
 *
 * Covers: the SSR/first-render 0×0 seed, syncing real dimensions after mount,
 * requestAnimationFrame coalescing of resize bursts, orientationchange, and
 * listener + pending-frame cleanup on unmount.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useViewportSize } from './useViewportSize'

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setViewport(1024, 768)
})

describe('useViewportSize', () => {
  it('returns 0×0 on the server / first render (hydration-safe)', () => {
    setViewport(1024, 768)
    function Probe() {
      const { width, height } = useViewportSize()
      return <span>{`${width}x${height}`}</span>
    }
    expect(renderToString(<Probe />)).toContain('0x0')
  })

  it('reports the real viewport size after mount', () => {
    setViewport(1280, 800)
    const { result } = renderHook(() => useViewportSize())
    expect(result.current).toEqual({ width: 1280, height: 800 })
  })

  it('coalesces a burst of resize events into one rAF update', () => {
    let rafCb: FrameRequestCallback | null = null
    const raf = vi.fn((cb: FrameRequestCallback) => {
      rafCb = cb
      return 1
    })
    vi.stubGlobal('requestAnimationFrame', raf)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    setViewport(1024, 768)
    const { result } = renderHook(() => useViewportSize())
    // Mount reads synchronously (not via rAF).
    expect(raf).toHaveBeenCalledTimes(0)
    expect(result.current).toEqual({ width: 1024, height: 768 })

    setViewport(500, 400)
    act(() => {
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('resize'))
    })
    // Three events → a single scheduled frame.
    expect(raf).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ width: 1024, height: 768 }) // not applied yet

    act(() => rafCb?.(0))
    expect(result.current).toEqual({ width: 500, height: 400 })
  })

  it('updates on orientationchange', () => {
    let rafCb: FrameRequestCallback | null = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    setViewport(1024, 768)
    const { result } = renderHook(() => useViewportSize())

    setViewport(400, 900)
    act(() => window.dispatchEvent(new Event('orientationchange')))
    act(() => rafCb?.(0))
    expect(result.current).toEqual({ width: 400, height: 900 })
  })

  it('removes listeners and cancels a pending frame on unmount', () => {
    const cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(42))
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useViewportSize())
    // Schedule a frame so there is something pending to cancel.
    act(() => window.dispatchEvent(new Event('resize')))

    unmount()
    expect(cancel).toHaveBeenCalledWith(42)
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function))
  })
})
