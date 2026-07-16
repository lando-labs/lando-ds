'use client'

/**
 * Breadcrumb Component
 *
 * Navigation component showing the current page's location within a hierarchy.
 * Uses context to manage separator and item states.
 *
 * @example
 * <Breadcrumb>
 *   <BreadcrumbItem href="/">Home</BreadcrumbItem>
 *   <BreadcrumbItem href="/products">Products</BreadcrumbItem>
 *   <BreadcrumbItem active>Current Page</BreadcrumbItem>
 * </Breadcrumb>
 */

import React, { createContext, useContext } from 'react'
import styles from './Breadcrumb.module.css'

interface BreadcrumbContextValue {
  separator: React.ReactNode
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  separator: '/',
})

export const useBreadcrumb = () => useContext(BreadcrumbContext)

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  /** Custom separator between items */
  separator?: React.ReactNode
  /** Additional CSS class merged onto the `<nav>` root. */
  className?: string
  /**
   * Inline styles merged onto the `<nav>` root.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
  /** Breadcrumb items */
  children: React.ReactNode
}

export const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ separator = '/', className = '', style, children, ...rest }, ref) => {
    return (
      <BreadcrumbContext.Provider value={{ separator }}>
        <nav
          ref={ref}
          // Consumer escape hatch spread BEFORE the internal aria-label so
          // the component's landmark label stays authoritative.
          {...rest}
          aria-label="Breadcrumb"
          className={[styles.breadcrumb, className].filter(Boolean).join(' ')}
          style={style}
        >
          <ol className={styles.list}>{children}</ol>
        </nav>
      </BreadcrumbContext.Provider>
    )
  }
)

Breadcrumb.displayName = 'Breadcrumb'
