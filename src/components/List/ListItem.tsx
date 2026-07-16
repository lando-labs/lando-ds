'use client'

/**
 * ListItem Component
 *
 * Individual item in a List with optional icon, actions, and interactive states.
 * Can be clickable, active, or disabled.
 *
 * @example
 * <ListItem icon={<UserIcon />} onClick={() => {}}>
 *   Click me
 * </ListItem>
 */

import React from 'react'
import styles from './List.module.css'

export interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  /** Icon to display before content */
  icon?: React.ReactNode
  /** Actions to display after content */
  actions?: React.ReactNode
  /** Make the item clickable */
  onClick?: () => void
  /** Highlight as active/selected */
  active?: boolean
  /** Disable interaction */
  disabled?: boolean
}

export const ListItem = React.forwardRef<HTMLLIElement, ListItemProps>(
  (
    {
      icon,
      actions,
      onClick,
      active = false,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const itemClasses = [
      styles.listItem,
      onClick ? styles.clickable : '',
      active ? styles.active : '',
      disabled ? styles.disabled : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const handleClick = () => {
      if (!disabled && onClick) {
        onClick()
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!disabled && onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick()
      }
    }

    return (
      <li
        ref={ref}
        className={itemClasses}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
        aria-disabled={disabled}
        {...props}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.content}>{children}</span>
        {actions && <span className={styles.actions}>{actions}</span>}
      </li>
    )
  }
)

ListItem.displayName = 'ListItem'
