'use client'

/**
 * RadioGroup Component
 *
 * A container component that manages a group of radio buttons with keyboard navigation.
 * Provides context for child Radio components.
 *
 * @example
 * <RadioGroup name="size" value={value} onChange={setValue}>
 *   <Radio value="sm" label="Small" />
 *   <Radio value="md" label="Medium" />
 *   <Radio value="lg" label="Large" />
 * </RadioGroup>
 */

import React, { createContext, useContext, useId } from 'react'
import styles from './Radio.module.css'

interface RadioGroupContextValue {
  name: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

export const useRadioGroup = () => {
  const context = useContext(RadioGroupContext)
  if (!context) {
    throw new Error('Radio must be used within RadioGroup')
  }
  return context
}

export interface RadioGroupProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'value' | 'defaultValue'
  > {
  /** Controlled value */
  value?: string
  /** Default value for uncontrolled mode */
  defaultValue?: string
  /** Callback when value changes */
  onChange?: (value: string) => void
  /** Name attribute for all radio buttons in this group */
  name: string
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical'
  /** Error message - when provided, group enters error state */
  error?: string
  /** Disable all radio buttons in the group */
  disabled?: boolean
  /** Container className */
  className?: string
  /** Children (Radio components) */
  children: React.ReactNode
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>((
  {
    value: controlledValue,
    defaultValue,
    onChange,
    name,
    orientation = 'vertical',
    error,
    disabled = false,
    className = '',
    children,
    style,
    ...rest
  },
  ref
) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue
  const groupId = useId()

  const handleChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const contextValue: RadioGroupContextValue = {
    name,
    value,
    onChange: handleChange,
    disabled,
  }

  const hasError = !!error

  const groupClasses = [
    styles.radioGroup,
    styles[orientation],
    hasError ? styles.groupError : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div
        {...rest}
        ref={ref}
        role="radiogroup"
        className={groupClasses}
        style={style}
        aria-invalid={hasError}
        aria-describedby={error ? `${groupId}-error` : undefined}
      >
        {children}
      </div>

      {error && (
        <span id={`${groupId}-error`} className={styles.errorText} role="alert">
          {error}
        </span>
      )}
    </RadioGroupContext.Provider>
  )
})

RadioGroup.displayName = 'RadioGroup'
