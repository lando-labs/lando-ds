'use client'

/**
 * LineChart Component
 *
 * Line chart for visualizing trends over time with brand theming.
 * Supports multi-series, area fills, and smooth curve interpolation.
 *
 * @example
 * <LineChart
 *   data={salesData}
 *   dataKeys={['revenue', 'profit']}
 *   xAxisKey="month"
 *   colorScheme="teal"
 *   fillArea
 *   height={300}
 * />
 */


import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Chart, BaseChartProps, ChartConfigProps, getChartColors, formatChartValue } from '../Chart'

export interface LineChartProps extends BaseChartProps, ChartConfigProps {
  /** Data keys to plot (e.g., ['revenue', 'profit']) */
  dataKeys: string[]
  /** Key for x-axis (e.g., 'month') */
  xAxisKey: string

  /** Line curve type */
  lineType?: 'linear' | 'monotone' | 'step' | 'stepBefore' | 'stepAfter'
  /** Line stroke width */
  strokeWidth?: number
  /** Dot size */
  dotSize?: number
  /** Show dots on data points */
  showDots?: boolean

  /** Fill area under line */
  fillArea?: boolean
  /** Area fill opacity */
  areaOpacity?: number

  /** Value formatting (currency, percent, compact, number) */
  valueFormat?: 'currency' | 'percent' | 'compact' | 'number'
}

export function LineChart({
  data,
  dataKeys,
  xAxisKey,
  lineType = 'monotone',
  strokeWidth = 2,
  dotSize = 4,
  showDots = true,
  fillArea = false,
  areaOpacity = 0.3,
  valueFormat = 'number',
  colorScheme = 'brand',
  colors: customColors,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  animationDuration = 300,
  // Config props the base `Chart` wrapper historically dropped (#334). They are
  // destructured here so they do NOT leak into `...chartProps` (and therefore
  // not onto the DOM via the wrapper's `...rest`); this chart type does not act
  // on them today.
  width: _width,
  variant: _variant,
  interactive: _interactive,
  legendPosition: _legendPosition,
  onDataPointClick: _onDataPointClick,
  onLegendClick: _onLegendClick,
  ...chartProps
}: LineChartProps) {
  const colors = customColors || getChartColors(colorScheme)

  // Use ComposedChart if fillArea is enabled (for area rendering)
  const ChartComponent = fillArea ? ComposedChart : RechartsLineChart

  const tooltipFormatter: NonNullable<
    TooltipProps<ValueType, NameType>['formatter']
  > = (value, name) => {
    const numeric = Array.isArray(value) ? Number(value[0]) : Number(value)
    return [formatChartValue(numeric, valueFormat), name]
  }

  return (
    // Config props (colorScheme/colors/showGrid/…) are consumed locally to
    // build the Recharts children below; the base `Chart` wrapper does not read
    // them (issue #334), so only the base-contract props flow through here via
    // `data` + `...chartProps` (which carries className/style/...rest).
    <Chart
      data={data}
      {...chartProps}
    >
      <ChartComponent data={data}>
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

        {dataKeys.map((key, index) => (
          fillArea ? (
            <Area
              key={key}
              type={lineType}
              dataKey={key}
              stroke={colors[index % colors.length]}
              strokeWidth={strokeWidth}
              fill={colors[index % colors.length]}
              fillOpacity={areaOpacity}
              dot={showDots ? { r: dotSize, fill: colors[index % colors.length] } : false}
              animationDuration={animationDuration}
            />
          ) : (
            <Line
              key={key}
              type={lineType}
              dataKey={key}
              stroke={colors[index % colors.length]}
              strokeWidth={strokeWidth}
              dot={showDots ? { r: dotSize, fill: colors[index % colors.length] } : false}
              activeDot={{ r: dotSize + 2 }}
              animationDuration={animationDuration}
            />
          )
        ))}
      </ChartComponent>
    </Chart>
  )
}

LineChart.displayName = 'LineChart'
