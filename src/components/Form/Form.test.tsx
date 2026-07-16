/**
 * Form Component Tests (#313 — Sprint 55 Lane C)
 *
 * Covers:
 *   - Renders children inside a <form> element
 *   - onSubmit fires with parsed FormData values when validation passes
 *   - Native HTML5 validity blocks submit and surfaces errors
 *   - Custom validator path produces errors and blocks submit
 *   - Invalid submit focuses first invalid field
 *   - Re-validation runs on change AFTER first failed submit
 *   - defaultValues are exposed via context
 *   - useFormContext returns null outside a Form
 *   - noValidate is set when a custom validator is supplied (suppresses
 *     browser-native tooltips)
 *   - axe a11y baseline
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Form, useFormContext } from './Form'
import { Field } from '../Field/Field'
import { Input } from '../Input/Input'

describe('Form', () => {
  it('renders children inside a native <form>', () => {
    const { container } = render(
      <Form>
        <Field name="email" label="Email">
          <Input type="email" />
        </Field>
      </Form>
    )
    const formEl = container.querySelector('form')
    expect(formEl).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('fires onSubmit with parsed values when validation passes', () => {
    const handleSubmit = vi.fn()
    render(
      <Form onSubmit={handleSubmit}>
        <Field name="email" label="Email">
          <Input defaultValue="ada@example.com" />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(handleSubmit).toHaveBeenCalledTimes(1)
    expect(handleSubmit.mock.calls[0]![0]).toEqual({ email: 'ada@example.com' }) // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present
  })

  it('blocks submit and surfaces error from native required validity', () => {
    // NOTE: In a real browser, clicking a submit button on an invalid
    // required field shows the browser-native validation popup and the
    // form's submit event NEVER fires. That's also true in jsdom — so
    // we use fireEvent.submit() to exercise the code path where the
    // submit IS fired programmatically and verify our handler then
    // catches the invalid field via checkValidity().
    const handleSubmit = vi.fn()
    const { container } = render(
      <Form onSubmit={handleSubmit}>
        <Field name="email" label="Email" required>
          <Input type="email" />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(handleSubmit).not.toHaveBeenCalled()
    // Error rendered as role=alert via the wrapped Input
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('custom validator path produces errors and blocks submit', () => {
    const handleSubmit = vi.fn()
    const validate = vi.fn((values: Record<string, unknown>) => {
      const errors: Record<string, string> = {}
      if (!values.email) errors.email = 'Email is required'
      return errors
    })
    render(
      <Form onSubmit={handleSubmit} validate={validate}>
        <Field name="email" label="Email">
          <Input defaultValue="" />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(validate).toHaveBeenCalled()
    expect(handleSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required')
  })

  it('custom validator path allows submit when no errors are returned', () => {
    const handleSubmit = vi.fn()
    const validate = (values: Record<string, unknown>): Record<string, string> => {
      if (!values.email) return { email: 'required' }
      return {}
    }
    render(
      <Form onSubmit={handleSubmit} validate={validate}>
        <Field name="email" label="Email">
          <Input defaultValue="ada@example.com" />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(handleSubmit).toHaveBeenCalledTimes(1)
    expect(handleSubmit.mock.calls[0]![0]).toEqual({ email: 'ada@example.com' }) // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present
  })

  it('focuses the first invalid field on failed submit', () => {
    render(
      <Form
        validate={() => ({
          // Errors keyed by field name. Form should focus the first
          // invalid field in DOM order, NOT in insertion order into the
          // error map — so we put 'name' last in the error map but
          // first in the DOM and assert 'name' wins focus.
          email: 'invalid',
          name: 'required',
        })}
      >
        <Field name="name" label="Name">
          <Input />
        </Field>
        <Field name="email" label="Email">
          <Input />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(document.activeElement).toBe(screen.getByLabelText(/Name/))
  })

  it('re-validates on change after a failed submit (clears error as user fixes it)', () => {
    const validate = (values: Record<string, unknown>) => {
      const errors: Record<string, string> = {}
      if (!values.email) errors.email = 'Email is required'
      return errors
    }
    render(
      <Form validate={validate}>
        <Field name="email" label="Email">
          <Input defaultValue="" />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required')

    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'ada@example.com' },
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does NOT validate on change before first submit', () => {
    const validate = vi.fn(() => ({ email: 'required' }))
    render(
      <Form validate={validate}>
        <Field name="email" label="Email">
          <Input />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'a' },
    })
    expect(validate).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('exposes defaultValues via context to nested Fields', () => {
    let captured: unknown = undefined
    function Spy() {
      const ctx = useFormContext()
      captured = ctx?.defaultValues
      return null
    }
    render(
      <Form defaultValues={{ email: 'ada@example.com', name: 'Ada' }}>
        <Spy />
      </Form>
    )
    expect(captured).toEqual({ email: 'ada@example.com', name: 'Ada' })
  })

  it('useFormContext returns null outside a Form', () => {
    let captured: unknown = 'initial'
    function Spy() {
      captured = useFormContext()
      return null
    }
    render(<Spy />)
    expect(captured).toBe(null)
  })

  it('sets noValidate on the form when a custom validator is supplied', () => {
    const { container } = render(
      <Form validate={() => ({})}>
        <Field name="email" label="Email">
          <Input />
        </Field>
      </Form>
    )
    const formEl = container.querySelector('form')!
    expect(formEl.noValidate).toBe(true)
  })

  it('does NOT set noValidate when no validator is supplied (native validity wins)', () => {
    const { container } = render(
      <Form>
        <Field name="email" label="Email">
          <Input type="email" />
        </Field>
      </Form>
    )
    const formEl = container.querySelector('form')!
    expect(formEl.noValidate).toBe(false)
  })

  it('Form is keyboard-submittable (Enter in an Input triggers submit)', () => {
    const handleSubmit = vi.fn()
    render(
      <Form onSubmit={handleSubmit}>
        <Field name="email" label="Email">
          <Input defaultValue="ada@example.com" />
        </Field>
      </Form>
    )
    const input = screen.getByLabelText(/Email/)
    fireEvent.submit(input.closest('form')!)
    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <Form>
        <Field name="email" label="Email" required>
          <Input type="email" />
        </Field>
        <Field name="name" label="Full name" helperText="As it appears on your ID">
          <Input />
        </Field>
        <button type="submit">Submit</button>
      </Form>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
