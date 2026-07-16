'use client'

/**
 * Avatar Component
 *
 * A versatile avatar component for displaying user profile images, initials, or icons.
 * Supports status indicators and multiple sizes.
 *
 * @example
 * <Avatar src="/user.jpg" alt="John Doe" />
 * <Avatar initials="JD" />
 * <Avatar initials="AB" status="online" />
 */

import React, { useState } from 'react'
import { Slot } from '../Slot'
import styles from './Avatar.module.css'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Render as the single child element, merging Avatar styling onto it
   * (Layer-7 composition, #424). Use to make an avatar clickable without
   * nesting interactive elements — e.g. `<Avatar asChild initials="JD"><a href="/profile" /></Avatar>`
   * renders `<a class="…avatar">`. The avatar's inner content (image /
   * initials / fallback / status) is composed INTO the child.
   */
  asChild?: boolean
  /** Image source URL */
  src?: string
  /** Alt text for the image */
  alt?: string
  /** Initials to display when no image is provided */
  initials?: string
  /** Size of the avatar */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Status indicator */
  status?: 'online' | 'offline' | 'busy' | 'away'
  /** Show loading state */
  loading?: boolean
  /**
   * Use a brand-themed gradient for the initials background.
   *
   * Sprint 10 (#59) — defaults to `true` whenever `initials` is provided
   * and no `src` is set. The specific gradient is picked deterministically
   * from the initials string so a contact list renders as a richly-colored
   * set (not 20 identical blue circles). Pass `gradient={false}` to opt
   * out and keep the flat neutral-300 look.
   */
  gradient?: boolean
}

/**
 * Deterministic hash of the initials string → one of `NUM_GRADIENT_SLOTS`.
 * Same input ALWAYS produces the same slot (no Math.random, no Date.now),
 * so "JD" → slot X today == "JD" → slot X tomorrow.
 *
 * Uses a simple character-sum mod N. N = 7 keeps the palette tight enough
 * that collisions are rare in small contact lists but wide enough that
 * adjacent cells don't repeat the same color.
 */
const NUM_GRADIENT_SLOTS = 7
function gradientSlotFor(initials: string | undefined): number {
  if (!initials) return 0
  let sum = 0
  for (let i = 0; i < initials.length; i++) {
    sum = (sum + initials.charCodeAt(i)) >>> 0
  }
  return sum % NUM_GRADIENT_SLOTS
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      asChild = false,
      src,
      alt = '',
      initials,
      size = 'md',
      status,
      loading = false,
      gradient,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false)

    // Sprint 10 (#59) — gradient defaults to ON when initials are
    // provided and the avatar isn't sourced from an image. Explicit
    // gradient={false} from the consumer always wins.
    const initialsWillShow =
      Boolean(initials) && (!src || imageError) && !loading
    const gradientEnabled =
      gradient === undefined ? initialsWillShow : gradient

    // Pick a deterministic slot from the initials string so "JD" always
    // renders the same gradient — and different initials in the same
    // list render varied colors.
    const gradientSlotClass = gradientEnabled
      ? (styles[`gradient-${gradientSlotFor(initials)}`] ?? styles.gradient)
      : ''

    const avatarClasses = [
      styles.avatar,
      styles[size],
      // The slot class owns `background` + `color`; we don't stack the
      // legacy `.gradient` class on top to avoid specificity fights.
      // Fallback to `.gradient` only if slot class somehow resolved empty
      // (shouldn't happen in practice — defensive).
      gradientEnabled ? gradientSlotClass || styles.gradient : '',
      loading ? styles.loading : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const showImage = src && !imageError && !loading
    const showInitials = !showImage && initials && !loading

    // Avatar's inner visual content — shared by the normal and asChild paths.
    const avatarInner = (
      <>
        {loading && <div className={styles.skeleton} aria-busy="true" />}

        {showImage && (
          <img
            src={src}
            alt={alt}
            className={styles.image}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}

        {showInitials && (
          <span className={styles.initials} aria-label={alt || initials}>
            {initials}
          </span>
        )}

        {!showImage && !showInitials && !loading && (
          <span className={styles.fallback} aria-label="User avatar">
            <UserIcon />
          </span>
        )}

        {status && (
          <span
            className={`${styles.status} ${styles[`status-${status}`]}`}
            role="img"
            aria-label={`Status: ${status}`}
          >
            {/*
              WCAG 1.4.1 — do not rely on color alone.
              Each status has a distinct shape/glyph overlay in addition
              to its background color, so color-blind and low-vision users
              can still distinguish states:
                - online:  solid dot (unchanged)
                - offline: empty ring outline
                - busy:    horizontal bar (minus)
                - away:    crescent moon
            */}
            <StatusGlyph status={status} />
          </span>
        )}
      </>
    )

    // #424 — asChild: merge avatar styling onto the caller's element (e.g. an
    // `<a>` link to a profile) without nesting interactive elements. The
    // avatar's inner content is composed INTO the child. A clickable avatar
    // normally has no visible text of its own, so the child's own children (if
    // any) are appended after the avatar visual.
    if (asChild && React.isValidElement(children)) {
      const onlyChild = children as React.ReactElement<{
        children?: React.ReactNode
      }>
      return (
        <Slot
          ref={ref as unknown as React.Ref<HTMLElement>}
          className={avatarClasses}
          {...props}
        >
          {React.cloneElement(
            onlyChild,
            undefined,
            <>
              {avatarInner}
              {onlyChild.props.children}
            </>
          )}
        </Slot>
      )
    }

    return (
      <div ref={ref} className={avatarClasses} {...props}>
        {avatarInner}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'

/**
 * Small inline SVG glyph for the status indicator. Kept tiny and
 * solid/stroke white on top of the colored background so it remains
 * legible at all avatar sizes. aria-hidden because the parent <span>
 * already carries the accessible label.
 */
const StatusGlyph = ({ status }: { status: NonNullable<AvatarProps['status']> }) => {
  if (status === 'online') {
    // No glyph — filled disc is already distinct enough in shape (the
    // only fully-filled state). Background color is the visual affordance.
    return null
  }

  if (status === 'offline') {
    // Hollow ring: drawn by the component's background; we add an inner
    // darker dot to produce a visually distinct "ring" look.
    return (
      <svg
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        width="100%"
        height="100%"
      >
        <circle cx="5" cy="5" r="2.5" fill="var(--color-surface, #fff)" />
      </svg>
    )
  }

  if (status === 'busy') {
    // Horizontal bar (minus) — matches the universal "do not disturb" glyph
    return (
      <svg
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        width="100%"
        height="100%"
      >
        <rect x="2" y="4.25" width="6" height="1.5" rx="0.75" fill="var(--color-surface, #fff)" />
      </svg>
    )
  }

  // away — crescent moon
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      width="100%"
      height="100%"
    >
      <path
        d="M7 5.5a3 3 0 0 1-3.5-3 3 3 0 1 0 3.5 3z"
        fill="var(--color-surface, #fff)"
      />
    </svg>
  )
}

// Default user icon for fallback
const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="100%"
    height="100%"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
