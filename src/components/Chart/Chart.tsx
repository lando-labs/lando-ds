/**
 * Chart Component
 *
 * Base wrapper component for all charts providing common functionality:
 * - Loading, empty, and error states
 * - Brand-themed styling
 * - Responsive container
 * - Accessibility support with hidden data table
 *
 * @example
 * <Chart data={data} title="Sales Data" loading={isLoading}>
 *   <RechartsLineChart>...</RechartsLineChart>
 * </Chart>
 *
 * @remarks
 * **SSR / Hydration Note**
 *
 * The hidden accessibility data-table renders the raw `data` rows as text.
 * If your `data` prop is derived from a non-deterministic source (e.g.
 * `Math.random()`, `Date.now()`, `new Date()`), the server and client will
 * generate different values and React will emit a hydration mismatch
 * warning for the table cells.
 *
 * We mark the data-table with `suppressHydrationWarning` because it is
 * purely for assistive technologies — it is visually off-screen and the
 * client-side value is the one screen readers ultimately announce. The
 * visible chart is rendered client-only by Recharts via
 * `ResponsiveContainer`, so it is unaffected.
 *
 * **Recommendation for consumers:** memoize dynamic data at the call site
 * so the same rows are produced on the server and the client:
 *
 * ```tsx
 * // Bad — regenerates on every render, differs between server and client:
 * <LineChart data={Array.from({ length: 10 }, () => ({
 *   x: Math.random(),
 *   y: Math.random(),
 * }))} />
 *
 * // Good — generated once and stable:
 * const data = useMemo(
 *   () => Array.from({ length: 10 }, () => ({
 *     x: Math.random(),
 *     y: Math.random(),
 *   })),
 *   [],
 * )
 * <LineChart data={data} />
 * ```
 */

'use client'

import { ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { BaseChartProps } from './types'
import styles from './Chart.module.css'

export interface ChartProps extends BaseChartProps {
  children: ReactNode
}

export function Chart({
  data,
  height = 300,
  aspectRatio,
  loading = false,
  empty = false,
  error,
  title,
  description,
  'aria-label': ariaLabel,
  children,
  className,
  style,
  ...rest
}: ChartProps) {
  // #270 — `.sizer` is a zero-box container-query host (see Chart.module.css)
  // wrapping `.chartContainer` so the `@container chart` font-size rule can
  // match it. The consumer contract is preserved exactly: `className` and
  // `style` (which carries the chart `height`) stay on `.chartContainer` as
  // before — the only change is one inert full-width block wrapper around it.
  //
  // #422 / Layer-3 passthrough — consumer `className`, `style`, and arbitrary
  // DOM attributes (`...rest`: `data-*`, `aria-*`, `id`, event handlers, …)
  // are applied to the **visually styled root** `.chartContainer` (the element
  // that carries `role`), NOT the inert `.sizer` wrapper and NOT the inner
  // Recharts `ResponsiveContainer`. `...rest` is spread first so the internal
  // class list and semantic `role` / `aria-label` win on conflict. Consumer
  // `style` is merged; the historical `{ height, ...style }` precedence (where
  // a consumer's `style.height` still overrides the resolved `height`) is
  // preserved unchanged.

  // Loading state
  if (loading) {
    return (
      <div className={styles.sizer}>
        <div
          {...rest}
          className={[styles.chartContainer, styles.loading, className]
            .filter(Boolean)
            .join(' ')}
          style={{ height, ...style }}
          role="status"
          aria-label="Loading chart"
        >
          <div className={styles.skeleton} style={{ height }} />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={styles.sizer}>
        <div
          {...rest}
          className={[styles.chartContainer, styles.error, className]
            .filter(Boolean)
            .join(' ')}
          style={{ height, ...style }}
          role="alert"
        >
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorText}>{error}</div>
        </div>
      </div>
    )
  }

  // Empty state
  if (empty || !data || data.length === 0) {
    return (
      <div className={styles.sizer}>
        <div
          {...rest}
          className={[styles.chartContainer, styles.empty, className]
            .filter(Boolean)
            .join(' ')}
          style={{ height, ...style }}
        >
          <div className={styles.emptyIcon}>📊</div>
          <div className={styles.emptyText}>No data to display</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.sizer}>
      <div
        {...rest}
        className={[styles.chartContainer, className].filter(Boolean).join(' ')}
        style={style}
        role="img"
        aria-label={ariaLabel || title || 'Chart'}
      >
        {title && (
          <div className={styles.title}>{title}</div>
        )}
        {description && (
          <div className={styles.description}>{description}</div>
        )}

        {aspectRatio ? (
          <ResponsiveContainer aspect={aspectRatio}>
            {children}
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={typeof height === 'number' ? height : 300}>
            {children}
          </ResponsiveContainer>
        )}

        {/*
          Accessibility: Hidden data-table for screen readers.

          suppressHydrationWarning: the table serializes consumer-supplied `data`.
          When consumers derive data from non-deterministic sources (Math.random,
          Date.now, etc.) the SSR-rendered text will not match the client-rendered
          text and React emits a hydration warning. The table is visually hidden
          and only exists for assistive technology — accepting the server/client
          race is safe because screen readers ultimately announce the final
          client-side value. See the Chart JSDoc for consumer guidance on
          memoizing dynamic data.
        */}
        <div
          style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
          suppressHydrationWarning
        >
          <table>
            <caption>{title || 'Chart data'}</caption>
            <thead>
              <tr>
                {data[0] &&
                  Object.keys(data[0]).map(key => <th key={key}>{key}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((value, j) => (
                    <td key={j}>{String(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

Chart.displayName = 'Chart'
