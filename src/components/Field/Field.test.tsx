/**
 * Field Component Tests (#313 — Sprint 55 Lane C)
 *
 * Covers:
 *   - Renders label-aware children (Input) by forwarding label/error/helperText
 *     onto the child via cloneElement (no doubled chrome).
 *   - Renders bare children (raw <input>) with its own label/error/helper-text.
 *   - Forwards name + id + error props to the child.
 *   - Generates unique ids when multiple Fields are used.
 *   - aria-invalid is set when error is present.
 *   - aria-describedby points at the error element id when error is present,
 *     helper id otherwise.
 *   - Pulls error from <Form> context when error prop not supplied.
 *   - defaultValues from <Form> populate inputs.
 *   - Throws (via React.Children.only) when multiple children are passed.
 *   - Field standalone (no <Form>) still renders correctly.
 *   - axe a11y baseline.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Field } from './Field'
import { Form } from '../Form/Form'
import { Input } from '../Input/Input'

describe('Field', () => {
  it('renders a label-aware child (Input) and the input is labelled', () => {
    render(
      <Field name="email" label="Email">
        <Input />
      </Field>
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('does NOT double-render the label when wrapping a label-aware Input', () => {
    render(
      <Field name="email" label="Email">
        <Input />
      </Field>
    )
    // Exactly one element should be associated with the "Email" label
    const labels = screen.getAllByText('Email')
    expect(labels).toHaveLength(1)
  })

  it('renders a bare child (raw input) with its own label + helper text', () => {
    render(
      <Field name="email" label="Email address" helperText="We never share">
        <input type="email" />
      </Field>
    )
    expect(screen.getByLabelText(/Email address/)).toBeInTheDocument()
    expect(screen.getByText('We never share')).toBeInTheDocument()
  })

  it('renders an error on a bare child as role=alert with aria-live="polite"', () => {
    render(
      <Field name="email" label="Email" error="Required">
        <input />
      </Field>
    )
    const alertEl = screen.getByRole('alert')
    expect(alertEl).toHaveTextContent('Required')
    expect(alertEl).toHaveAttribute('aria-live', 'polite')
  })

  it('forwards name + id onto the child (Input)', () => {
    render(
      <Field name="email" label="Email">
        <Input />
      </Field>
    )
    const input = screen.getByLabelText('Email') as HTMLInputElement
    expect(input.name).toBe('email')
    expect(input.id).toMatch(/^ll-field-/)
  })

  it('forwards name onto a bare child', () => {
    render(
      <Field name="email" label="Email">
        <input />
      </Field>
    )
    const input = screen.getByLabelText(/Email/) as HTMLInputElement
    expect(input.name).toBe('email')
  })

  it('forwards explicit error prop to a label-aware Input', () => {
    render(
      <Field name="email" label="Email" error="Bad">
        <Input />
      </Field>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Bad')
  })

  it('generates unique ids when multiple Fields are rendered', () => {
    render(
      <>
        <Field name="email" label="Email">
          <input />
        </Field>
        <Field name="name" label="Name">
          <input />
        </Field>
      </>
    )
    const emailInput = screen.getByLabelText(/Email/) as HTMLInputElement
    const nameInput = screen.getByLabelText(/Name/) as HTMLInputElement
    expect(emailInput.id).toMatch(/^ll-field-/)
    expect(nameInput.id).toMatch(/^ll-field-/)
    expect(emailInput.id).not.toBe(nameInput.id)
  })

  it('sets aria-invalid=true when error is present', () => {
    render(
      <Field name="email" label="Email" error="Bad">
        <input />
      </Field>
    )
    const input = screen.getByLabelText(/Email/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('does NOT set aria-invalid when no error', () => {
    render(
      <Field name="email" label="Email">
        <input />
      </Field>
    )
    const input = screen.getByLabelText(/Email/)
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('aria-describedby points at the error element id when error is present', () => {
    render(
      <Field name="email" label="Email" error="Bad" helperText="ignored">
        <input />
      </Field>
    )
    const input = screen.getByLabelText(/Email/)
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    // The element pointed to by aria-describedby contains the error text
    const describedEl = document.getElementById(describedBy!)
    expect(describedEl).toHaveTextContent('Bad')
  })

  it('aria-describedby points at the helper id when no error', () => {
    render(
      <Field name="email" label="Email" helperText="Helpful">
        <input />
      </Field>
    )
    const input = screen.getByLabelText(/Email/)
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const describedEl = document.getElementById(describedBy!)
    expect(describedEl).toHaveTextContent('Helpful')
  })

  it('reads error from parent Form context when no explicit error prop', () => {
    // Use Form's validator to inject a context error after submit.
    // No simulation needed for context — render Field directly inside
    // a Form whose validate seeds the error map on submit.
    render(
      <Form validate={() => ({ email: 'context-error' })}>
        <Field name="email" label="Email">
          <input />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByRole('alert')).toHaveTextContent('context-error')
  })

  it('explicit error prop overrides parent Form context error', () => {
    render(
      <Form validate={() => ({ email: 'context-error' })}>
        <Field name="email" label="Email" error="explicit-error">
          <input />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByRole('alert')).toHaveTextContent('explicit-error')
  })

  it('populates input from Form defaultValues on initial render', () => {
    render(
      <Form defaultValues={{ email: 'ada@example.com' }}>
        <Field name="email" label="Email">
          <input />
        </Field>
      </Form>
    )
    const input = screen.getByLabelText(/Email/) as HTMLInputElement
    expect(input.defaultValue).toBe('ada@example.com')
  })

  it('child-supplied defaultValue beats Form defaultValues', () => {
    render(
      <Form defaultValues={{ email: 'form-default@example.com' }}>
        <Field name="email" label="Email">
          <input defaultValue="child-default@example.com" />
        </Field>
      </Form>
    )
    const input = screen.getByLabelText(/Email/) as HTMLInputElement
    expect(input.defaultValue).toBe('child-default@example.com')
  })

  it('preserves consumer-supplied aria-describedby alongside the error id', () => {
    render(
      <Field name="email" label="Email" error="Bad">
        <input aria-describedby="tooltip-id" />
      </Field>
    )
    const input = screen.getByLabelText(/Email/)
    const describedBy = input.getAttribute('aria-describedby')!
    // The merged value should include BOTH the error id and the consumer's
    expect(describedBy).toContain('tooltip-id')
    expect(describedBy).toMatch(/-error/)
  })

  it('marks required: passes required=true onto the child', () => {
    render(
      <Field name="email" label="Email" required>
        <input />
      </Field>
    )
    const input = screen.getByLabelText(/Email/)
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('throws when multiple children are passed (React.Children.only contract)', () => {
    // Silence the React error overlay in jsdom for this test
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    expect(() =>
      render(
        // @ts-expect-error — intentionally invalid; multiple children
        <Field name="email" label="Email">
          <input />
          <input />
        </Field>
      )
    ).toThrow()
    consoleError.mockRestore()
  })

  it('Field works standalone (without a parent Form)', () => {
    render(
      <Field name="email" label="Email" helperText="No form needed">
        <input />
      </Field>
    )
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
    expect(screen.getByText('No form needed')).toBeInTheDocument()
  })

  it('has no a11y violations on bare-input path (axe)', async () => {
    const { container } = render(
      <Field name="email" label="Email address" required helperText="Required">
        <input type="email" />
      </Field>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no a11y violations on label-aware Input path (axe)', async () => {
    const { container } = render(
      <Field name="email" label="Email" error="Bad email">
        <Input type="email" />
      </Field>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  /* ---------------------------------------------------------------- *
   *  #422 — className / style / ...rest pass-through
   *
   *  Field has two render paths and therefore two roots:
   *    - BARE child (raw <input>)  → the `.container` wrapper Field renders.
   *    - DELEGATED child (<Input>) → the cloned child (Field renders no DOM
   *      of its own there), so overrides merge onto that child.
   * ---------------------------------------------------------------- */
  describe('root pass-through (#422)', () => {
    it('bare path: forwards data-testid + winning style onto the .container wrapper', () => {
      const { container } = render(
        <Field
          name="email"
          label="Email"
          data-testid="field-root"
          style={{ color: 'rgb(1, 2, 3)' }}
        >
          <input />
        </Field>
      )
      const root = container.firstChild as HTMLElement
      expect(root.getAttribute('data-testid')).toBe('field-root')
      expect(root.style.color).toBe('rgb(1, 2, 3)')
      // The wrapper still contains the label + input.
      expect(root.querySelector('input')).not.toBeNull()
      expect(root.querySelector('label')).not.toBeNull()
    })

    it('bare path: merges a consumer className onto the .container wrapper', () => {
      const { container } = render(
        <Field name="email" label="Email" className="consumer-field">
          <input />
        </Field>
      )
      const root = container.firstChild as HTMLElement
      expect(root.className).toContain('consumer-field')
      expect(root.className.split(' ').length).toBeGreaterThan(1)
    })

    it('delegated path: forwards data-testid + winning style onto the rendered input', () => {
      render(
        <Field
          name="email"
          label="Email"
          data-testid="field-input"
          style={{ color: 'rgb(1, 2, 3)' }}
        >
          <Input />
        </Field>
      )
      const el = screen.getByTestId('field-input')
      // The styled root is the input the consumer's <Input> renders.
      expect(el.style.color).toBe('rgb(1, 2, 3)')
    })

    it('delegated path: consumer className is preserved alongside the child class', () => {
      render(
        <Field name="email" label="Email" className="consumer-field">
          <Input className="own-input-class" />
        </Field>
      )
      // Both the consumer's Field className and the child's own class must
      // survive the cloneElement merge somewhere on the rendered subtree.
      expect(document.querySelector('.consumer-field')).not.toBeNull()
      expect(document.querySelector('.own-input-class')).not.toBeNull()
    })
  })
})
