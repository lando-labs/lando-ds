'use client'

/**
 * Field Component (#313 — Sprint 55 Lane C)
 *
 * Wraps a single input affordance with label + error + helper-text wiring.
 * Designed to compose with the existing Lando inputs (Input, NumberInput,
 * Textarea, Select, Combobox, Slider, etc.) WITHOUT duplicating their
 * label/error UI — Field forwards the label/error/helperText props onto
 * the child via cloneElement, so the input's own (already-tested)
 * label/error chrome is what the user sees. This keeps the a11y wiring
 * in one place per input and means Field has no opinions about styling.
 *
 * For bare children that don't have a label slot (e.g. a raw `<input>`),
 * Field renders its own label + error + helper-text chrome instead.
 *
 * Behavior:
 *   - Generates a unique id (via useId) and threads it onto the child as
 *     both `id` and `htmlFor` on the label.
 *   - Reads its current error from the parent <Form> context (or accepts
 *     an explicit `error` prop to render standalone).
 *   - Reads its initial value from <Form defaultValues> when used inside
 *     a <Form>; honors any `defaultValue` already passed on the child.
 *   - Registers itself with <Form> so a failed-submit can focus the
 *     first invalid field.
 *   - Wires `aria-describedby` -> error/helper id and `aria-invalid` when
 *     an error is present.
 *
 * Pattern:
 *   <Field name="email" label="Email" required>
 *     <Input type="email" />
 *   </Field>
 *
 * The child must be a single React element. Multiple children, fragments,
 * or text are NOT supported — that's a deliberate constraint so the
 * cloneElement wiring stays predictable.
 *
 * Render-prop style was considered and rejected for v1: the cloneElement
 * style reads more naturally next to the other Lando components and
 * doesn't require the consumer to remember which props to spread. If a
 * render-prop variant is ever needed (e.g. for arbitrary input layouts),
 * it can be added as a sibling `<FieldRender>` without changing this API.
 */

import React, { useEffect, useId, useMemo, useRef } from 'react'
import { useFormContext } from '../Form/Form'
import styles from './Field.module.css'

/* -------------------------------------------------------------------------- *
 *  Types
 * -------------------------------------------------------------------------- */

/**
 * Props that Field forwards onto its child via cloneElement. The child
 * is typed to accept these optionally — every Lando input already
 * accepts at least `name`, `id`, `defaultValue`/`value`, `error`,
 * `aria-invalid`, `aria-describedby`, and `required`. Plain DOM inputs
 * accept the same.
 */
export interface FieldChildProps {
  id?: string
  name?: string
  label?: string
  required?: boolean
  error?: string
  helperText?: string
  defaultValue?: unknown
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-required'?: boolean | 'true' | 'false'
}

/**
 * Native attributes accepted on Field's rendered root. Which DOM node that
 * is depends on the render path (see {@link FieldProps.className}):
 *   - Bare path  → the `.container` wrapper `<div>` Field renders itself.
 *   - Delegated path (label-aware child like `<Input>`) → the cloned child,
 *     since Field renders no DOM of its own there.
 * `children` is redefined below as the single input element.
 */
type FieldRootAttributes = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>

export interface FieldProps extends FieldRootAttributes {
  /**
   * Form field name. Used as the key in the form values object and to
   * look up errors from the parent <Form> context.
   */
  name: string

  /**
   * Visible label text. Forwarded to the child if the child accepts a
   * `label` prop (the Lando inputs do); otherwise rendered as a
   * standalone <label> element above the child.
   */
  label: string

  /** Whether the field is required. Forwarded to the child. */
  required?: boolean

  /**
   * Helper text below the input. Forwarded to the child if it accepts a
   * `helperText` prop; otherwise rendered as a standalone hint below the
   * input. Suppressed when an error is present (error wins).
   */
  helperText?: string

  /**
   * Explicit error message. Overrides any error from the parent <Form>
   * context. Useful when using <Field> standalone (without <Form>) or
   * for one-off error states.
   */
  error?: string

  /**
   * Tell Field that the child does NOT have its own label/error chrome
   * (e.g. raw `<input>` or `<select>`). When true, Field renders its
   * own `<label>` and error/helper text wrapper. Default detection
   * checks for the presence of a `label` prop on the child — if the
   * child already declares `label`, we trust it has a label slot.
   */
  bare?: boolean

  /**
   * Additional CSS class for Field's rendered root.
   *
   * - **Bare path** (raw `<input>`/`<select>`, or `bare`): merged onto the
   *   `.container` wrapper `<div>` Field renders.
   * - **Delegated path** (label-aware child like `<Input>`): Field renders no
   *   wrapper of its own, so the class is merged onto the cloned child's own
   *   `className` (the child's rendered root). Nothing is silently dropped.
   */
  className?: string

  /**
   * Inline styles for Field's rendered root. Follows the same target rules as
   * {@link FieldProps.className} — the `.container` wrapper on the bare path,
   * or the cloned child (merged with any `style` the child already has) on the
   * delegated path. (Inherited type from `HTMLAttributes`; restated for docs.)
   */
  style?: React.CSSProperties

  /**
   * The input affordance. Must be a single React element (one Input,
   * one Select, etc.). Fragments and multiple children are rejected.
   */
  children: React.ReactElement<FieldChildProps>
}

/* -------------------------------------------------------------------------- *
 *  Implementation
 * -------------------------------------------------------------------------- */

/**
 * Heuristic: does the child component support its own label/error chrome?
 *
 * The Lando inputs (Input, NumberInput, Textarea, Select, Checkbox,
 * Radio, Switch, Slider, Combobox) all accept a `label` prop and render
 * their own label + error UI. Detecting that via `displayName` is
 * fragile (minification, displayName drift), so we instead look at
 * whether the child already declares a `label` prop OR is one of the
 * known native elements that do NOT support label internally.
 *
 * Returns `true` when Field SHOULD render its own label/error chrome
 * (i.e. the child is a bare native input).
 */
function childIsBare(child: React.ReactElement<FieldChildProps>): boolean {
  // If it's a host string element (input/select/textarea), it has no
  // label slot — Field renders its own.
  if (typeof child.type === 'string') return true
  return false
}

export function Field({
  name,
  label,
  required,
  helperText,
  error: errorProp,
  bare: bareProp,
  children,
  className,
  style,
  ...rest
}: FieldProps) {
  // Validate children — only a single element is supported. Throwing in
  // dev is louder than a quiet bug; React.Children.only does the right
  // thing (throws if not exactly one element).
  React.Children.only(children)

  const reactId = useId()
  // The base id used for the input. Stable across renders.
  const fieldId = `ll-field-${reactId.replace(/:/g, '')}`
  const errorId = `${fieldId}-error`
  const helperId = `${fieldId}-helper`

  const ctx = useFormContext()
  const contextError = ctx?.errors[name]
  const error = errorProp ?? contextError

  // Register with parent <Form> so failed submits can focus this field.
  // We attach a ref to the child via cloneElement below; the ref handle
  // here is what <Form> uses to call .focus().
  const fieldRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!ctx) return
    return ctx.registerField(name, fieldRef)
  }, [ctx, name])

  // Resolve defaults: if the child already declares a `defaultValue`,
  // that wins (the consumer's local intent beats form-level defaults).
  // Otherwise fall back to <Form defaultValues[name]> when present.
  const childDefaultValue = (children.props as FieldChildProps).defaultValue
  const formDefault = ctx?.defaultValues[name]
  const defaultValue = childDefaultValue ?? formDefault

  // Treat the child as "bare" if either explicitly told so, or it's a
  // host element (a string type like 'input').
  const isBare = bareProp ?? childIsBare(children)

  // Build aria-describedby: merge any existing describedby on the child
  // with our error/helper id so we don't clobber consumer-supplied refs
  // (e.g. a tooltip on the input that also writes aria-describedby).
  const existingDescribedBy = (children.props as FieldChildProps)['aria-describedby']
  const describedByIds = [
    error ? errorId : null,
    !error && helperText ? helperId : null,
    existingDescribedBy ?? null,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  // Props we always inject onto the child. We pass through label/error/
  // helperText/required as well — for label-aware inputs this is what
  // their internal chrome reads; for bare children these are ignored
  // since plain HTML elements don't accept them.
  const childProps: FieldChildProps & { ref?: React.Ref<HTMLElement> } = useMemo(
    () => ({
      id: fieldId,
      name,
      // Forward error/label/helperText to label-aware inputs so they
      // render their own (already-styled) chrome. Bare children ignore
      // these props.
      ...(isBare ? {} : { label, error, helperText, required }),
      // a11y wiring. We set these on every child regardless of label-
      // aware status — for the Lando inputs this duplicates what they
      // set internally (with the same id), which is harmless; for bare
      // children this is the only place these are wired.
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedByIds || undefined,
      'aria-required': required ? true : undefined,
      // Honor child-supplied defaultValue; otherwise inject Form's.
      ...(defaultValue !== undefined ? { defaultValue: defaultValue as never } : {}),
    }),
    [fieldId, name, isBare, label, error, helperText, required, describedByIds, defaultValue]
  )

  // Merge ref: if the child already has a ref, preserve it.
  const mergedRef: React.Ref<HTMLElement> = (instance) => {
    fieldRef.current = instance
    // React 19's ElementType doesn't expose `ref` on the cloneElement
    // props, but the child can still carry a ref via React's normal
    // mechanism. We don't need to forward to legacy `ref` callbacks
    // here — the rare case of a consumer passing an additional ref on
    // top of Field's cloneElement is out of v1 scope.
  }

  // Consumer pass-through (className / style / ...rest) for the DELEGATED
  // path. There, Field renders NO DOM of its own (it returns the clone), so
  // the cloned child IS the rendered root — merging consumer overrides onto
  // it is the only way to honor them without silently dropping them (#422).
  //
  //   - className: concatenated (Field's consumer class + the child's own).
  //   - style:     merged; the child's own `style` wins on key conflict, since
  //                the child is the consumer's element with explicit intent.
  //   - ...rest:   spread first so the child's own explicit props still win.
  //
  // On the BARE path these same overrides land on the `.container` wrapper
  // instead (see below), so we DON'T forward them onto the bare child.
  const childOwnClassName = (children.props as { className?: string }).className
  const childOwnStyle = (children.props as { style?: React.CSSProperties }).style
  const delegatedPassthrough = isBare
    ? null
    : {
        ...rest,
        className: [className, childOwnClassName].filter(Boolean).join(' ') || undefined,
        style:
          style || childOwnStyle
            ? { ...style, ...childOwnStyle }
            : undefined,
      }

  // The cloneElement cast collapses to `any` for the props shape — the
  // child's prop type may be narrower than HTMLAttributes (e.g. Input's
  // own InputProps), but cloneElement only accepts a Partial of the
  // child's props, and we know our injected shape is structurally
  // compatible (every Lando input + every host input accepts these).
  const cloned = React.cloneElement(
    children,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { ...delegatedPassthrough, ...childProps, ref: mergedRef } as unknown as any
  )

  // Label-aware children render their own chrome — we just return the
  // clone and let the child draw the label + error itself. This avoids
  // doubled labels / doubled error text.
  if (!isBare) {
    return cloned
  }

  // Bare path: render label + child + error/helper-text wrapper. Mirrors
  // the structure of `<Input>` so the visual result is consistent across
  // a form that mixes Lando inputs with raw `<input>` (e.g. a 3rd-party
  // input wrapped in a Field).
  //
  // The `.container` wrapper IS Field's owned visual root on this path, so
  // consumer className / style / ...rest land here. Rest is spread BEFORE
  // the component's own className/style so the latter win on conflict.
  return (
    <div
      {...rest}
      className={[styles.container, className].filter(Boolean).join(' ')}
      style={style}
    >
      <label htmlFor={fieldId} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-label="required">
            *
          </span>
        )}
      </label>

      {cloned}

      {(error || helperText) && (
        <div className={styles.footer}>
          {error ? (
            <span id={errorId} className={styles.errorText} role="alert" aria-live="polite">
              {error}
            </span>
          ) : helperText ? (
            <span id={helperId} className={styles.helperText}>
              {helperText}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}

Field.displayName = 'Field'
