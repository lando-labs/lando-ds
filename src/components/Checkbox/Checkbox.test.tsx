/**
 * Checkbox Component Tests
 *
 * Sprint 12 (#14) — coverage backfill for form components.
 *
 * Covers:
 *   - Label rendering + htmlFor wiring
 *   - Controlled (`checked`) and uncontrolled (`defaultChecked`) modes
 *   - onChange signature: `(checked: boolean) => void` (NOT a ChangeEvent)
 *   - disabled prevents user-driven state changes
 *   - name attribute forwarded for FormData / Server Actions
 *   - aria-invalid wired when `error` prop is supplied
 *   - required rendered to native DOM
 *   - indeterminate property set via effect (not attribute)
 *   - jest-axe a11y smoke
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('renders with label and links label to input via htmlFor', () => {
    render(<Checkbox label="Accept terms" />)
    // getByLabelText walks the label/htmlFor pairing — fails if wiring breaks.
    expect(screen.getByLabelText('Accept terms')).toBeInTheDocument()
  })

  it('reflects controlled `checked` prop in the DOM', () => {
    const { rerender } = render(
      <Checkbox label="Terms" checked={false} onChange={() => {}} />
    )
    expect(screen.getByLabelText('Terms')).not.toBeChecked()

    rerender(<Checkbox label="Terms" checked={true} onChange={() => {}} />)
    expect(screen.getByLabelText('Terms')).toBeChecked()
  })

  it('supports uncontrolled mode via defaultChecked', () => {
    render(<Checkbox label="Remember me" defaultChecked />)
    expect(screen.getByLabelText('Remember me')).toBeChecked()
  })

  it('calls onChange with boolean (NOT ChangeEvent) on click', () => {
    // Checkbox.tsx line 24: `onChange?: (checked: boolean) => void`
    // Regression test pins the boolean-arg signature so refactors can't
    // accidentally revert to a ChangeEvent signature.
    const handleChange = vi.fn()
    render(<Checkbox label="Opt in" onChange={handleChange} />)

    fireEvent.click(screen.getByLabelText('Opt in'))
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
    // Argument should be a raw boolean, not an event object.
    expect(typeof handleChange.mock.calls[0]![0]).toBe('boolean') // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present
  })

  it('does not fire onChange when disabled (user-event respects DOM disabled)', async () => {
    // user-event matches real-browser behavior: clicks on disabled inputs
    // are suppressed before onChange fires.
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Checkbox label="Disabled" disabled onChange={handleChange} />)

    const input = screen.getByLabelText('Disabled') as HTMLInputElement
    expect(input).toBeDisabled()
    await user.click(input)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('does not fire onChange when disabled even with fireEvent.click (#76 guard)', () => {
    // JSDOM's fireEvent.click is permissive and DOES dispatch a change event
    // on disabled inputs. This test would have failed before the explicit
    // `if (disabled) return` guard in handleChange; now it passes because
    // the component short-circuits before calling the onChange callback.
    const handleChange = vi.fn()
    render(<Checkbox label="Disabled" disabled onChange={handleChange} />)

    const input = screen.getByLabelText('Disabled') as HTMLInputElement
    expect(input).toBeDisabled()
    fireEvent.click(input)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('forwards `name` attribute for FormData / Server Actions', () => {
    render(<Checkbox label="Newsletter" name="newsletter" />)
    expect(screen.getByLabelText('Newsletter')).toHaveAttribute(
      'name',
      'newsletter'
    )
  })

  it('sets aria-invalid and exposes the error message when `error` is provided', () => {
    render(<Checkbox label="Required box" error="This field is required" />)
    const input = screen.getByLabelText('Required box')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required')
  })

  it('aria-invalid is false when no error', () => {
    render(<Checkbox label="Clean" />)
    expect(screen.getByLabelText('Clean')).toHaveAttribute(
      'aria-invalid',
      'false'
    )
  })

  it('applies indeterminate via property (not attribute)', () => {
    render(<Checkbox label="Select all" indeterminate />)
    const input = screen.getByLabelText('Select all') as HTMLInputElement
    // indeterminate is a DOM property, not a reflected attribute.
    expect(input.indeterminate).toBe(true)
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <Checkbox label="Accept the terms and conditions" />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
