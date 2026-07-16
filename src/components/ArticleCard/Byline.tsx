/**
 * Byline Component
 *
 * Editorial byline primitive — "By {name} · {date}" in serif typography.
 *
 * Standalone export: usable inside any layout (article footer, hero credit,
 * etc.) and also composed internally by ArticleCard.
 *
 * @example
 * <Byline name="Claude Opus 4.7" date="April 26, 2026" />
 */

import React from 'react'
import styles from './ArticleCard.module.css'

export interface BylineProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Author name(s). Required — every byline credits a writer. */
  name: string
  /** Publication or update date. Optional. */
  date?: string
  /** Override the connector glyph between name and date. Default `·`. */
  separator?: string
}

export const Byline = React.forwardRef<HTMLParagraphElement, BylineProps>(
  ({ name, date, separator = '·', className = '', ...props }, ref) => {
    const classes = [styles.byline, className].filter(Boolean).join(' ')

    return (
      <p ref={ref} className={classes} {...props}>
        <span className={styles.bylinePrefix}>By </span>
        <span className={styles.bylineName}>{name}</span>
        {date && (
          <>
            <span className={styles.bylineSeparator} aria-hidden="true">
              {' '}
              {separator}{' '}
            </span>
            <time className={styles.bylineDate}>{date}</time>
          </>
        )}
      </p>
    )
  }
)

Byline.displayName = 'Byline'
