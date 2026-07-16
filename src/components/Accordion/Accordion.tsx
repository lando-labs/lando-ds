'use client'

/**
 * Accordion Component
 *
 * A container component that manages a group of accordion items.
 * Supports single or multiple expansion modes with smooth animations.
 *
 * @example
 * <Accordion type="single" defaultValue="item-1">
 *   <AccordionItem value="item-1" title="Section 1">Content 1</AccordionItem>
 *   <AccordionItem value="item-2" title="Section 2">Content 2</AccordionItem>
 * </Accordion>
 */

import React, { createContext, useContext, useState } from 'react'
import styles from './Accordion.module.css'

interface AccordionContextValue {
  type: 'single' | 'multiple'
  value: string | string[]
  onChange: (value: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

export const useAccordion = () => {
  const context = useContext(AccordionContext)
  if (!context) {
    throw new Error('AccordionItem must be used within Accordion')
  }
  return context
}

export interface AccordionProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Expansion mode: single = only one open at a time, multiple = many can be open */
  type?: 'single' | 'multiple'
  /** Default expanded value(s) for uncontrolled mode */
  defaultValue?: string | string[]
  /** Controlled expanded value(s) */
  value?: string | string[]
  /** Callback when expansion changes */
  onChange?: (value: string | string[]) => void
  /** Container className */
  className?: string
  /** Children (AccordionItem components) */
  children: React.ReactNode
}

export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      type = 'single',
      defaultValue,
      value: controlledValue,
      onChange,
      className = '',
      children,
      style,
      ...rest
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState<string | string[]>(() => {
      if (defaultValue !== undefined) {
        return defaultValue
      }
      return type === 'single' ? '' : []
    })

    const isControlled = controlledValue !== undefined
    const value = isControlled ? controlledValue : internalValue

    const handleChange = (itemValue: string) => {
      let newValue: string | string[]

      if (type === 'single') {
        // Single mode: toggle or set new value
        newValue = value === itemValue ? '' : itemValue
      } else {
        // Multiple mode: add/remove from array
        const currentArray = Array.isArray(value) ? value : []
        if (currentArray.includes(itemValue)) {
          newValue = currentArray.filter(v => v !== itemValue)
        } else {
          newValue = [...currentArray, itemValue]
        }
      }

      if (!isControlled) {
        setInternalValue(newValue)
      }
      onChange?.(newValue)
    }

    const contextValue: AccordionContextValue = {
      type,
      value,
      onChange: handleChange,
    }

    return (
      <AccordionContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={`${styles.accordion} ${className}`}
          style={style}
          {...rest}
        >
          {children}
        </div>
      </AccordionContext.Provider>
    )
  }
)

Accordion.displayName = 'Accordion'
