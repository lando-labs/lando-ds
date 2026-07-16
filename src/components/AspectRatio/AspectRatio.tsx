/**
 * AspectRatio Component
 *
 * Constrains its child to a fixed width/height ratio using the native CSS
 * `aspect-ratio` property. The component itself is a plain `<div>` wrapper —
 * the child fills it completely so any element (image, video, iframe, map)
 * inherits the ratio without bespoke padding-bottom hacks.
 *
 * @example
 * <AspectRatio ratio={16 / 9}>
 *   <img src="/hero.jpg" alt="Hero" />
 * </AspectRatio>
 *
 * <AspectRatio ratio="4 / 3" />
 */

import React from 'react'
import styles from './AspectRatio.module.css'

export interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width-to-height ratio. Accepts a number (`16 / 9`) or a CSS-valid string
   * (`"16 / 9"`, `"1.618"`). Defaults to `16 / 9`.
   */
  ratio?: number | string
  /** Child element constrained to the ratio. */
  children?: React.ReactNode
}

export const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ ratio = 16 / 9, className = '', style, children, ...props }, ref) => {
    const combined = [styles.aspectRatio, className].filter(Boolean).join(' ')
    return (
      <div
        ref={ref}
        className={combined}
        style={{ aspectRatio: String(ratio), ...style }}
        {...props}
      >
        {children}
      </div>
    )
  },
)

AspectRatio.displayName = 'AspectRatio'
