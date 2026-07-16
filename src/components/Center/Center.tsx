/**
 * Center Component
 *
 * Layout primitive that centers its children both horizontally and
 * vertically. A trivial flex container; mostly here for declarative
 * readability so `<Center>` reads at a glance.
 *
 * @example
 * <Center inline>
 *   <Spinner />
 * </Center>
 *
 * <Center as="section">
 *   <EmptyState title="No items" />
 * </Center>
 */

import React from 'react'
import styles from './Center.module.css'

type CenterElement = 'div' | 'span' | 'section' | 'main' | 'article'

export interface CenterProps extends React.HTMLAttributes<HTMLElement> {
  /** HTML element to render as. Defaults to `'div'`. */
  as?: CenterElement
  /** Render with `inline-flex` instead of `flex` (inline-block context). */
  inline?: boolean
  /** Centered content. */
  children?: React.ReactNode
}

export const Center = React.forwardRef<HTMLElement, CenterProps>(
  ({ as: Tag = 'div', inline = false, className = '', children, ...props }, ref) => {
    const combined = [
      styles.center,
      inline ? styles.inline : styles.block,
      className,
    ]
      .filter(Boolean)
      .join(' ')
    // Cast at the boundary: the polymorphic `as` widens the element type
    // beyond the forwarded ref's HTMLDivElement default. Consumers retain
    // type-safety via the `as` prop hint.
    const TagComponent = Tag as React.ElementType
    return (
      <TagComponent ref={ref} className={combined} {...props}>
        {children}
      </TagComponent>
    )
  },
)

Center.displayName = 'Center'
