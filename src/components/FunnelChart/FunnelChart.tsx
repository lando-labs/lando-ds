'use client'

/**
 * FunnelChart Component
 *
 * Sequential drop-off visualization (signup → verified → activated → paid).
 *
 * Recharts has no native funnel primitive, so this renders a custom SVG
 * trapezoid stack. Each stage is a `<polygon>` whose width is proportional
 * to its `count` (or `percentage`). Labels are placed inside the trapezoid
 * for vertical orientation and beside it for horizontal.
 *
 * **Reuse of the Chart base pattern**
 *
 * The shared `Chart` wrapper is built around Recharts' `ResponsiveContainer`
 * which expects Recharts children. Passing a hand-rolled SVG through it is
 * possible at runtime but pulls a `ResizeObserver` dependency into tests
 * for no benefit (see `Chart.test.tsx` — the same reason its render-level
 * tests are source-level only). FunnelChart therefore:
 *
 *   - reuses `Chart.module.css` for visual parity of loading / empty /
 *     error / title / description states
 *   - reuses `getChartColors(colorScheme)` for theme propagation
 *   - reuses the `BaseChartProps` shape for prop consistency
 *   - mirrors the off-screen SSR data-table fallback (with
 *     `suppressHydrationWarning`) for screen-reader access
 *
 * but renders the success-path body directly inside its own container so
 * tests render cleanly under jsdom without a `ResizeObserver` shim.
 *
 * @example
 * <FunnelChart
 *   data={[
 *     { stage: 'Signups',   count: 1250, percentage: 100 },
 *     { stage: 'Verified',  count: 980,  percentage: 78 },
 *     { stage: 'Activated', count: 620,  percentage: 50 },
 *     { stage: 'Converted', count: 215,  percentage: 17 },
 *   ]}
 *   orientation="vertical"
 *   showPercentages
 *   showAbsoluteCounts
 *   colorScheme="teal"
 * />
 */

import React, { forwardRef, useMemo } from 'react'
import { BaseChartProps, getChartColors } from '../Chart'
import type { ChartConfigProps, ColorScheme } from '../Chart'
import chartStyles from '../Chart/Chart.module.css'
import styles from './FunnelChart.module.css'

/** A single funnel stage. `percentage` is optional — when omitted, it is
 *  auto-computed from `count` relative to the first stage. */
export interface FunnelStage {
  stage: string
  count: number
  percentage?: number
}

export interface FunnelChartProps
  extends Omit<BaseChartProps, 'data' | 'aspectRatio'>,
    // The funnel renderer only honors a subset of the shared chart config
    // (issue #334 split). It does NOT expose grids, legends, or tooltips, so
    // those `ChartConfigProps` flags are intentionally NOT picked here. Note
    // `BaseChartProps` already contributes `React.HTMLAttributes<HTMLDivElement>`,
    // so consumer `className` / `style` / `...rest` flow through.
    Pick<
      ChartConfigProps,
      'width' | 'variant' | 'colorScheme' | 'colors' | 'interactive' | 'animationDuration'
    > {
  /** Funnel stages, ordered widest → narrowest. */
  data: FunnelStage[]
  /** Stack stages vertically (default) or sequence them horizontally. */
  orientation?: 'vertical' | 'horizontal'
  /** Show percentage labels on each stage (default: `true`). */
  showPercentages?: boolean
  /** Show absolute count labels on each stage (default: `true`). */
  showAbsoluteCounts?: boolean
}

/** Internal: a fully-resolved stage with percentage filled in. */
interface ResolvedStage {
  stage: string
  count: number
  percentage: number
}

/**
 * Resolve raw input into renderable stages. Throws nothing — invalid input
 * (negative counts, non-numeric percentages) is reported back to the caller
 * as an `error` string so the component can surface it via the Chart base
 * error state.
 */
function resolveStages(data: FunnelStage[]): {
  stages: ResolvedStage[]
  errorMessage?: string
} {
  if (!Array.isArray(data) || data.length === 0) {
    return { stages: [] }
  }

  // Validate first — bail out cheaply on malformed input.
  for (const row of data) {
    if (typeof row.count !== 'number' || Number.isNaN(row.count)) {
      return { stages: [], errorMessage: 'Funnel data: every stage must have a numeric count.' }
    }
    if (row.count < 0) {
      return { stages: [], errorMessage: 'Funnel data: counts must be non-negative.' }
    }
    if (
      row.percentage !== undefined &&
      (typeof row.percentage !== 'number' || Number.isNaN(row.percentage) || row.percentage < 0)
    ) {
      return {
        stages: [],
        errorMessage: 'Funnel data: percentages must be non-negative numbers.',
      }
    }
  }

  const baseCount = data[0]!.count // safe: data.length > 0 checked above
  const stages = data.map<ResolvedStage>((row) => ({
    stage: row.stage,
    count: row.count,
    percentage:
      row.percentage !== undefined
        ? row.percentage
        : baseCount > 0
        ? (row.count / baseCount) * 100
        : 0,
  }))

  return { stages }
}

/** Round to 2dp for display while keeping integer percentages clean. */
function formatPercentage(p: number): string {
  if (Number.isInteger(p)) return `${p}%`
  return `${p.toFixed(1)}%`
}

/** Default vertical funnel size — matches Chart base default `height` (300). */
const DEFAULT_HEIGHT = 300
const DEFAULT_WIDTH = 480

export const FunnelChart = forwardRef<HTMLDivElement, FunnelChartProps>(
  function FunnelChart(
    {
      data,
      orientation = 'vertical',
      showPercentages = true,
      showAbsoluteCounts = true,
      colorScheme = 'brand',
      colors: customColors,
      width: widthProp,
      height = DEFAULT_HEIGHT,
      variant: _variant = 'default',
      loading = false,
      empty = false,
      error,
      title,
      description,
      'aria-label': ariaLabel,
      animationDuration = 300,
      interactive: _interactive,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const { stages, errorMessage } = useMemo(() => resolveStages(data), [data])

    const palette = useMemo<string[]>(() => {
      const fromScheme = customColors && customColors.length > 0
        ? customColors
        : getChartColors(colorScheme as ColorScheme)
      return fromScheme.length > 0 ? fromScheme : getChartColors('brand')
    }, [colorScheme, customColors])

    const resolvedError = error ?? errorMessage

    // ---- Loading state (mirrors Chart base) ----
    if (loading) {
      return (
        <div
          {...rest}
          ref={ref}
          className={`${chartStyles.chartContainer} ${chartStyles.loading} ${className || ''}`}
          style={{ height, ...style }}
          role="status"
          aria-label="Loading chart"
        >
          <div className={chartStyles.skeleton} style={{ height }} />
        </div>
      )
    }

    // ---- Error state ----
    if (resolvedError) {
      return (
        <div
          {...rest}
          ref={ref}
          className={`${chartStyles.chartContainer} ${chartStyles.error} ${className || ''}`}
          style={{ height, ...style }}
          role="alert"
        >
          <div className={chartStyles.errorIcon} aria-hidden="true">⚠️</div>
          <div className={chartStyles.errorText}>{resolvedError}</div>
        </div>
      )
    }

    // ---- Empty state ----
    const allZero = stages.length > 0 && stages.every((s) => s.count === 0)
    if (empty || stages.length === 0 || allZero) {
      return (
        <div
          {...rest}
          ref={ref}
          className={`${chartStyles.chartContainer} ${chartStyles.empty} ${className || ''}`}
          style={{ height, ...style }}
        >
          <div className={chartStyles.emptyIcon} aria-hidden="true">📊</div>
          <div className={chartStyles.emptyText}>No data to display</div>
        </div>
      )
    }

    // ---- Success path: render funnel SVG ----
    const renderWidth = typeof widthProp === 'number' ? widthProp : DEFAULT_WIDTH
    const renderHeight = typeof height === 'number' ? height : DEFAULT_HEIGHT

    // Use the FIRST stage as the 100% reference. We size each stage's width
    // relative to the largest stage's count (always stages[0] in a funnel).
    const maxCount = stages[0]!.count // safe: empty `stages` returns above
    const stageRatios = stages.map((s) => (maxCount > 0 ? s.count / maxCount : 0))

    // Geometry — vertical funnel: width tapers top→bottom, equal heights.
    // Horizontal funnel: height tapers left→right, equal widths.
    const polygons: Array<{
      points: string
      fill: string
      labelX: number
      labelY: number
      labelAnchor: 'start' | 'middle' | 'end'
      labelInside: boolean
    }> = []

    if (orientation === 'vertical') {
      const stageHeight = renderHeight / stages.length
      for (let i = 0; i < stages.length; i++) {
        const topRatio = stageRatios[i]! // safe: i < stages.length === stageRatios.length
        const bottomRatio = stageRatios[i + 1] ?? topRatio * 0.85
        const topWidth = renderWidth * topRatio
        const bottomWidth = renderWidth * Math.min(bottomRatio, topRatio)
        const yTop = i * stageHeight
        const yBottom = (i + 1) * stageHeight
        const xTopLeft = (renderWidth - topWidth) / 2
        const xTopRight = xTopLeft + topWidth
        const xBottomLeft = (renderWidth - bottomWidth) / 2
        const xBottomRight = xBottomLeft + bottomWidth
        const points = `${xTopLeft},${yTop} ${xTopRight},${yTop} ${xBottomRight},${yBottom} ${xBottomLeft},${yBottom}`

        polygons.push({
          points,
          fill: palette[i % palette.length]!, // safe: palette is non-empty
          labelX: renderWidth / 2,
          labelY: yTop + stageHeight / 2,
          labelAnchor: 'middle',
          labelInside: true,
        })
      }
    } else {
      // horizontal: stages flow left→right, height tapers
      const stageWidth = renderWidth / stages.length
      for (let i = 0; i < stages.length; i++) {
        const leftRatio = stageRatios[i]! // safe: i < stages.length === stageRatios.length
        const rightRatio = stageRatios[i + 1] ?? leftRatio * 0.85
        const leftHeight = renderHeight * leftRatio
        const rightHeight = renderHeight * Math.min(rightRatio, leftRatio)
        const xLeft = i * stageWidth
        const xRight = (i + 1) * stageWidth
        const yLeftTop = (renderHeight - leftHeight) / 2
        const yLeftBottom = yLeftTop + leftHeight
        const yRightTop = (renderHeight - rightHeight) / 2
        const yRightBottom = yRightTop + rightHeight
        const points = `${xLeft},${yLeftTop} ${xRight},${yRightTop} ${xRight},${yRightBottom} ${xLeft},${yLeftBottom}`

        polygons.push({
          points,
          fill: palette[i % palette.length]!, // safe: palette is non-empty
          // Place label BESIDE the stage, just below the trapezoid.
          labelX: xLeft + stageWidth / 2,
          labelY: renderHeight + 4,
          labelAnchor: 'middle',
          labelInside: false,
        })
      }
    }

    const computedAriaLabel =
      ariaLabel ||
      title ||
      `Funnel chart with ${stages.length} ${stages.length === 1 ? 'stage' : 'stages'}`

    return (
      <div
        data-testid="funnel-chart"
        {...rest}
        ref={ref}
        className={`${chartStyles.chartContainer} ${className || ''}`}
        style={style}
        role="img"
        aria-label={computedAriaLabel}
      >
        {title && <div className={chartStyles.title}>{title}</div>}
        {description && <div className={chartStyles.description}>{description}</div>}

        <svg
          className={styles.svg}
          width="100%"
          height={renderHeight}
          viewBox={`0 0 ${renderWidth} ${renderHeight + (orientation === 'horizontal' ? 40 : 0)}`}
          preserveAspectRatio="xMidYMid meet"
          data-orientation={orientation}
          // The chart already carries role="img" + aria-label on the wrapper;
          // mark the SVG presentational so screen readers announce the
          // wrapper label and read the off-screen data table for details.
          role="presentation"
          aria-hidden="true"
          focusable="false"
        >
          {polygons.map((poly, i) => {
            const stage = stages[i]! // safe: polygons is built 1:1 from stages
            // Stagger animation start so stages cascade in.
            const animStyle: React.CSSProperties = {
              animationDelay: `${i * 80}ms`,
              animationDuration: `${animationDuration}ms`,
            }
            return (
              <g key={`${stage.stage}-${i}`} className={styles.stage} style={animStyle}>
                <polygon
                  points={poly.points}
                  fill={poly.fill}
                  stroke="var(--color-surface)"
                  strokeWidth={1}
                />
                <text
                  x={poly.labelX}
                  y={poly.labelY}
                  textAnchor={poly.labelAnchor}
                  className={`${styles.label} ${
                    poly.labelInside ? styles.labelInside : styles.labelBeside
                  }`}
                  dy="-0.2em"
                >
                  <tspan className={styles.labelStage}>{stage.stage}</tspan>
                </text>
                {(showAbsoluteCounts || showPercentages) && (
                  <text
                    x={poly.labelX}
                    y={poly.labelY}
                    textAnchor={poly.labelAnchor}
                    className={`${styles.label} ${
                      poly.labelInside ? styles.labelInsideMeta : styles.labelBesideMeta
                    } ${styles.labelMeta}`}
                    dy="1.1em"
                    data-testid={`funnel-meta-${i}`}
                  >
                    {showAbsoluteCounts && (
                      <tspan data-testid={`funnel-count-${i}`}>
                        {stage.count.toLocaleString()}
                      </tspan>
                    )}
                    {showAbsoluteCounts && showPercentages && <tspan> · </tspan>}
                    {showPercentages && (
                      <tspan data-testid={`funnel-percentage-${i}`}>
                        {formatPercentage(stage.percentage)}
                      </tspan>
                    )}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/*
          Accessibility: off-screen data table for screen readers.
          Mirrors the Chart base SSR fallback shape — `suppressHydrationWarning`
          is intentional because the table serializes consumer-supplied data
          which may be derived from non-deterministic sources.
        */}
        <div
          style={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
          suppressHydrationWarning
        >
          <table>
            <caption>{title || 'Funnel chart data'}</caption>
            <thead>
              <tr>
                <th>Stage</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => (
                <tr key={`${s.stage}-${i}`}>
                  <td>{s.stage}</td>
                  <td>{s.count.toLocaleString()}</td>
                  <td>{formatPercentage(s.percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  },
)

FunnelChart.displayName = 'FunnelChart'
