'use client'

/**
 * BarChart Component
 *
 * Bar chart for comparing categories with brand-themed styling.
 * Supports vertical/horizontal layouts, stacked bars, and rounded corners.
 *
 * @example
 * <BarChart
 *   data={salesData}
 *   dataKeys={['sales']}
 *   xAxisKey="product"
 *   colorScheme="teal"
 *   barRadius={6}
 *   height={300}
 * />
 */


import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Chart, BaseChartProps, ChartConfigProps, getChartColors, formatChartValue } from '../Chart'

export interface BarChartProps extends BaseChartProps, ChartConfigProps {
  /** Data keys to plot */
  dataKeys: string[]
  /** Key for x-axis (category axis) */
  xAxisKey: string

  /** Bar corner radius (number or [topLeft, topRight, bottomRight, bottomLeft]) */
  barRadius?: number | [number, number, number, number]
  /** Size of each bar */
  barSize?: number
  /** Gap between bars */
  barGap?: number

  /** Layout orientation */
  layout?: 'horizontal' | 'vertical'
  /** Stack bars instead of grouping */
  stacked?: boolean

  /** Show value labels on bars */
  showValueLabels?: boolean

  /** Value formatting (currency, percent, compact, number) */
  valueFormat?: 'currency' | 'percent' | 'compact' | 'number'
}

export function BarChart({
  data,
  dataKeys,
  xAxisKey,
  barRadius = 6,
  barSize,
  barGap = 4,
  layout = 'horizontal',
  stacked = false,
  showValueLabels = false,
  valueFormat = 'number',
  colorScheme = 'brand',
  colors: customColors,
  showGrid = true,
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
}: BarChartProps) {
  const colors = customColors || getChartColors(colorScheme)

  // For vertical bars, the layout is "horizontal" (confusing Recharts naming)
  const chartLayout = layout === 'vertical' ? 'horizontal' : 'vertical'

  const tooltipFormatter: NonNullable<
    TooltipProps<ValueType, NameType>['formatter']
  > = (value, name) => {
    const numeric = Array.isArray(value) ? Number(value[0]) : Number(value)
    return [formatChartValue(numeric, valueFormat), name]
  }

  // Recharts' LabelList `formatter` receives the raw value from the data row.
  // We coerce to number (since `ChartDataPoint` values are `unknown`) before
  // running it through our formatter.
  const labelFormatter = (value: unknown): string =>
    formatChartValue(Number(value) || 0, valueFormat)

  // Determine which axis is which based on layout
  const CategoryAxis = chartLayout === 'horizontal' ? XAxis : YAxis
  const ValueAxis = chartLayout === 'horizontal' ? YAxis : XAxis

  return (
    // Config props are consumed locally to build the Recharts children; the
    // base `Chart` wrapper does not read them (#334), so only base-contract
    // props flow through via `data` + `...chartProps` (className/style/...rest).
    <Chart
      data={data}
      {...chartProps}
    >
      <RechartsBarChart data={data} layout={chartLayout} barGap={barGap}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border-subtle)"
            opacity={0.5}
          />
        )}

        <CategoryAxis
          dataKey={xAxisKey}
          type="category"
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
          stroke="var(--color-border-default)"
          axisLine={{ stroke: 'var(--color-border-default)' }}
        />

        <ValueAxis
          type="number"
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
          stroke="var(--color-border-default)"
          axisLine={{ stroke: 'var(--color-border-default)' }}
          tickFormatter={(value) => formatChartValue(value, valueFormat)}
        />

        {showTooltip && (
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
            }}
            labelStyle={{
              color: 'var(--color-text-primary)',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--spacing-xs)',
            }}
            itemStyle={{
              color: 'var(--color-text-secondary)',
            }}
            formatter={tooltipFormatter}
          />
        )}

        {showLegend && <Legend />}

        {dataKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={barRadius}
            maxBarSize={barSize}
            stackId={stacked ? 'stack' : undefined}
            animationDuration={animationDuration}
            label={showValueLabels ? { position: 'top', formatter: labelFormatter } : false}
          />
        ))}
      </RechartsBarChart>
    </Chart>
  )
}

BarChart.displayName = 'BarChart'
