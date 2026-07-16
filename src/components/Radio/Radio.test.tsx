/**
 * Radio Component Tests
 *
 * Regression coverage for #27 (Radio children support):
 * - children prop renders as the label
 * - legacy `label` prop still works (backward compat)
 * - children takes precedence when both provided
 * - omitting both children and label is valid (radio still works)
 * - children accepts ReactNode (rich content like <strong>)
 *
 * Also covers baseline behavior so the additive change is anchored:
 * - radio is wired to the group via name/value
 * - clicking a radio fires onChange with its value
 * - disabled radios do not fire onChange
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Radio } from './Radio'
import { RadioGroup } from './RadioGroup'

describe('Radio', () => {
  describe('label rendering (#27)', () => {
    it('renders children as the label', () => {
      render(
        <RadioGroup name="size" onChange={() => {}}>
          <Radio value="sm">Small</Radio>
          <Radio value="md">Medium</Radio>
        </RadioGroup>
      )

      expect(screen.getByText('Small')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
    })

    it('still renders the legacy `label` prop (backward compat)', () => {
      render(
        <RadioGroup name="size" onChange={() => {}}>
          <Radio value="sm" label="Small" />
          <Radio value="md" label="Medium" />
        </RadioGroup>
      )

      expect(screen.getByText('Small')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
    })

    it('prefers children over label when both are provided', () => {
      render(
        <RadioGroup name="size" onChange={() => {}}>
          <Radio value="sm" label="Ignored Label">
            Children Win
          </Radio>
        </RadioGroup>
      )

      expect(screen.getByText('Children Win')).toBeInTheDocument()
      expect(screen.queryByText('Ignored Label')).not.toBeInTheDocument()
    })

    it('is valid with neither children nor label (no label text rendered, radio still works)', () => {
      const handleChange = vi.fn()
      render(
        <RadioGroup name="size" onChange={handleChange}>
          <Radio value="sm" />
        </RadioGroup>
      )

      // Radio input is still in the DOM and functional
      const radio = screen.getByRole('radio')
      expect(radio).toBeInTheDocument()
      expect(radio).toHaveAttribute('value', 'sm')

      fireEvent.click(radio)
      expect(handleChange).toHaveBeenCalledWith('sm')
    })

    it('accepts ReactNode children (rich content)', () => {
      render(
        <RadioGroup name="size" onChange={() => {}}>
          <Radio value="lg">
            <strong data-testid="bold-label">Large</strong>
          </Radio>
        </RadioGroup>
      )

      const bold = screen.getByTestId('bold-label')
      expect(bold).toBeInTheDocument()
      expect(bold.tagName).toBe('STRONG')
      expect(bold).toHaveTextContent('Large')
    })
  })

  describe('group wiring', () => {
    it('renders as a radio input with the group name and its own value', () => {
      render(
        <RadioGroup name="priority" onChange={() => {}}>
          <Radio value="low">Low</Radio>
          <Radio value="high">High</Radio>
        </RadioGroup>
      )

      const radios = screen.getAllByRole('radio') as HTMLInputElement[]
      expect(radios).toHaveLength(2)
      expect(radios[0]).toHaveAttribute('name', 'priority')
      expect(radios[0]).toHaveAttribute('value', 'low')
      expect(radios[1]).toHaveAttribute('name', 'priority')
      expect(radios[1]).toHaveAttribute('value', 'high')
    })

    it('fires onChange with the radio value when clicked', () => {
      const handleChange = vi.fn()
      render(
        <RadioGroup name="priority" onChange={handleChange}>
          <Radio value="low">Low</Radio>
          <Radio value="high">High</Radio>
        </RadioGroup>
      )

      fireEvent.click(screen.getByText('High'))
      expect(handleChange).toHaveBeenCalledWith('high')
    })

    it('does not fire onChange when the individual Radio is disabled', () => {
      const handleChange = vi.fn()
      render(
        <RadioGroup name="priority" onChange={handleChange}>
          <Radio value="low" disabled>
            Low
          </Radio>
          <Radio value="high">High</Radio>
        </RadioGroup>
      )

      const lowRadio = (screen.getAllByRole('radio') as HTMLInputElement[])[0]! // safe: getAllByRole throws on zero → index 0 present
      expect(lowRadio).toBeDisabled()

      // Clicking a disabled radio should not trigger the group's onChange.
      // Note: real browsers also suppress the click, but we assert the handler
      // is not invoked either way.
      fireEvent.click(lowRadio)
      expect(handleChange).not.toHaveBeenCalled()
    })
  })
})

/* ---------------------------------------------------------------------- *
 *  Sprint 12 (#14) — coverage backfill
 *
 *  The block above was added for #27 (children API). These additions
 *  cover RadioGroup semantics that weren't previously exercised:
 *  uncontrolled defaults, group-wide disable, selection mutual-exclusion,
 *  controlled-value behavior, role=radiogroup wiring, error state, and
 *  jest-axe a11y.
 * ---------------------------------------------------------------------- */
describe('RadioGroup — Sprint 12 coverage', () => {
  it('renders with role=radiogroup', () => {
    render(
      <RadioGroup name="size" defaultValue="md">
        <Radio value="sm">Small</Radio>
        <Radio value="md">Medium</Radio>
      </RadioGroup>
    )
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('reflects uncontrolled defaultValue selection', () => {
    render(
      <RadioGroup name="plan" defaultValue="pro">
        <Radio value="free">Free</Radio>
        <Radio value="pro">Pro</Radio>
        <Radio value="enterprise">Enterprise</Radio>
      </RadioGroup>
    )
    expect(screen.getByLabelText('Pro')).toBeChecked()
    expect(screen.getByLabelText('Free')).not.toBeChecked()
  })

  it('selecting one Radio deselects siblings (uncontrolled)', () => {
    render(
      <RadioGroup name="theme" defaultValue="light">
        <Radio value="light">Light</Radio>
        <Radio value="dark">Dark</Radio>
      </RadioGroup>
    )
    const light = screen.getByLabelText('Light')
    const dark = screen.getByLabelText('Dark')
    expect(light).toBeChecked()
    expect(dark).not.toBeChecked()

    fireEvent.click(dark)

    expect(dark).toBeChecked()
    expect(light).not.toBeChecked()
  })

  it('honors controlled `value` — click without parent update leaves selection unchanged', () => {
    const handleChange = vi.fn()
    render(
      <RadioGroup name="c" value="a" onChange={handleChange}>
        <Radio value="a">A</Radio>
        <Radio value="b">B</Radio>
      </RadioGroup>
    )
    fireEvent.click(screen.getByLabelText('B'))
    // onChange fires, but since parent did not update `value`, selection
    // stays on A.
    expect(handleChange).toHaveBeenCalledWith('b')
    expect(screen.getByLabelText('A')).toBeChecked()
    expect(screen.getByLabelText('B')).not.toBeChecked()
  })

  it('group-level disabled disables every radio in the group', () => {
    render(
      <RadioGroup name="d" defaultValue="x" disabled>
        <Radio value="x">X</Radio>
        <Radio value="y">Y</Radio>
      </RadioGroup>
    )
    for (const r of screen.getAllByRole('radio')) {
      expect(r).toBeDisabled()
    }
  })

  it('shows error (role=alert) and sets aria-invalid on the group', () => {
    render(
      <RadioGroup name="required" error="Please pick a plan">
        <Radio value="free">Free</Radio>
        <Radio value="pro">Pro</Radio>
      </RadioGroup>
    )
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Please pick a plan')
  })

  it('throws a helpful error when Radio is used outside RadioGroup', () => {
    // Radio.tsx calls `useRadioGroup()` which throws on null context.
    // Silence React's error boundary log for this negative-path assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Radio value="x">Orphan</Radio>)).toThrow(
      /Radio must be used within RadioGroup/
    )
    spy.mockRestore()
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <RadioGroup name="size" defaultValue="md" aria-label="T-shirt size">
        <Radio value="sm">Small</Radio>
        <Radio value="md">Medium</Radio>
        <Radio value="lg">Large</Radio>
      </RadioGroup>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  // #423 — full-customizability contract: consumer `style` + rest props land
  // on the visual root (the `role="radiogroup"` div), and the internal
  // radiogroup role is NOT clobbered by a consumer-supplied `role`.
  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the visual root', () => {
      render(
        <RadioGroup
          name="size"
          defaultValue="md"
          data-testid="my-radiogroup"
          style={{ color: 'rgb(10, 20, 30)' }}
        >
          <Radio value="sm">Small</Radio>
          <Radio value="md">Medium</Radio>
        </RadioGroup>
      )
      const root = screen.getByTestId('my-radiogroup')
      expect(root).toBe(screen.getByRole('radiogroup'))
      expect(root.style.color).toBe('rgb(10, 20, 30)')
    })

    it('keeps the internal radiogroup role even when the consumer passes role', () => {
      render(
        <RadioGroup
          name="size"
          defaultValue="md"
          data-testid="roled-radiogroup"
          role="presentation"
        >
          <Radio value="sm">Small</Radio>
          <Radio value="md">Medium</Radio>
        </RadioGroup>
      )
      expect(screen.getByTestId('roled-radiogroup')).toHaveAttribute(
        'role',
        'radiogroup'
      )
    })
  })
})
