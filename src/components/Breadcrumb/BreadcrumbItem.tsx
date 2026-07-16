'use client'

/**
 * BreadcrumbItem Component
 *
 * Individual item within a Breadcrumb navigation.
 * Can be a link (plain `<a>` via `href`, or routed via `asChild`),
 * or plain text (when active).
 *
 * @example
 * // Plain <a> link
 * <BreadcrumbItem href="/home">Home</BreadcrumbItem>
 *
 * // Active (current page, not a link)
 * <BreadcrumbItem active>Current</BreadcrumbItem>
 *
 * @example
 * // next/link integration via asChild
 * import Link from 'next/link'
 * <BreadcrumbItem asChild>
 *   <Link href="/team">Team</Link>
 * </BreadcrumbItem>
 */

import React from 'react'
import { Slot } from '../Slot'
import { safeHref } from '../../utils/safeHref'
import { useBreadcrumb } from './Breadcrumb'
import styles from './Breadcrumb.module.css'

export interface BreadcrumbItemProps
  extends Omit<React.HTMLAttributes<HTMLLIElement>, 'onClick'> {
  /**
   * URL for a plain-<a> breadcrumb item.
   * For routed links (next/link etc.), use `asChild` instead.
   */
  href?: string
  /**
   * Render as the single child element, merging link styling onto it.
   * Enables routing libraries (next/link, react-router Link) to work
   * without wrapping. When true, `href` and `onClick` on the item are
   * ignored — put them on the child instead.
   */
  asChild?: boolean
  /** Indicates current page (not a link) */
  active?: boolean
  /** Click handler for custom navigation (ignored when `asChild`) */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  /** Additional CSS class */
  className?: string
  /** Item content */
  children: React.ReactNode
}

export const BreadcrumbItem = React.forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  (
    {
      href,
      asChild = false,
      active = false,
      onClick,
      className = '',
      style,
      children,
      ...rest
    },
    ref
  ) => {
    const { separator } = useBreadcrumb()

    const itemClasses = [
      styles.item,
      active ? styles.active : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (active) {
        e.preventDefault()
        return
      }
      onClick?.(e)
    }

    // Active items render as text regardless of asChild — semantically they
    // aren't navigation.
    const renderLink = () => {
      if (asChild) {
        return (
          <Slot className={styles.link}>
            {children}
          </Slot>
        )
      }
      return (
        // #320 — sanitize consumer-supplied href against javascript:/data:/etc.
        <a href={safeHref(href)} className={styles.link} onClick={handleClick}>
          {children}
        </a>
      )
    }

    return (
      <li ref={ref} className={itemClasses} style={style} {...rest}>
        {active || (!href && !asChild) ? (
          <span
            className={styles.text}
            aria-current={active ? 'page' : undefined}
          >
            {children}
          </span>
        ) : (
          renderLink()
        )}
        {!active && (
          <span className={styles.separator} aria-hidden="true">
            {separator}
          </span>
        )}
      </li>
    )
  }
)

BreadcrumbItem.displayName = 'BreadcrumbItem'
