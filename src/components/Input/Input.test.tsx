/**
 * Input Component Tests
 *
 * Sprint 12 (#14) — expanded beyond #13 regression checks. Adds coverage
 * for controlled value pattern, aria-invalid/aria-required wiring, password
 * toggle state transition, clearable behavior, and jest-axe a11y.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Input } from './Input'

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows error message (role=alert) and sets aria-invalid when error prop is provided', () => {
    render(<Input label="Username" error="Username is required" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Username is required')
    expect(screen.getByLabelText('Username')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })

  it('shows helper text when provided and no error', () => {
    render(<Input label="Password" helperText="At least 8 characters" />)
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
  })

  it('suppresses helperText when error is present (error wins)', () => {
    render(
      <Input
        label="Email"
        helperText="We'll never share your email"
        error="Invalid email"
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email')
    expect(
      screen.queryByText("We'll never share your email")
    ).not.toBeInTheDocument()
  })

  it('marks input as required when required prop is true', () => {
    render(<Input label="Email" required />)
    expect(screen.getByLabelText(/Email/)).toBeRequired()
  })

  it('supports controlled value + onChange (ChangeEvent signature)', () => {
    // Input.tsx spreads a native onChange (ChangeEvent), in contrast to
    // Checkbox/Switch/Textarea which use value-only signatures. This test
    // pins the ChangeEvent contract.
    const handleChange = vi.fn()
    const { rerender } = render(
      <Input label="Name" value="Ada" onChange={handleChange} />
    )
    const input = screen.getByLabelText('Name') as HTMLInputElement
    expect(input.value).toBe('Ada')

    fireEvent.change(input, { target: { value: 'Grace' } })
    expect(handleChange).toHaveBeenCalledTimes(1)
    // First arg should be a ChangeEvent with a target
    expect(handleChange.mock.calls[0]![0]).toHaveProperty('target') // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present

    rerender(<Input label="Name" value="Grace" onChange={handleChange} />)
    expect(input.value).toBe('Grace')
  })

  it('password toggle flips the input type between password and text', () => {
    render(<Input label="Password" type="password" />)
    const input = screen.getByLabelText('Password') as HTMLInputElement
    expect(input.type).toBe('password')

    const toggle = screen.getByRole('button', { name: /show password/i })
    fireEvent.click(toggle)

    expect(input.type).toBe('text')
    // After toggle the aria-label flips to "Hide password"
    expect(
      screen.getByRole('button', { name: /hide password/i })
    ).toBeInTheDocument()
  })

  it('clear button fires onClear callback', () => {
    const handleClear = vi.fn()
    render(
      <Input
        label="Search"
        value="hello"
        onChange={() => {}}
        onClear={handleClear}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /clear input/i }))
    expect(handleClear).toHaveBeenCalledTimes(1)
  })

  it('does not render clear button when value is empty', () => {
    render(
      <Input label="Search" value="" onChange={() => {}} onClear={vi.fn()} />
    )
    // Input.tsx line 84: showClearButton requires onClear + truthy value
    expect(
      screen.queryByRole('button', { name: /clear input/i })
    ).not.toBeInTheDocument()
  })

  it('renders left and right icon slots', () => {
    render(
      <Input
        label="Search"
        leftIcon={<span data-testid="left">L</span>}
        rightIcon={<span data-testid="right">R</span>}
      />
    )
    expect(screen.getByTestId('left')).toBeInTheDocument()
    expect(screen.getByTestId('right')).toBeInTheDocument()
  })

  // A11y regression: issue #13. The password visibility toggle must be
  // keyboard reachable — previously it was rendered with tabIndex={-1},
  // which hid it from Tab traversal entirely.
  it('password visibility toggle is keyboard-focusable (#13)', () => {
    render(<Input label="Password" type="password" />)
    const toggle = screen.getByRole('button', { name: /show password/i })
    expect(toggle).toBeInTheDocument()
    expect(toggle).not.toHaveAttribute('tabIndex', '-1')
    // aria-pressed communicates the toggle state
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('clear button is keyboard-focusable when onClear is provided (#13)', () => {
    render(<Input label="Query" value="hello" onChange={() => {}} onClear={vi.fn()} />)
    const clear = screen.getByRole('button', { name: /clear input/i })
    expect(clear).toBeInTheDocument()
    expect(clear).not.toHaveAttribute('tabIndex', '-1')
  })

  /* -------------------------------------------------------------------- *
   *  Sprint 30 (#240) — RN parity: `showCharacterCount` alias
   *
   *  The web Input historically uses `showCharCount`; the RN Input uses
   *  `showCharacterCount`. The alias accepts both so consumers writing
   *  cross-platform code don't have to fork the prop name per platform.
   *  Behavior is OR'd: if either prop is true, the counter renders.
   * -------------------------------------------------------------------- */
  it('renders character counter when showCharCount + maxLength are set (existing)', () => {
    render(
      <Input
        label="Bio"
        maxLength={100}
        showCharCount
        value="hello"
        onChange={() => {}}
      />
    )
    expect(screen.getByText('5/100')).toBeInTheDocument()
  })

  it('renders character counter when showCharacterCount + maxLength are set (RN-parity alias)', () => {
    render(
      <Input
        label="Bio"
        maxLength={100}
        showCharacterCount
        value="hello"
        onChange={() => {}}
      />
    )
    expect(screen.getByText('5/100')).toBeInTheDocument()
  })

  it('renders counter when both showCharCount and showCharacterCount are true', () => {
    // Both flags supplied — they agree, counter renders, no warning needed.
    render(
      <Input
        label="Bio"
        maxLength={50}
        showCharCount
        showCharacterCount
        value="hi"
        onChange={() => {}}
      />
    )
    expect(screen.getByText('2/50')).toBeInTheDocument()
  })

  it('does not render counter when neither flag is true (regression guard)', () => {
    render(<Input label="Open" maxLength={100} value="abc" onChange={() => {}} />)
    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument()
  })

  it('updates counter as the user types via the showCharacterCount alias', () => {
    render(
      <Input
        label="Tweet"
        maxLength={280}
        showCharacterCount
      />
    )
    const input = screen.getByLabelText('Tweet') as HTMLInputElement
    expect(screen.getByText('0/280')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'hello world' } })
    expect(screen.getByText('11/280')).toBeInTheDocument()
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <div>
        <Input label="Email address" type="email" required />
        <Input label="Password" type="password" />
        <Input label="Notes" helperText="Optional" />
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
