/**
 * Card Component
 *
 * A versatile container component with optional header, body, and footer sections.
 * Supports various visual styles and interactive states.
 *
 * @example
 * <Card variant="elevated">
 *   <CardHeader>Title</CardHeader>
 *   <CardBody>Content goes here</CardBody>
 *   <CardFooter>Footer content</CardFooter>
 * </Card>
 *
 * // Auto-header shortcut for widget cards:
 * <Card title="Tasks" subtitle="3 open" actions={<Button size="sm">New</Button>}>
 *   <CardBody>...</CardBody>
 * </Card>
 */

import React from 'react'
import styles from './Card.module.css'
import { CardHeader } from './CardHeader'
import { CardTitle } from './CardTitle'
import { Text } from '../Text'
import { Slot } from '../Slot'

/**
 * Shared, non-HTML props for every Card variant.
 * Split out so the discriminated union below can attach the correct host's
 * HTMLAttributes (div vs button) per branch (#327).
 */
interface CardBaseProps {
  /**
   * Visual style variant.
   *
   * - `default` (default): subtle tinted shadow + hairline border.
   *   Gives every card a faint brand depth. New in Sprint 10 (#59).
   * - `outlined`: 2px border for stronger separation, no shadow. Border
   *   color can be overridden per-instance via the `--card-outline-color`
   *   CSS custom property (defaults to `var(--color-border-default)`),
   *   enabling semantic-colored outlined cards without a typed prop.
   * - `flat`: no shadow, no border. Explicit opt-out when you want the
   *   pre-Sprint-10 flat look (e.g. inside a card-on-card composition).
   * - `elevated`: strong shadow, raised off the surface.
   */
  variant?: 'default' | 'outlined' | 'flat' | 'elevated'
  /** Padding size for the card */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Show loading skeleton state */
  loading?: boolean
  /** Add a brand-tinted gradient background */
  gradient?: boolean
  /**
   * Optional card title. When set, Card auto-renders an internal
   * CardHeader with this title. Use this OR a manual `<CardHeader>`
   * inside children — not both.
   */
  title?: string
  /** Optional subtitle rendered below the title in muted caption style. */
  subtitle?: string
  /** Optional actions slot rendered right-aligned in the auto-header. */
  actions?: React.ReactNode
  /** Heading level for the auto-rendered title. Default 3 (h3). */
  titleAs?: 1 | 2 | 3 | 4 | 5 | 6
  /**
   * Stretch the card to fill the available cross-axis width.
   *
   * When true the root element gets `width: 100%`, matching the React
   * Native `Card` primitive's `fullWidth` semantic (RN uses
   * `alignSelf: 'stretch'` + `width: '100%'`). Backported from the RN
   * package for cross-platform prop parity (Refs: #240 remediation).
   *
   * Note: clickable cards already render as a 100%-wide `<button>` via
   * the `.clickable` CSS class, so `fullWidth` is a no-op there but is
   * still accepted for consistent prop API.
   */
  fullWidth?: boolean
  /**
   * Render through the single child element (Radix-style `asChild`),
   * merging Card's props + its `.card` root class / variant classes onto
   * it instead of emitting the default `<div>` (#424). Use to turn a whole
   * card into a semantic `<article>`, an `<a>`, a `next/link`, etc.
   *
   * When `asChild` is set, Card delegates its entire surface to the single
   * child: the auto-header (`title` / `subtitle` / `actions`) and the
   * `loading` skeleton are NOT rendered — the consumer owns the element's
   * content. Compose those yourself inside the child if needed. `clickable`
   * is likewise a no-op under `asChild` (the child element defines its own
   * interaction semantics — use an `<a>` or `<button>` child).
   */
  asChild?: boolean
}

/**
 * Card props when rendering as a `<div>` (default). Carries div-specific
 * HTML attributes — `cite`, `onMouseEnter` typed against HTMLDivElement,
 * etc. — and forbids `disabled` / `type` (button-only attrs).
 */
export type CardDivProps = CardBaseProps & {
  /** Make the card clickable with hover effects */
  clickable?: false
} & React.HTMLAttributes<HTMLDivElement>

/**
 * Card props when `clickable=true`. The root swaps to a `<button>`, so the
 * full button HTML attribute set applies (`type`, `disabled`, `form`, etc.)
 * and event handlers are typed against HTMLButtonElement. (#327)
 */
export type CardButtonProps = CardBaseProps & {
  /** Make the card clickable with hover effects */
  clickable: true
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export type CardProps = CardDivProps | CardButtonProps

// Internal forwardRef target type — covers both branches so the same
// component implementation can accept either ref. Consumers see the precise
// type at the call site via the function overloads exported below.
type CardRef = HTMLDivElement | HTMLButtonElement

const CardImpl = React.forwardRef<CardRef, CardProps>(
  (
    props,
    ref
  ) => {
    const {
      variant = 'default',
      padding = 'md',
      clickable = false,
      loading = false,
      gradient = false,
      title,
      subtitle,
      actions,
      titleAs = 3,
      fullWidth = false,
      asChild = false,
      className = '',
      children,
      onClick,
      ...rest
    } = props as CardBaseProps & {
      clickable?: boolean
      className?: string
      children?: React.ReactNode
      onClick?: React.MouseEventHandler<HTMLElement>
    } & Record<string, unknown>
    const cardClasses = [
      styles.card,
      styles[variant],
      styles[`padding-${padding}`],
      clickable ? styles.clickable : '',
      loading ? styles.loading : '',
      gradient ? styles.gradient : '',
      fullWidth ? styles.fullWidth : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const hasAutoHeader = Boolean(title || subtitle || actions)

    const autoHeader = hasAutoHeader ? (
      <CardHeader>
        <div className={styles.autoHeaderRow}>
          <div className={styles.autoTitleBlock}>
            {title && <CardTitle as={titleAs}>{title}</CardTitle>}
            {subtitle && (
              <Text variant="caption" size="sm">
                {subtitle}
              </Text>
            )}
          </div>
          {actions && <div className={styles.autoActions}>{actions}</div>}
        </div>
      </CardHeader>
    ) : null

    const content = loading ? (
      <div className={styles.skeleton} aria-busy="true" aria-live="polite">
        <div className={styles.skeletonHeader} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} style={{ width: '70%' }} />
      </div>
    ) : (
      <>
        {autoHeader}
        {children}
      </>
    )

    if (asChild) {
      // #424 — delegate the whole card surface to the single child element.
      // `.card` + variant classes and forwarded props (onClick, rest, style)
      // merge onto it via Slot. Auto-header + skeleton are intentionally NOT
      // rendered: the consumer owns the child's content. `clickable` is a
      // no-op here — the child element defines its own interaction semantics.
      const slotProps = rest as React.HTMLAttributes<HTMLElement>
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={cardClasses}
          onClick={onClick as React.MouseEventHandler<HTMLElement> | undefined}
          {...slotProps}
        >
          {children}
        </Slot>
      )
    }

    if (clickable) {
      // Default type="button" so a clickable Card never accidentally submits
      // a surrounding form. Consumer can still override via `rest`.
      const buttonProps = rest as React.ButtonHTMLAttributes<HTMLButtonElement>
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          className={cardClasses}
          onClick={onClick as React.MouseEventHandler<HTMLButtonElement> | undefined}
          {...buttonProps}
        >
          {content}
        </button>
      )
    }

    const divProps = rest as React.HTMLAttributes<HTMLDivElement>
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={cardClasses}
        onClick={onClick as React.MouseEventHandler<HTMLDivElement> | undefined}
        {...divProps}
      >
        {content}
      </div>
    )
  }
)

CardImpl.displayName = 'Card'

/**
 * Card props when `clickable` is a runtime `boolean` (not a narrowed literal).
 * Used by consumers like DetailCard that compute `clickable={someBoolean}` —
 * those sites can't satisfy the literal-true / literal-false branches of the
 * discriminated union, so they hit this widened overload instead. The element
 * type is `HTMLDivElement | HTMLButtonElement` and the prop set is the union
 * of both host attribute sets.
 */
export type CardEitherProps = CardBaseProps & {
  clickable: boolean
} & (React.HTMLAttributes<HTMLDivElement> | React.ButtonHTMLAttributes<HTMLButtonElement>)

/**
 * Card — public export with discriminated-union overloads (#327). The
 * compiler picks the div or button branch based on `clickable`, giving
 * consumers correct ref types AND access to host-specific attributes
 * (`type`, `disabled` on the button branch).
 *
 * A third overload accepts a runtime `boolean` for callers that compute
 * `clickable` dynamically (e.g. DetailCard) — those sites lose the host
 * narrowing but keep the API surface and pass the typecheck.
 *
 * NB: this is an interface with multiple call signatures rather than an
 * intersection of callable types — the intersection form was unstable
 * for overload resolution (TS only surfaced 2 of 3 branches at consumer
 * sites that passed a non-literal boolean).
 */
interface CardOverloads {
  (props: CardButtonProps & React.RefAttributes<HTMLButtonElement>): React.ReactElement | null
  (props: CardDivProps & React.RefAttributes<HTMLDivElement>): React.ReactElement | null
  (props: CardEitherProps & React.RefAttributes<HTMLDivElement | HTMLButtonElement>): React.ReactElement | null
  displayName?: string
}

export const Card = CardImpl as unknown as CardOverloads
