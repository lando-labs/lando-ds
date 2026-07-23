/**
 * Switch Component Tests
 *
 * Sprint 12 (#14) — coverage backfill for form components.
 *
 * Switch is a themed toggle built on <input type="checkbox" role="switch">.
 * Its API is very similar to Checkbox: onChange has a `(checked: boolean)`
 * signature, not a ChangeEvent.
 *
 * Covers:
 *   - Label rendering + htmlFor wiring
 *   - role=switch + aria-checked communicate state to AT
 *   - Controlled / uncontrolled modes
 *   - onChange signature `(checked: boolean) => void`
 *   - disabled prevents change
 *   - size variant does not break accessibility
 *   - name attribute forwarded
 *   - jest-axe a11y smoke
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { Switch } from './Switch'
import { resolveTokenHex } from '../../test/contrast-helpers'
import { contrastRatio, AA_LARGE } from '../../tokens/contrast'

describe('Switch', () => {
  it('renders with label', () => {
    render(<Switch label="Enable notifications" />)
    expect(screen.getByLabelText('Enable notifications')).toBeInTheDocument()
  })

  it('exposes role=switch to assistive technology', () => {
    render(<Switch label="Dark mode" />)
    // role=switch (not role=checkbox) — a screen reader will announce
    // "switch" instead of "checkbox", which is the correct semantic.
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('reflects controlled `checked` state via aria-checked + DOM checked', () => {
    const { rerender } = render(
      <Switch label="Sync" checked={false} onChange={() => {}} />
    )
    const input = screen.getByRole('switch') as HTMLInputElement
    expect(input.checked).toBe(false)
    expect(input).toHaveAttribute('aria-checked', 'false')

    rerender(<Switch label="Sync" checked={true} onChange={() => {}} />)
    expect(input.checked).toBe(true)
    expect(input).toHaveAttribute('aria-checked', 'true')
  })

  it('supports uncontrolled mode via defaultChecked', () => {
    render(<Switch label="Auto-save" defaultChecked />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('calls onChange with boolean (NOT ChangeEvent) when toggled', () => {
    // Switch.tsx line 24: `onChange?: (checked: boolean) => void`
    const handleChange = vi.fn()
    render(<Switch label="Toggle" onChange={handleChange} />)

    fireEvent.click(screen.getByRole('switch'))
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
    expect(typeof handleChange.mock.calls[0]![0]).toBe('boolean') // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present
  })

  it('does not fire onChange when disabled (user-event respects DOM disabled)', async () => {
    // user-event matches real-browser behavior: clicks on disabled inputs
    // are suppressed before onChange fires.
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Switch label="Locked" disabled onChange={handleChange} />)
    const input = screen.getByRole('switch')
    expect(input).toBeDisabled()
    await user.click(input)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('does not fire onChange when disabled even with fireEvent.click (#76 guard)', () => {
    // JSDOM's fireEvent.click bypasses the native disabled guard and
    // dispatches change events anyway. This test would have failed before
    // the explicit `if (disabled) return` guard in handleChange.
    const handleChange = vi.fn()
    render(<Switch label="Locked" disabled onChange={handleChange} />)
    const input = screen.getByRole('switch')
    expect(input).toBeDisabled()
    fireEvent.click(input)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('renders all three size variants', () => {
    // Smoke — size just swaps a CSS Module class; we assert the component
    // renders and remains interactive at every size.
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      const { unmount } = render(
        <Switch label={`Size ${size}`} size={size} />
      )
      expect(screen.getByRole('switch')).toBeInTheDocument()
      unmount()
    }
  })

  it('forwards `name` attribute for FormData / Server Actions', () => {
    render(<Switch label="Notifications" name="notifications_enabled" />)
    expect(screen.getByRole('switch')).toHaveAttribute(
      'name',
      'notifications_enabled'
    )
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(<Switch label="Enable experimental features" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  // #12 / #72 — off-state (unchecked) track contrast. Reuses the shared
  // `resolveTokenHex` helper from Button's #9 fix (jsdom does not resolve
  // `@layer` order or reliably evaluate `color-mix()`/`oklch()` custom-
  // property cascades, so this asserts against the REAL tokens.css values
  // rather than rendering + `getComputedStyle`). Mirrors Switch.module.css's
  // `.track` (base, fixed by #72) and `[data-theme='dark'] .track` (#12) rules.
  describe('off-track contrast (#12, #72)', () => {
    it('dark off-track clears SC 1.4.11 (≥3:1) against the page surface', () => {
      // [data-theme='dark'] .track { background-color: var(--color-border-emphasis) }
      const track = resolveTokenHex('--color-border-emphasis', 'dark')
      const surface = resolveTokenHex('--color-surface', 'dark')
      // Measured 4.15:1 (was 1.14:1 via --color-surface-elevated pre-fix —
      // track and page surface were nearly indistinguishable).
      expect(contrastRatio(track, surface)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('dark off-track clears ≥3:1 against an elevated/card surface (the nested case)', () => {
      // Switch is commonly nested in a Card, which paints --color-surface-elevated
      // rather than the page --color-surface — the acceptance criteria calls
      // this out explicitly as the surface the track must still pop off of.
      const track = resolveTokenHex('--color-border-emphasis', 'dark')
      const elevated = resolveTokenHex('--color-surface-elevated', 'dark')
      // Measured 3.64:1.
      expect(contrastRatio(track, elevated)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('dark thumb is distinguishable from the off-track (≥3:1)', () => {
      // .thumb { background-color: var(--color-surface) } in BOTH themes —
      // the thumb intentionally matches the page surface and relies on the
      // track color (not its own) to read as a separate shape. Once the
      // track clears AA_LARGE against --color-surface (asserted above), the
      // thumb — being literally --color-surface — necessarily clears the
      // same ratio against the track.
      const track = resolveTokenHex('--color-border-emphasis', 'dark')
      const thumb = resolveTokenHex('--color-surface', 'dark')
      expect(contrastRatio(thumb, track)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('#72 — light off-track clears SC 1.4.11 (≥3:1) against the page surface and page background', () => {
      // .track { background-color: var(--color-border-emphasis) } (light default)
      const track = resolveTokenHex('--color-border-emphasis', 'light')
      const surface = resolveTokenHex('--color-surface', 'light')
      const pageBg = resolveTokenHex('--color-neutral-50', 'light')
      // Measured 3.61:1 vs --color-surface, 3.45:1 vs --color-neutral-50
      // (was 1.525:1 / 1.457:1 via --color-border-default pre-fix — the
      // acceptance criteria's own quoted 1.53:1 failure).
      expect(contrastRatio(track, surface)).toBeGreaterThanOrEqual(AA_LARGE)
      expect(contrastRatio(track, pageBg)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('#72 — light off-track clears ≥3:1 against an elevated/card surface (the nested case)', () => {
      const track = resolveTokenHex('--color-border-emphasis', 'light')
      const elevated = resolveTokenHex('--color-surface-elevated', 'light')
      // Measured 3.29:1.
      expect(contrastRatio(track, elevated)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('#72 — light thumb is distinguishable from the off-track (≥3:1), not relying solely on the shadow', () => {
      // .thumb { background-color: var(--color-surface) } in BOTH themes —
      // once the track clears AA_LARGE against --color-surface (asserted
      // above), the thumb — being literally --color-surface — necessarily
      // clears the same ratio against the track, independent of box-shadow.
      const track = resolveTokenHex('--color-border-emphasis', 'light')
      const thumb = resolveTokenHex('--color-surface', 'light')
      expect(contrastRatio(thumb, track)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('checked/on-state track is untouched by #12/#72 (regression lock)', () => {
      // The fixes only changed the OFF-state `.track` background (base rule
      // for #72, the `[data-theme='dark']` override for #12) and the
      // (light) hover step's source token; the checked/on-state rule
      // (background: var(--color-primary), in both themes) is unmodified.
      // Locks the current measured on-state values — guards against an
      // accidental leak of the off-track fixes into the checked rule. Not
      // asserted against an AA threshold: on-state contrast (light 6.00:1,
      // dark 2.96:1) is a separate, out-of-scope question from #12/#72,
      // which are specifically about the OFF-state track.
      const onTrackLight = resolveTokenHex('--color-primary', 'light')
      const onTrackDark = resolveTokenHex('--color-primary', 'dark')
      const lightSurface = resolveTokenHex('--color-surface', 'light')
      const darkSurface = resolveTokenHex('--color-surface', 'dark')
      expect(contrastRatio(onTrackLight, lightSurface)).toBeCloseTo(6.005, 2)
      expect(contrastRatio(onTrackDark, darkSurface)).toBeCloseTo(2.956, 2)
    })
  })
})
