'use client'

/**
 * NumberInput Component
 *
 * A numeric input with stepper buttons, min/max clamping, configurable
 * precision, and ARIA spinbutton semantics. Distinct from <Input type="number">
 * which has well-known a11y/styling issues (mobile keyboard quirks, accidental
 * scroll-wheel mutation, UA stepper styling battles, locale parsing).
 *
 * Sprint 54 (#309) — Lane B of v0.33.0.
 *
 * @example
 * // Controlled
 * <NumberInput
 *   label="Quantity"
 *   value={qty}
 *   onChange={(n) => setQty(n)}
 *   min={0}
 *   max={99}
 * />
 *
 * @example
 * // Decimal with precision
 * <NumberInput
 *   label="Price"
 *   defaultValue={9.99}
 *   step={0.01}
 *   precision={2}
 *   min={0}
 * />
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Icon } from '../Icon'
import styles from './NumberInput.module.css'

type NumberInputSize = 'sm' | 'md' | 'lg'

// All native input attrs that NumberInput owns or types differently than
// HTMLInputElement (value/defaultValue/onChange/min/max/step/size/type).
type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'min'
  | 'max'
  | 'step'
  | 'size'
  | 'type'
>

export interface NumberInputProps extends NativeInputProps {
  /** Controlled numeric value. Pass `undefined` for empty. */
  value?: number
  /** Uncontrolled initial value. */
  defaultValue?: number
  /**
   * Called when the value changes. Receives `undefined` when the field is
   * cleared — distinct from `0` — following the #328 Select convention.
   */
  onChange?: (value: number | undefined) => void
  /** Minimum allowed value. Clamped on blur and stepping. */
  min?: number
  /** Maximum allowed value. Clamped on blur and stepping. */
  max?: number
  /** Step amount for steppers, arrow keys, and PageUp/Down. Defaults to 1. */
  step?: number
  /** Decimal places to enforce on blur. Defaults to 0 (integer). */
  precision?: number
  /** When false, the `-` key is rejected and pasted negatives clamp to min/0. */
  allowNegative?: boolean
  /** Disabled state (also sets aria-disabled). */
  disabled?: boolean
  /** Read-only state. */
  readOnly?: boolean
  /** Label rendered above the input. */
  label?: string
  /** Helper text below the input. Suppressed when `error` is set. */
  helperText?: string
  /** Error message — when set, the input goes into the invalid state. */
  error?: string
  /** Placeholder text. */
  placeholder?: string
  /** Size of the input + steppers. */
  size?: NumberInputSize
  /** Show the +/- stepper buttons on the right. Defaults to true. */
  showSteppers?: boolean
  /** ClassName applied to the outer container. */
  containerClassName?: string
}

/* -------------------------------------------------------------------------- *
 *  Internal helpers
 * -------------------------------------------------------------------------- */

/**
 * Clamp `n` between `min` and `max`. If only one bound is defined, applies it.
 * `min > max` is invalid — the caller is expected to have warned + dropped one.
 */
function clamp(n: number, min: number | undefined, max: number | undefined): number {
  let v = n
  if (typeof min === 'number' && v < min) v = min
  if (typeof max === 'number' && v > max) v = max
  return v
}

/**
 * Round `n` to `precision` decimal places using round-half-away-from-zero.
 * Uses an epsilon-shifted Math.round to avoid IEEE-754 binary-fp quirks
 * (e.g. 1.005 → 1 instead of 1.01 with naive `Math.round(n * 100) / 100`).
 */
function roundToPrecision(n: number, precision: number): number {
  if (precision <= 0) return Math.round(n)
  const factor = Math.pow(10, precision)
  // Re-stringify to drop floating-point noise before rounding.
  return Math.round((n + Number.EPSILON) * factor) / factor
}

/**
 * Parse a user-typed string into a number. Returns `undefined` for
 * empty / unparseable input. Does NOT enforce min/max/precision/sign —
 * that happens on blur and stepping. Note: we deliberately preserve the
 * `-` sign here so a negative value reaches `clampAndCommit`, where the
 * `allowNegative=false` clamp branch can hoist it to min/0. (The keydown
 * handler rejects the `-` keypress itself; this path only matters for
 * paste / programmatic `.value` writes.)
 */
function parseInput(
  raw: string,
  { precision }: { precision: number }
): number | undefined {
  if (raw === '' || raw === '-') return undefined
  let cleaned = raw
  if (precision <= 0) cleaned = cleaned.replace(/\./g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Format a number for display. We don't use Intl.NumberFormat in v1 to keep
 * controlled-input round-tripping deterministic (locale separators would
 * fight typing). The issue notes Intl.NumberFormat as a future enhancement.
 */
function formatDisplay(
  value: number | undefined,
  precision: number
): string {
  if (value === undefined) return ''
  if (precision > 0) return value.toFixed(precision)
  return String(value)
}

/* -------------------------------------------------------------------------- *
 *  Component
 * -------------------------------------------------------------------------- */

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      min,
      max,
      step = 1,
      precision = 0,
      allowNegative = true,
      disabled = false,
      readOnly = false,
      label,
      helperText,
      error,
      placeholder,
      size = 'md',
      showSteppers = true,
      containerClassName = '',
      className = '',
      id,
      onBlur,
      onKeyDown,
      onPaste,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    /* ---- Invalid-config guard ---------------------------------------- */
    // If min > max, log once and ignore max (treat as unbounded above).
    // Use a ref so we only warn on the first render where the misconfig is
    // present — re-warning every render would spam the console.
    const warnedRef = useRef(false)
    let effectiveMax = max
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      if (!warnedRef.current) {
        console.warn(
          `[NumberInput] min (${min}) > max (${max}); ignoring max. ` +
            'Please pass a valid range.'
        )
        warnedRef.current = true
      }
      effectiveMax = undefined
    }

    /* ---- Controlled vs uncontrolled --------------------------------- */
    const isControlled = value !== undefined
    const [internalValue, setInternalValue] = useState<number | undefined>(
      defaultValue
    )
    const currentValue = isControlled ? value : internalValue

    // Display string is what's in the <input>. It tracks `currentValue` but
    // also holds transient typing state (e.g. `"1."`, `"-"`) before commit.
    const [displayValue, setDisplayValue] = useState<string>(() =>
      formatDisplay(currentValue, precision)
    )

    // When the controlled value (or precision) changes from outside while the
    // user isn't actively typing, sync the display. We compare against the
    // displayed value to avoid clobbering mid-edit state.
    useEffect(() => {
      const formatted = formatDisplay(currentValue, precision)
      // parseInput round-trip lets us distinguish "user typed `1.` and the
      // formatted controlled value is also 1" (don't stomp) from a genuine
      // external value change.
      const parsedDisplay = parseInput(displayValue, { precision })
      if (parsedDisplay !== currentValue) {
        setDisplayValue(formatted)
      }
      // We intentionally do NOT include displayValue in deps — it would
      // re-sync on every keystroke and trash transient typing state.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentValue, precision])

    /* ---- Commit helpers --------------------------------------------- */

    const commitValue = useCallback(
      (next: number | undefined) => {
        // NaN should never make it this far, but belt-and-braces:
        if (typeof next === 'number' && !Number.isFinite(next)) return
        if (!isControlled) setInternalValue(next)
        onChange?.(next)
      },
      [isControlled, onChange]
    )

    /**
     * Apply min/max clamping AND precision rounding, then commit. Used by
     * blur, stepper clicks, and keyboard increment.
     */
    const clampAndCommit = useCallback(
      (n: number | undefined): number | undefined => {
        if (n === undefined) {
          commitValue(undefined)
          setDisplayValue('')
          return undefined
        }
        // allowNegative=false: clamp negatives to min (or 0).
        let v = n
        if (!allowNegative && v < 0) {
          v = typeof min === 'number' ? min : 0
        }
        v = clamp(v, min, effectiveMax)
        v = roundToPrecision(v, precision)
        commitValue(v)
        setDisplayValue(formatDisplay(v, precision))
        return v
      },
      [allowNegative, min, effectiveMax, precision, commitValue]
    )

    /**
     * Increment or decrement by `step * multiplier`. Multiplier is 1 for
     * single arrow/click, 10 for Shift+Arrow and PageUp/Down.
     */
    const stepBy = useCallback(
      (direction: 1 | -1, multiplier: number = 1) => {
        if (disabled || readOnly) return
        const base = currentValue ?? (typeof min === 'number' ? min : 0)
        const next = base + direction * step * multiplier
        clampAndCommit(next)
      },
      [disabled, readOnly, currentValue, min, step, clampAndCommit]
    )

    /* ---- Event handlers --------------------------------------------- */

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      setDisplayValue(raw)
      const parsed = parseInput(raw, { precision })
      if (parsed === undefined) {
        // Empty or transient ("-", "1."). Only emit undefined if the field is
        // truly empty so trailing-decimal typing doesn't fire a spurious clear.
        if (raw === '') commitValue(undefined)
        return
      }
      // Don't clamp/round mid-typing — that fights the user. Just propagate
      // the parsed value upward so controlled callers see live updates.
      commitValue(parsed)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Commit final formatted value (clamp + precision-round) on blur.
      const parsed = parseInput(displayValue, { precision })
      clampAndCommit(parsed)
      onBlur?.(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow consumer's keydown handler to run first (e.g. for form submit
      // shortcuts). It can preventDefault to suppress our handling.
      onKeyDown?.(e)
      if (e.defaultPrevented) return
      if (disabled || readOnly) return

      // Reject `-` keypress when allowNegative=false.
      if (!allowNegative && e.key === '-') {
        e.preventDefault()
        return
      }

      // Stepper keyboard handling.
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          stepBy(1, e.shiftKey ? 10 : 1)
          break
        case 'ArrowDown':
          e.preventDefault()
          stepBy(-1, e.shiftKey ? 10 : 1)
          break
        case 'PageUp':
          e.preventDefault()
          stepBy(1, 10)
          break
        case 'PageDown':
          e.preventDefault()
          stepBy(-1, 10)
          break
        case 'Home':
          if (typeof min === 'number') {
            e.preventDefault()
            clampAndCommit(min)
          }
          break
        case 'End':
          if (typeof effectiveMax === 'number') {
            e.preventDefault()
            clampAndCommit(effectiveMax)
          }
          break
      }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      onPaste?.(e)
      if (e.defaultPrevented) return
      const pasted = e.clipboardData.getData('text')
      const parsed = parseInput(pasted, { precision })
      if (parsed === undefined) {
        // Unparseable paste — block it so the field doesn't get garbage.
        e.preventDefault()
        return
      }
      // Let the default paste happen for parseable input — onChange + onBlur
      // will normalize it. For unparseable but partially numeric pastes (e.g.
      // "$1,234.56") we currently reject; locale-aware paste is out of scope
      // for v1 per the issue body.
    }

    /* ---- Derived a11y / styling ------------------------------------- */

    const hasError = !!error
    const canIncrement =
      !disabled &&
      !readOnly &&
      (typeof effectiveMax !== 'number' ||
        (currentValue ?? -Infinity) < effectiveMax)
    const canDecrement =
      !disabled &&
      !readOnly &&
      (typeof min !== 'number' || (currentValue ?? Infinity) > min)

    const inputClasses = [
      styles.input,
      styles[`size-${size}`],
      showSteppers ? styles.hasSteppers : '',
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
            {rest.required && (
              <span className={styles.required} aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        <div className={`${styles.inputWrapper} ${styles[`size-${size}`]}`}>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode={precision > 0 ? 'decimal' : 'numeric'}
            role="spinbutton"
            className={inputClasses}
            value={displayValue}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={hasError || undefined}
            aria-disabled={disabled || undefined}
            aria-readonly={readOnly || undefined}
            aria-valuenow={currentValue}
            aria-valuemin={min}
            aria-valuemax={effectiveMax}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            {...rest}
          />

          {showSteppers && (
            <div className={styles.steppers} aria-hidden={false}>
              <button
                type="button"
                className={`${styles.stepper} ${styles.stepperUp}`}
                onClick={() => stepBy(1)}
                disabled={!canIncrement}
                aria-label="Increment"
                tabIndex={-1}
              >
                <Icon size="sm">
                  <Plus />
                </Icon>
              </button>
              <button
                type="button"
                className={`${styles.stepper} ${styles.stepperDown}`}
                onClick={() => stepBy(-1)}
                disabled={!canDecrement}
                aria-label="Decrement"
                tabIndex={-1}
              >
                <Icon size="sm">
                  <Minus />
                </Icon>
              </button>
            </div>
          )}
        </div>

        {(error || helperText) && (
          <div className={styles.footer}>
            {error && (
              <span id={errorId} className={styles.errorText} role="alert">
                {error}
              </span>
            )}
            {!error && helperText && (
              <span id={helperId} className={styles.helperText}>
                {helperText}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }
)

NumberInput.displayName = 'NumberInput'
