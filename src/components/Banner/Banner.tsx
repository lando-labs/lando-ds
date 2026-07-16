'use client'

/**
 * Banner Component
 *
 * Slim viewport-fixed (`position: fixed`) persistent notification bar pinned
 * to the top or bottom edge of the viewport. Distinct from sibling primitives:
 *
 * - `Toast` — auto-dismisses; transient.
 * - `StickyBar` — `position: sticky` inside its scroll container, not viewport.
 * - `Alert` — inline content; lives in normal document flow.
 * - `Banner` — viewport-fixed, persistent until accepted/dismissed.
 *
 * Primary use cases:
 *  1. GDPR `ConsentBanner` (pinned to viewport bottom, persistent until
 *     accepted/dismissed).
 *  2. System-level notices (offline indicator, session expiring, scheduled
 *     maintenance window).
 *
 * Z-index `--z-banner: 950` sits above `BottomNav` (900) and below `Modal`
 * (1000), so a "session expiring" banner stays visible above the mobile tab
 * bar but never obscures a focused dialog.
 *
 * @example GDPR consent banner
 * ```tsx
 * <Banner
 *   placement="bottom"
 *   variant="info"
 *   onDismiss={handleDecline}
 *   actions={<Button variant="primary" onClick={handleAccept}>Accept</Button>}
 * >
 *   We use cookies to improve your experience. <a href="/privacy">Privacy policy</a>
 * </Banner>
 * ```
 *
 * @example Offline notice (top, no dismiss)
 * ```tsx
 * <Banner placement="top" variant="warning">
 *   You are offline. Changes will sync when reconnected.
 * </Banner>
 * ```
 *
 * Issue: #84
 */

import React from 'react'
import styles from './Banner.module.css'

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Which edge of the viewport the banner pins to.
   * @default 'bottom'
   */
  placement?: 'top' | 'bottom'

  /**
   * Visual variant — colors align with `Alert`'s semantic palette.
   * @default 'info'
   */
  variant?: 'info' | 'warning' | 'success' | 'error'

  /**
   * Optional dismiss callback. When provided, a close (×) button renders
   * on the trailing edge and calls `onDismiss` on click. Omit to render
   * a non-dismissible banner (e.g. critical system notices).
   */
  onDismiss?: () => void

  /**
   * Optional actions slot rendered to the right of the message, before the
   * dismiss button. Typically holds one or two `<Button>` elements
   * ("Accept" / "Learn more").
   */
  actions?: React.ReactNode

  /** Banner content (the primary message). */
  children: React.ReactNode

  /** Additional CSS class appended to the root element. */
  className?: string

  /** Inline style overrides merged onto the root element. */
  style?: React.CSSProperties
}

const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const Banner = React.forwardRef<HTMLDivElement, BannerProps>(
  function Banner(
    {
      placement = 'bottom',
      variant = 'info',
      onDismiss,
      actions,
      children,
      className = '',
      style,
      ...rest
    },
    ref
  ) {
    const classes = [
      styles.banner,
      styles[`placement-${placement}`],
      styles[`variant-${variant}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // Error variant uses role="alert" (assertive announcement); other
    // variants use role="status" (polite, non-interrupting).
    const role = variant === 'error' ? 'alert' : 'status'

    // #270 — `.sizer` is a zero-box container-query host (see Banner.module.css)
    // that wraps the fixed `.banner` so the `@container banner` reflow rule can
    // match it. The consumer contract is preserved exactly: `ref`, `className`,
    // `style`, `role`, and the data-attrs all stay on the `.banner` element as
    // before — the only change is one inert wrapper div above a `position:
    // fixed` element (which has zero layout impact, being out of flow).
    return (
      <div className={styles.sizer}>
        <div
          ref={ref}
          className={classes}
          style={style}
          data-placement={placement}
          data-variant={variant}
          {...rest}
          role={role}
        >
          <div className={styles.message}>{children}</div>
          {(actions || onDismiss) && (
            <div className={styles.trailing}>
              {actions && <div className={styles.actions}>{actions}</div>}
              {onDismiss && (
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={onDismiss}
                  aria-label="Dismiss banner"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
)

Banner.displayName = 'Banner'
