/**
 * Badge Component
 *
 * A small label component for displaying status, counts, or tags.
 * Supports multiple variants and can be removable.
 *
 * @example
 * import { Star } from 'lucide-react'
 * <Badge variant="primary">New</Badge>
 * <Badge variant="success" size="sm">Active</Badge>
 * <Badge variant="warning" icon={<Star />} onRemove={() => {}}>Pending</Badge>
 *
 * // colorScheme is orthogonal to variant — use it for *identity*
 * // (a "RSS" badge is always orange regardless of state):
 * <Badge colorScheme="orange">RSS</Badge>
 * <Badge colorScheme="blue">NewsAPI</Badge>
 */

import React from 'react'
import { Icon } from '../Icon'
import { Slot } from '../Slot'
import styles from './Badge.module.css'

/**
 * Identity palettes for the Badge `colorScheme` prop. Orthogonal to
 * `variant` — `variant` paints *state* (success/warning/danger/info),
 * `colorScheme` paints *identity* (a source-type tag, a topic chip).
 *
 * If both are passed, `colorScheme` wins for color. `variant` retains
 * its semantics for things like dot-mode rendering.
 */
export type BadgeColorScheme =
  | 'sky'
  | 'teal'
  | 'orange'
  | 'blue'
  | 'purple'
  | 'green'
  | 'rose'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Render as the single child element, merging Badge styling onto it
   * (Layer-7 composition, #424). Use to make a badge clickable without
   * nesting interactive elements — e.g. `<Badge asChild><a href="…">Tag</a></Badge>`
   * renders `<a class="…badge">`. The badge's inner structure (icon +
   * `.content`, optional remove button) is composed INTO the child, mirroring
   * the non-`asChild` layout.
   */
  asChild?: boolean
  /** Visual style variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  /**
   * Identity palette (orthogonal to `variant`). When supplied, the badge
   * paints from the named palette regardless of `variant`'s color
   * mapping. Use for identities that aren't states — e.g. source-type
   * tags ("RSS" → orange, "PubMed" → purple).
   *
   * Both can co-exist: `colorScheme` wins for color, `variant` retains
   * its semantics for non-color behaviors.
   */
  colorScheme?: BadgeColorScheme
  /** Size of the badge */
  size?: 'sm' | 'md' | 'lg'
  /** Show only a dot indicator without text */
  dot?: boolean
  /** Use pill shape (fully rounded) */
  pill?: boolean
  /** Icon to display before the badge text - pass a lucide-react element */
  icon?: React.ReactNode
  /**
   * Callback when the remove button is clicked. Renders a `<button>` inside the
   * badge.
   *
   * Caveat (#509): with `asChild` + an **interactive** child (e.g. `<a href>`),
   * the remove `<button>` composes *inside* that child, which is invalid
   * interactive-in-interactive nesting. For a removable clickable tag, keep the
   * badge non-`asChild` and place the link inside, or render the remove control
   * as a sibling outside the Badge.
   */
  onRemove?: () => void
}

const CloseIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      asChild = false,
      variant = 'default',
      colorScheme,
      size = 'md',
      dot = false,
      pill = false,
      icon,
      onRemove,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    /**
     * `colorScheme` overrides the color slots from `variant`. We apply it
     * AFTER the variant class so its CSS rules win the cascade for color
     * tokens. `variant` is still emitted (and retained for non-color
     * semantics like dot rendering and consumer overrides via className).
     *
     * The colorScheme class is keyed `cs-<name>` to avoid collision with
     * a future identity-named variant (no such variant today, but the prefix
     * keeps the two namespaces clean).
     */
    const colorSchemeClass = colorScheme
      ? styles[`cs-${colorScheme}` as keyof typeof styles]
      : ''

    const badgeClasses = [
      styles.badge,
      styles[variant],
      styles[size],
      colorSchemeClass,
      dot ? styles.dot : '',
      pill ? styles.pill : '',
      icon ? styles.hasIcon : '',
      onRemove ? styles.removable : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const iconSize = size === 'sm' ? 'xs' : size === 'lg' ? 'sm' : ('xs' as const)

    // The remove button is a badge-owned sibling of the content — shared by
    // both the normal and asChild render paths.
    const removeButton = onRemove ? (
      <button
        type="button"
        className={styles.removeButton}
        onClick={onRemove}
        aria-label="Remove badge"
      >
        <CloseIcon />
      </button>
    ) : null

    // #424 — asChild: merge badge styling onto the caller's element (e.g. an
    // `<a>` to make a clickable tag without nested interactive elements).
    // Compose the badge's inner structure INTO the child so its own text
    // becomes the badge label, mirroring the non-asChild layout.
    if (asChild && React.isValidElement(children)) {
      const onlyChild = children as React.ReactElement<{
        children?: React.ReactNode
      }>
      const composedChild = React.cloneElement(
        onlyChild,
        undefined,
        <>
          {!dot && (
            <span className={styles.content}>
              {icon && (
                <Icon size={iconSize} className={styles.icon}>
                  {icon}
                </Icon>
              )}
              {onlyChild.props.children}
            </span>
          )}
          {removeButton}
        </>
      )
      return (
        <Slot
          ref={ref as unknown as React.Ref<HTMLElement>}
          className={badgeClasses}
          {...props}
        >
          {composedChild}
        </Slot>
      )
    }

    return (
      <span ref={ref} className={badgeClasses} {...props}>
        {!dot && (
          <span className={styles.content}>
            {icon && (
              <Icon size={iconSize} className={styles.icon}>
                {icon}
              </Icon>
            )}
            {children}
          </span>
        )}
        {removeButton}
      </span>
    )
  }
)

Badge.displayName = 'Badge'
