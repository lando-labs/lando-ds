'use client'

/**
 * DonutChart Component
 *
 * Donut chart with customizable center content for displaying metrics.
 * Perfect for showing totals, percentages, or key values.
 *
 * @example
 * <DonutChart
 *   data={userData}
 *   dataKey="value"
 *   nameKey="name"
 *   colorScheme="teal"
 *   centerContent={
 *     <div>
 *       <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>900</div>
 *       <div style={{ fontSize: '0.875rem' }}>Total Users</div>
 *     </div>
 *   }
 * />
 */


import { ReactNode } from 'react'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Chart, BaseChartProps, ChartConfigProps, getChartColors } from '../Chart'
import type { ChartDataPoint } from '../Chart/types'
import styles from './DonutChart.module.css'

/**
 * Payload passed to onSliceClick. Recharts surfaces a rich payload here
 * (pie sector + coordinate metadata merged with the underlying data row);
 * we model it as the user's data row plus an open-ended record so consumers
 * can narrow to extra fields at their call site if they need them.
 */
export type PieSliceClickData = ChartDataPoint & Record<string, unknown>

// A donut has no cartesian grid, so `showGrid` is intentionally omitted from
// the public surface. `showGrid` now lives on `ChartConfigProps` (issue #334),
// so the omit targets that interface.
export interface DonutChartProps
  extends BaseChartProps,
    Omit<ChartConfigProps, 'showGrid'> {
  /** Key for the value data */
  dataKey: string
  /** Key for the label/name data */
  nameKey: string

  /** Inner radius (donut hole size) */
  innerRadius?: number
  /** Outer radius */
  outerRadius?: number
  /** Padding angle between segments */
  paddingAngle?: number

  /** Content to display in the center of the donut */
  centerContent?: ReactNode

  /** Show labels on segments */
  showLabels?: boolean

  /** Active segment index */
  activeIndex?: number
  /** Callback when slice is clicked */
  onSliceClick?: (data: PieSliceClickData, index: number) => void
}

export function DonutChart({
  data,
  dataKey,
  nameKey,
  innerRadius = 60,
  outerRadius = 80,
  paddingAngle = 2,
  centerContent,
  showLabels = false,
  activeIndex,
  onSliceClick,
  colorScheme = 'brand',
  colors: customColors,
  showTooltip = true,
  showLegend = true,
  animationDuration = 300,
  // Pulled out so we can MERGE it with the internal donut wrapper class below
  // (#422 wrong-root: previously the consumer `className` was REPLACED).
  className,
  // Config props the base `Chart` wrapper historically dropped (#334) —
  // destructured so they do NOT leak into `...chartProps` / onto the DOM.
  width: _width,
  variant: _variant,
  interactive: _interactive,
  legendPosition: _legendPosition,
  onDataPointClick: _onDataPointClick,
  onLegendClick: _onLegendClick,
  ...chartProps
}: DonutChartProps) {
  const colors = customColors || getChartColors(colorScheme)

  // #422 wrong-root fix — when `centerContent` is set we need the internal
  // `donutChartWrapper` positioning class on the chart root, but we must NOT
  // discard the consumer's `className`. Merge both (array-join idiom) instead
  // of replacing.
  const mergedClassName =
    [centerContent ? styles.donutChartWrapper : null, className]
      .filter(Boolean)
      .join(' ') || undefined

  // Calculate total for percentage. Values are typed as `unknown` on
  // ChartDataPoint, so coerce to number at the boundary.
  const total = data.reduce<number>(
    (sum, entry) => sum + (Number(entry[dataKey]) || 0),
    0
  )

  const tooltipFormatter: NonNullable<
    TooltipProps<ValueType, NameType>['formatter']
  > = (value, name) => {
    const numeric = Array.isArray(value) ? Number(value[0]) : Number(value)
    const percent = total > 0 ? ((numeric / total) * 100).toFixed(1) : '0.0'
    return [`${numeric} (${percent}%)`, name]
  }

  return (
    // Config props are consumed locally to build the Recharts children; the
    // base `Chart` wrapper does not read them (#334), so only base-contract
    // props flow through via `data` + `...chartProps`. `className` is merged
    // (consumer class + internal donut wrapper) and passed explicitly.
    <Chart
      data={data}
      {...chartProps}
      className={mergedClassName}
    >
      <RechartsPieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={paddingAngle}
          label={showLabels}
          labelLine={showLabels}
          animationDuration={animationDuration}
          onClick={(sliceData: unknown, index: number) =>
            onSliceClick?.(sliceData as PieSliceClickData, index)
          }
        >
          {data.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={colors[index % colors.length]}
              stroke="var(--color-surface)"
              strokeWidth={2}
              style={{
                filter: activeIndex === index ? 'brightness(1.1)' : undefined,
                cursor: onSliceClick ? 'pointer' : 'default',
              }}
            />
          ))}
        </Pie>

        {showTooltip && (
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
            }}
            formatter={tooltipFormatter}
          />
        )}

        {showLegend && <Legend />}
      </RechartsPieChart>

      {centerContent && (
        <div className={styles.centerContent}>
          {centerContent}
        </div>
      )}
    </Chart>
  )
}

DonutChart.displayName = 'DonutChart'
