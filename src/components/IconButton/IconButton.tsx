/**
 * IconButton Component
 *
 * Icon-only button primitive. Replaces hand-rolled icon-only ghost buttons
 * (`.menuTrigger`, `.dismissBtn`, `.commentDeleteBtn`, `.userViewDeleteBtn`,
 * `.orderBtn`, etc.) that recur across consuming apps. Surfaced in a
 * design-system recomposition audit.
 *
 * Why this exists as its own component (and not just `<Button variant="ghost">`):
 * - **`aria-label` is REQUIRED** at the type level. An icon-only button with
 *   no accessible name is invisible to screen-reader users; making the prop
 *   non-optional turns a recurring a11y regression into a TypeScript error.
 * - 1:1 (square) hit area with a guaranteed 44×44px minimum touch target
 *   (iOS/Android touch target guidance), regardless of the visible icon size.
 * - Pre-tuned padding and sizes for icon-only chromes — consumers stop
 *   re-deriving these values per call site.
 *
 * The child of `<IconButton>` is the icon — pass any Lucide React icon,
 * the design system's `<Icon>` wrapper, or any custom SVG.
 *
 * @example
 * import { IconButton } from '@lando-labs/lando-ds'
 * import { Trash2 } from 'lucide-react'
 *
 * <IconButton aria-label="Delete comment" onClick={handleDelete}>
 *   <Trash2 />
 * </IconButton>
 *
 * @example
 * // Variants and sizes
 * <IconButton aria-label="Settings" variant="ghost" size="sm"><Settings /></IconButton>
 * <IconButton aria-label="Save"     variant="solid" size="md"><Check /></IconButton>
 * <IconButton aria-label="Edit"     variant="outline" size="xs"><Edit /></IconButton>
 *
 * @example
 * // Loading state — async actions swap the icon for a spinner and disable
 * // the button. `aria-label` stays intact so screen readers still announce
 * // the action.
 * <IconButton aria-label="Save" loading={isSaving} onClick={handleSave}>
 *   <Check />
 * </IconButton>
 */

import React from 'react'
import { Spinner } from '../Spinner'
import styles from './IconButton.module.css'

/**
 * Props for `<IconButton>`.
 *
 * Extends the native `<button>` props EXCEPT `aria-label`, which is then
 * re-declared as a required string. This is the single most important type
 * constraint in the component: omitting `aria-label` is a TypeScript error,
 * not just a runtime/a11y warning.
 */
export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /**
   * Accessible label for screen readers. REQUIRED — an icon-only button
   * has no visible text, so without this prop the control is unusable to
   * assistive technology. TypeScript will reject calls that omit it.
   */
  'aria-label': string
  /**
   * Visual style variant.
   * - `ghost` (default): transparent background, subtle hover tint. Best
   *   for incidental affordances inside cards, list rows, popovers.
   * - `solid`: filled primary background. Use for primary icon-only
   *   actions (e.g. a floating "compose" button).
   * - `outline`: 1px border, transparent background. Use when you need
   *   a visible affordance against busy backgrounds.
   */
  variant?: 'ghost' | 'solid' | 'outline'
  /**
   * Visible icon size.
   * - `xs` → 24×24px visible
   * - `sm` (default) → 32×32px visible
   * - `md` → 40×40px visible
   *
   * Note: every size guarantees a minimum 44×44px hit area regardless of
   * visible size, so touch targets meet iOS/Android guidance even when
   * the visible chrome is smaller.
   */
  size?: 'xs' | 'sm' | 'md'
  /**
   * Show loading spinner and disable interactions. When `true`:
   * - The icon child is replaced by a centered `<Spinner>` sized to match
   *   the IconButton size (xs→xs, sm→sm, md→md).
   * - The native `disabled` attribute is set, blocking click and keyboard
   *   activation at the browser level.
   * - `aria-label` is preserved so screen readers still announce the
   *   action being performed.
   * - `aria-busy="true"` is set so AT can communicate the in-flight state.
   *
   * Mirrors the `loading` prop on `<Button>`.
   */
  loading?: boolean
  /** The icon to render inside the button. */
  children: React.ReactNode
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'sm',
      loading = false,
      className = '',
      children,
      type = 'button',
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = [
      styles.iconButton,
      styles[variant],
      styles[size],
      loading ? styles.loading : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        data-variant={variant}
        data-size={size}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        <span className={styles.iconWrapper} aria-hidden="true">
          {loading ? <Spinner size={size} /> : children}
        </span>
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
