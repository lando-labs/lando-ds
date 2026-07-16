'use client'

/**
 * AccordionItem Component
 *
 * An individual accordion item that can be expanded/collapsed.
 * Must be used within an Accordion component.
 *
 * @example
 * <AccordionItem value="item-1" title="Title">Content here</AccordionItem>
 * <AccordionItem value="item-2" title="Custom" icon={<Icon />}>More content</AccordionItem>
 */

import React, { useRef, useEffect, useState } from 'react'
import { useAccordion } from './Accordion'
import styles from './Accordion.module.css'

export interface AccordionItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Unique identifier for this item */
  value: string
  /** Title displayed in the header */
  title: string | React.ReactNode
  /** Optional icon displayed before title */
  icon?: React.ReactNode
  /** Disable this accordion item */
  disabled?: boolean
  /** Container className */
  className?: string
  /** Content to display when expanded */
  children: React.ReactNode
}

export const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  (
    {
      value,
      title,
      icon,
      disabled = false,
      className = '',
      children,
      style,
      ...rest
    },
    ref
  ) => {
  const { type, value: accordionValue, onChange } = useAccordion()
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(0)

  // Determine if this item is expanded
  const isExpanded = type === 'single'
    ? accordionValue === value
    : Array.isArray(accordionValue) && accordionValue.includes(value)

  // Calculate content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      if (isExpanded) {
        setHeight(contentRef.current.scrollHeight)
      } else {
        setHeight(0)
      }
    }
  }, [isExpanded, children])

  // Recalculate height on window resize
  useEffect(() => {
    if (!isExpanded) return

    const handleResize = () => {
      if (contentRef.current) {
        setHeight(contentRef.current.scrollHeight)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isExpanded])

  const handleClick = () => {
    if (!disabled) {
      onChange(value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const itemClasses = [
    styles.item,
    isExpanded ? styles.itemExpanded : '',
    disabled ? styles.itemDisabled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={ref} className={itemClasses} style={style} {...rest}>
      <button
        type="button"
        className={styles.trigger}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-disabled={disabled}
        disabled={disabled}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{title}</span>
        <ChevronIcon className={styles.chevron} />
      </button>

      <div
        className={styles.content}
        style={{ height: `${height}px` }}
        aria-hidden={!isExpanded}
      >
        <div ref={contentRef} className={styles.contentInner}>
          {children}
        </div>
      </div>
    </div>
  )
  }
)

AccordionItem.displayName = 'AccordionItem'

// Chevron icon component (private helper — not exported)
const ChevronIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
