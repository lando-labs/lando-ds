/**
 * CardFooter Component
 *
 * Footer section for Card component, typically containing actions or metadata.
 *
 * @example
 * <CardFooter>
 *   <Button>Action</Button>
 * </CardFooter>
 */

import React from 'react'
import styles from './Card.module.css'

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${styles.cardFooter} ${className}`} {...props}>
        {children}
      </div>
    )
  }
)

CardFooter.displayName = 'CardFooter'
