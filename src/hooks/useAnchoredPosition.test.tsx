// @vitest-environment jsdom

/**
 * useAnchoredPosition lifecycle tests (#331).
 *
 * The shared primitive that Dropdown/Select/TagInput (via usePortalPosition),
 * Tooltip, and Popover all delegate their measure→retry→listen lifecycle to.
 * The five overlays exercise it end-to-end in their own suites; these tests pin
 * the lifecycle contract directly: off-screen until measured, ready after a
 * successful synchronous measure, and reset to off-screen on close.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnchoredPosition, type AnchoredReady } from './useAnchoredPosition'

interface Result extends AnchoredReady {
  top: number
  left: number
}

const OFFSCREEN: Result = { top: -9999, left: -9999, isReady: false }

/** A detached element whose getBoundingClientRect is a fixed stub. */
function stubEl(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return el
}

describe('useAnchoredPosition', () => {
  it('returns the off-screen value while closed (isReady false)', () => {
    const triggerRef = { current: stubEl() }
    const overlayRef = { current: stubEl() }
    const { result } = renderHook(() =>
      useAnchoredPosition<Result>(triggerRef, overlayRef, false, () => ({ top: 1, left: 2 }), OFFSCREEN)
    )
    expect(result.current).toEqual(OFFSCREEN)
  })

  it('measures synchronously on open when both refs are mounted, then resets on close', () => {
    const triggerRef = { current: stubEl() }
    const overlayRef = { current: stubEl() }
    const compute = vi.fn(() => ({ top: 42, left: 7 }))

    const { result, rerender } = renderHook(
      ({ open }) => useAnchoredPosition<Result>(triggerRef, overlayRef, open, compute, OFFSCREEN),
      { initialProps: { open: false } }
    )
    expect(result.current.isReady).toBe(false)

    // Open: the sync-first attempt in useLayoutEffect measures before paint.
    act(() => rerender({ open: true }))
    expect(result.current.isReady).toBe(true)
    expect(result.current.top).toBe(42)
    expect(result.current.left).toBe(7)
    expect(compute).toHaveBeenCalledWith(triggerRef.current, overlayRef.current)

    // Close: reset back to the off-screen value.
    act(() => rerender({ open: false }))
    expect(result.current).toEqual(OFFSCREEN)
  })

  it('stays off-screen while open if a ref is not yet mounted (measure returns false)', () => {
    const triggerRef = { current: null as HTMLElement | null }
    const overlayRef = { current: stubEl() }
    const compute = vi.fn(() => ({ top: 5, left: 5 }))

    const { result } = renderHook(() =>
      useAnchoredPosition<Result>(triggerRef, overlayRef, true, compute, OFFSCREEN)
    )
    // Sync try can't measure (trigger ref null) → compute never runs, stays off-screen.
    expect(compute).not.toHaveBeenCalled()
    expect(result.current.isReady).toBe(false)
  })
})
