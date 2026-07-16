/**
 * NavTabs.Item (#377)
 *
 * A single navigation item within `<NavTabs>`. Renders a real anchor (or a
 * routed child via `asChild`) with optional icon + badge slots and a
 * consumer-driven `active` state (2px underline + `aria-current="page"`).
 *
 * Lives in its own file (matching BottomNavItem/SidebarNavItem/BreadcrumbItem)
 * so its `asChild` polymorphism is attributed to `NavTabsItem` alone and does
 * not leak onto the `<NavTabs>` container in `meta.json` (#509).
 *
 * See `NavTabs.tsx` for usage examples.
 */

import React from 'react'
import { Slot } from '../Slot'
import { safeHref } from '../../utils/safeHref'
import { sanitizeRestProps } from '../../utils/sanitizeRestProps'
import styles from './NavTabs.module.css'

export interface NavTabsItemProps {
  /**
   * Mark this item as the current route. Adds `aria-current="page"` and
   * paints the 2px active underline.
   */
  active?: boolean
  /**
   * Render the provided child element as the link node, merging className,
   * `aria-current`, `onClick`, and ref onto it via the Slot pattern. Intended
   * for routing-library integration (e.g. `next/link`):
   *
   *   <NavTabs.Item asChild active>
   *     <Link href="/dashboard">Dashboard</Link>
   *   </NavTabs.Item>
   *
   * When true, `href` on the item is ignored — the child owns its routing.
   * The `icon` and `badge` slots continue to work normally (they render
   * inside the slotted child).
   */
  asChild?: boolean
  /**
   * URL for the plain-anchor flavor. Required when `asChild` is false.
   * Routed through `safeHref` so `javascript:`/`data:` etc. are neutralized
   * (#320 — enforced by `src/test/no-unguarded-anchor-href.test.ts`).
   */
  href?: string
  /** Optional leading icon — usually a lucide-react icon or DS `<Icon>`. */
  icon?: React.ReactNode
  /** Optional trailing badge (e.g. `<Badge>3</Badge>` or a status pill). */
  badge?: React.ReactNode
  /** Click handler (fires alongside navigation). */
  onClick?: React.MouseEventHandler<HTMLElement>
  /** Tab label. */
  children: React.ReactNode
  /** Additional className merged onto the link element. */
  className?: string
}

export const NavTabsItem = React.forwardRef<HTMLElement, NavTabsItemProps>(
  (
    {
      active = false,
      asChild = false,
      href,
      icon,
      badge,
      onClick,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const itemClasses = [
      styles.item,
      active ? styles.itemActive : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const sharedProps = {
      'aria-current': active ? ('page' as const) : undefined,
      onClick,
      // #320 — never spread arbitrary consumer props raw onto the anchor.
      ...sanitizeRestProps(rest),
    }

    /**
     * Build the icon + label + badge layout. `labelContent` is the text shown
     * in the label slot — for the plain-anchor flavor that's just `children`;
     * for `asChild`, it's the consumer's slotted child's OWN children (so we
     * don't nest the consumer's `<a>` inside our own label span).
     */
    const buildInner = (labelContent: React.ReactNode) => (
      <>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={styles.label}>{labelContent}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
      </>
    )

    if (asChild) {
      // The Slot wraps the consumer's element (e.g. <Link>) and merges
      // className + aria-current + onClick + ref onto it. We clone the
      // child, replacing its `children` with our icon+label+badge tree —
      // the label text is sourced from the consumer's child's own children
      // so we don't nest a duplicate <a> inside our own label span.
      if (!React.isValidElement(children)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'NavTabs.Item: `asChild` expects a single React element child ' +
              '(e.g. <Link href="…">Label</Link>).',
          )
        }
        return null
      }
      const childEl = children as React.ReactElement<{
        children?: React.ReactNode
      }>
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={itemClasses}
          {...sharedProps}
        >
          {React.cloneElement(childEl, {}, buildInner(childEl.props.children))}
        </Slot>
      )
    }

    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        // #320 — sanitize the href against javascript:/data:/etc.
        href={safeHref(href)}
        className={itemClasses}
        {...sharedProps}
      >
        {buildInner(children)}
      </a>
    )
  },
)

NavTabsItem.displayName = 'NavTabs.Item'
