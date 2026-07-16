'use client'

/**
 * SidebarNavItem Component
 *
 * A reusable navigation item primitive for sidebar navigation.
 * Absorbs the repeated `.nav-item` CSS pattern that every consumer was
 * rebuilding from scratch.
 *
 * ## asChild pattern (Option B — recommended)
 *
 * When `asChild` is true, the inner **label portion** is slotted via the Slot
 * component — the consumer's element (e.g. `<Link>`) receives the className,
 * ref, onClick, and aria-current attributes, while the outer wrapper and the
 * icon / badge slots remain in SidebarNavItem's control.
 *
 *   <SidebarNavItem icon={<Users />} badge={<Badge>3</Badge>} asChild>
 *     <Link href="/contacts">Contacts</Link>
 *   </SidebarNavItem>
 *
 * Renders as:
 *   <div class="item [active]">
 *     <span class="icon">…icon…</span>
 *     <Link href="/contacts" class="label [active]" aria-current="page">Contacts</Link>
 *     <span class="badge">…badge…</span>
 *   </div>
 *
 * ## Collapsed-rail mode
 *
 * Pass `collapsed={true}` to enter rail mode. The label and badge are hidden,
 * and the item is wrapped in a Tooltip (placement="right") so the label
 * remains discoverable for keyboard and pointer users.
 *
 * Note: Sidebar.tsx does NOT expose a React context — there is no
 * `useSidebarContext` available. Consumers must pass `collapsed` down
 * explicitly (or compose this inside the `collapsedContent` prop of Sidebar).
 *
 * @example Static href
 * <SidebarNavItem href="/" icon={<LayoutDashboard />} active>Dashboard</SidebarNavItem>
 *
 * @example With badge
 * <SidebarNavItem href="/contacts" icon={<Users />} badge={<Badge>3</Badge>}>
 *   Contacts
 * </SidebarNavItem>
 *
 * @example next/link integration
 * <SidebarNavItem icon={<Users />} asChild>
 *   <Link href="/contacts">Contacts</Link>
 * </SidebarNavItem>
 *
 * @example Collapsed rail — auto-wraps with Tooltip showing the label
 * <SidebarNavItem href="/contacts" icon={<Users />} collapsed>Contacts</SidebarNavItem>
 */

import React from 'react'
import { Slot } from '../Slot'
import { Tooltip } from '../Tooltip'
import { safeHref } from '../../utils/safeHref'
import { sanitizeRestProps } from '../../utils/sanitizeRestProps'
import { useSidebarContext } from './Sidebar'
import styles from './SidebarNavItem.module.css'

/**
 * Pass-through attributes for the rendered label element (the `<a>` /
 * `<button>` / slotted child). `onClick` is omitted because SidebarNavItem
 * restates it below with the same handler type for documentation; `children`
 * is redefined as the label content. All other native attributes — `style`,
 * `data-*`, `aria-*`, `title`, etc. — are accepted and flow (sanitized) onto
 * the label, including THROUGH `<Slot>` onto the consumer's child in
 * `asChild` mode.
 */
type SidebarNavItemRootAttributes = Omit<
  React.HTMLAttributes<HTMLElement>,
  'onClick' | 'children'
>

export interface SidebarNavItemProps extends SidebarNavItemRootAttributes {
  /**
   * URL to navigate to. Renders as `<a>` when provided and `asChild` is false.
   * Omit when using `asChild` (the child element owns its own href).
   */
  href?: string
  /**
   * Render the provided child element as the label node, merging
   * className / onClick / aria-current / ref onto it via the Slot pattern.
   * Intended for next/link integration:
   *   `<SidebarNavItem asChild><Link href="/x">Label</Link></SidebarNavItem>`
   *
   * When `asChild` is true, `href` is ignored — the child owns its routing.
   * The `icon` and `badge` props continue to work normally (they render
   * outside the Slot, in the wrapping div).
   */
  asChild?: boolean
  /**
   * Optional leading icon — accepts any ReactNode so consumers can pass raw
   * lucide-react components or DS `<Icon>` wrappers.
   */
  icon?: React.ReactNode
  /**
   * Mark this item as the current page/active route.
   * Renders with `aria-current="page"` and active styling.
   */
  active?: boolean
  /** Optional trailing badge/chip (e.g. unread count `<Badge>3</Badge>`). */
  badge?: React.ReactNode
  /** Label text — also used as Tooltip content in collapsed-rail mode. */
  children: React.ReactNode
  /**
   * Collapsed-rail mode. Hides the label and badge; wraps the item in a
   * Tooltip (placement right) showing `children` as the label.
   *
   * When omitted, the value is inherited from the parent <Sidebar> via
   * context (#391) — so a child renders in rail mode automatically whenever
   * the Sidebar is collapsed, with no consumer wiring. Pass an explicit
   * boolean to override the inherited value (e.g. force rail mode in a
   * standalone usage outside a Sidebar parent).
   */
  collapsed?: boolean
  /** Click handler (fires alongside navigation). */
  onClick?: React.MouseEventHandler<HTMLElement>
  /**
   * Additional className merged with internal styles on the OUTER wrapper
   * `<div>` (the full item row — padding, hover/active background).
   *
   * Note: `style` and any other pass-through attributes (`data-*`, `aria-*`,
   * `title`, …) land on the INNER label element instead — the `<a>` /
   * `<button>` / slotted child — because that is the interactive node and the
   * documented `asChild` Slot target. This split mirrors the existing runtime
   * behavior: className styles the row box; other attributes ride the link.
   */
  className?: string
}

export const SidebarNavItem = React.forwardRef<HTMLElement, SidebarNavItemProps>(
  (
    {
      href,
      asChild = false,
      icon,
      active = false,
      badge,
      children,
      collapsed: collapsedProp,
      onClick,
      className,
      ...rest
    },
    ref,
  ) => {
    // #391 — inherit collapsed from Sidebar parent when the consumer doesn't
    // pin it explicitly. Standalone usage (no Sidebar parent) gets `false`.
    const sidebarCtx = useSidebarContext()
    const collapsed = collapsedProp ?? sidebarCtx?.collapsed ?? false

    const wrapperClasses = [
      styles.item,
      active ? styles.active : '',
      collapsed ? styles.collapsed : '',
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

    const iconNode = icon ? (
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    ) : null

    const badgeNode = !collapsed && badge ? (
      <span className={styles.badge}>{badge}</span>
    ) : null

    let labelNode: React.ReactNode

    if (asChild) {
      // Option B: Slot wraps the consumer's element (e.g. Link) and merges
      // className, aria-current, onClick, and ref onto it. The icon and badge
      // are rendered as siblings outside the Slot in the wrapper div.
      // The Slot inherits styles.label so the child's text is styled correctly.
      labelNode = (
        <Slot
          // ref forwarded to the slotted child (e.g. <a> rendered by Link)
          ref={ref as React.Ref<HTMLElement>}
          className={[styles.label, active ? styles.labelActive : ''].filter(Boolean).join(' ')}
          {...sharedProps}
        >
          {children}
        </Slot>
      )
    } else if (href) {
      labelNode = (
        <a
          // Forwarded ref is typed as HTMLElement (broadest base). <a> extends
          // HTMLElement — casting to HTMLAnchorElement is safe and satisfies the
          // <a> ref type without using `any`.
          ref={ref as React.Ref<HTMLAnchorElement>}
          // #320 — sanitize the href against javascript:/data:/etc.
          href={safeHref(href)}
          className={styles.label}
          {...sharedProps}
        >
          {!collapsed && children}
        </a>
      )
    } else {
      labelNode = (
        <button
          // Same reasoning as above — HTMLButtonElement extends HTMLElement.
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          className={styles.label}
          {...sharedProps}
        >
          {!collapsed && children}
        </button>
      )
    }

    const item = (
      <div className={wrapperClasses}>
        {iconNode}
        {labelNode}
        {badgeNode}
      </div>
    )

    // In collapsed-rail mode, wrap with Tooltip so users see the label on
    // hover/focus. placement="right" matches the rail's narrow profile.
    if (collapsed) {
      return (
        <Tooltip content={children} position="right">
          {item}
        </Tooltip>
      )
    }

    return item
  },
)

SidebarNavItem.displayName = 'SidebarNavItem'
