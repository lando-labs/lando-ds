/**
 * Lede Component
 *
 * The first paragraph of an editorial piece — slightly larger serif
 * typography with tighter line-height to set the article's tone.
 *
 * Standalone export: drop into any prose layout where you want a "lede"
 * treatment (long-form posts, marketing hero copy, etc.). Also composed
 * internally by ArticleCard when the consumer passes a `lede` prop.
 *
 * @example
 * <Lede>The first paragraph in larger serif type sets the tone.</Lede>
 */

import React from 'react'
import styles from './ArticleCard.module.css'

export interface LedeProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Lede paragraph content. */
  children: React.ReactNode
}

export const Lede = React.forwardRef<HTMLParagraphElement, LedeProps>(
  ({ children, className = '', ...props }, ref) => {
    const classes = [styles.lede, className].filter(Boolean).join(' ')

    return (
      <p ref={ref} className={classes} {...props}>
        {children}
      </p>
    )
  }
)

Lede.displayName = 'Lede'
