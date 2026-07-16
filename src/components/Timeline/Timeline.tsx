'use client'

/**
 * Timeline Component
 *
 * Vertical event timeline supporting two complementary usage modes:
 *
 * 1. **Distributed-tracing / log mode** (original v0.8.0 API)
 *    Use `timestamp` (string/ReactNode), `status`, `expandable`, and
 *    nested `<Timeline.Group>` for hierarchical span visualization.
 *
 * 2. **Activity-feed mode** (added in v0.9.0)
 *    Use `icon` (rendered inside the dot bezel), `title` (bold lead
 *    line), `actor` (muted byline), `variant` (color), and a
 *    `Date | string` timestamp — auto-formatted via
 *    `Intl.RelativeTimeFormat` (recent) or `Intl.DateTimeFormat`
 *    (older), with a `formatTimestamp` escape hatch.
 *
 * Both modes use the same dot-and-rail connector and can be mixed
 * within a single Timeline.
 *
 * @example Tracing usage
 * <Timeline>
 *   <Timeline.Item timestamp="09:42:01" status="success">
 *     <Text>Request completed</Text>
 *   </Timeline.Item>
 *   <Timeline.Item timestamp="09:42:02" status="info" expandable>
 *     <Text>Tool: web_search</Text>
 *     <Timeline.Group>
 *       <Timeline.Item timestamp="09:42:02.1" status="info">
 *         <Text>Fetched 42 results</Text>
 *       </Timeline.Item>
 *     </Timeline.Group>
 *   </Timeline.Item>
 * </Timeline>
 *
 * @example Activity-feed usage
 * <Timeline>
 *   <TimelineItem
 *     icon={<Icon name="Edit" />}
 *     timestamp={new Date('2026-04-25T14:30:00')}
 *     title="Story moved to Editor Review"
 *     actor="claude-opus-4-7"
 *   >
 *     The investigator agent completed the draft. Word count: 1,247.
 *   </TimelineItem>
 *   <TimelineItem
 *     icon={<Icon name="Check" />}
 *     timestamp={new Date('2026-04-25T14:32:00')}
 *     title="Approved by editor"
 *     actor="user@example.com"
 *     variant="success"
 *   />
 * </Timeline>
 */

import React from 'react'
import styles from './Timeline.module.css'

export type TimelineStatus = 'default' | 'info' | 'success' | 'warning' | 'error'

/**
 * Activity-feed flavored color variant. Maps internally to the same
 * color tokens as `status`, but uses semantically familiar names for
 * activity-feed consumers (`neutral` instead of `default`).
 */
export type TimelineVariant = 'neutral' | 'info' | 'success' | 'warning' | 'error'

/* ============================================================================
   Timeline (root)
   ============================================================================ */

export interface TimelineProps
  extends Omit<React.HTMLAttributes<HTMLOListElement>, 'children'> {
  /** Render 3 skeleton rows while data is being fetched. */
  loading?: boolean
  /** Content shown when no children are provided. */
  emptyState?: React.ReactNode
  /** Timeline.Item children (and optionally nested Timeline.Group inside). */
  children?: React.ReactNode
}

const TimelineRoot = React.forwardRef<HTMLOListElement, TimelineProps>(
  ({ loading, emptyState, children, className = '', ...rest }, ref) => {
    const classes = [styles.timeline, className].filter(Boolean).join(' ')

    if (loading) {
      return (
        <ol ref={ref} className={classes} aria-busy="true" {...rest}>
          {[0, 1, 2].map(i => (
            <li key={i} className={styles.skeletonItem}>
              <div className={styles.connector}>
                <span className={`${styles.dot} ${styles.skeletonDot}`} />
                <span className={`${styles.line} ${styles.skeletonLine}`} />
              </div>
              <div className={styles.body}>
                <div className={styles.skeletonTimestamp} />
                <div className={styles.skeletonContent} />
              </div>
            </li>
          ))}
        </ol>
      )
    }

    const hasChildren = React.Children.count(children) > 0

    if (!hasChildren && emptyState !== undefined) {
      return <div className={styles.empty}>{emptyState}</div>
    }

    return (
      <ol ref={ref} className={classes} {...rest}>
        {children}
      </ol>
    )
  }
)

/* ============================================================================
   Timestamp formatting helpers (activity-feed mode)
   ============================================================================ */

/**
 * Default smart formatter for `Date` timestamps in activity-feed mode.
 *
 * - Less than 1 minute ago  -> "just now"
 * - Less than 1 hour ago    -> Intl.RelativeTimeFormat in minutes
 * - Less than 24 hours ago  -> Intl.RelativeTimeFormat in hours
 * - Less than 7 days ago    -> Intl.RelativeTimeFormat in days
 * - Older                   -> Absolute "MMM D, YYYY, h:mm A"
 *
 * Future-dated values are also formatted relative ("in 5 minutes").
 */
function defaultFormatTimestamp(date: Date): string {
  const now = Date.now()
  const target = date.getTime()
  const diffSeconds = (target - now) / 1000
  const absSeconds = Math.abs(diffSeconds)

  // Less than 7 days: relative
  if (absSeconds < 60 * 60 * 24 * 7) {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

    if (absSeconds < 60) {
      // Less than a minute -> snap to "now"
      return rtf.format(0, 'second').replace('0 seconds ago', 'just now')
    }
    if (absSeconds < 60 * 60) {
      const minutes = Math.round(diffSeconds / 60)
      return rtf.format(minutes, 'minute')
    }
    if (absSeconds < 60 * 60 * 24) {
      const hours = Math.round(diffSeconds / 3600)
      return rtf.format(hours, 'hour')
    }
    const days = Math.round(diffSeconds / 86400)
    return rtf.format(days, 'day')
  }

  // Older than 7 days: absolute
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/* ============================================================================
   TimelineItem
   ============================================================================ */

export interface TimelineItemProps
  extends Omit<React.HTMLAttributes<HTMLLIElement>, 'children' | 'title'> {
  /**
   * Leading timestamp slot.
   *
   * - `string` / `ReactNode`: rendered as-is (tracing mode — e.g. `"09:42:01"`).
   * - `Date`: formatted with `formatTimestamp` if provided, otherwise
   *   smart-formatted (relative for < 7 days, absolute for older).
   */
  timestamp?: React.ReactNode | Date
  /**
   * Custom formatter for `Date` timestamps. Ignored when `timestamp`
   * is a string/ReactNode.
   */
  formatTimestamp?: (date: Date) => string
  /**
   * Status-based dot coloring. Use for tracing/log semantics.
   * (`variant` is the activity-feed counterpart — both apply the
   * same color tokens; `variant` takes precedence if both are set.)
   */
  status?: TimelineStatus
  /**
   * Activity-feed color variant. Same color machinery as `status`,
   * but with `neutral` instead of `default` for naming clarity in
   * activity-feed contexts. Wins over `status` when both are set.
   */
  variant?: TimelineVariant
  /**
   * Icon rendered inside the dot bezel (activity-feed mode).
   * Sized at ~14px to fit the bezel circle. When provided, the
   * dot expands to a 24px bezel.
   */
  icon?: React.ReactNode
  /** Bold lead line rendered above `children` body (activity-feed mode). */
  title?: React.ReactNode
  /** Muted "by {actor}" line rendered under `title` (activity-feed mode). */
  actor?: string
  /** Enable expand/collapse toggle UI with chevron. */
  expandable?: boolean
  /** Controlled expanded state. If omitted, state is managed internally. */
  expanded?: boolean
  /** Uncontrolled initial expanded state. */
  defaultExpanded?: boolean
  /** Fires when expanded state changes. */
  onExpandedChange?: (expanded: boolean) => void
  /** Item body — text, markup, and optionally a nested <Timeline.Group>. */
  children?: React.ReactNode
}

/**
 * Internal: resolve the color-class name. `variant` wins over `status`
 * when both are set. Maps `variant`'s `neutral` to status's `default`
 * so they share the same CSS rules.
 */
function resolveStatusClass(
  status: TimelineStatus,
  variant?: TimelineVariant
): string {
  if (variant) {
    const mapped: TimelineStatus = variant === 'neutral' ? 'default' : variant
    return styles[`status-${mapped}`] ?? ''
  }
  return styles[`status-${status}`] ?? ''
}

/**
 * Internal: render a timestamp prop into a string/ReactNode for
 * display inside the `<time>` element.
 */
function renderTimestamp(
  timestamp: React.ReactNode | Date | undefined,
  formatTimestamp?: (date: Date) => string
): React.ReactNode | undefined {
  if (timestamp === undefined || timestamp === null) return undefined
  if (timestamp instanceof Date) {
    return (formatTimestamp ?? defaultFormatTimestamp)(timestamp)
  }
  return timestamp
}

export const TimelineItem = React.forwardRef<HTMLLIElement, TimelineItemProps>(
  (
    {
      timestamp,
      formatTimestamp,
      status = 'default',
      variant,
      icon,
      title,
      actor,
      expandable = false,
      expanded: controlledExpanded,
      defaultExpanded = false,
      onExpandedChange,
      children,
      className = '',
      ...rest
    },
    ref
  ) => {
    const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded)
    const isControlled = controlledExpanded !== undefined
    const isExpanded = isControlled ? controlledExpanded : internalExpanded

    const toggleExpanded = () => {
      const next = !isExpanded
      if (!isControlled) setInternalExpanded(next)
      onExpandedChange?.(next)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleExpanded()
      }
    }

    // Partition children: if an expandable item contains a TimelineGroup, the
    // group is a SIBLING of the toggle button (not inside the button). This
    // keeps interactive elements out of the clickable region.
    let groupChildren: React.ReactNode[] = []
    let bodyChildren: React.ReactNode[] = []

    if (expandable) {
      React.Children.forEach(children, child => {
        if (React.isValidElement(child) && child.type === TimelineGroup) {
          groupChildren.push(child)
        } else {
          bodyChildren.push(child)
        }
      })
    } else {
      bodyChildren = React.Children.toArray(children)
    }

    const statusClass = resolveStatusClass(status, variant)

    const classes = [
      styles.item,
      statusClass,
      icon ? styles.hasIcon : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const renderedTimestamp = renderTimestamp(timestamp, formatTimestamp)

    // The connector slot. When an icon is provided we render a larger
    // bezel containing the icon; otherwise the original 10px dot.
    const connector = (
      <div className={styles.connector}>
        {icon ? (
          <span className={`${styles.dot} ${styles.bezel}`} aria-hidden="true">
            <span className={styles.iconWrap}>{icon}</span>
          </span>
        ) : (
          <span className={styles.dot} />
        )}
        <span className={styles.line} />
      </div>
    )

    // Header content shared between expandable and non-expandable
    // renders. Order: timestamp, title, actor, body.
    const headerContent = (
      <>
        {renderedTimestamp !== undefined && (
          <time className={styles.timestamp}>{renderedTimestamp}</time>
        )}
        {title !== undefined && title !== null && (
          <div className={styles.title}>{title}</div>
        )}
        {actor !== undefined && actor !== null && actor !== '' && (
          <div className={styles.actor}>by {actor}</div>
        )}
        {bodyChildren.length > 0 && (
          <div className={styles.content}>{bodyChildren}</div>
        )}
      </>
    )

    return (
      <li ref={ref} className={classes} {...rest}>
        {connector}
        <div className={styles.body}>
          {expandable ? (
            <>
              <button
                type="button"
                className={styles.toggle}
                onClick={toggleExpanded}
                onKeyDown={handleKeyDown}
                aria-expanded={isExpanded}
              >
                <div className={styles.toggleHeader}>
                  <div className={styles.toggleHeaderText}>{headerContent}</div>
                  <ChevronRightIcon className={styles.chevron} />
                </div>
              </button>
              {isExpanded && groupChildren}
            </>
          ) : (
            headerContent
          )}
        </div>
      </li>
    )
  }
)

TimelineItem.displayName = 'TimelineItem'

/* ============================================================================
   TimelineGroup (nested second-tier)
   ============================================================================ */

export interface TimelineGroupProps
  extends Omit<React.HTMLAttributes<HTMLOListElement>, 'children'> {
  /** Timeline.Item children rendered with smaller second-tier visuals. */
  children?: React.ReactNode
}

export const TimelineGroup = React.forwardRef<HTMLOListElement, TimelineGroupProps>(
  ({ children, className = '', ...rest }, ref) => {
    const classes = [styles.group, className].filter(Boolean).join(' ')
    return (
      <ol ref={ref} className={classes} role="list" {...rest}>
        {children}
      </ol>
    )
  }
)

TimelineGroup.displayName = 'TimelineGroup'

/* ============================================================================
   Chevron icon (private)
   ============================================================================ */

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M6 4L10 8L6 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/* ============================================================================
   Compound attachment
   ============================================================================ */

export const Timeline = Object.assign(TimelineRoot, {
  Item: TimelineItem,
  Group: TimelineGroup,
})

// Set AFTER Object.assign so the compound attachment can't drop it.
Timeline.displayName = 'Timeline'
