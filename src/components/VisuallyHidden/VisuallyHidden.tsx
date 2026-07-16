/**
 * VisuallyHidden Component
 *
 * Renders content that is visually hidden but remains accessible to screen
 * readers — the canonical "sr-only" pattern (WCAG 1.3.1, 4.1.2 helper).
 * Use for off-screen labels, supplementary descriptions, and icon-button
 * names that should never appear visually.
 *
 * @example
 * <button>
 *   <Icon name="trash" />
 *   <VisuallyHidden>Delete item</VisuallyHidden>
 * </button>
 */

import React from 'react'
import styles from './VisuallyHidden.module.css'

type VisuallyHiddenElement = 'span' | 'div' | 'label' | 'p'

export interface VisuallyHiddenProps
  extends React.HTMLAttributes<HTMLElement> {
  /** HTML element to render as. Defaults to `'span'`. */
  as?: VisuallyHiddenElement
  /** Content visually hidden but read by AT. */
  children: React.ReactNode
}

export const VisuallyHidden = React.forwardRef<
  HTMLElement,
  VisuallyHiddenProps
>(({ as: Tag = 'span', className = '', children, ...props }, ref) => {
  const combined = [styles.visuallyHidden, className].filter(Boolean).join(' ')
  // Cast at the boundary: polymorphic `as` widens beyond span, so the
  // forwarded ref accepts any HTMLElement subtype.
  const TagComponent = Tag as React.ElementType
  return (
    <TagComponent ref={ref} className={combined} {...props}>
      {children}
    </TagComponent>
  )
})

VisuallyHidden.displayName = 'VisuallyHidden'
