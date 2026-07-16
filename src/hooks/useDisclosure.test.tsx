// @vitest-environment jsdom

/**
 * useDisclosure contract tests (#504).
 *
 * Pins the two promises the hook makes: the four operations behave (open, close,
 * toggle, set, seeded from `initial`), and every handler — plus the object
 * holding them — is referentially STABLE across re-renders, which is what lets a
 * consumer pass them to a memoized child. The double-toggle test is the one that
 * would catch a `toggle` that closed over `isOpen` instead of using a functional
 * updater.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDisclosure } from './useDisclosure'

describe('useDisclosure — behavior', () => {
  it('defaults to closed', () => {
    const { result } = renderHook(() => useDisclosure())
    expect(result.current[0]).toBe(false)
  })

  it('seeds from `initial`', () => {
    const { result } = renderHook(() => useDisclosure(true))
    expect(result.current[0]).toBe(true)
  })

  it('opens, closes, and is idempotent', () => {
    const { result } = renderHook(() => useDisclosure())

    act(() => result.current[1].open())
    expect(result.current[0]).toBe(true)

    // Opening an open disclosure is a no-op, not a toggle.
    act(() => result.current[1].open())
    expect(result.current[0]).toBe(true)

    act(() => result.current[1].close())
    expect(result.current[0]).toBe(false)

    act(() => result.current[1].close())
    expect(result.current[0]).toBe(false)
  })

  it('toggles', () => {
    const { result } = renderHook(() => useDisclosure())

    act(() => result.current[1].toggle())
    expect(result.current[0]).toBe(true)

    act(() => result.current[1].toggle())
    expect(result.current[0]).toBe(false)
  })

  it('sets an explicit value', () => {
    const { result } = renderHook(() => useDisclosure())

    act(() => result.current[1].set(true))
    expect(result.current[0]).toBe(true)

    act(() => result.current[1].set(false))
    expect(result.current[0]).toBe(false)
  })

  it('toggles twice in one commit without going stale (functional updater)', () => {
    const { result } = renderHook(() => useDisclosure())

    // Both calls land in the same batch. A `toggle` that closed over `isOpen`
    // would read `false` twice and settle on `true`; a functional updater
    // correctly flips false → true → false.
    act(() => {
      result.current[1].toggle()
      result.current[1].toggle()
    })
    expect(result.current[0]).toBe(false)
  })
})

describe('useDisclosure — referential stability', () => {
  it('keeps every handler identity stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useDisclosure())
    const first = result.current[1]

    rerender()
    act(() => result.current[1].open()) // a state change, not just a re-render
    rerender()

    const latest = result.current[1]
    expect(latest.open).toBe(first.open)
    expect(latest.close).toBe(first.close)
    expect(latest.toggle).toBe(first.toggle)
    expect(latest.set).toBe(first.set)
  })

  it('keeps the handlers object itself stable (safe to pass to a memoized child)', () => {
    const { result, rerender } = renderHook(() => useDisclosure())
    const first = result.current[1]

    rerender()
    expect(result.current[1]).toBe(first)

    act(() => result.current[1].toggle())
    expect(result.current[1]).toBe(first)
  })
})
