'use client'

/**
 * PieChart Component
 *
 * Pie chart for visualizing proportions and percentages with brand colors.
 * Supports custom labels and interactive segments.
 *
 * @example
 * <PieChart
 *   data={distributionData}
 *   dataKey="value"
 *   nameKey="name"
 *   colorScheme="teal"
 *   showLabels
 *   height={300}
 * />
 */


import type React from 'react'
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

/**
 * Payload passed to onSliceClick. Recharts surfaces a rich payload here
 * (pie sector + coordinate metadata merged with the underlying data row);
 * we model it as the user's data row plus an open-ended record so consumers
 * can narrow to extra fields at their call site if they need them.
 */
export type PieSliceClickData = ChartDataPoint & Record<string, unknown>

/**
 * Payload for the custom label renderer. Recharts merges the underlying data
 * row with geometric info (coordinates, sector angles, etc.); we expose the
 * data row shape and let consumers access the extra fields via index.
 */
export type PieLabelData = ChartDataPoint & Record<string, unknown>

// A pie has no cartesian grid, so `showGrid` is intentionally omitted from the
// public surface. `showGrid` now lives on `ChartConfigProps` (issue #334), so
// the omit targets that interface.
export interface PieChartProps
  extends BaseChartProps,
    Omit<ChartConfigProps, 'showGrid'> {
  /** Key for the value data */
  dataKey: string
  /** Key for the label/name data */
  nameKey: string

  /** Inner radius (0 for full pie) */
  innerRadius?: number
  /** Outer radius */
  outerRadius?: number
  /** Padding angle between segments */
  paddingAngle?: number

  /** Show labels on segments */
  showLabels?: boolean
  /** Label type (percent, value, name) */
  labelType?: 'percent' | 'value' | 'name'

  /** Active segment index */
  activeIndex?: number
  /** Callback when slice is clicked */
  onSliceClick?: (data: PieSliceClickData, index: number) => void
}

export function PieChart({
  data,
  dataKey,
  nameKey,
  innerRadius = 0,
  outerRadius = 80,
  paddingAngle = 2,
  showLabels = true,
  labelType = 'percent',
  activeIndex,
  onSliceClick,
  colorScheme = 'brand',
  colors: customColors,
  showTooltip = true,
  showLegend = true,
  animationDuration = 300,
  // Config props the base `Chart` wrapper historically dropped (#334) —
  // destructured so they do NOT leak into `...chartProps` / onto the DOM.
  width: _width,
  variant: _variant,
  interactive: _interactive,
  legendPosition: _legendPosition,
  onDataPointClick: _onDataPointClick,
  onLegendClick: _onLegendClick,
  ...chartProps
}: PieChartProps) {
  const colors = customColors || getChartColors(colorScheme)

  // Calculate total for percentage. Values are typed as `unknown` on
  // ChartDataPoint, so coerce to number at the boundary.
  const total = data.reduce<number>(
    (sum, entry) => sum + (Number(entry[dataKey]) || 0),
    0
  )

  // Custom label renderer. Recharts calls this with a merged payload of the
  // underlying data row plus geometric info; we only read the user-provided
  // dataKey / nameKey fields.
  const renderLabel = (entry: PieLabelData): React.ReactNode => {
    if (!showLabels) return null

    const value = Number(entry[dataKey]) || 0
    if (labelType === 'percent') {
      const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
      return `${percent}%`
    }
    if (labelType === 'value') {
      return value
    }
    return String(entry[nameKey] ?? '')
  }

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
    // props flow through via `data` + `...chartProps` (className/style/...rest).
    <Chart
      data={data}
      {...chartProps}
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
          label={renderLabel}
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
    </Chart>
  )
}

PieChart.displayName = 'PieChart'
