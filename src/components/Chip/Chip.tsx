/**
 * Chip Component
 *
 * Interactive, multi-select toggle chip for filter panels and pill-style
 * filtering surfaces. Distinct from neighboring primitives:
 * - **`SegmentedControl`** is single-select (one option at a time).
 *   `Chip` is multi-select — each chip carries its own `selected` state.
 * - **`Badge`** is non-interactive (renders as `<span>`). `Chip` renders
 *   as a real `<button type="button">` with `aria-pressed` toggle
 *   semantics and native keyboard support.
 * - **`Button`** is too heavy visually for a filter pill.
 *
 * Surfaced in a design-system recomposition audit. Two surfaces
 * hand-rolled this pattern (`.chip*` and `.rangeBtn*`); this is
 * the canonical primitive.
 *
 * @example
 * <Chip selected={isFailed} onClick={() => toggle('failed')} count={42}>
 *   Failed
 * </Chip>
 *
 * @example
 * <Chip
 *   selected={isActive}
 *   onClick={() => toggle('active')}
 *   leftIcon={<Filter />}
 *   size="sm"
 * >
 *   Active
 * </Chip>
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './Chip.module.css'

export interface ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /**
   * Render as the single child element, merging Chip styling onto it
   * (Layer-7 composition, #424). Use to render a chip as an `<a>` (e.g. a
   * filter that navigates) without nesting interactive elements. The chip's
   * inner structure (icons, label, count) is composed INTO the child, and
   * `aria-pressed` still reflects `selected`.
   */
  asChild?: boolean
  /**
   * Whether the chip is currently selected (toggled "on"). Drives the
   * tinted-background visual treatment and `aria-pressed` value.
   */
  selected?: boolean
  /**
   * Optional count rendered after the label as a parenthesized number,
   * e.g. `Failed (42)`. Useful for filter chips that surface result
   * counts without requiring a second component.
   */
  count?: number
  /**
   * Visual size of the chip.
   * - `sm`: 24px min-height, 12px font, 14px icon
   * - `md` (default): 32px min-height, 14px font, 16px icon
   */
  size?: 'sm' | 'md'
  /**
   * Optional leading icon rendered before the label. Pass a
   * lucide-react element (or any ReactNode). Sized to 14px (sm) or
   * 16px (md) automatically.
   */
  leftIcon?: React.ReactNode
  /**
   * Optional trailing icon rendered after the label and count. Pass a
   * lucide-react element (or any ReactNode). Sized to 14px (sm) or
   * 16px (md) automatically.
   *
   * Passive slot — symmetric with `leftIcon`. There is intentionally no
   * `onRightIconClick` callback; the chip's `onClick` covers the whole
   * surface. If a consumer needs an actionable right-icon (e.g. a
   * dismiss button that fires independently of the toggle), compose a
   * separate interactive element next to the chip rather than nesting
   * an interactive child inside the button. See #112.
   */
  rightIcon?: React.ReactNode
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      asChild = false,
      selected = false,
      count,
      size = 'md',
      leftIcon,
      rightIcon,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const chipClasses = [
      styles.chip,
      styles[size],
      selected ? styles.selected : '',
      disabled ? styles.disabled : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // Chip's inner structure — shared by the normal and asChild render paths.
    // `label` is the text that goes in the `.label` slot: for the normal path
    // it's `children`; for asChild it's the child element's OWN children (so
    // the chip label wraps the anchor's text, not the anchor itself).
    const renderInner = (label: React.ReactNode) => (
      <>
        {leftIcon && (
          <span className={styles.leftIcon} aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className={styles.label}>{label}</span>
        {typeof count === 'number' && (
          <span className={styles.count}>({count})</span>
        )}
        {rightIcon && (
          <span className={styles.rightIcon} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </>
    )

    // #424 — asChild: merge chip styling onto the caller's element (e.g. an
    // `<a>` filter link) without nesting interactive elements. The chip's
    // icon/label/count structure is composed INTO the child, replacing the
    // child's own children (the `.label` slot carries them). Native `type` /
    // `disabled` are button-only, so we omit them; `aria-pressed` and — when
    // disabled — `aria-disabled` (both valid on any element) are forwarded so a
    // slotted `<a>`/custom child is announced correctly and not just visually
    // styled disabled (#509).
    if (asChild && React.isValidElement(children)) {
      const onlyChild = children as React.ReactElement<{
        children?: React.ReactNode
      }>
      return (
        <Slot
          ref={ref as unknown as React.Ref<HTMLElement>}
          className={chipClasses}
          aria-pressed={selected}
          aria-disabled={disabled || undefined}
          {...props}
        >
          {React.cloneElement(
            onlyChild,
            undefined,
            renderInner(onlyChild.props.children)
          )}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        type="button"
        className={chipClasses}
        aria-pressed={selected}
        disabled={disabled}
        {...props}
      >
        {renderInner(children)}
      </button>
    )
  }
)

Chip.displayName = 'Chip'
