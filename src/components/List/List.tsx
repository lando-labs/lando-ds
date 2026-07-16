/**
 * List Component
 *
 * A flexible list container supporting ordered, unordered, and plain variants.
 * Works with ListItem components for consistent spacing and styling.
 *
 * @example
 * <List variant="unordered" divider>
 *   <ListItem>First item</ListItem>
 *   <ListItem>Second item</ListItem>
 * </List>
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './List.module.css'

type ListVariant = 'ordered' | 'unordered' | 'plain'

type ListOwnProps = {
  /** List style variant */
  variant?: ListVariant
  /** Spacing between items */
  spacing?: 'sm' | 'md' | 'lg'
  /** Show dividers between items */
  divider?: boolean
  /**
   * Render as the single child element, merging List styling onto it
   * (Layer-7 composition, #424). The element type is normally derived from
   * `variant` (`<ol>` for ordered, else `<ul>`); `asChild` lets you supply
   * your own root element (e.g. a `<nav>`-wrapped list) while keeping the
   * `styles.list` classes.
   */
  asChild?: boolean
  /** Additional CSS class */
  className?: string
  /** List content (ListItem children) */
  children?: React.ReactNode
}

/**
 * List prop surface.
 *
 * The component renders either `<ol>` or `<ul>` depending on `variant`. Both
 * element types share `React.HTMLAttributes<HTMLElement>` for non-native-specific
 * props (className, style, aria-*, role, etc.), so we type the extra props via
 * the intersection with `HTMLAttributes<HTMLOListElement | HTMLUListElement>`.
 */
export type ListProps = ListOwnProps &
  Omit<React.HTMLAttributes<HTMLOListElement | HTMLUListElement>, keyof ListOwnProps>

export const List = React.forwardRef<HTMLOListElement | HTMLUListElement, ListProps>(
  (
    {
      variant = 'unordered',
      spacing = 'md',
      divider = false,
      asChild = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const listClasses = [
      styles.list,
      styles[variant],
      styles[`spacing-${spacing}`],
      divider ? styles.divider : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // #424 — asChild merges List styling onto the caller's element, bypassing
    // the variant-driven `<ol>`/`<ul>` choice.
    if (asChild) {
      return (
        <Slot
          ref={ref as unknown as React.Ref<HTMLElement>}
          className={listClasses}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    if (variant === 'ordered') {
      return (
        <ol
          ref={ref as React.Ref<HTMLOListElement>}
          className={listClasses}
          {...props}
        >
          {children}
        </ol>
      )
    }

    return (
      <ul
        ref={ref as React.Ref<HTMLUListElement>}
        className={listClasses}
        {...props}
      >
        {children}
      </ul>
    )
  }
)

List.displayName = 'List'
