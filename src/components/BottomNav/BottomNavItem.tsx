/**
 * BottomNavItem Component
 *
 * A single tab inside `<BottomNav>`. Stacks an icon on top of a small label,
 * with an optional badge (unread count) in the upper-right corner.
 *
 * ## asChild pattern (Slot)
 *
 * When `asChild` is true, the consumer's element (e.g. `<Link>`) receives the
 * className, ref, onClick, and aria-current props via the Slot pattern. The
 * icon, label, and badge children are passed through and stay in
 * BottomNavItem's control.
 *
 *   <BottomNavItem icon={<Compass />} label="Discover" asChild>
 *     <Link href="/discover" />
 *   </BottomNavItem>
 *
 * Note: when using `asChild`, the slotted child's children (if any) are
 * IGNORED — `icon` + `label` from BottomNavItem's props are rendered inside
 * the slot. This keeps the visual structure consistent across asChild and
 * non-asChild usage.
 *
 * ## Active state
 *
 * Pass `active={true}` (typically derived from your router's `pathname`) to
 * mark the current tab. Adds `aria-current="page"` and active styling.
 *
 * ## Badge slot
 *
 * Accepts:
 * - a number (rendered as text — `0` is treated as "no badge" and skipped)
 * - any other ReactNode (rendered as-is)
 * - `null` / `undefined` (no badge)
 *
 * @example
 * <BottomNavItem
 *   href="/inbox"
 *   icon={<Inbox />}
 *   label="Inbox"
 *   badge={unreadCount}
 *   active={pathname === '/inbox'}
 * />
 */

import React from 'react'
import { Slot } from '../Slot'
import { safeHref, isExternalHref } from '../../utils/safeHref'
import { sanitizeRestProps } from '../../utils/sanitizeRestProps'
import styles from './BottomNav.module.css'

export interface BottomNavItemProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  /**
   * URL to navigate to. Renders as `<a href="...">` when provided and
   * `asChild` is false. Omit when using `asChild` (the child owns href).
   */
  href?: string
  /**
   * Render the provided child element as the tab root via Slot.
   * Intended for routing-library integration (e.g. `next/link`):
   *
   *   <BottomNavItem icon={<X />} label="Y" asChild>
   *     <Link href="/y" />
   *   </BottomNavItem>
   *
   * When true, `href` is ignored — the child owns its routing.
   * The slotted child's own children are ignored; `icon` + `label` from this
   * component's props are rendered inside the slot for consistent visual
   * structure.
   */
  asChild?: boolean
  /** Leading icon — typically a lucide-react icon or DS `<Icon>`. */
  icon: React.ReactNode
  /** Short text label rendered below the icon (10–12px). */
  label: React.ReactNode
  /**
   * Optional badge content — number, ReactNode, null, or undefined.
   * - `null` / `undefined` / `0`: no badge rendered.
   * - number > 0: rendered as text inside a small pill.
   * - any other ReactNode: rendered as-is inside the badge container.
   */
  badge?: React.ReactNode | number | null
  /** Mark this tab as the current route. Adds `aria-current="page"`. */
  active?: boolean
  /** Click handler (fires alongside navigation). */
  onClick?: React.MouseEventHandler<HTMLElement>
  /** Additional className merged onto the tab root. */
  className?: string
  /**
   * Override the accessible name. Defaults to the rendered `label`. Useful when
   * `label` is a complex ReactNode and you want a plain-text aria-label.
   */
  ariaLabel?: string
  /** When asChild is true, the single React element child to slot into. */
  children?: React.ReactNode
}

/**
 * Decide whether the badge prop should render.
 * - `null` / `undefined`: skip
 * - `0` (number): skip — most badge usage is "unread count > 0"
 * - everything else: render
 */
function shouldRenderBadge(badge: React.ReactNode | number | null | undefined): boolean {
  if (badge === null || badge === undefined) return false
  if (typeof badge === 'number' && badge === 0) return false
  return true
}

export const BottomNavItem = React.forwardRef<HTMLElement, BottomNavItemProps>(
  (
    {
      href,
      asChild = false,
      icon,
      label,
      badge,
      active = false,
      onClick,
      className,
      ariaLabel,
      children,
      ...rest
    },
    ref,
  ) => {
    const classes = [
      styles.item,
      active ? styles.itemActive : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const sharedProps = {
      'aria-current': active ? ('page' as const) : undefined,
      'aria-label': ariaLabel,
      onClick,
      // #320 — never spread arbitrary consumer props raw onto the anchor/button.
      ...sanitizeRestProps(rest),
    }

    const inner = (
      <>
        <span className={styles.iconWrap} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.label}>{label}</span>
        {shouldRenderBadge(badge) && (
          <span className={styles.badge} aria-hidden="true">
            {badge}
          </span>
        )}
      </>
    )

    if (asChild) {
      // Slot the consumer's element. Their `children` (if any) are dropped —
      // we always render `icon` + `label` + `badge` so the visual structure
      // stays consistent across asChild and non-asChild usage.
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={classes}
          {...sharedProps}
        >
          {React.isValidElement(children)
            ? React.cloneElement(children as React.ReactElement<{ children?: React.ReactNode }>, {}, inner)
            : children}
        </Slot>
      )
    }

    if (href) {
      const external = isExternalHref(href)
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          {...sharedProps}
          // #320/#321 — sanitized href + tabnabbing protection LAST so a
          // pass-through prop can't override them.
          href={safeHref(href)}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
        >
          {inner}
        </a>
      )
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={classes}
        {...sharedProps}
      >
        {inner}
      </button>
    )
  },
)

BottomNavItem.displayName = 'BottomNavItem'
