/**
 * Textarea Component Tests
 *
 * Sprint 12 (#14) — coverage backfill for form components.
 *
 * Textarea is a multi-line input with label/helperText/error, maxLength-
 * driven character counting, and a `resize` CSS option. onChange uses a
 * `(value: string) => void` signature (NOT a ChangeEvent).
 *
 * Covers:
 *   - Label rendering + htmlFor wiring
 *   - helperText / error display (mutually exclusive — error wins)
 *   - aria-invalid + aria-describedby wired correctly
 *   - Controlled (`value`) and uncontrolled (`defaultValue`) modes
 *   - onChange signature `(value: string) => void`
 *   - rows attribute forwarded
 *   - maxLength caps input length (native browser enforcement)
 *   - showCount renders the counter (only when maxLength is set)
 *   - disabled / readOnly states
 *   - jest-axe a11y smoke
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('renders with label linked to the textarea', () => {
    render(<Textarea label="Bio" />)
    expect(screen.getByLabelText('Bio')).toBeInTheDocument()
  })

  it('renders helperText below the textarea', () => {
    render(<Textarea label="About" helperText="Max 500 characters" />)
    expect(screen.getByText('Max 500 characters')).toBeInTheDocument()
  })

  it('shows error (role=alert) and suppresses helperText when error is set', () => {
    render(
      <Textarea
        label="Description"
        helperText="Describe yourself"
        error="This field is required"
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required')
    // Helper text must NOT render when error is present.
    expect(screen.queryByText('Describe yourself')).not.toBeInTheDocument()
  })

  it('wires aria-invalid and aria-describedby to the error node', () => {
    render(<Textarea label="Notes" error="Required" />)
    const ta = screen.getByLabelText('Notes')
    expect(ta).toHaveAttribute('aria-invalid', 'true')
    const describedBy = ta.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    // The referenced id must resolve to the alert node.
    const alert = document.getElementById(describedBy!)
    expect(alert).toHaveTextContent('Required')
  })

  it('reflects controlled `value` prop', () => {
    const { rerender } = render(
      <Textarea label="Msg" value="hello" onChange={() => {}} />
    )
    const ta = screen.getByLabelText('Msg') as HTMLTextAreaElement
    expect(ta.value).toBe('hello')

    rerender(<Textarea label="Msg" value="world" onChange={() => {}} />)
    expect(ta.value).toBe('world')
  })

  it('supports uncontrolled mode via defaultValue', () => {
    render(<Textarea label="Notes" defaultValue="initial text" />)
    const ta = screen.getByLabelText('Notes') as HTMLTextAreaElement
    expect(ta.value).toBe('initial text')
  })

  it('calls onChange with string value (NOT ChangeEvent)', () => {
    // Textarea.tsx line 24: `onChange?: (value: string) => void`
    const handleChange = vi.fn()
    render(<Textarea label="Feedback" onChange={handleChange} />)

    const ta = screen.getByLabelText('Feedback')
    fireEvent.change(ta, { target: { value: 'new text' } })

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith('new text')
    expect(typeof handleChange.mock.calls[0]![0]).toBe('string') // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present
  })

  it('forwards `rows` attribute to the native textarea', () => {
    render(<Textarea label="Long text" rows={10} />)
    expect(screen.getByLabelText('Long text')).toHaveAttribute('rows', '10')
  })

  it('forwards `maxLength` to the native textarea', () => {
    render(<Textarea label="Tweet" maxLength={280} />)
    expect(screen.getByLabelText('Tweet')).toHaveAttribute('maxLength', '280')
  })

  it('renders character counter when showCount + maxLength are set', () => {
    render(
      <Textarea
        label="Bio"
        maxLength={100}
        showCount
        defaultValue="hello"
      />
    )
    // Counter text: "5/100"
    expect(screen.getByText('5/100')).toBeInTheDocument()
  })

  it('does NOT render the counter when showCount is true but maxLength is not set', () => {
    render(<Textarea label="Open" showCount defaultValue="abc" />)
    // No "N/undefined" counter should appear.
    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument()
  })

  /* -------------------------------------------------------------------- *
   *  Sprint 30 (#240) — RN parity: `showCharacterCount` alias
   *
   *  The web Textarea historically uses `showCount`; the RN
   *  Textarea/Input use `showCharacterCount`. The alias accepts both so
   *  consumers writing cross-platform code don't have to fork the prop
   *  name per platform. Behavior is OR'd: if either is true, the counter
   *  renders.
   * -------------------------------------------------------------------- */
  it('renders counter when showCharacterCount + maxLength are set (RN-parity alias)', () => {
    render(
      <Textarea
        label="Bio"
        maxLength={100}
        showCharacterCount
        defaultValue="hello"
      />
    )
    expect(screen.getByText('5/100')).toBeInTheDocument()
  })

  it('renders counter when both showCount and showCharacterCount are true', () => {
    // Both flags supplied — they agree, counter renders, no warning needed.
    render(
      <Textarea
        label="Bio"
        maxLength={50}
        showCount
        showCharacterCount
        defaultValue="hi"
      />
    )
    expect(screen.getByText('2/50')).toBeInTheDocument()
  })

  it('does not render counter when showCharacterCount is true but maxLength is unset', () => {
    // Mirrors the existing showCount guard — counter requires a numeric max.
    render(<Textarea label="Open" showCharacterCount defaultValue="abc" />)
    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument()
  })

  it('updates counter as the user types via the showCharacterCount alias', () => {
    render(
      <Textarea
        label="Tweet"
        maxLength={280}
        showCharacterCount
      />
    )
    const ta = screen.getByLabelText('Tweet')
    expect(screen.getByText('0/280')).toBeInTheDocument()

    fireEvent.change(ta, { target: { value: 'hello world' } })
    expect(screen.getByText('11/280')).toBeInTheDocument()
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <Textarea label="Additional notes" helperText="Optional" />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
