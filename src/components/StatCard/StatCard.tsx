/**
 * StatCard Component
 *
 * A specialized card for displaying statistics with trend indicators.
 * Features large value display, optional trend data, and color variants.
 *
 * Deliberate standalone component (distinct markup/CSS), not a `Card` recipe —
 * the recipe-vs-component boundary is a recorded decision (#515), with
 * recipe-ification tracked for the future Recipes layer (#415).
 *
 * @example
 * <StatCard
 *   label="Total Users"
 *   value="1,234"
 *   trend={{ value: 12.5, direction: 'up' }}
 *   trendLabel="vs last month"
 *   icon={<UsersIcon />}
 *   color="success"
 * />
 *
 * @example
 * // Contextual subtitle explaining a surprising zero (#32)
 * <StatCard
 *   label="Active Agents"
 *   value={0}
 *   subtitle="all events from Claude Code root"
 * />
 *
 * @example
 * // Subtitle + trend coexist (stacked)
 * <StatCard
 *   label="Revenue"
 *   value="$12.4k"
 *   subtitle="excluding refunds"
 *   trend={{ value: 8.2, direction: 'up' }}
 *   trendLabel="vs last month"
 * />
 *
 * @example
 * // Inverted metric (#467): a RISING refund rate is BAD. `direction` still
 * // shows the true up-arrow, while `sentiment: 'negative'` paints it in the
 * // error color (decoupled from the arrow). Omit `sentiment` and the color is
 * // derived from direction (up = positive), preserving the default behavior.
 * <StatCard
 *   label="Refund Rate"
 *   value="3.2%"
 *   trend={{ value: 0.4, direction: 'up', sentiment: 'negative' }}
 *   trendLabel="vs last month"
 * />
 */

import React from 'react'
import { Skeleton } from '../Skeleton'
import { Slot } from '../Slot'
import styles from './StatCard.module.css'

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Render through the single child element (Radix-style `asChild`),
   * merging StatCard's root class + forwarded props onto it instead of
   * emitting the default `<div>` (#424). Use to make the whole stat card
   * a semantic `<article>`, an `<a>`, etc. The `.statCard` root class and
   * `color-*` variant always land on the rendered element either way.
   *
   * Not honored while `loading` — the skeleton owns the DOM in that state.
   */
  asChild?: boolean
  /** Label describing the statistic */
  label: string
  /** The main value to display */
  value: string | number
  /**
   * Short contextual subtitle rendered beneath the primary value
   * (above the trend line when both are present). Use for edge-case
   * explanations — e.g. why a zero value is not a bug.
   *
   * Typography is intentionally lighter than `label` (DS caption-like)
   * so the primary value stays dominant. See issue #32.
   */
  subtitle?: string | React.ReactNode
  /**
   * Trend data with percentage change.
   *
   * `direction` drives ONLY the arrow glyph (the literal movement of the
   * metric). `sentiment` drives the pill COLOR and its good/bad meaning,
   * DECOUPLED from the arrow (#467) so an *inverted* metric can be expressed —
   * e.g. Refund Rate, where a rising number (up-arrow) is BAD and must read in
   * the error color.
   */
  trend?: {
    /** Magnitude of the change; rendered as `|value|%`. */
    value: number
    /** Arrow glyph direction — the literal up/down/flat movement of the metric. */
    direction: 'up' | 'down' | 'neutral'
    /**
     * Explicit good/bad color intent, DECOUPLED from `direction` (#467).
     *
     * Controls the pill color and the good/bad sense independently of the
     * arrow glyph:
     *   - `positive` → success / emerald
     *   - `negative` → error / red
     *   - `neutral`  → gray
     *
     * When omitted, sentiment is derived from `direction` to preserve the
     * historical behavior (`up` → positive, `down` → negative, `neutral` →
     * neutral), so existing consumers are unaffected. Set it for inverted
     * metrics (refund rate, churn, error rate, cost, bounce rate) where a
     * rising number is bad: `{ direction: 'up', sentiment: 'negative' }`
     * renders an up-arrow in the error color. The rendered pill also exposes
     * `data-direction` / `data-sentiment` attributes as stable styling hooks.
     */
    sentiment?: 'positive' | 'negative' | 'neutral'
  }
  /** Label for the trend (e.g., "vs last month") */
  trendLabel?: string
  /** Icon to display with the statistic */
  icon?: React.ReactNode
  /** Color variant for theming */
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
  /** Show loading skeleton state */
  loading?: boolean
}

/**
 * Default mapping from arrow `direction` to color `sentiment`, used when a
 * `trend.sentiment` is not given. Preserves the historical behavior where the
 * arrow direction alone drove the color (up = good/green, down = bad/red).
 */
const DIRECTION_SENTIMENT = {
  up: 'positive',
  down: 'negative',
  neutral: 'neutral',
} as const

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      label,
      value,
      subtitle,
      trend,
      trendLabel,
      icon,
      color = 'primary',
      loading = false,
      asChild = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const cardClasses = [
      styles.statCard,
      styles[`color-${color}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    if (loading) {
      return (
        <div ref={ref} className={cardClasses} {...props}>
          <div className={styles.header}>
            <Skeleton variant="text" width="60%" height={16} />
            {icon && (
              <div className={styles.iconWrapper}>
                <Skeleton variant="circular" width={40} height={40} />
              </div>
            )}
          </div>
          <div className={styles.valueGroup}>
            <div className={styles.valueWrapper}>
              <Skeleton variant="text" width="50%" height={40} />
            </div>
            {subtitle && (
              <Skeleton variant="text" width="70%" height={14} />
            )}
          </div>
          {(trend || trendLabel) && (
            <div className={styles.trendWrapper}>
              <Skeleton variant="text" width="40%" height={14} />
            </div>
          )}
        </div>
      )
    }

    // #467 — effective color sentiment for the trend pill, decoupled from the
    // arrow direction. An explicit `trend.sentiment` wins; otherwise it is
    // derived from `direction` so pre-#467 consumers render exactly as before.
    const trendSentiment = trend
      ? trend.sentiment ?? DIRECTION_SENTIMENT[trend.direction]
      : undefined

    // Structured content shared by both the default and asChild render paths.
    const content = (
      <>
        <div className={styles.header}>
          <span className={styles.label}>{label}</span>
          {icon && <div className={styles.iconWrapper}>{icon}</div>}
        </div>

        <div className={styles.valueGroup}>
          <div className={styles.valueWrapper}>
            <span className={styles.value}>{value}</span>
          </div>
          {subtitle && (
            <span className={styles.subtitle}>{subtitle}</span>
          )}
        </div>

        {(trend || trendLabel) && (
          <div className={styles.trendWrapper}>
            {trend && (
              <span
                className={`${styles.trend} ${styles[`trend-${trendSentiment}`]}`}
                data-direction={trend.direction}
                data-sentiment={trendSentiment}
              >
                <TrendIcon direction={trend.direction} />
                <span className={styles.trendValue}>
                  {Math.abs(trend.value)}%
                </span>
              </span>
            )}
            {trendLabel && (
              <span className={styles.trendLabel}>{trendLabel}</span>
            )}
          </div>
        )}
      </>
    )

    // #424 — polymorphic root. When asChild, delegate the root element to the
    // consumer's single child: StatCard's structured content is injected as
    // that child's content, and Slot merges `.statCard` + color variant +
    // forwarded props onto it. The skeleton state opts out (a loading
    // placeholder has no meaningful child element to delegate to).
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement
      return (
        <Slot ref={ref as React.Ref<HTMLElement>} className={cardClasses} {...props}>
          {React.cloneElement(child, undefined, content)}
        </Slot>
      )
    }

    return (
      <div ref={ref} className={cardClasses} {...props}>
        {content}
      </div>
    )
  }
)

StatCard.displayName = 'StatCard'

// Trend Arrow Icon
const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'neutral' }) => {
  if (direction === 'neutral') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    )
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: direction === 'down' ? 'rotate(180deg)' : 'none' }}
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}
