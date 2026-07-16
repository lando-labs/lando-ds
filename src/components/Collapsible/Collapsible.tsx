'use client'

/**
 * Collapsible Component
 *
 * Standalone animated show/hide for a region of content. Distinct from
 * `<Accordion>`, which manages a group of sibling items in a single
 * shared expansion state — use Collapsible for one-off "click to expand"
 * surfaces (filter panels, settings sub-sections, advanced options).
 *
 * Animation mirrors `AccordionItem`: a measured height transition that
 * the user's `prefers-reduced-motion` setting suppresses to an instant
 * toggle. Supports controlled (`open` + `onOpenChange`) and uncontrolled
 * (`defaultOpen`) usage.
 *
 * @example
 * <Collapsible defaultOpen>
 *   <p>Body content shown initially.</p>
 * </Collapsible>
 *
 * <Collapsible open={showFilters} onOpenChange={setShowFilters}>
 *   <FilterPanel />
 * </Collapsible>
 */

import React, { useEffect, useRef, useState } from 'react'
import styles from './Collapsible.module.css'

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled open state. */
  open?: boolean
  /** Uncontrolled initial open state. Ignored when `open` is provided. */
  defaultOpen?: boolean
  /** Notified whenever the open state changes. */
  onOpenChange?: (open: boolean) => void
  /** Container className. */
  className?: string
  /** Content shown/hidden by the collapsible. */
  children: React.ReactNode
}

export const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  (
    {
      open: controlledOpen,
      defaultOpen = false,
      onOpenChange,
      className = '',
      style,
      children,
      ...rest
    },
    ref,
  ) => {
    const [internalOpen, setInternalOpen] = useState(defaultOpen)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen

    const contentRef = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState<number | undefined>(
      defaultOpen ? undefined : 0,
    )

    // Measure on open/content change so the height transition has a target
    // value; reset to 0 on close.
    useEffect(() => {
      if (!contentRef.current) return
      if (open) {
        setHeight(contentRef.current.scrollHeight)
      } else {
        setHeight(0)
      }
    }, [open, children])

    // Notify the consumer when an uncontrolled `internalOpen` changes.
    // (setInternalOpen is exported on context elsewhere in the codebase
    // for trigger primitives; this primitive renders the region only.)
    useEffect(() => {
      if (!isControlled) onOpenChange?.(internalOpen)
      // We intentionally only react to internalOpen here.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [internalOpen])
    void setInternalOpen

    const containerClasses = [
      styles.collapsible,
      open ? styles.open : styles.closed,
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={containerClasses} style={style} {...rest}>
        <div
          className={styles.content}
          style={{ height: height === undefined ? 'auto' : `${height}px` }}
          aria-hidden={!open}
          data-state={open ? 'open' : 'closed'}
        >
          <div ref={contentRef} className={styles.contentInner}>
            {children}
          </div>
        </div>
      </div>
    )
  },
)

Collapsible.displayName = 'Collapsible'
