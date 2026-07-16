/**
 * Spinner Component
 *
 * Circular loading indicator with a brand-themed gradient animation.
 * Used for loading states and async operations.
 *
 * @example
 * <Spinner size="md" />
 * <Spinner size="lg" color="primary" label="Loading..." />
 * <Spinner size="sm" color="success" />
 */

import React from 'react'
import styles from './Spinner.module.css'

export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Size of the spinner */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Color variant */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  /** Optional loading label for accessibility */
  label?: string
  /**
   * Additional CSS class on the visual root (the `.spinnerContainer` div).
   *
   * #422 — `className` now lands on the OUTER status container (the visual
   * root that carries `role="status"`), not the inner `<svg>`. To target the
   * animated `<svg>` specifically, use {@link SpinnerProps.svgClassName}.
   */
  className?: string
  /**
   * Escape hatch: extra class applied to the inner animated `<svg>` element.
   * The `size` / `color` variant classes still apply; this is appended after
   * them.
   */
  svgClassName?: string
}

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  (
    {
      size = 'md',
      color = 'primary',
      label,
      className = '',
      svgClassName = '',
      style,
      ...rest
    },
    ref
  ) => {
    const containerClasses = [styles.spinnerContainer, className]
      .filter(Boolean)
      .join(' ')

    const spinnerClasses = [
      styles.spinner,
      styles[size],
      styles[color],
      svgClassName,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div
        ref={ref}
        className={containerClasses}
        style={style}
        {...rest}
        role="status"
        aria-live="polite"
        aria-label={label || 'Loading'}
      >
        <svg
          className={spinnerClasses}
          viewBox="0 0 50 50"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className={styles.track}
            cx="25"
            cy="25"
            r="20"
            fill="none"
            strokeWidth="5"
          />
          <circle
            className={styles.path}
            cx="25"
            cy="25"
            r="20"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
        {label && <span className={styles.label}>{label}</span>}
      </div>
    )
  }
)

Spinner.displayName = 'Spinner'
