/**
 * AvatarGroup Component
 *
 * Renders multiple `<Avatar>` children with a slight horizontal overlap
 * to compactly represent a team or contributor list. When the child count
 * exceeds `max`, the overflow is collapsed into a "+N" affordance.
 *
 * @example
 * <AvatarGroup max={3}>
 *   <Avatar initials="JD" />
 *   <Avatar initials="AB" />
 *   <Avatar initials="CD" />
 *   <Avatar initials="EF" />
 * </AvatarGroup>
 */

import React from 'react'
import styles from './AvatarGroup.module.css'

export type AvatarGroupSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface AvatarGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Avatar children to stack. */
  children: React.ReactNode
  /** Truncate after this many avatars; surplus rolls into a "+N" badge. */
  max?: number
  /**
   * Inherited size token passed down via a `data-size` attribute so
   * descendants can opt-in to matched dimensions. The Avatar component
   * still owns its own `size` prop — this is a hint, not enforcement.
   */
  size?: AvatarGroupSize
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ children, max, size = 'md', className = '', ...props }, ref) => {
    const all = React.Children.toArray(children).filter(React.isValidElement)
    const visible = typeof max === 'number' ? all.slice(0, max) : all
    const overflow = all.length - visible.length

    const combined = [styles.group, styles[`size-${size}`], className]
      .filter(Boolean)
      .join(' ')

    return (
      <div
        ref={ref}
        className={combined}
        data-size={size}
        {...props}
      >
        {visible.map((child, index) => (
          <span key={index} className={styles.slot}>
            {child}
          </span>
        ))}
        {overflow > 0 && (
          <span
            className={`${styles.slot} ${styles.overflow}`}
            aria-label={`${overflow} more`}
          >
            +{overflow}
          </span>
        )}
      </div>
    )
  },
)

AvatarGroup.displayName = 'AvatarGroup'
