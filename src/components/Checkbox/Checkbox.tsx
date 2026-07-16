'use client'

/**
 * Checkbox Component
 *
 * A flexible checkbox component with label, error states, and indeterminate support.
 * Features a brand-themed checkmark animation and full keyboard accessibility.
 *
 * @example
 * <Checkbox label="Accept terms" />
 * <Checkbox checked={checked} onChange={setChecked} />
 * <Checkbox indeterminate label="Select all" />
 */

import React, { useRef, useEffect, useId } from 'react'
import styles from './Checkbox.module.css'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** Controlled checked state */
  checked?: boolean
  /** Default checked state for uncontrolled mode */
  defaultChecked?: boolean
  /** Callback when checkbox state changes */
  onChange?: (checked: boolean) => void
  /** Label text displayed next to checkbox */
  label?: string
  /** Error message - when provided, checkbox enters error state */
  error?: string
  /** Indeterminate state (for partial selection in groups) */
  indeterminate?: boolean
  /** Container className for styling wrapper */
  containerClassName?: string
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked,
      defaultChecked,
      onChange,
      label,
      disabled,
      error,
      indeterminate = false,
      containerClassName = '',
      className = '',
      id,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const checkboxId = id || generatedId
    const inputRef = useRef<HTMLInputElement>(null)

    // Merge external ref with internal ref
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(inputRef.current)
      } else if (ref) {
        ref.current = inputRef.current
      }
    }, [ref])

    // Handle indeterminate state (must be set via property, not attribute)
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate
      }
    }, [indeterminate])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // #76 — Explicit disabled guard. Real browsers suppress change events
      // on disabled inputs, but JSDOM's fireEvent.click bypasses that guard,
      // and subtle DOM edge cases (programmatic .click(), synthetic events
      // from addons) can fire onChange on a disabled input. Matches Radio's
      // pattern so all three form components behave consistently.
      if (disabled) return
      onChange?.(e.target.checked)
    }

    const hasError = !!error

    const checkboxClasses = [
      styles.checkbox,
      hasError ? styles.error : '',
      indeterminate ? styles.indeterminate : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={`${styles.container} ${containerClassName}`}>
        <label htmlFor={checkboxId} className={styles.checkboxWrapper}>
          <input
            ref={inputRef}
            id={checkboxId}
            type="checkbox"
            className={checkboxClasses}
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={error ? `${checkboxId}-error` : undefined}
            {...props}
            onChange={handleChange}
          />

          <span className={styles.checkboxControl} aria-hidden="true">
            <svg
              className={styles.checkIcon}
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M11.5 5L7 10.5L4.5 8"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <svg
              className={styles.indeterminateIcon}
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 8H11"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </span>

          {label && (
            <span className={styles.label}>
              {label}
              {required && <span className={styles.required} aria-label="required">*</span>}
            </span>
          )}
        </label>

        {error && (
          <span id={`${checkboxId}-error`} className={styles.errorText} role="alert">
            {error}
          </span>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'
