// @vitest-environment jsdom

/**
 * useToggle contract tests (#504).
 *
 * Pins the cycle semantics (advance-and-wrap with no argument, jump with one),
 * the boolean default, and the setter's referential stability — including the
 * case that makes stability hard: a caller who passes a FRESH array literal on
 * every render. The setter must stay identical while still cycling through the
 * latest list.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToggle } from './useToggle'

describe('useToggle — boolean default', () => {
  it('starts at false and cycles false → true → false', () => {
    const { result } = renderHook(() => useToggle())
    expect(result.current[0]).toBe(false)

    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)

    act(() => result.current[1]())
    expect(result.current[0]).toBe(false)
  })

  it('jumps to an explicit boolean', () => {
    const { result } = renderHook(() => useToggle())

    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)

    // Setting the value it already holds is a no-op, not an advance.
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)

    act(() => result.current[1](false))
    expect(result.current[0]).toBe(false)
  })
})

describe('useToggle — custom cycles', () => {
  it('advances through the list and wraps at the end', () => {
    const { result } = renderHook(() => useToggle(['light', 'dark', 'system']))
    expect(result.current[0]).toBe('light')

    act(() => result.current[1]())
    expect(result.current[0]).toBe('dark')

    act(() => result.current[1]())
    expect(result.current[0]).toBe('system')

    act(() => result.current[1]())
    expect(result.current[0]).toBe('light') // wrapped
  })

  it('jumps to an explicit value anywhere in the cycle', () => {
    const { result } = renderHook(() => useToggle(['light', 'dark', 'system']))

    act(() => result.current[1]('system'))
    expect(result.current[0]).toBe('system')

    // …and advancing from there resumes the cycle at the right place.
    act(() => result.current[1]())
    expect(result.current[0]).toBe('light')
  })

  it('holds position when handed a value that is not in the cycle', () => {
    const { result } = renderHook(() => useToggle(['a', 'b']))

    act(() => result.current[1]('nope'))
    expect(result.current[0]).toBe('a') // no desync, no crash
  })

  it('supports a single-value cycle (advance is a no-op)', () => {
    const { result } = renderHook(() => useToggle(['only']))

    act(() => result.current[1]())
    expect(result.current[0]).toBe('only')
  })

  it('throws on an empty cycle rather than yielding a phantom value', () => {
    // React logs the render error; silence it so the suite output stays clean.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useToggle<string>([]))).toThrow(/non-empty/)
    spy.mockRestore()
  })
})

describe('useToggle — setter stability', () => {
  it('keeps a stable setter identity across re-renders with a fresh inline array', () => {
    const { result, rerender } = renderHook(({ values }) => useToggle(values), {
      // A new array identity on every render is the common call pattern.
      initialProps: { values: ['a', 'b'] },
    })
    const firstSetter = result.current[1]

    rerender({ values: ['a', 'b'] })
    expect(result.current[1]).toBe(firstSetter)

    act(() => result.current[1]())
    rerender({ values: ['a', 'b'] })
    expect(result.current[1]).toBe(firstSetter)
  })

  it('the stable setter cycles through the LATEST values, not the ones it mounted with', () => {
    const { result, rerender } = renderHook(({ values }) => useToggle(values), {
      initialProps: { values: ['a', 'b'] },
    })

    // Grow the cycle after mount. The setter's identity never changed, so it can
    // only see the new list if it reads it at call time (through the ref).
    rerender({ values: ['a', 'b', 'c'] })

    act(() => result.current[1]())
    expect(result.current[0]).toBe('b')

    act(() => result.current[1]())
    expect(result.current[0]).toBe('c') // would have wrapped to 'a' on a stale list
  })

  it('clamps to the first entry when the cycle shrinks out from under the index', () => {
    const { result, rerender } = renderHook(({ values }) => useToggle(values), {
      initialProps: { values: ['a', 'b', 'c'] },
    })

    act(() => result.current[1]('c')) // index 2
    expect(result.current[0]).toBe('c')

    rerender({ values: ['a'] }) // index 2 no longer exists
    expect(result.current[0]).toBe('a')
  })
})
