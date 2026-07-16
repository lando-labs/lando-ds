'use client'

/**
 * AreaChart Component
 *
 * Area chart for visualizing volume trends with brand gradient fills.
 * Supports stacked areas and customizable opacity.
 *
 * @example
 * <AreaChart
 *   data={trafficData}
 *   dataKeys={['desktop', 'mobile']}
 *   xAxisKey="month"
 *   colorScheme="teal"
 *   stacked
 *   height={300}
 * />
 */


import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Chart, BaseChartProps, ChartConfigProps, getChartColors, formatChartValue } from '../Chart'

export interface AreaChartProps extends BaseChartProps, ChartConfigProps {
  /** Data keys to plot */
  dataKeys: string[]
  /** Key for x-axis */
  xAxisKey: string

  /** Area curve type */
  curveType?: 'linear' | 'monotone' | 'step' | 'stepBefore' | 'stepAfter'
  /** Area fill opacity */
  fillOpacity?: number

  /** Stack areas instead of overlaying */
  stacked?: boolean

  /** Value formatting (currency, percent, compact, number) */
  valueFormat?: 'currency' | 'percent' | 'compact' | 'number'
}

export function AreaChart({
  data,
  dataKeys,
  xAxisKey,
  curveType = 'monotone',
  fillOpacity = 0.6,
  stacked = false,
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
}: AreaChartProps) {
  const colors = customColors || getChartColors(colorScheme)

  const tooltipFormatter: NonNullable<
    TooltipProps<ValueType, NameType>['formatter']
  > = (value, name) => {
    const numeric = Array.isArray(value) ? Number(value[0]) : Number(value)
    return [formatChartValue(numeric, valueFormat), name]
  }

  return (
    // Config props are consumed locally to build the Recharts children; the
    // base `Chart` wrapper does not read them (#334), so only base-contract
    // props flow through via `data` + `...chartProps` (className/style/...rest).
    <Chart
      data={data}
      {...chartProps}
    >
      <RechartsAreaChart data={data}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border-subtle)"
            opacity={0.5}
          />
        )}

        <XAxis
          dataKey={xAxisKey}
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
          stroke="var(--color-border-default)"
          axisLine={{ stroke: 'var(--color-border-default)' }}
        />

        <YAxis
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

        {/* Render areas in reverse order for proper stacking visual */}
        {[...dataKeys].reverse().map((key, index) => {
          const colorIndex = dataKeys.length - 1 - index
          return (
            <Area
              key={key}
              type={curveType}
              dataKey={key}
              stroke={colors[colorIndex % colors.length]}
              strokeWidth={2}
              fill={colors[colorIndex % colors.length]}
              fillOpacity={fillOpacity}
              stackId={stacked ? 'stack' : undefined}
              animationDuration={animationDuration}
            />
          )
        })}
      </RechartsAreaChart>
    </Chart>
  )
}

AreaChart.displayName = 'AreaChart'
