// @vitest-environment jsdom

/**
 * useControllableState contract tests (#508).
 *
 * Pins the controlled/uncontrolled semantics the whole state contract rests on:
 * uncontrolled seeds from `defaultValue` and owns its state; controlled never
 * mutates internal state and defers to the consumer via `onChange`; the setter
 * is stable and accepts functional updaters in both modes; `onChange` fires on
 * real changes only.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useControllableState } from './useControllableState'

describe('useControllableState — uncontrolled', () => {
  it('seeds from defaultValue and owns its own state', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useControllableState({ value: undefined, defaultValue: 'a', onChange })
    )
    expect(result.current[0]).toBe('a')

    act(() => result.current[1]('b'))
    expect(result.current[0]).toBe('b')
    // The observer sees the committed change...
    expect(onChange).toHaveBeenCalledWith('b')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('resolves a functional updater against the current value', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useControllableState<number>({ value: undefined, defaultValue: 1, onChange })
    )
    act(() => result.current[1]((prev) => prev + 1))
    act(() => result.current[1]((prev) => prev + 1))
    expect(result.current[0]).toBe(3)
    expect(onChange).toHaveBeenLastCalledWith(3)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('starts undefined when no defaultValue is given', () => {
    const { result } = renderHook(() =>
      useControllableState<string>({ value: undefined, defaultValue: undefined })
    )
    expect(result.current[0]).toBeUndefined()
  })

  it('does not fire onChange on mount', () => {
    const onChange = vi.fn()
    renderHook(() =>
      useControllableState({ value: undefined, defaultValue: 'a', onChange })
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('useControllableState — controlled', () => {
  it('reflects the controlled value and never mutates internal state', () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useControllableState({ value, defaultValue: 'x', onChange }),
      { initialProps: { value: 'a' } }
    )
    expect(result.current[0]).toBe('a')

    // Consumer-owned: calling setValue notifies but does NOT change value until
    // the parent flips the prop.
    act(() => result.current[1]('b'))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(result.current[0]).toBe('a') // unchanged — parent hasn't updated

    // Parent flips the prop → value follows.
    rerender({ value: 'b' })
    expect(result.current[0]).toBe('b')
  })

  it('resolves a functional updater against the current controlled prop', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useControllableState<number>({ value: 5, defaultValue: 0, onChange })
    )
    act(() => result.current[1]((prev) => prev + 10))
    expect(onChange).toHaveBeenCalledWith(15)
  })

  it('does not fire onChange for a no-op set (resolved === current)', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useControllableState({ value: 'a', defaultValue: undefined, onChange })
    )
    act(() => result.current[1]('a'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores defaultValue entirely when controlled', () => {
    const { result } = renderHook(() =>
      useControllableState({ value: 'controlled', defaultValue: 'ignored' })
    )
    expect(result.current[0]).toBe('controlled')
  })
})

describe('useControllableState — explicit `controlled` override', () => {
  it('treats value===undefined as CONTROLLED when controlled=true (undefined-sentinel fix)', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useControllableState<string | undefined>({
        value: undefined,
        defaultValue: 'seed',
        onChange,
        controlled: true,
      })
    )
    // Controlled: reflects the (undefined) controlled value, NOT the default seed.
    expect(result.current[0]).toBeUndefined()
    // setValue notifies but does not write internal state (consumer owns it).
    act(() => result.current[1]('x'))
    expect(onChange).toHaveBeenCalledWith('x')
    expect(result.current[0]).toBeUndefined() // still undefined — parent hasn't updated
  })

  it('treats a defined value as UNCONTROLLED when controlled=false', () => {
    const { result } = renderHook(() =>
      useControllableState<string>({
        value: 'ignored',
        defaultValue: 'seed',
        controlled: false,
      })
    )
    expect(result.current[0]).toBe('seed') // uncontrolled — ignores the value prop
    act(() => result.current[1]('next'))
    expect(result.current[0]).toBe('next') // owns its state
  })

  it('honors controlled=false over a defined value (uses ?? not ||)', () => {
    const { result } = renderHook(() =>
      useControllableState({ value: 'v', defaultValue: 'd', controlled: false })
    )
    expect(result.current[0]).toBe('d')
  })
})

describe('useControllableState — setter stability', () => {
  it('keeps a stable setter identity across re-renders with new inline onChange', () => {
    const { result, rerender } = renderHook(
      ({ onChange }) =>
        useControllableState({ value: undefined, defaultValue: 0, onChange }),
      { initialProps: { onChange: () => {} } }
    )
    const firstSetter = result.current[1]
    rerender({ onChange: () => {} }) // new inline callback identity
    expect(result.current[1]).toBe(firstSetter)
  })

  it('the stable setter still calls the latest onChange', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(
      ({ onChange }) => useControllableState({ value: 3, defaultValue: 0, onChange }),
      { initialProps: { onChange: first } }
    )
    rerender({ onChange: second })
    act(() => result.current[1](9))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(9)
  })
})
