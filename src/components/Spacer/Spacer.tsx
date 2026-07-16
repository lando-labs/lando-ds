/**
 * Spacer Component
 *
 * A flexible spacer that fills available space along the parent flex axis.
 * Drop one between siblings to push them apart without per-sibling
 * `margin-left: auto`.
 *
 * @example
 * <Inline>
 *   <Avatar />
 *   <Text>Jane Doe</Text>
 *   <Spacer />
 *   <Badge>Admin</Badge>
 * </Inline>
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './Spacer.module.css'

export interface SpacerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Visual orientation hint — sets the corresponding minimum dimension so
   * the spacer renders even when the parent isn't flex. In a flex parent
   * the `flex: 1 1 auto` rule does the work; the prop is purely a no-op
   * outside flex contexts. Defaults to `'horizontal'`.
   */
  axis?: 'horizontal' | 'vertical'
  /**
   * Render as the single child element, merging Spacer styling onto it
   * (Layer-7 composition, #424). Pass a single element as `children`; the
   * `styles.spacer` class and `aria-hidden` land on it.
   */
  asChild?: boolean
  /**
   * Child element to render when `asChild` is true. Ignored otherwise
   * (a plain Spacer renders no children).
   */
  children?: React.ReactNode
}

export const Spacer = React.forwardRef<HTMLSpanElement, SpacerProps>(
  ({ axis = 'horizontal', asChild = false, className = '', children, ...props }, ref) => {
    const combined = [styles.spacer, styles[axis], className]
      .filter(Boolean)
      .join(' ')
    if (asChild) {
      return (
        <Slot ref={ref} className={combined} aria-hidden="true" {...props}>
          {children}
        </Slot>
      )
    }
    return (
      <span
        ref={ref}
        className={combined}
        aria-hidden="true"
        {...props}
      />
    )
  },
)

Spacer.displayName = 'Spacer'
