// @vitest-environment jsdom

/**
 * useMounted tests (#504).
 *
 * Pins the canonical hydration-guard contract: false on the server AND on the
 * first client render, true after mount — and no crash on unmount.
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useMounted } from './useMounted'

function Probe() {
  return <span>{String(useMounted())}</span>
}

describe('useMounted', () => {
  it('is false on the server / first render (no effects run)', () => {
    // renderToString never flushes effects → captures the server + first-render
    // value, which must be false so hydration matches.
    expect(renderToString(<Probe />)).toContain('false')
  })

  it('is true after mount', () => {
    const { result } = renderHook(() => useMounted())
    expect(result.current).toBe(true)
  })

  it('unmounts cleanly (no listeners/timers to leak)', () => {
    const { unmount } = renderHook(() => useMounted())
    expect(() => unmount()).not.toThrow()
  })
})
