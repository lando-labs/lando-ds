'use client'

/**
 * DropdownItem Component
 *
 * Individual menu item in a Dropdown with optional icon, destructive styling,
 * and divider support.
 *
 * @example
 * <DropdownItem icon={<SaveIcon />} onClick={() => save()}>
 *   Save
 * </DropdownItem>
 *
 * <DropdownItem divider />
 *
 * <DropdownItem destructive onClick={() => deleteItem()}>
 *   Delete
 * </DropdownItem>
 */

import React from 'react'
import styles from './Dropdown.module.css'

export interface DropdownItemProps
  extends Omit<React.HTMLAttributes<HTMLButtonElement>, 'onClick' | 'onSelect'> {
  /** Icon to display before content */
  icon?: React.ReactNode
  /** Click handler */
  onClick?: () => void
  /** Disable interaction */
  disabled?: boolean
  /** Destructive action (red text) */
  destructive?: boolean
  /** Render as divider instead of item */
  divider?: boolean
  /** Additional CSS class */
  className?: string
  /** Item content */
  children?: React.ReactNode
  /** Internal: callback from Dropdown for closing */
  onSelect?: () => void
}

export const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  function DropdownItem(
    {
      icon,
      onClick,
      disabled = false,
      destructive = false,
      divider = false,
      className = '',
      children,
      onSelect,
      style,
      ...rest
    },
    ref
  ) {
    // Render divider. The passthrough props are typed for the primary
    // `<button role="menuitem">` visual root; the divider is a separate
    // `<div role="separator">` branch, so only the element-agnostic `style`
    // is forwarded here (spreading button-typed handlers onto a div would be a
    // type error, and a separator is not an interactive item). `data-*` /
    // `aria-*` for the divider can be supplied via `style`-adjacent props on
    // the item branch instead.
    if (divider) {
      return <div className={styles.divider} style={style} role="separator" />
    }

    const handleClick = () => {
      if (!disabled && onClick) {
        onClick()
      }
      if (onSelect) {
        onSelect()
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleClick()
      }
    }

    const itemClasses = [
      styles.item,
      disabled ? styles.disabled : '',
      destructive ? styles.destructive : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        ref={ref}
        type="button"
        className={itemClasses}
        style={style}
        // Consumer passthrough (#423). `{...rest}` spreads BEFORE the behavioral
        // handlers and the `role="menuitem"`/disabled/tabIndex contract so a
        // consumer can't clobber item activation or the menu-item semantics.
        {...rest}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        role="menuitem"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      >
        {icon && <span className={styles.itemIcon}>{icon}</span>}
        <span className={styles.itemContent}>{children}</span>
      </button>
    )
  }
)

DropdownItem.displayName = 'DropdownItem'
