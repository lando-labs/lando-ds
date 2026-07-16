'use client'

/**
 * Radio Component
 *
 * A radio button component that must be used within a RadioGroup.
 * Features a subtle selection animation and full keyboard accessibility.
 *
 * Accepts either `children` (recommended — matches React ecosystem convention)
 * or `label` (kept for backward compatibility) to render the radio label.
 * When both are provided, `children` takes precedence.
 *
 * @example
 * // Recommended: children pattern (matches Radix, shadcn/ui, MUI)
 * <RadioGroup name="size" value={value} onChange={setValue}>
 *   <Radio value="sm">Small</Radio>
 *   <Radio value="md">Medium</Radio>
 *   <Radio value="lg"><strong>Large</strong> (most popular)</Radio>
 * </RadioGroup>
 *
 * @example
 * // Also supported: label prop
 * <RadioGroup name="size" value={value} onChange={setValue}>
 *   <Radio value="sm" label="Small" />
 *   <Radio value="md" label="Medium" />
 * </RadioGroup>
 */

import React, { useId } from 'react'
import { useRadioGroup } from './RadioGroup'
import styles from './Radio.module.css'

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'name' | 'children'> {
  /** Value for this radio option */
  value: string
  /**
   * Label content displayed next to the radio.
   * Preferred over `label` — matches React ecosystem convention and
   * supports rich content (formatted text, icons, etc.).
   * When both `children` and `label` are provided, `children` wins.
   */
  children?: React.ReactNode
  /**
   * Label text displayed next to radio.
   * Retained for backward compatibility; new code should use `children`.
   */
  label?: React.ReactNode
  /** Container className for styling wrapper */
  containerClassName?: string
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      value,
      label,
      children,
      disabled: disabledProp,
      containerClassName = '',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const { name, value: groupValue, onChange, disabled: groupDisabled } = useRadioGroup()
    const generatedId = useId()
    const radioId = id || generatedId

    const isChecked = groupValue === value
    const isDisabled = disabledProp || groupDisabled

    const handleChange = () => {
      if (!isDisabled) {
        onChange?.(value)
      }
    }

    const radioClasses = [
      styles.radio,
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // children takes precedence over label (matches ecosystem convention).
    // If neither is provided, no label text is rendered (radio still works).
    const labelContent = children ?? label

    return (
      <div className={`${styles.radioContainer} ${containerClassName}`}>
        <label htmlFor={radioId} className={styles.radioWrapper}>
          <input
            ref={ref}
            id={radioId}
            type="radio"
            name={name}
            value={value}
            checked={isChecked}
            disabled={isDisabled}
            className={radioClasses}
            onChange={handleChange}
            {...props}
          />

          <span className={styles.radioControl} aria-hidden="true">
            <span className={styles.radioIndicator} />
          </span>

          {labelContent != null && labelContent !== false && (
            <span className={styles.label}>
              {labelContent}
            </span>
          )}
        </label>
      </div>
    )
  }
)

Radio.displayName = 'Radio'
