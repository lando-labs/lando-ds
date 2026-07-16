'use client'

/**
 * Form Component (#313 — Sprint 55 Lane C)
 *
 * A wrapper around the native `<form>` element that owns validation context
 * for nested `<Field>` children. Schema-agnostic by design — accepts either:
 *
 *   - a `validate` function (sync only in v1) that maps form values to a
 *     `{ [fieldName]: string }` error map, or
 *   - nothing, in which case native HTML5 validity (required, type, pattern,
 *     etc.) is the source of truth and runs via `form.checkValidity()`.
 *
 * Conform integration was deferred (see ARCHITECTURE NOTE below); the prop
 * surface and FormContext are shaped so a future Conform-backed adapter
 * can layer on without breaking changes.
 *
 * v1 explicit non-goals (deferred to follow-up issues):
 *   - Async validation (server-roundtrip)
 *   - Multi-step / wizard forms
 *   - Field arrays (dynamic add/remove)
 *   - Nested <Form> composition
 *   - Zod / Valibot schema adapters (the `validate` prop hook works with
 *     any sync validator; the consumer can wire schema -> validate-fn today
 *     without taking a dep in the DS)
 *
 * ARCHITECTURE NOTE — Conform was deferred for v1:
 *   The issue calls for Conform-backed forms. Conform is a great fit but
 *   requires (a) a peer dep on @conform-to/react, (b) the consumer picks
 *   Zod or Valibot (also peer deps), and (c) the Field abstraction has to
 *   speak Conform's `getFieldsetProps` / `getInputProps` shapes. Rolling
 *   that in within a single sprint lane would balloon scope. The native
 *   wrapper here covers the common case (sync validation + a11y wiring)
 *   and the FormContext is intentionally shaped to be Conform-adaptable
 *   in a follow-up issue.
 *
 * @example Native HTML5 validity only
 *   <Form onSubmit={(values) => console.log(values)}>
 *     <Field name="email" label="Email">
 *       <Input type="email" required />
 *     </Field>
 *     <Button type="submit">Submit</Button>
 *   </Form>
 *
 * @example Custom sync validator
 *   <Form
 *     defaultValues={{ email: '' }}
 *     validate={(values) => {
 *       const errors: Record<string, string> = {}
 *       if (!values.email) errors.email = 'Email is required'
 *       else if (!values.email.includes('@')) errors.email = 'Invalid email'
 *       return errors
 *     }}
 *     onSubmit={(values) => console.log(values)}
 *   >
 *     <Field name="email" label="Email"><Input /></Field>
 *     <Button type="submit">Submit</Button>
 *   </Form>
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import styles from './Form.module.css'

/* -------------------------------------------------------------------------- *
 *  Types
 * -------------------------------------------------------------------------- */

/**
 * Sync validator. Returns a map of `{ fieldName: errorMessage }` for invalid
 * fields, or an empty object (or `null`/`undefined`) if the form is valid.
 * Receives the current form values as a plain object.
 */
export type FormValidator = (
  values: Record<string, unknown>
) => Record<string, string> | null | undefined

export interface FormProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'onChange'> {
  /**
   * Called with the validated form values when the user submits AND
   * validation passes. Receives a plain `{ [fieldName]: value }` object
   * derived from the native FormData.
   *
   * If validation fails, focus moves to the first invalid field and
   * onSubmit is NOT called.
   */
  onSubmit?: (values: Record<string, unknown>, event: React.FormEvent<HTMLFormElement>) => void | Promise<void>

  /**
   * Optional sync validator. If provided, runs on submit (and is the
   * source of truth for field errors). If omitted, native HTML5 validity
   * is the source of truth.
   */
  validate?: FormValidator

  /**
   * Initial values for fields. Each Field reads `defaultValues[name]` on
   * mount to populate its input. Values themselves are NOT held in React
   * state by Form — the underlying inputs remain the source of truth.
   * (This keeps Form schema-agnostic and lets each input keep its own
   * controlled/uncontrolled behavior.)
   */
  defaultValues?: Record<string, unknown>

  /**
   * Validation mode:
   *   - `'onSubmit'` (default): validate only when the form is submitted.
   *     After the first submit attempt, fields revalidate on change.
   *   - `'onChange'`: validate every change.
   *   - `'onBlur'`: validate on field blur.
   *
   * v1 implements `'onSubmit'` semantics (with revalidate-on-change after
   * first submit). `'onChange'` and `'onBlur'` are accepted by the prop
   * surface but currently behave like `'onSubmit'` — wiring them is
   * tracked as a follow-up.
   */
  validationMode?: 'onSubmit' | 'onChange' | 'onBlur'

  /** Form children (typically Field components + a submit Button). */
  children: React.ReactNode
}

/**
 * Context exposed to nested Field components.
 *
 * Field uses this to:
 *   - read its initial value from `defaultValues`
 *   - read its current error from `errors`
 *   - get a unique form-scoped id prefix (`formId`)
 *   - register itself so the form can focus the first invalid field on
 *     failed submit
 */
export interface FormContextValue {
  /** Unique id prefix scoped to this form instance. */
  formId: string
  /** Default values supplied via `<Form defaultValues>`. */
  defaultValues: Record<string, unknown>
  /** Current error map (keyed by field name). */
  errors: Record<string, string>
  /**
   * Register a field with the form. Returns an unregister callback.
   * Called by Field on mount. The DOM ref is used to focus the first
   * invalid field on failed submit.
   */
  registerField: (name: string, ref: React.RefObject<HTMLElement | null>) => () => void
  /**
   * Whether the form has been submitted at least once. Fields can use
   * this to decide whether to display errors (some consumers prefer to
   * hide errors before first submit).
   */
  hasSubmitted: boolean
}

const FormContext = createContext<FormContextValue | null>(null)

/**
 * Hook for reading the parent <Form> context. Returns `null` if used
 * outside a <Form> — Field handles the null case by rendering its child
 * standalone (degrades gracefully when used without a wrapping form).
 */
export function useFormContext(): FormContextValue | null {
  return useContext(FormContext)
}

/* -------------------------------------------------------------------------- *
 *  Implementation
 * -------------------------------------------------------------------------- */

/**
 * Convert a FormData instance to a plain `{ [name]: value }` object.
 * Multiple values for the same name (e.g. checkbox groups) collapse into
 * an array. Files are passed through as File objects.
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (key in out) {
      const existing = out[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        out[key] = [existing, value]
      }
    } else {
      out[key] = value
    }
  }
  return out
}

export const Form = React.forwardRef<HTMLFormElement, FormProps>(function Form(
  {
    onSubmit,
    validate,
    defaultValues = {},
    validationMode = 'onSubmit',
    children,
    className = '',
    noValidate,
    ...rest
  },
  forwardedRef
) {
  const reactId = React.useId()
  const formId = `ll-form-${reactId.replace(/:/g, '')}`

  // We use `noValidate` ON the <form> when a custom validator is supplied —
  // otherwise the browser would also pop its own validation tooltips,
  // double-reporting errors. When no `validate` prop is given, we let the
  // browser handle native validity.
  const shouldDisableNativeValidation = noValidate ?? !!validate

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasSubmitted, setHasSubmitted] = useState(false)

  // Registered field DOM refs, keyed by field name. Used to focus the first
  // invalid field on a failed submit.
  const fieldRefs = useRef<Map<string, React.RefObject<HTMLElement | null>>>(new Map())

  const registerField = useCallback(
    (name: string, ref: React.RefObject<HTMLElement | null>) => {
      fieldRefs.current.set(name, ref)
      return () => {
        fieldRefs.current.delete(name)
      }
    },
    []
  )

  /**
   * Focus the first invalid field in DOM order. Walks the form's own
   * registered fields rather than querying the DOM for `:invalid` so it
   * works with custom-validator errors that don't set native validity.
   */
  const focusFirstInvalid = useCallback(
    (errorMap: Record<string, string>, formEl: HTMLFormElement) => {
      // Walk fields in DOM order — iterate the form's own form-control set
      // (formEl.elements) so we focus in the order the user sees on screen,
      // not in insertion order into the ref map.
      const elements = Array.from(formEl.elements) as HTMLElement[]
      for (const el of elements) {
        const name = (el as HTMLInputElement).name
        if (name && errorMap[name]) {
          // Prefer the registered ref (it may be the rich child wrapper,
          // e.g. a custom <Select> root), but fall back to the form element
          // itself if no ref was registered.
          const ref = fieldRefs.current.get(name)
          const target = ref?.current ?? el
          if (typeof (target as HTMLElement).focus === 'function') {
            ;(target as HTMLElement).focus()
          }
          return
        }
      }
    },
    []
  )

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      const formEl = event.currentTarget
      setHasSubmitted(true)

      let nextErrors: Record<string, string> = {}

      if (validate) {
        // Custom validator path. Build values from FormData and let the
        // consumer's validator produce the error map.
        const formData = new FormData(formEl)
        const values = formDataToObject(formData)
        const result = validate(values)
        nextErrors = result ?? {}
      } else {
        // Native HTML5 validity path. checkValidity() walks all form
        // controls and returns false if any are invalid.
        if (!formEl.checkValidity()) {
          event.preventDefault()
          const elements = Array.from(formEl.elements) as HTMLInputElement[]
          for (const el of elements) {
            if (el.name && !el.validity.valid) {
              nextErrors[el.name] = el.validationMessage || 'This field is invalid.'
            }
          }
        }
      }

      setErrors(nextErrors)

      if (Object.keys(nextErrors).length > 0) {
        event.preventDefault()
        focusFirstInvalid(nextErrors, formEl)
        return
      }

      // Validation passed. Prevent native submit (we don't want the page
      // to navigate by default) and call the consumer's handler with the
      // parsed values.
      event.preventDefault()
      if (onSubmit) {
        const formData = new FormData(formEl)
        const values = formDataToObject(formData)
        await onSubmit(values, event)
      }
    },
    [validate, onSubmit, focusFirstInvalid]
  )

  /**
   * After the first submit, revalidate on every change so the user sees
   * errors clear as they fix them. Before first submit, change events
   * are ignored (we don't want to flag fields the user hasn't tried to
   * submit yet).
   */
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLFormElement>) => {
      if (!hasSubmitted) return
      const formEl = event.currentTarget
      if (validate) {
        const formData = new FormData(formEl)
        const values = formDataToObject(formData)
        const result = validate(values) ?? {}
        setErrors(result)
      } else {
        const nextErrors: Record<string, string> = {}
        const elements = Array.from(formEl.elements) as HTMLInputElement[]
        for (const el of elements) {
          if (el.name && !el.validity.valid) {
            nextErrors[el.name] = el.validationMessage || 'This field is invalid.'
          }
        }
        setErrors(nextErrors)
      }
    },
    [hasSubmitted, validate]
  )

  const contextValue = useMemo<FormContextValue>(
    () => ({
      formId,
      defaultValues,
      errors,
      registerField,
      hasSubmitted,
    }),
    [formId, defaultValues, errors, registerField, hasSubmitted]
  )

  // `validationMode` is captured in the prop surface for forward-compat
  // but does not change v1 behavior (always 'onSubmit' + revalidate-on-
  // change after first submit). Touching the value here keeps the
  // unused-vars lint happy and documents the intent.
  void validationMode

  return (
    <FormContext.Provider value={contextValue}>
      <form
        ref={forwardedRef}
        className={[styles.form, className].filter(Boolean).join(' ')}
        noValidate={shouldDisableNativeValidation}
        onSubmit={handleSubmit}
        onChange={handleChange}
        {...rest}
      >
        {children}
      </form>
    </FormContext.Provider>
  )
})

Form.displayName = 'Form'
