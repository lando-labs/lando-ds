'use client'

/**
 * Input Component
 *
 * A flexible input component with label, helper text, error states, and icon support.
 * Built with accessibility in mind (semantic HTML, label association, ARIA on
 * error/helper text); a systematic WCAG AA audit is tracked in #13 — do not
 * assume full AA conformance.
 *
 * @example
 * <Input label="Email" type="email" placeholder="Enter your email" />
 * <Input label="Password" type="password" error="Password is required" />
 * <Input leftIcon={<SearchIcon />} placeholder="Search..." />
 */

import React, { useState, useId } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'
import { Icon } from '../Icon'
import styles from './Input.module.css'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text displayed above the input */
  label?: string
  /** Helper text displayed below the input */
  helperText?: string
  /** Error message - when provided, input enters error state */
  error?: string
  /** Icon or element displayed on the left side of input */
  leftIcon?: React.ReactNode
  /** Icon or element displayed on the right side of input */
  rightIcon?: React.ReactNode
  /**
   * Show character count (requires maxLength to be set).
   *
   * Web-native shorthand. Cross-platform consumers should prefer
   * `showCharacterCount`, which is the canonical name used by the
   * React Native `Input` (Refs: #240 remediation). Both props are
   * accepted; if either is true the counter renders.
   */
  showCharCount?: boolean
  /**
   * Show character count (requires maxLength to be set).
   *
   * Canonical cross-platform alias for `showCharCount`. Use this when
   * writing code that targets both the web and React Native packages
   * so the prop name doesn't have to fork per platform (Refs: #240
   * remediation). If both `showCharCount` and `showCharacterCount`
   * are provided, the counter renders if either is true.
   */
  showCharacterCount?: boolean
  /** Callback when clear button is clicked */
  onClear?: () => void
  /** Container className for styling wrapper */
  containerClassName?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      showCharCount = false,
      showCharacterCount = false,
      maxLength,
      onClear,
      containerClassName = '',
      className = '',
      disabled,
      readOnly,
      required,
      id,
      type = 'text',
      value,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const [showPassword, setShowPassword] = useState(false)
    const [charCount, setCharCount] = useState(
      typeof value === 'string' ? value.length : 0
    )

    // Unified flag: either prop name turns the counter on. Cross-platform
    // consumers should prefer `showCharacterCount` (matches RN); web-only
    // consumers can keep using `showCharCount`. (Refs: #240 remediation)
    const showCount = showCharCount || showCharacterCount

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (showCount) {
        setCharCount(e.target.value.length)
      }
      props.onChange?.(e)
    }

    const handleClear = () => {
      setCharCount(0)
      onClear?.()
    }

    const inputType = type === 'password' && showPassword ? 'text' : type

    const hasError = !!error
    const showClearButton = onClear && value && !disabled && !readOnly

    const inputClasses = [
      styles.input,
      leftIcon ? styles.hasLeftIcon : '',
      (rightIcon || showClearButton || type === 'password') ? styles.hasRightIcon : '',
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
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && <span className={styles.required} aria-label="required">*</span>}
          </label>
        )}

        <div className={styles.inputWrapper}>
          {leftIcon && (
            <span className={styles.leftIcon} aria-hidden="true">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={inputClasses}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            maxLength={maxLength}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            value={value}
            {...props}
            onChange={handleChange}
          />

          <div className={styles.rightIconGroup}>
            {type === 'password' && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <Icon size="sm">{showPassword ? <EyeOff /> : <Eye />}</Icon>
              </button>
            )}

            {showClearButton && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={handleClear}
                aria-label="Clear input"
              >
                <Icon size="sm"><X /></Icon>
              </button>
            )}

            {rightIcon && !showClearButton && type !== 'password' && (
              <span className={styles.rightIcon} aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </div>
        </div>

        {(error || helperText || (showCount && maxLength)) && (
          <div className={styles.footer}>
            <div className={styles.helperWrapper}>
              {error && (
                <span id={`${inputId}-error`} className={styles.errorText} role="alert">
                  {error}
                </span>
              )}
              {!error && helperText && (
                <span id={`${inputId}-helper`} className={styles.helperText}>
                  {helperText}
                </span>
              )}
            </div>

            {showCount && maxLength && (
              <span className={styles.charCount} aria-live="polite" aria-atomic="true">
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
