/**
 * ThemeProvider key-cleanup test (`task_2c2ebf2f`).
 *
 * `applyTheme` writes `--*` custom properties to `document.documentElement.style`.
 * Before this fix, the Provider tracked no per-application write set, so:
 *
 *   - Swapping theme A → theme B left theme A's `--*` keys on the root.
 *   - Calling `setProductTheme(undefined)` left ALL of the previous theme's
 *     keys on the root.
 *   - Unmounting the Provider left the keys behind too.
 *
 * The fix is a `useRef<Set<string>>` that records every `--*` key written by
 * the most recent `applyTheme` call; the next call diffs old → new and
 * removes anything dropped. On unmount, every tracked key is removed.
 *
 * This test exercises all three transitions on a real Provider via the
 * `useTheme().setProductTheme` API — the same surface a consumer's theme-
 * builder UI would use.
 */

import React from 'react'
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { ProductTheme } from '../tokens'
import { ThemeProvider, useTheme } from './ThemeProvider'

beforeAll(() => {
  // jsdom does not implement matchMedia; ThemeProvider reads it for system theme.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }
})

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-product')
  document.documentElement.removeAttribute('data-theme-preset')
  document.documentElement.removeAttribute('data-tint-chrome')
  localStorage.clear()
})

const THEME_A: ProductTheme = {
  name: 'theme-a',
  tokens: {
    color: {
      'brand-x': '#FF0000', // becomes --color-brand-x
      'brand-y': '#0000FF', // becomes --color-brand-y
    },
  },
}

const THEME_B: ProductTheme = {
  name: 'theme-b',
  tokens: {
    color: {
      'brand-y': '#00FF00', // overlaps with THEME_A — should update, not leak
      'brand-z': '#FF00FF', // becomes --color-brand-z
    },
  },
}

/** A child that exposes `setProductTheme` so the test can trigger the swap. */
function Swapper(): React.JSX.Element {
  const { setProductTheme } = useTheme()
  return (
    <>
      <button onClick={() => setProductTheme(THEME_A)}>A</button>
      <button onClick={() => setProductTheme(THEME_B)}>B</button>
      <button onClick={() => setProductTheme(undefined)}>clear</button>
    </>
  )
}

describe('ThemeProvider applyTheme key cleanup (task_2c2ebf2f)', () => {
  it('writes both keys when theme A is applied', () => {
    render(
      <ThemeProvider disableStorage defaultProductTheme={THEME_A}>
        <div>child</div>
      </ThemeProvider>,
    )

    const style = document.documentElement.style
    expect(style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    expect(style.getPropertyValue('--color-brand-y')).toBe('#0000FF')
  })

  it('removes stale keys when swapping A → B', () => {
    render(
      <ThemeProvider disableStorage defaultProductTheme={THEME_A}>
        <Swapper />
      </ThemeProvider>,
    )

    // Sanity — theme A is applied.
    const style = document.documentElement.style
    expect(style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    expect(style.getPropertyValue('--color-brand-y')).toBe('#0000FF')

    // Swap to theme B.
    fireEvent.click(screen.getByText('B'))

    // The unique-to-A key MUST be gone — this is the leak the fix addresses.
    expect(style.getPropertyValue('--color-brand-x')).toBe('')
    // Overlapping key is rewritten to B's value, not leaked.
    expect(style.getPropertyValue('--color-brand-y')).toBe('#00FF00')
    // New key from B is present.
    expect(style.getPropertyValue('--color-brand-z')).toBe('#FF00FF')
  })

  it('removes all keys when setProductTheme(undefined) is called', () => {
    render(
      <ThemeProvider disableStorage defaultProductTheme={THEME_A}>
        <Swapper />
      </ThemeProvider>,
    )

    const style = document.documentElement.style
    expect(style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    expect(style.getPropertyValue('--color-brand-y')).toBe('#0000FF')

    fireEvent.click(screen.getByText('clear'))

    expect(style.getPropertyValue('--color-brand-x')).toBe('')
    expect(style.getPropertyValue('--color-brand-y')).toBe('')
    // data-product attribute also goes away — sanity check on the existing
    // attribute lifecycle that already worked pre-fix.
    expect(document.documentElement.getAttribute('data-product')).toBe(null)
  })

  it('handles the full A → B → undefined chain without leftovers', () => {
    render(
      <ThemeProvider disableStorage defaultProductTheme={THEME_A}>
        <Swapper />
      </ThemeProvider>,
    )

    const style = document.documentElement.style

    fireEvent.click(screen.getByText('B'))
    // After the swap to B, A's unique key is gone and B's keys are present.
    expect(style.getPropertyValue('--color-brand-x')).toBe('')
    expect(style.getPropertyValue('--color-brand-y')).toBe('#00FF00')
    expect(style.getPropertyValue('--color-brand-z')).toBe('#FF00FF')

    fireEvent.click(screen.getByText('clear'))
    // All of B's keys are now gone too.
    expect(style.getPropertyValue('--color-brand-x')).toBe('')
    expect(style.getPropertyValue('--color-brand-y')).toBe('')
    expect(style.getPropertyValue('--color-brand-z')).toBe('')
  })

  it('removes all written keys on unmount', () => {
    const { unmount } = render(
      <ThemeProvider disableStorage defaultProductTheme={THEME_A}>
        <div>child</div>
      </ThemeProvider>,
    )

    const style = document.documentElement.style
    expect(style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    expect(style.getPropertyValue('--color-brand-y')).toBe('#0000FF')

    unmount()

    expect(style.getPropertyValue('--color-brand-x')).toBe('')
    expect(style.getPropertyValue('--color-brand-y')).toBe('')
  })

  // Post-#384 skeptic (N4) — dev StrictMode double-invokes effects
  // (mount → unmount → mount). The cleanup contract appears safe by analysis
  // but was not test-pinned. This test asserts a swap + unmount still leaves
  // a clean slate when wrapped in <React.StrictMode>. If a future refactor
  // ever stops nulling `appliedKeysRef` in the cleanup return, the second
  // mount of the StrictMode pair would "remember" keys that no longer apply
  // and this test would catch it.
  it('cleanup is correct under React.StrictMode (swap A → B → unmount)', () => {
    const { unmount } = render(
      <React.StrictMode>
        <ThemeProvider disableStorage defaultProductTheme={THEME_A}>
          <Swapper />
        </ThemeProvider>
      </React.StrictMode>,
    )

    const style = document.documentElement.style
    // First-paint under StrictMode: A's keys are present.
    expect(style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    expect(style.getPropertyValue('--color-brand-y')).toBe('#0000FF')

    // Swap to B. Overlapping --color-brand-y updates; unique-to-A
    // --color-brand-x must NOT leak through the StrictMode double-invoke.
    fireEvent.click(screen.getByText('B'))
    expect(style.getPropertyValue('--color-brand-x')).toBe('')
    expect(style.getPropertyValue('--color-brand-y')).toBe('#00FF00')
    expect(style.getPropertyValue('--color-brand-z')).toBe('#FF00FF')

    // Unmount — every key the provider ever wrote should be gone.
    unmount()
    expect(style.getPropertyValue('--color-brand-x')).toBe('')
    expect(style.getPropertyValue('--color-brand-y')).toBe('')
    expect(style.getPropertyValue('--color-brand-z')).toBe('')
  })
})
