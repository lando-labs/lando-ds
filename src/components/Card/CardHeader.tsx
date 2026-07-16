/**
 * CardHeader Component
 *
 * Header section for Card component, typically containing a title and optional actions.
 *
 * @example
 * <CardHeader>
 *   <h3>Card Title</h3>
 * </CardHeader>
 */

import React from 'react'
import styles from './Card.module.css'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional content or actions (e.g., buttons, icons) */
  actions?: React.ReactNode
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', actions, children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${styles.cardHeader} ${className}`} {...props}>
        <div className={styles.cardHeaderContent}>{children}</div>
        {actions && <div className={styles.cardHeaderActions}>{actions}</div>}
      </div>
    )
  }
)

CardHeader.displayName = 'CardHeader'
