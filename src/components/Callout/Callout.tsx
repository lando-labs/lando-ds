/**
 * Callout Component
 *
 * Left-border accent block with optional uppercase label and leading icon.
 * The most-repeated custom layout in the v0.10.0 primitives audit — three
 * surfaces hand-roll the same pattern (annotation blocks plus editorial
 * pull-quote `<blockquote>`s).
 *
 * `Divider` (orientation only) and `Alert` (transient + dismiss baggage)
 * don't fit this need, so `Callout` slots in as a pure container primitive.
 *
 * When to use which (#514 — the three are kept distinct by design):
 * - `Callout` — static, in-flow doc/editorial emphasis (this component).
 * - `Alert`   — contextual status message (info/success/warning/error), optionally dismissible.
 * - `Banner`  — viewport-fixed, page-level persistent notice (`placement: top | bottom`).
 *
 * Token mapping note: the brief proposed `--color-{accent}-medium` /
 * `-lightest`, but the actual semantic palettes (`success | warning | info |
 * error`) use the `lightest | light | base | dark | darkest` scale and skip
 * the `medium` step. We map to the actual tokens — see
 * `Callout.module.css` for the per-accent table.
 *
 * @example Basic usage
 * <Callout accent="primary" label="MY TAKE">
 *   This pattern deserves wider adoption than it gets.
 * </Callout>
 *
 * @example Editorial pull-quote
 * <Callout as="blockquote" accent="neutral">
 *   "The view is enough for me."
 * </Callout>
 *
 * @example With icon
 * <Callout accent="info" label="HEADS UP" icon={<Icon name="Info" />}>
 *   This setting affects every workspace member.
 * </Callout>
 */

import React from 'react'
import styles from './Callout.module.css'

export type CalloutAccent =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

type CalloutElement =
  | 'div'
  | 'aside'
  | 'blockquote'
  | 'section'
  | 'figure'
  | 'p'

type CalloutOwnProps<E extends CalloutElement = 'div'> = {
  /**
   * HTML element to render as. Defaults to `div`.
   *
   * The `blockquote` use case is critical — editorial pull-quotes
   * need it. `aside` is also natural for sidebar annotations.
   */
  as?: E
  /**
   * Accent color. Drives left-border, background tint, and label/icon ink
   * via the per-accent token mapping in `Callout.module.css`.
   * @default 'primary'
   */
  accent?: CalloutAccent
  /**
   * Optional uppercase label rendered above the body content (e.g.
   * `MY TAKE`, `HEADS UP`). Visually styled with letter-spacing 0.05em,
   * font-weight 600, and font-size 0.6875rem (~11px).
   */
  label?: React.ReactNode
  /**
   * Optional leading icon. Renders inline at the start of the callout,
   * vertically aligned with the label or first line of content.
   */
  icon?: React.ReactNode
  /** Callout body content. */
  children: React.ReactNode
  /** Additional CSS class name(s) appended to the root element. */
  className?: string
  /** Inline style overrides (merged with computed styles). */
  style?: React.CSSProperties
}

export type CalloutProps<E extends CalloutElement = 'div'> =
  CalloutOwnProps<E> &
    Omit<React.ComponentPropsWithoutRef<E>, keyof CalloutOwnProps<E>>

type PolymorphicRef<E extends React.ElementType> =
  React.ComponentPropsWithRef<E>['ref']

type PolymorphicCallout = <E extends CalloutElement = 'div'>(
  props: CalloutProps<E> & { ref?: PolymorphicRef<E> }
) => React.ReactElement | null

export const Callout: PolymorphicCallout = React.forwardRef(
  <E extends CalloutElement = 'div'>(
    {
      as,
      accent = 'primary',
      label,
      icon,
      children,
      className = '',
      style,
      ...props
    }: CalloutProps<E>,
    ref: PolymorphicRef<E>
  ) => {
    const Tag = (as || 'div') as React.ElementType

    const classNames = [
      styles.callout,
      styles[`accent-${accent}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const body = (
      <div className={styles.body}>
        {label !== undefined && label !== null && label !== '' && (
          <span className={styles.label}>{label}</span>
        )}
        {children}
      </div>
    )

    return (
      <Tag ref={ref} className={classNames} style={style} {...props}>
        {icon ? (
          <div className={styles.layout}>
            <span className={styles.iconSlot} aria-hidden="true">
              {icon}
            </span>
            {body}
          </div>
        ) : (
          body
        )}
      </Tag>
    )
  }
) as PolymorphicCallout

;(Callout as { displayName?: string }).displayName = 'Callout'
