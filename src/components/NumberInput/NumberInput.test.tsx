/**
 * NumberInput Component Tests
 *
 * Sprint 54 (#309) — Lane B of v0.33.0. Covers controlled/uncontrolled
 * patterns, stepper interactions (click + keyboard), min/max clamping,
 * precision rounding, allowNegative rejection, paste validation, undefined
 * emission on clear (#328 convention), NaN guards, and ARIA spinbutton
 * semantics.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { NumberInput } from './NumberInput'

describe('NumberInput', () => {
  /* -------------------------------------------------------------- *
   *  Rendering & basic props
   * -------------------------------------------------------------- */

  it('renders with label and exposes spinbutton role', () => {
    render(<NumberInput label="Quantity" defaultValue={5} />)
    const input = screen.getByRole('spinbutton', { name: 'Quantity' })
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('5')
  })

  it('renders with defaultValue (uncontrolled) and fires onChange', () => {
    const onChange = vi.fn()
    render(<NumberInput label="N" defaultValue={3} onChange={onChange} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('3')

    fireEvent.change(input, { target: { value: '7' } })
    expect(onChange).toHaveBeenLastCalledWith(7)
  })

  it('renders with controlled value and reflects external updates', () => {
    const { rerender } = render(
      <NumberInput label="N" value={10} onChange={() => {}} />
    )
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('10')

    rerender(<NumberInput label="N" value={42} onChange={() => {}} />)
    expect(input.value).toBe('42')
  })

  /* -------------------------------------------------------------- *
   *  Steppers (click)
   * -------------------------------------------------------------- */

  it('increment button steps up by step', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        step={2}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))
    expect(onChange).toHaveBeenLastCalledWith(7)
  })

  it('decrement button steps down by step', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        step={2}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('hides steppers when showSteppers=false', () => {
    render(
      <NumberInput label="N" defaultValue={1} showSteppers={false} />
    )
    expect(
      screen.queryByRole('button', { name: 'Increment' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Decrement' })
    ).not.toBeInTheDocument()
  })

  it('disables increment at max and decrement at min', () => {
    render(
      <NumberInput label="N" defaultValue={10} min={0} max={10} />
    )
    expect(screen.getByRole('button', { name: 'Increment' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrement' })).not.toBeDisabled()
  })

  /* -------------------------------------------------------------- *
   *  Keyboard
   * -------------------------------------------------------------- */

  it('ArrowUp increments by step', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        step={1}
        onChange={onChange}
      />
    )
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(6)
  })

  it('ArrowDown decrements by step', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        step={1}
        onChange={onChange}
      />
    )
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('Shift+ArrowUp increments by step * 10', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={0}
        step={2}
        onChange={onChange}
      />
    )
    fireEvent.keyDown(screen.getByRole('spinbutton'), {
      key: 'ArrowUp',
      shiftKey: true,
    })
    expect(onChange).toHaveBeenLastCalledWith(20)
  })

  it('Shift+ArrowDown decrements by step * 10', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={50}
        step={1}
        onChange={onChange}
      />
    )
    fireEvent.keyDown(screen.getByRole('spinbutton'), {
      key: 'ArrowDown',
      shiftKey: true,
    })
    expect(onChange).toHaveBeenLastCalledWith(40)
  })

  it('PageUp / PageDown step by step * 10', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={0}
        step={1}
        onChange={onChange}
      />
    )
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'PageUp' })
    expect(onChange).toHaveBeenLastCalledWith(10)

    onChange.mockClear()
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'PageDown' })
    // PageDown was applied to the most recently *committed* value; in
    // uncontrolled mode that's 10, so result is 0.
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  /* -------------------------------------------------------------- *
   *  Clamping
   * -------------------------------------------------------------- */

  it('clamps to min when stepping below min', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={1}
        min={0}
        step={5}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('clamps to max when stepping above max', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={99}
        max={100}
        step={5}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))
    expect(onChange).toHaveBeenLastCalledWith(100)
  })

  it('clamps typed-and-blurred value below min up to min', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        min={0}
        max={10}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '-50' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(0)
    expect(input.value).toBe('0')
  })

  it('clamps typed-and-blurred value above max down to max', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        min={0}
        max={10}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(10)
    expect(input.value).toBe('10')
  })

  /* -------------------------------------------------------------- *
   *  Precision
   * -------------------------------------------------------------- */

  it('rounds to precision on blur (display + onChange)', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="Price"
        defaultValue={0}
        precision={2}
        step={0.01}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1.005' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(1.01)
    expect(input.value).toBe('1.01')
  })

  it('integer precision (default) strips decimals on blur', () => {
    const onChange = vi.fn()
    render(<NumberInput label="N" defaultValue={0} onChange={onChange} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '3.7' } })
    // Decimal char is stripped at parse-time for precision=0, so the parsed
    // typed value is 37, not 3 or 4. Blur clamps + formats.
    fireEvent.blur(input)
    expect(input.value).toBe('37')
  })

  /* -------------------------------------------------------------- *
   *  allowNegative
   * -------------------------------------------------------------- */

  it('allowNegative=false rejects the `-` keypress', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        allowNegative={false}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('spinbutton')
    const event = fireEvent.keyDown(input, { key: '-' })
    // fireEvent returns whether the event's default was NOT prevented.
    // We preventDefault'd, so this should be false.
    expect(event).toBe(false)
  })

  it('allowNegative=false clamps pasted negative on blur', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        allowNegative={false}
        min={2}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    // Simulate parsed negative making it into the field via stepping or
    // programmatic change; on blur the clamp should hoist it to `min`.
    fireEvent.change(input, { target: { value: '-99' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(2)
    expect(input.value).toBe('2')
  })

  it('allowNegative=false with no min clamps negatives to 0', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        allowNegative={false}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '-50' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  /* -------------------------------------------------------------- *
   *  Paste
   * -------------------------------------------------------------- */

  it('rejects an unparseable paste (e.g. "abc") gracefully', () => {
    const onChange = vi.fn()
    render(<NumberInput label="N" defaultValue={5} onChange={onChange} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement

    const evt = fireEvent.paste(input, {
      clipboardData: { getData: () => 'abc' },
    })
    // preventDefault was called → fireEvent returns false.
    expect(evt).toBe(false)
    // onChange should NOT have been called from the paste.
    expect(onChange).not.toHaveBeenCalled()
    // Value still 5.
    expect(input.value).toBe('5')
  })

  it('accepts a parseable paste', () => {
    render(<NumberInput label="N" defaultValue={5} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    const evt = fireEvent.paste(input, {
      clipboardData: { getData: () => '42' },
    })
    // Not preventDefault'd → fireEvent returns true.
    expect(evt).toBe(true)
  })

  /* -------------------------------------------------------------- *
   *  Clear & undefined emission (#328 convention)
   * -------------------------------------------------------------- */

  it('emits onChange(undefined) when the user clears the input', () => {
    const onChange = vi.fn()
    render(<NumberInput label="N" defaultValue={5} onChange={onChange} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  /* -------------------------------------------------------------- *
   *  NaN guard
   * -------------------------------------------------------------- */

  it('never emits NaN — unparseable typing leaves last value intact', () => {
    const onChange = vi.fn()
    render(<NumberInput label="N" defaultValue={5} onChange={onChange} />)
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    // Type a transient "-" — parseInput returns undefined for this, NOT NaN.
    // Verify no NaN ever shows up in onChange calls.
    fireEvent.change(input, { target: { value: '-' } })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.change(input, { target: { value: 'abc' } })
    for (const call of onChange.mock.calls) {
      // Every emitted value is either a finite number or undefined — never NaN.
      const v = call[0]
      expect(
        v === undefined || (typeof v === 'number' && Number.isFinite(v))
      ).toBe(true)
    }
  })

  /* -------------------------------------------------------------- *
   *  Invalid config (min > max)
   * -------------------------------------------------------------- */

  it('warns and ignores max when min > max', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<NumberInput label="N" defaultValue={5} min={10} max={1} />)
    expect(warn).toHaveBeenCalled()
    expect(warn.mock.calls[0]![0]).toMatch(/min.*>.*max/i) // safe: toHaveBeenCalled() asserted above → calls[0] present
    warn.mockRestore()
  })

  /* -------------------------------------------------------------- *
   *  Disabled / readOnly
   * -------------------------------------------------------------- */

  it('does not step when disabled', () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        disabled
        onChange={onChange}
      />
    )
    // Stepper buttons are disabled.
    const inc = screen.getByRole('button', { name: 'Increment' })
    expect(inc).toBeDisabled()
    // Keyboard ArrowUp on the spinbutton is also a no-op.
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' })
    expect(onChange).not.toHaveBeenCalled()
  })

  /* -------------------------------------------------------------- *
   *  ARIA wiring
   * -------------------------------------------------------------- */

  it('wires aria-valuenow / aria-valuemin / aria-valuemax', () => {
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        min={0}
        max={10}
      />
    )
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('aria-valuenow', '5')
    expect(input).toHaveAttribute('aria-valuemin', '0')
    expect(input).toHaveAttribute('aria-valuemax', '10')
  })

  it('wires aria-invalid + aria-describedby for the error message', () => {
    render(
      <NumberInput label="N" defaultValue={5} error="Too small" />
    )
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const errMsg = screen.getByRole('alert')
    expect(errMsg).toHaveTextContent('Too small')
    expect(input.getAttribute('aria-describedby')).toContain(
      errMsg.getAttribute('id') || ''
    )
  })

  it('helperText is linked via aria-describedby when no error', () => {
    render(
      <NumberInput
        label="N"
        defaultValue={5}
        helperText="Between 0 and 10"
      />
    )
    const input = screen.getByRole('spinbutton')
    const help = screen.getByText('Between 0 and 10')
    expect(input.getAttribute('aria-describedby')).toContain(
      help.getAttribute('id') || ''
    )
  })

  /* -------------------------------------------------------------- *
   *  a11y (axe)
   * -------------------------------------------------------------- */

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <div>
        <NumberInput label="Quantity" defaultValue={1} min={0} max={99} />
        <NumberInput label="Price" defaultValue={9.99} precision={2} step={0.01} />
        <NumberInput
          label="Disabled"
          defaultValue={0}
          disabled
        />
        <NumberInput
          label="With error"
          defaultValue={-1}
          min={0}
          error="Must be ≥ 0"
        />
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
