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
})
