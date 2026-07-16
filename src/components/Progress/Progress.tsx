'use client'

/**
 * Progress Component
 *
 * A versatile progress indicator with multiple variants (bar, circle, dots).
 * Features brand-themed gradient fills and smooth animations.
 *
 * @example
 * <Progress value={65} />
 * <Progress value={80} variant="circle" size="lg" />
 * <Progress indeterminate variant="dots" />
 * <Progress value={45} color="success" showValue label="Upload progress" />
 */

import React, { useId } from 'react'
import styles from './Progress.module.css'

export interface ProgressProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  /** Progress value (0-100) - optional when indeterminate is true */
  value?: number
  /** Visual variant */
  variant?: 'bar' | 'circle' | 'dots'
  /** Size of the progress indicator */
  size?: 'sm' | 'md' | 'lg'
  /** Color theme */
  color?: 'primary' | 'success' | 'warning' | 'error'
  /** Label text displayed above progress */
  label?: string
  /** Show percentage value */
  showValue?: boolean
  /** Indeterminate state (for unknown progress) */
  indeterminate?: boolean
  /** Container className */
  className?: string
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value = 0,
      variant = 'bar',
      size = 'md',
      color = 'primary',
      label,
      showValue = false,
      indeterminate = false,
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100)

  // #74 — Wire the label to the progressbar for a11y.
  //
  // When the label is rendered visibly (bar/dots variant) we link the
  // <span> via aria-labelledby so screen readers announce the same text
  // sighted users see. useId keeps multiple Progress instances on the
  // same page from colliding.
  //
  // The circle variant never renders the visible label span (the label
  // slot is omitted when variant === 'circle'). For that case we fall back
  // to aria-label when the label is a plain string. Rich-node labels on
  // circle variant are unlikely in practice and would require the
  // consumer to supply an aria-label manually.
  const labelId = useId()
  const hasVisibleLabel = !!label && variant !== 'circle'
  const labelledBy = hasVisibleLabel ? labelId : undefined
  const stringAriaLabel =
    variant === 'circle' && typeof label === 'string' ? label : undefined

  const containerClasses = [
    styles.container,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const renderBar = () => {
    const barClasses = [
      styles.bar,
      styles[size],
      styles[color],
      indeterminate ? styles.indeterminate : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div
        className={barClasses}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby={labelledBy}
      >
        <div
          className={styles.barFill}
          style={{ width: indeterminate ? '100%' : `${clampedValue}%` }}
        />
      </div>
    )
  }

  const renderCircle = () => {
    const sizes = { sm: 48, md: 64, lg: 96 }
    const circleSize = sizes[size]
    const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 6 : 8
    const radius = (circleSize - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (clampedValue / 100) * circumference

    const circleClasses = [
      styles.circle,
      styles[size],
      styles[color],
      indeterminate ? styles.indeterminate : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div
        className={circleClasses}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={stringAriaLabel}
      >
        <svg
          width={circleSize}
          height={circleSize}
          viewBox={`0 0 ${circleSize} ${circleSize}`}
          className={styles.circleSvg}
        >
          {/* Background circle */}
          <circle
            className={styles.circleTrack}
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            className={styles.circleProgress}
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={indeterminate ? circumference / 4 : offset}
            transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
          />
        </svg>
        {showValue && !indeterminate && (
          <span className={styles.circleValue}>{clampedValue}%</span>
        )}
      </div>
    )
  }

  const renderDots = () => {
    const dotCount = size === 'sm' ? 3 : size === 'md' ? 4 : 5

    const dotsClasses = [
      styles.dots,
      styles[size],
      styles[color],
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={dotsClasses} role="progressbar" aria-label="Loading">
        {Array.from({ length: dotCount }).map((_, index) => (
          <span
            key={index}
            className={styles.dot}
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </div>
    )
  }

  const renderProgress = () => {
    switch (variant) {
      case 'circle':
        return renderCircle()
      case 'dots':
        return renderDots()
      case 'bar':
      default:
        return renderBar()
    }
  }

  return (
    <div ref={ref} className={containerClasses} style={style} {...rest}>
      {(label || showValue) && variant !== 'circle' && (
        <div className={styles.header}>
          {label && <span id={labelId} className={styles.label}>{label}</span>}
          {showValue && !indeterminate && variant !== 'dots' && (
            <span className={styles.value}>{clampedValue}%</span>
          )}
        </div>
      )}
      {renderProgress()}
    </div>
  )
  }
)

Progress.displayName = 'Progress'
