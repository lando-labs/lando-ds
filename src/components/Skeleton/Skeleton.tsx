/**
 * Skeleton Component
 *
 * Loading placeholder with a subtle wave animation.
 * Provides visual feedback during content loading states.
 *
 * @example
 * <Skeleton variant="text" width="80%" />
 * <Skeleton variant="circular" width={40} height={40} />
 * <Skeleton variant="rectangular" height={200} animation="wave" />
 */

import React from 'react'
import styles from './Skeleton.module.css'

export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Shape variant of the skeleton */
  variant?: 'text' | 'circular' | 'rectangular'
  /** Width of the skeleton */
  width?: string | number
  /** Height of the skeleton */
  height?: string | number
  /** Animation type */
  animation?: 'pulse' | 'wave' | 'none'
}

export const Skeleton = React.forwardRef<HTMLSpanElement, SkeletonProps>(
  (
    { variant = 'text', width, height, animation = 'wave', className = '', style: styleProp, ...rest },
    ref
  ) => {
    const skeletonClasses = [
      styles.skeleton,
      styles[variant],
      animation !== 'none' ? styles[animation] : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // Convert numeric values to pixels
    const formatDimension = (value: string | number | undefined) => {
      if (value === undefined) return undefined
      return typeof value === 'number' ? `${value}px` : value
    }

    // Only set width/height when the corresponding prop is provided — an
    // always-present `undefined` key would clobber a consumer `style.width`.
    const dimensionStyle: React.CSSProperties = {}
    const resolvedWidth = formatDimension(width)
    const resolvedHeight = formatDimension(height)
    if (resolvedWidth !== undefined) dimensionStyle.width = resolvedWidth
    if (resolvedHeight !== undefined) dimensionStyle.height = resolvedHeight

    return (
      <span
        ref={ref}
        aria-busy="true"
        aria-live="polite"
        aria-label="Loading"
        {...rest}
        className={skeletonClasses}
        style={{ ...styleProp, ...dimensionStyle }}
      >
        {animation === 'wave' && (
          <span className={styles.waveOverlay} aria-hidden="true" />
        )}
      </span>
    )
  }
)

Skeleton.displayName = 'Skeleton'
