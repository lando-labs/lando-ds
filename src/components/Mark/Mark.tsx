/**
 * Mark Component
 *
 * Semantic `<mark>` wrapper with a brand-tinted background — the design
 * system's replacement for the browser's default fluorescent yellow.
 * Ideal for search-result highlighting, inline annotations, and call-outs.
 *
 * @example
 * <Text>The keyword <Mark>tokens</Mark> appears here.</Text>
 *
 * @example
 * // Layer-7 composition (#424): keep the highlight styling on your own element.
 * <Mark asChild><span role="note">flagged</span></Mark>
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './Mark.module.css'

export interface MarkProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Render as the single child element, merging Mark styling onto it
   * (Layer-7 composition, #424). The tinted `styles.mark` class lands on
   * the rendered child.
   */
  asChild?: boolean
  /** Highlighted content. */
  children: React.ReactNode
}

export const Mark = React.forwardRef<HTMLElement, MarkProps>(
  ({ asChild = false, className = '', children, ...props }, ref) => {
    const combined = [styles.mark, className].filter(Boolean).join(' ')
    const Comp = asChild ? Slot : 'mark'
    return (
      <Comp ref={ref} className={combined} {...props}>
        {children}
      </Comp>
    )
  },
)

Mark.displayName = 'Mark'
