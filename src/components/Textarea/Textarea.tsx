'use client'

/**
 * Textarea Component
 *
 * A flexible textarea component with label, helper text, error states, and character counter.
 * Supports auto-resize and controlled/uncontrolled modes.
 *
 * @example
 * <Textarea label="Description" placeholder="Enter description..." />
 * <Textarea label="Bio" maxLength={500} showCount />
 * <Textarea label="Message" error="Message is required" />
 */

import React, { useState, useId } from 'react'
import styles from './Textarea.module.css'

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  /** Controlled value */
  value?: string
  /** Default value for uncontrolled mode */
  defaultValue?: string
  /** Callback when textarea value changes */
  onChange?: (value: string) => void
  /** Label text displayed above textarea */
  label?: string
  /** Helper text displayed below textarea */
  helperText?: string
  /** Error message - when provided, textarea enters error state */
  error?: string
  /** Number of visible text rows */
  rows?: number
  /** Resize behavior */
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
  /** Maximum character length */
  maxLength?: number
  /**
   * Show character count (requires maxLength).
   *
   * Web-native shorthand kept for backwards compatibility. Cross-platform
   * consumers should prefer `showCharacterCount`, which is the canonical
   * name used by the React Native `Textarea`/`Input` primitives (Refs:
   * #240 remediation). Both props are accepted; if either is true the
   * counter renders.
   */
  showCount?: boolean
  /**
   * Show character count (requires maxLength).
   *
   * Canonical cross-platform alias matching the React Native package.
   * Use this when writing code that targets both web and React Native
   * so the prop name doesn't have to fork per platform (Refs: #240
   * remediation). If both `showCount` and `showCharacterCount` are
   * provided, the counter renders if either is true.
   */
  showCharacterCount?: boolean
  /** Container className for styling wrapper */
  containerClassName?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      label,
      helperText,
      error,
      rows = 4,
      resize = 'vertical',
      maxLength,
      showCount = false,
      showCharacterCount = false,
      containerClassName = '',
      className = '',
      disabled,
      readOnly,
      required,
      id,
      placeholder,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const textareaId = id || generatedId
    const [charCount, setCharCount] = useState(
      typeof value === 'string' ? value.length : typeof defaultValue === 'string' ? defaultValue.length : 0
    )

    // Unified flag: either prop name turns the counter on. Cross-platform
    // consumers should prefer `showCharacterCount` (matches RN); web-only
    // consumers can keep using `showCount`. (Refs: #240 remediation)
    const showCounter = showCount || showCharacterCount

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      if (showCounter || maxLength) {
        setCharCount(newValue.length)
      }
      onChange?.(newValue)
    }

    const hasError = !!error
    const isAtLimit = maxLength !== undefined && charCount >= maxLength

    const textareaClasses = [
      styles.textarea,
      styles[`resize-${resize}`],
      hasError ? styles.error : '',
      disabled ? styles.disabled : '',
      readOnly ? styles.readonly : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={`${styles.container} ${containerClassName}`}>
        {label && (
          <label htmlFor={textareaId} className={styles.label}>
            {label}
            {required && <span className={styles.required} aria-label="required">*</span>}
          </label>
        )}

        <div className={styles.textareaWrapper}>
          <textarea
            ref={ref}
            id={textareaId}
            className={textareaClasses}
            rows={rows}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined
            }
            value={value}
            defaultValue={defaultValue}
            {...props}
            onChange={handleChange}
          />
        </div>

        {(error || helperText || (showCounter && maxLength)) && (
          <div className={styles.footer}>
            <div className={styles.helperWrapper}>
              {error && (
                <span id={`${textareaId}-error`} className={styles.errorText} role="alert">
                  {error}
                </span>
              )}
              {!error && helperText && (
                <span id={`${textareaId}-helper`} className={styles.helperText}>
                  {helperText}
                </span>
              )}
            </div>

            {showCounter && maxLength && (
              <span
                className={`${styles.charCount} ${isAtLimit ? styles.charCountLimit : ''}`}
                aria-live="polite"
                aria-atomic="true"
              >
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
