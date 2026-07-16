/**
 * PullQuote Component
 *
 * Editorial pull-quote — a `<blockquote>` rendered with italic serif type,
 * indentation, and a left-border accent rule (using --color-editorial-rule
 * which inherits from --color-border-subtle so dark mode propagates).
 *
 * Standalone export: drop into any prose layout to highlight a quote. Also
 * composed internally by ArticleCard when the consumer passes a `pullQuote`
 * prop.
 *
 * @example
 * <PullQuote>"The most striking thing was how predictable it all became."</PullQuote>
 *
 * @example
 * // With attribution:
 * <PullQuote cite="A. Lovelace">
 *   "The Analytical Engine has no pretensions whatever to originate anything."
 * </PullQuote>
 */

import React from 'react'
import styles from './ArticleCard.module.css'

export interface PullQuoteProps
  extends React.BlockquoteHTMLAttributes<HTMLQuoteElement> {
  /** Quote text. */
  children: React.ReactNode
  /** Optional attribution rendered below the quote in muted byline style. */
  attribution?: React.ReactNode
}

export const PullQuote = React.forwardRef<HTMLQuoteElement, PullQuoteProps>(
  ({ children, attribution, className = '', ...props }, ref) => {
    const classes = [styles.pullQuote, className].filter(Boolean).join(' ')

    return (
      <blockquote ref={ref} className={classes} {...props}>
        <p className={styles.pullQuoteText}>{children}</p>
        {attribution && (
          <footer className={styles.pullQuoteAttribution}>
            <span aria-hidden="true">— </span>
            {attribution}
          </footer>
        )}
      </blockquote>
    )
  }
)

PullQuote.displayName = 'PullQuote'
