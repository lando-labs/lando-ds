'use client'

/**
 * Sparkline Component
 *
 * Lightweight inline data visualization (default 80×20px) rendered as
 * hand-rolled SVG. Intentionally does NOT import recharts — keeps the
 * payload minimal and avoids the recharts runtime cost for what is
 * typically an at-a-glance trend indicator in a table cell or list row.
 *
 * Variants:
 * - `bars` — one `<rect>` per non-zero bucket
 * - `line` — a single `<polyline>` across normalized points
 *
 * Data API (two overloads, normalized internally):
 * - `SparklineDataPoint[]` — explicit `{ t, count }` buckets (original API)
 * - `number[]` — convenience form; index becomes the synthetic `t`
 *
 * Style props (line variant):
 * - `color` — accepts a semantic variant key (`'primary' | 'success' | …`)
 *   resolved to a design-token CSS variable, OR any raw CSS color string
 *   (back-compat with v0.8 callers passing `var(--color-…)` directly).
 * - `fill` — when truthy and `variant="line"`, renders a gradient fill from
 *   the line down to the baseline. Ignored for `bars` (bars already paint
 *   solid color blocks).
 * - `showDot` — renders a small `<circle>` at the last data point. Useful
 *   for emphasizing the most recent value. Color matches the line.
 *
 * Empty states (empty array OR all-zero values) render `emptyFallback`
 * (default: em-dash) inside the same `<span>` wrapper, so layout stays
 * stable when a row has no activity.
 *
 * Accessibility: the component sets `aria-label` on the SVG. When data is
 * present, the label includes a trend summary (direction + min/max) so
 * screen readers announce something meaningful, not just "Activity trend".
 *
 * Ref target is always the outer `<span>` — the inner render (SVG vs
 * em-dash) is a render-time decision, but the ref contract is consistent.
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './Sparkline.module.css'

export interface SparklineDataPoint {
  /** Bucket identifier — typically an ISO timestamp, but any string or number works. */
  t: string | number
  /** Value for this bucket. Must be ≥ 0. */
  count: number
}

/** Semantic color variants resolved to design tokens. */
export type SparklineColorVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'info'

/**
 * Color prop — accepts a semantic variant key or any raw CSS color string.
 * Token resolution table is below in `resolveColor`.
 */
export type SparklineColor = SparklineColorVariant | (string & {})

export interface SparklineProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * Time-series data, most recent last. Empty array → renders emptyFallback.
   *
   * Accepts either explicit `{ t, count }` buckets OR a plain `number[]`.
   * Plain numbers are normalized internally with the array index as the
   * synthetic `t` (so the line/bar shape is identical, but you skip the
   * boilerplate when you don't have real timestamps to attach).
   */
  data: SparklineDataPoint[] | number[]
  /** Size in pixels. Defaults to 80×20. */
  size?: { w?: number; h?: number }
  /** Convenience override for height (alias for `size.h`). Default: 20. */
  height?: number
  /** Convenience override for width (alias for `size.w`). Default: 80. */
  width?: number
  /** Bar chart or line chart. Default 'bars'. */
  variant?: 'bars' | 'line'
  /**
   * Color for the line/bars. Accepts:
   * - A semantic variant key: `'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'`
   *   (resolved to the matching `--color-*-base` design token)
   * - Any raw CSS color string (`'#1b7fa8'`, `'rgb(…)'`, `'var(--color-teal-base)'`)
   *
   * Default: `var(--color-primary)` (back-compat with v0.8).
   */
  color?: SparklineColor
  /**
   * When truthy and `variant="line"`, render a gradient fill below the line
   * (full color at top → ~5% opacity at baseline). Ignored for `bars`.
   * Default: false.
   */
  fill?: boolean
  /**
   * When truthy, render a small `<circle>` at the last data point. Color
   * matches the resolved `color` prop. Default: false.
   */
  showDot?: boolean
  /** Rendered when data is empty or all values are zero. Default: em-dash '—'. */
  emptyFallback?: React.ReactNode
  /**
   * Accessible label for the SVG / em-dash span. Uses the native `aria-label`
   * attribute (inherited from `HTMLAttributes`) — matches the React-Aria /
   * Radix convention. If omitted, a trend summary is auto-generated from the
   * data (e.g. "Trend: ascending, min 12, max 45").
   */
  'aria-label'?: string
  /**
   * Render as the single child element, merging the Sparkline's wrapper
   * styling and resolved color onto it (Layer-7 composition, #424). Pass a
   * single element as `children`; the `styles.sparkline` class, wrapper
   * `style` (resolved color), and `role="img"`/`aria-label` land on it, and
   * the SVG (or empty fallback) is composed inside.
   */
  asChild?: boolean
  /**
   * Child element to render when `asChild` is true. Ignored otherwise — a
   * plain Sparkline renders its own SVG / fallback content.
   */
  children?: React.ReactNode
}

const DEFAULT_SIZE = { w: 80, h: 20 }

/**
 * Map a semantic color variant to its design-token CSS var. Anything that
 * isn't one of the known variants falls through unchanged — that's how
 * `color="var(--color-teal-base)"` (the v0.8 escape hatch) keeps working.
 */
const SEMANTIC_COLOR_MAP: Record<SparklineColorVariant, string> = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success-base)',
  warning: 'var(--color-warning-base)',
  // Tokens use `error` (not `danger`) — alias here so consumers can use
  // either ergonomic name. `danger` is the "frontend" word; `error` is the
  // token-system word.
  danger: 'var(--color-error-base)',
  neutral: 'var(--color-neutral-500)',
  info: 'var(--color-info-base)',
}

function resolveColor(color: SparklineColor | undefined): string {
  // Default follows the brand (#287) — was a raw --color-ocean-base rung that
  // never re-skinned when a product theme overrode --color-primary.
  if (!color) return 'var(--color-primary)'
  if (color in SEMANTIC_COLOR_MAP) {
    return SEMANTIC_COLOR_MAP[color as SparklineColorVariant]
  }
  return color
}

/**
 * Normalize the polymorphic `data` prop into the canonical
 * `SparklineDataPoint[]` shape. `number[]` callers get an index-based `t`.
 */
function normalizeData(
  data: SparklineDataPoint[] | number[]
): SparklineDataPoint[] {
  if (data.length === 0) return []
  // Discriminator: the first element's shape decides the branch. We don't
  // mix-and-match within an array — TypeScript already enforces that.
  if (typeof data[0] === 'number') {
    return (data as number[]).map((count, i) => ({ t: i, count }))
  }
  return data as SparklineDataPoint[]
}

/**
 * Build an a11y label summarizing the trend. Used when consumer didn't
 * pass `aria-label` explicitly. Format mirrors what a screen-reader user
 * would want at a glance: direction + min/max bounds.
 */
function buildTrendLabel(data: SparklineDataPoint[]): string {
  if (data.length === 0) return 'No activity'
  const counts = data.map((d) => d.count)
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  const first = counts[0]! // safe: data.length > 0 checked above; counts is 1:1 with data
  const last = counts[counts.length - 1]! // safe: counts is non-empty
  let direction: string
  if (data.length < 2 || first === last) direction = 'flat'
  else if (last > first) direction = 'ascending'
  else direction = 'descending'
  return `Trend: ${direction}, min ${min}, max ${max}`
}

// Stable id counter — kept module-scoped so SSR + hydration produce the
// same value per call site (React.useId would also work, but we want the
// id namespaced to gradients only so it's predictable in snapshot tests).
let gradientIdCounter = 0
function nextGradientId(): string {
  gradientIdCounter += 1
  return `sparkline-fill-${gradientIdCounter}`
}

export const Sparkline = React.forwardRef<HTMLSpanElement, SparklineProps>(
  (
    {
      data,
      size,
      width,
      height,
      variant = 'bars',
      color,
      fill = false,
      showDot = false,
      emptyFallback = '—',
      'aria-label': ariaLabel,
      asChild = false,
      children,
      className,
      style,
      ...rest
    },
    ref
  ) => {
    // Width/height resolution — `size.w`/`size.h` win over `width`/`height`
    // shortcuts (explicit object form is the v0.8 API, the shortcuts are
    // ergonomics). Falls back to the historical 80×20 default.
    const w = size?.w ?? width ?? DEFAULT_SIZE.w
    const h = size?.h ?? height ?? DEFAULT_SIZE.h

    const normalized = React.useMemo(() => normalizeData(data), [data])

    // Gradient id is stable per-instance via useRef so re-renders don't churn
    // the SVG `<defs>` and break referenced `fill="url(#…)"` mid-paint. Lives
    // up here (not inside the data-bearing branch) so hook order is stable
    // across the empty/non-empty render switch.
    const gradientIdRef = React.useRef<string | null>(null)
    if (gradientIdRef.current === null) {
      gradientIdRef.current = nextGradientId()
    }
    const gradientId = gradientIdRef.current

    // Empty = no data OR all values are zero. Both cases should surface the
    // fallback so that a "no activity" row reads the same as a "no data" row.
    const hasData =
      normalized.length > 0 && normalized.some((d) => d.count > 0)

    const resolvedColor = resolveColor(color)
    // `color` from the `color` prop is a themed default; a consumer's inline
    // `style={{ color }}` is the more explicit override and must win, so spread
    // `style` last. (Layer-3 override contract — no silent style-key drop.)
    const wrapperStyle: React.CSSProperties = {
      color: resolvedColor,
      ...style,
    }

    // Trend label is auto-derived if the consumer didn't override. Recompute
    // on every render — cost is O(n) over a sparkline-sized array (typically
    // ≤ 60 points), well below the cost of a useMemo wrapper.
    const computedAriaLabel =
      ariaLabel ?? (hasData ? buildTrendLabel(normalized) : 'No activity')

    if (!hasData) {
      const emptyClasses = [styles.sparkline, styles.empty, className]
        .filter(Boolean)
        .join(' ')
      if (asChild && React.isValidElement(children)) {
        const onlyChild = children as React.ReactElement<{
          children?: React.ReactNode
        }>
        return (
          <Slot
            ref={ref as unknown as React.Ref<HTMLElement>}
            role="img"
            aria-label={computedAriaLabel}
            className={emptyClasses}
            style={wrapperStyle}
            {...rest}
          >
            {React.cloneElement(onlyChild, undefined, emptyFallback)}
          </Slot>
        )
      }
      return (
        <span
          ref={ref}
          role="img"
          aria-label={computedAriaLabel}
          className={emptyClasses}
          style={wrapperStyle}
          {...rest}
        >
          {emptyFallback}
        </span>
      )
    }

    const max = Math.max(...normalized.map((d) => d.count))

    const showFill = fill && variant === 'line'

    const svg = (
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={computedAriaLabel}
        className={styles.svg}
      >
        {showFill && (
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
              data-testid="sparkline-fill-gradient"
            >
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        )}
        {variant === 'bars' ? (
          <BarsRenderer data={normalized} w={w} h={h} max={max} />
        ) : (
          <LineRenderer
            data={normalized}
            w={w}
            h={h}
            max={max}
            fillId={showFill ? gradientId : null}
            showDot={showDot}
          />
        )}
      </svg>
    )

    const dataClasses = [styles.sparkline, className].filter(Boolean).join(' ')

    if (asChild && React.isValidElement(children)) {
      const onlyChild = children as React.ReactElement<{
        children?: React.ReactNode
      }>
      return (
        <Slot
          ref={ref as unknown as React.Ref<HTMLElement>}
          className={dataClasses}
          style={wrapperStyle}
          {...rest}
        >
          {React.cloneElement(onlyChild, undefined, svg)}
        </Slot>
      )
    }

    return (
      <span
        ref={ref}
        className={dataClasses}
        style={wrapperStyle}
        {...rest}
      >
        {svg}
      </span>
    )
  }
)

Sparkline.displayName = 'Sparkline'

interface RendererProps {
  data: SparklineDataPoint[]
  w: number
  h: number
  max: number
}

interface LineRendererProps extends RendererProps {
  fillId: string | null
  showDot: boolean
}

/**
 * Internal — renders one `<rect>` per non-zero bucket.
 *
 * Zero-count buckets are skipped entirely (no rect emitted) so the bar view
 * reads as sparse activity. Single-bar sparklines (count === 1) still render,
 * because we clamp `barWidth` to a minimum of 1px to avoid division-by-zero
 * when gaps exceed the drawable width.
 */
function BarsRenderer({ data, w, h, max }: RendererProps) {
  const count = data.length
  const gap = 1
  const barWidth = Math.max(1, (w - gap * Math.max(0, count - 1)) / count)

  return (
    <>
      {data.map((d, i) => {
        if (d.count === 0) return null
        const normalized = (d.count / max) * h
        const x = i * (barWidth + gap)
        const y = h - normalized
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={normalized}
            className={styles.bar}
          />
        )
      })}
    </>
  )
}

/**
 * Internal — builds a `<polyline>` from normalized points, optionally with
 * a filled `<path>` underneath (closed to the baseline) and an end-of-line
 * `<circle>` marker.
 *
 * Zero-count buckets are NOT skipped here — they participate in the line as a
 * low point on the y-axis (0), so the curve keeps its shape. Single-point data
 * is rendered as a single "point" (polyline with one vertex); SVG still draws
 * the linecap.
 */
function LineRenderer({
  data,
  w,
  h,
  max,
  fillId,
  showDot,
}: LineRendererProps) {
  const count = data.length
  const stepX = count > 1 ? w / (count - 1) : 0

  // Pre-compute (x, y) once so polyline + fill path + dot all agree on the
  // same coordinates. Avoids subtle drift from re-running the math.
  const points = data.map((d, i) => {
    const x = i * stepX
    const y = h - (d.count / max) * h
    return { x, y }
  })

  const polylinePoints = points
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')

  // Fill path closes the line at the baseline so the gradient renders as a
  // sealed area under the curve. Only computed when `fillId` is set.
  let fillPath: string | null = null
  if (fillId && points.length > 0) {
    const segments: string[] = []
    points.forEach((p, i) => {
      segments.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    })
    // Close down to the baseline and back to start.
    const last = points[points.length - 1]! // safe: points.length > 0 checked above
    const first = points[0]! // safe: points.length > 0 checked above
    segments.push(`L${last.x.toFixed(2)},${h.toFixed(2)}`)
    segments.push(`L${first.x.toFixed(2)},${h.toFixed(2)}`)
    segments.push('Z')
    fillPath = segments.join(' ')
  }

  // Dot radius scales with sparkline height. Floor at 1.5px so it stays
  // visible at the smallest 20px default; cap at ~3.5px so it doesn't
  // dominate larger sparklines.
  const dotRadius = Math.min(3.5, Math.max(1.5, h / 16))
  const lastPoint = points[points.length - 1]

  return (
    <>
      {fillPath && (
        <path d={fillPath} fill={`url(#${fillId})`} className={styles.fill} />
      )}
      <polyline points={polylinePoints} className={styles.line} />
      {showDot && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={dotRadius}
          className={styles.dot}
          data-testid="sparkline-dot"
        />
      )}
    </>
  )
}
