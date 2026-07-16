'use client'

/**
 * Switch Component
 *
 * A toggle switch component with a smooth wave transition animation.
 * Available in three sizes with full keyboard accessibility.
 *
 * @example
 * <Switch label="Enable notifications" />
 * <Switch checked={enabled} onChange={setEnabled} size="lg" />
 * <Switch label="Dark mode" disabled />
 */

import React, { useId } from 'react'
import styles from './Switch.module.css'

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'size'> {
  /** Controlled checked state */
  checked?: boolean
  /** Default checked state for uncontrolled mode */
  defaultChecked?: boolean
  /** Callback when switch state changes */
  onChange?: (checked: boolean) => void
  /** Label text displayed next to switch */
  label?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Container className for styling wrapper */
  containerClassName?: string
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked,
      onChange,
      label,
      size = 'md',
      disabled,
      containerClassName = '',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const switchId = id || generatedId

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // #76 — Explicit disabled guard. See Checkbox for rationale; mirrors
      // Radio's pattern so all three form components behave consistently.
      if (disabled) return
      onChange?.(e.target.checked)
    }

    const switchClasses = [
      styles.switch,
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const trackClasses = [
      styles.track,
      styles[size],
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={`${styles.container} ${containerClassName}`}>
        <label htmlFor={switchId} className={styles.switchWrapper}>
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            role="switch"
            className={switchClasses}
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            aria-checked={checked}
            {...props}
            onChange={handleChange}
          />

          <span className={trackClasses} aria-hidden="true">
            <span className={styles.thumb} />
          </span>

          {label && (
            <span className={styles.label}>
              {label}
            </span>
          )}
        </label>
      </div>
    )
  }
)

Switch.displayName = 'Switch'
