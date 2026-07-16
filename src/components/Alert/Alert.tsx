'use client'

/**
 * Alert Component
 *
 * Display important messages, notifications, or contextual feedback.
 * Supports semantic variants with optional close functionality and custom icons.
 *
 * Two visual shapes:
 * - **block** (default): full alert "card" with elevated surface tint and
 *   generous padding — for form-level errors and prominent inline notices.
 * - **inline** (`inline` prop): slim, no-card variant for in-page guidance /
 *   teaching banners (e.g. ProjectDetailView teaching banners). Composes with
 *   the same semantic variants. Distinct from the v0.11.0 `<Banner>`
 *   component, which is a viewport-fixed persistent notice.
 *
 * @example
 * <Alert variant="info" title="Notice">Your session will expire soon</Alert>
 * <Alert variant="success" closable onClose={handleClose}>Changes saved</Alert>
 * <Alert variant="warning" icon={<CustomIcon />}>Please review</Alert>
 * <Alert variant="info" inline>Tip: drag cards between columns to reorder.</Alert>
 */

import React, { useState } from 'react'
import styles from './Alert.module.css'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual style variant matching semantic meaning */
  variant?: 'info' | 'success' | 'warning' | 'error'
  /** Optional title displayed prominently */
  title?: string
  /** Show close button */
  closable?: boolean
  /** Callback when close button is clicked */
  onClose?: () => void
  /** Custom icon (default icons provided per variant) */
  icon?: React.ReactNode
  /**
   * Render the slim, no-card "inline" shape used for in-page guidance /
   * teaching banners. Composes with all semantic variants. Distinct from
   * the v0.11.0 `<Banner>` component, which is for viewport-fixed notices.
   * @default false
   */
  inline?: boolean
  /** Additional CSS class */
  className?: string
  /** Inline style overrides merged onto the root element. */
  style?: React.CSSProperties
  /** Alert content */
  children: React.ReactNode
}

const DefaultIcons: Record<string, React.ReactNode> = {
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
}

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      closable = false,
      onClose,
      icon,
      inline = false,
      className = '',
      style,
      children,
      ...rest
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(true)
    const [isExiting, setIsExiting] = useState(false)

    const handleClose = () => {
      setIsExiting(true)
      setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, 300) // Match animation duration
    }

    if (!isVisible) return null

    const alertClasses = [
      styles.alert,
      styles[variant],
      inline ? styles.inline : '',
      isExiting ? styles.exiting : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const displayIcon = icon !== undefined ? icon : DefaultIcons[variant]

    return (
      <div
        ref={ref}
        className={alertClasses}
        style={style}
        {...rest}
        role="alert"
        aria-live="polite"
      >
        {displayIcon && (
          <div className={styles.icon} aria-hidden="true">
            {displayIcon}
          </div>
        )}

        <div className={styles.content}>
          {title && <div className={styles.title}>{title}</div>}
          <div className={styles.message}>{children}</div>
        </div>

        {closable && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close alert"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    )
  }
)

Alert.displayName = 'Alert'
