/**
 * BottomNav Component
 *
 * Mobile-only fixed-bottom tab bar (e.g. Discover / Library / Serve / Account).
 * Hidden at `>= 768px` (breakpoints.px.md) — desktop layouts use the Sidebar
 * pattern instead.
 *
 * Sprint 17 (#82) — absorbs a consumer app's hand-rolled mobile nav.
 *
 * ## Composition
 *
 *   <BottomNav>
 *     <BottomNavItem href="/discover" icon={<Compass />} label="Discover" active />
 *     <BottomNavItem href="/library"  icon={<Leaf />}   label="Library" badge={3} />
 *     <BottomNavItem href="/serve"    icon={<Coffee />} label="Serve" />
 *     <BottomNavItem href="/account"  icon={<User />}   label="Account" />
 *   </BottomNav>
 *
 * ## Layout
 *
 * - `position: fixed; bottom: 0; left: 0; right: 0`
 * - Height ~60px (configurable via `--bottomnav-height` CSS var)
 * - `padding-bottom: env(safe-area-inset-bottom)` so the bar respects iOS home indicators
 * - z-index: `var(--z-bottomnav, 900)` (Lane 3 owns the canonical token)
 *
 * ## Consumer responsibility
 *
 * Because the bar is `position: fixed`, the underlying page can scroll
 * underneath it. Consumers should add bottom padding to the main content
 * area (e.g. `padding-bottom: 60px` on mobile) so the last bit of content
 * isn't covered by the bar.
 */

import React from 'react'
import styles from './BottomNav.module.css'

export interface BottomNavProps extends React.HTMLAttributes<HTMLElement> {
  /** Tab items — usually `<BottomNavItem>` children. */
  children: React.ReactNode
  /** Accessible label for the navigation landmark. Defaults to "Primary". */
  ariaLabel?: string
  /** Additional className merged with internal styles. */
  className?: string
}

export const BottomNav = React.forwardRef<HTMLElement, BottomNavProps>(
  ({ children, ariaLabel = 'Primary', className, ...rest }, ref) => {
    const classes = [styles.nav, className].filter(Boolean).join(' ')

    return (
      <nav
        ref={ref}
        // Consumer escape hatch spread BEFORE the internal aria-label /
        // className so the dedicated `ariaLabel` prop and component styles
        // stay authoritative. (`style` flows through `...rest`.)
        {...rest}
        aria-label={ariaLabel}
        className={classes}
      >
        {children}
      </nav>
    )
  },
)

BottomNav.displayName = 'BottomNav'
