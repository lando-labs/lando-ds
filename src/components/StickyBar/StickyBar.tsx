'use client'

/**
 * StickyBar Component
 *
 * A primitive for horizontal strips that pin to the top or bottom of
 * their nearest scroll container. Wraps children in a `position: sticky`
 * element with a configurable offset, background variant, and optional
 * shadow-on-scroll affordance.
 *
 * ## Why `position: sticky` (not `fixed`)
 *
 * Sticky respects the scroll context it lives in — pinning inside a
 * scrollable `<main>` (like AppShell's content area) rather than the
 * viewport. Consumers can drop a StickyBar in any overflow-auto wrapper
 * and it will Just Work.
 *
 * ## Shadow-on-scroll
 *
 * When `elevation="shadow-on-scroll"`, the bar uses an invisible
 * zero-height sentinel element placed at its natural (unpinned) edge.
 * An IntersectionObserver watches that sentinel — once it leaves the
 * viewport, the bar is pinned and we toggle `data-pinned="true"` on
 * the bar. This is cheaper than a scroll listener and avoids the race
 * conditions of reading scrollTop on an unknown scroll container.
 *
 * ## Consumer example
 *
 * The active-filters chip row on an Activity page uses the `blur`
 * variant with shadow-on-scroll. See issue #23 for context.
 *
 * @example Top-pinned toolbar (default)
 * ```tsx
 * <StickyBar variant="blur" elevation="shadow-on-scroll" aria-label="Filter toolbar">
 *   <FilterChips />
 * </StickyBar>
 * ```
 *
 * @example Bottom-pinned form action bar
 * ```tsx
 * <StickyBar position="bottom" elevation="shadow" aria-label="Form actions">
 *   <Inline gap="sm" justify="end">
 *     <Button variant="ghost">Cancel</Button>
 *     <Button variant="primary">Save</Button>
 *   </Inline>
 * </StickyBar>
 * ```
 *
 * @example With custom offset (e.g. under a 64px AppShell header)
 * ```tsx
 * <StickyBar offset={64}>
 *   <Toolbar />
 * </StickyBar>
 *
 * // Or using calc() for dynamic values
 * <StickyBar offset="calc(var(--header-height) + var(--spacing-8))">
 *   <Toolbar />
 * </StickyBar>
 * ```
 *
 * Issue: #23
 */

import React, { useEffect, useRef, useState } from 'react'
import styles from './StickyBar.module.css'

export interface StickyBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Which edge of the scroll container the bar pins to.
   * @default "top"
   */
  position?: 'top' | 'bottom'

  /**
   * Distance from the pinned edge. Numbers are treated as pixels;
   * strings are passed through as-is so consumers can use `calc()`
   * or design-token expressions.
   * @default 0
   * @example offset={64} // 64px from the top
   * @example offset="calc(var(--header-height) + 8px)"
   */
  offset?: number | string

  /**
   * Background treatment for the bar.
   * - `surface` — opaque, matches the surface token (default)
   * - `blur` — translucent with backdrop-filter blur
   * - `transparent` — no background, for custom chrome strips
   * @default "surface"
   */
  variant?: 'surface' | 'blur' | 'transparent'

  /**
   * Elevation / shadow treatment.
   * - `none` — no shadow (default)
   * - `shadow` — always-on shadow
   * - `shadow-on-scroll` — shadow appears only once the bar becomes
   *   pinned (i.e. the user has scrolled past its natural position)
   * @default "none"
   */
  elevation?: 'none' | 'shadow' | 'shadow-on-scroll'

  /**
   * Override the default z-index. By default uses the `--z-index-sticky`
   * token (100) — below modals (1000) and dropdowns (1100).
   */
  zIndex?: number

  /**
   * Accessible label for the region landmark. Screen readers will
   * announce this when the user navigates into the bar.
   */
  'aria-label'?: string

  /**
   * Override the ARIA role. Defaults to `"region"` which matches the
   * "landmark region" pattern screen readers expose to users. Set to
   * `"toolbar"` if the bar contains only a set of controls.
   * @default "region"
   */
  role?: React.AriaRole

  /**
   * Contents of the sticky bar.
   */
  children: React.ReactNode

  /**
   * Additional CSS class applied to the bar.
   */
  className?: string

  /**
   * Inline styles merged onto the bar. Useful for one-off tweaks
   * (but prefer `variant`/`elevation`/`offset` props when possible).
   */
  style?: React.CSSProperties
}

/**
 * Resolve an offset value (number or string) into a CSS length string.
 * Numbers are serialized as `${n}px`, strings pass through unchanged.
 */
function resolveOffset(value: number | string | undefined): string {
  if (value === undefined) return '0'
  if (typeof value === 'number') return `${value}px`
  return value
}

export const StickyBar = React.forwardRef<HTMLDivElement, StickyBarProps>(
  function StickyBar(
    {
      position = 'top',
      offset = 0,
      variant = 'surface',
      elevation = 'none',
      zIndex,
      'aria-label': ariaLabel,
      role = 'region',
      children,
      className = '',
      style,
      ...rest
    },
    forwardedRef
  ) {
    const barRef = useRef<HTMLDivElement | null>(null)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    // `pinned` drives the shadow-on-scroll affordance. It's only
    // meaningful when elevation="shadow-on-scroll"; for other values
    // the state is harmless (and cheap).
    const [pinned, setPinned] = useState(false)

    // Merge external ref with our internal one.
    const setBarRef = (node: HTMLDivElement | null) => {
      barRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    // IntersectionObserver on the sentinel — only engaged when the
    // shadow-on-scroll affordance is requested.
    useEffect(() => {
      if (elevation !== 'shadow-on-scroll') return
      const sentinel = sentinelRef.current
      if (!sentinel) return

      // `isIntersecting === false` means the sentinel has scrolled
      // out of the viewport → the bar is pinned. We use `threshold: 0`
      // and a zero-height sentinel so the transition is crisp.
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry) setPinned(!entry.isIntersecting)
        },
        { threshold: 0 }
      )

      observer.observe(sentinel)
      return () => observer.disconnect()
    }, [elevation])

    const classes = [
      styles.stickybar,
      styles[`position-${position}`],
      styles[`variant-${variant}`],
      elevation !== 'none' && styles[`elevation-${elevation}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // Build the inline style. We set the pinning edge dynamically
    // so consumers can drive it from props (top: Xpx / bottom: Xpx).
    const resolvedOffset = resolveOffset(offset)
    const positionStyle: React.CSSProperties =
      position === 'top'
        ? { top: resolvedOffset }
        : { bottom: resolvedOffset }

    const mergedStyle: React.CSSProperties = {
      ...positionStyle,
      ...(zIndex !== undefined ? { zIndex } : {}),
      ...style,
    }

    // The sentinel must be a sibling of the bar in the scroll container
    // so that it sits at the bar's natural (unpinned) position. React's
    // Fragment lets us emit both without adding a wrapper element
    // (which would break the sticky behavior).
    return (
      <>
        {elevation === 'shadow-on-scroll' && (
          <div
            ref={sentinelRef}
            className={`${styles.sentinel} ${
              position === 'top' ? styles['sentinel-top'] : styles['sentinel-bottom']
            }`}
            aria-hidden="true"
            data-testid="stickybar-sentinel"
          />
        )}
        <div
          ref={setBarRef}
          // Consumer escape hatch spread BEFORE the internal role / aria-label
          // / data-* so the dedicated props and pinned-state attributes stay
          // authoritative.
          {...rest}
          className={classes}
          style={mergedStyle}
          role={role}
          aria-label={ariaLabel}
          data-pinned={pinned ? 'true' : 'false'}
          data-position={position}
          data-variant={variant}
          data-elevation={elevation}
        >
          {children}
        </div>
      </>
    )
  }
)

StickyBar.displayName = 'StickyBar'
