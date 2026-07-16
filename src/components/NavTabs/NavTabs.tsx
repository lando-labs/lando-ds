/**
 * NavTabs Component (#377)
 *
 * Horizontal area-switcher for app top-bars and section navigation.
 * Absorbs the `.topbar-area-link` pattern that consumers were hand-rolling
 * from raw `<Link>` + a 2px brand underline.
 *
 * ## NavTabs vs. Tabs — important distinction
 *
 * `<NavTabs>` is the NAVIGATION pattern: a row of links that route the user
 * between pages / app areas. Each item is a real anchor (or a routed child via
 * `asChild`), and the active state is **consumer-driven** (you pass `active`
 * because you know the current route).
 *
 * `<Tabs>` (existing) is the PANEL-SWITCHING pattern: tabbed UI inside a single
 * page that toggles between sibling content panels. State is owned by the Tabs
 * component itself.
 *
 * If you're switching routes → `NavTabs`.
 * If you're switching panels on the SAME route → `Tabs`.
 *
 * ## Active-indicator: CSS-only 2px underline
 *
 * The active item is marked by a 2px bottom border in `--color-primary`. This
 * is intentionally a CSS-only affordance (no JS measurement, no FLIP animation
 * in v1) so the component is SSR-safe and ships with zero client JS for the
 * non-`asChild` plain-anchor flavor.
 *
 * ## Keyboard
 *
 * Native Tab navigation moves between items — each item is a real link, so it
 * is focusable by default. There is intentionally NO roving tabindex / arrow
 * key handler in v1; nav items are anchors, not radio-like tabs, and hijacking
 * arrow keys would break expected screen-reader behavior.
 *
 * @example Plain anchor
 * <NavTabs aria-label="Primary">
 *   <NavTabs.Item href="/dashboard" active>Dashboard</NavTabs.Item>
 *   <NavTabs.Item href="/contacts">Contacts</NavTabs.Item>
 *   <NavTabs.Item href="/settings">Settings</NavTabs.Item>
 * </NavTabs>
 *
 * @example Next.js routing via asChild
 * import Link from 'next/link'
 *
 * <NavTabs aria-label="Primary">
 *   <NavTabs.Item asChild active={pathname === '/dashboard'}>
 *     <Link href="/dashboard">Dashboard</Link>
 *   </NavTabs.Item>
 *   <NavTabs.Item asChild active={pathname.startsWith('/contacts')}>
 *     <Link href="/contacts">Contacts</Link>
 *   </NavTabs.Item>
 * </NavTabs>
 *
 * @example With icon + badge slots
 * <NavTabs aria-label="Primary">
 *   <NavTabs.Item href="/inbox" icon={<Inbox />} badge={<Badge>3</Badge>} active>
 *     Inbox
 *   </NavTabs.Item>
 * </NavTabs>
 */

import React from 'react'
import styles from './NavTabs.module.css'
import { NavTabsItem, type NavTabsItemProps } from './NavTabsItem'

export interface NavTabsProps extends React.HTMLAttributes<HTMLElement> {
  /** Accessible label for the navigation landmark. Defaults to `"Primary"`. */
  'aria-label'?: string
  /** `<NavTabs.Item>` elements. */
  children: React.ReactNode
  /** Additional className merged onto the `<nav>` root. */
  className?: string
  /**
   * Inline styles merged onto the `<nav>` root.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

interface NavTabsComponent
  extends React.ForwardRefExoticComponent<
    NavTabsProps & React.RefAttributes<HTMLElement>
  > {
  Item: typeof NavTabsItem
}

const NavTabsBase = React.forwardRef<HTMLElement, NavTabsProps>(
  (
    { 'aria-label': ariaLabel = 'Primary', className, style, children, ...rest },
    ref,
  ) => {
    const classes = [styles.navTabs, className].filter(Boolean).join(' ')

    // Wrap each child in an <li> so the list semantics are correct without
    // forcing consumers to write <li> wrappers themselves.
    const items = React.Children.toArray(children).map((child, index) => {
      if (!React.isValidElement(child)) return child
      return (
        <li key={(child.key ?? index) as React.Key} className={styles.itemWrapper}>
          {child}
        </li>
      )
    })

    return (
      <nav
        ref={ref}
        // Consumer escape hatch spread BEFORE the resolved aria-label so the
        // dedicated prop (with its "Primary" default) stays authoritative.
        {...rest}
        aria-label={ariaLabel}
        className={classes}
        style={style}
      >
        {/* role="list" — Safari + iOS VoiceOver strip implicit list semantics
            when `list-style: none` is applied. The explicit role brings them
            back. */}
        <ul role="list" className={styles.list}>
          {items}
        </ul>
      </nav>
    )
  },
)

NavTabsBase.displayName = 'NavTabs'

export const NavTabs = NavTabsBase as NavTabsComponent
NavTabs.Item = NavTabsItem

// NavTabsItem lives in its own file (#509) so its `asChild` polymorphism is
// attributed to NavTabsItem alone in meta, not the NavTabs container. Re-export
// here so the established `@lando-labs/lando-ds` import paths are unchanged.
export { NavTabsItem, type NavTabsItemProps }
