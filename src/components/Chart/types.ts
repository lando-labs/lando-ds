/**
 * Chart Component Types
 *
 * Shared TypeScript interfaces for all chart components.
 *
 * ## Type contract (issue #334)
 *
 * The base `Chart` wrapper only *applies* a subset of the props historically
 * declared on `BaseChartProps`; the rest were underscore-prefixed and silently
 * dropped. To stop advertising props the wrapper does not honor, the surface is
 * split into two interfaces:
 *
 * - {@link BaseChartProps} — the **real contract the base `Chart` wrapper
 *   honors**. It extends `React.HTMLAttributes<HTMLDivElement>` (so consumer
 *   `className`, `style`, `data-*`, `aria-*`, event handlers, … flow through to
 *   the styled root) plus the props `Chart` actually reads (`data`, `height`,
 *   `aspectRatio`, `loading`, `empty`, `error`, `title`, `description`). The
 *   accessible label is the native `aria-label` (from `HTMLAttributes`).
 * - {@link ChartConfigProps} — sub-chart-only rendering configuration
 *   (`variant`, `colorScheme`, `colors`, grid/legend/tooltip toggles, animation,
 *   interaction callbacks, …). The base `Chart` wrapper does **not** consume
 *   these; the concrete sub-charts (`LineChart`, `BarChart`, …) read them and
 *   translate them into Recharts elements.
 *
 * Sub-charts therefore extend `BaseChartProps & ChartConfigProps`. The
 * `ChartProps` export name continues to alias the base-wrapper contract for
 * backward compatibility.
 */

/**
 * Generic row shape for chart data. Keys are arbitrary strings (data-key names),
 * values are typically numbers or strings but can be any JSON-serializable value.
 * Consumers that need a stricter shape can narrow at the call site.
 */
export type ChartDataPoint = Record<string, unknown>

export type ColorScheme = 'brand' | 'teal' | 'success' | 'warning' | 'danger' | 'custom'

export type LegendPosition = 'top' | 'right' | 'bottom' | 'left'

/**
 * The real contract honored by the base `Chart` wrapper.
 *
 * Extends `React.HTMLAttributes<HTMLDivElement>` exactly once so that consumer
 * `className`, `style`, and arbitrary DOM attributes (`data-*`, `aria-*`, event
 * handlers, `id`, …) pass through to the **visually styled root `<div>`** the
 * wrapper renders. Only the additional fields below are read directly by
 * `Chart`; everything else is forwarded to the DOM via `...rest`.
 *
 * Note: `className` and `style` come from `HTMLAttributes` and are intentionally
 * NOT redeclared here.
 */
export interface BaseChartProps extends React.HTMLAttributes<HTMLDivElement> {
  // Data
  data: ChartDataPoint[]

  // Dimensions honored by the base wrapper
  height?: number | string
  aspectRatio?: number

  // States
  loading?: boolean
  empty?: boolean
  error?: string

  // Accessibility
  /**
   * Visible / data-table caption text. Note this also satisfies the native
   * `title` attribute from `HTMLAttributes<HTMLDivElement>` (both are `string`).
   */
  title?: string
  description?: string
  // The accessible label uses the native `aria-label` attribute (inherited
  // from `HTMLAttributes<HTMLDivElement>`) — matches the React-Aria / Radix
  // convention. The base `Chart` wrapper reads it and falls back to `title`.
}

/**
 * Sub-chart-only rendering configuration.
 *
 * These props are consumed by the concrete chart components (`LineChart`,
 * `BarChart`, `AreaChart`, `PieChart`, `DonutChart`, …) to drive Recharts
 * rendering. The base `Chart` wrapper does NOT read them — declaring them here
 * (rather than on {@link BaseChartProps}) keeps the base wrapper's advertised
 * surface honest (issue #334).
 */
export interface ChartConfigProps {
  // Dimensions
  /**
   * Intended outer width. Forwarded by sub-charts to their Recharts layout;
   * the base `Chart` wrapper itself always renders a 100%-width responsive
   * container and does not read this.
   */
  width?: number | string

  // Styling
  variant?: 'default' | 'brand' | 'gradient'
  colorScheme?: ColorScheme
  colors?: string[]

  // Interaction
  interactive?: boolean
  animationDuration?: number

  // Layout
  showLegend?: boolean
  legendPosition?: LegendPosition
  showGrid?: boolean
  showTooltip?: boolean

  // Callbacks
  /**
   * Click handler for individual data points. The payload shape is
   * Recharts-defined and varies by chart type; consumers should narrow at
   * their use site.
   */
  onDataPointClick?: (data: ChartDataPoint) => void
  onLegendClick?: (dataKey: string) => void
}

export interface ChartTheme {
  colors: string[]
  gridColor: string
  axisColor: string
  tooltipBg: string
  tooltipBorder: string
}

export interface TimeSeriesDataPoint {
  date: string
  value: number
  [key: string]: unknown
}

export interface CategoryDataPoint {
  category: string
  value: number
  [key: string]: unknown
}

export interface ProportionDataPoint {
  name: string
  value: number
  color?: string
}

export interface ChartLine {
  key: string
  name: string
  color?: string
  strokeWidth?: number
  dot?: boolean
}

export interface ChartBar {
  key: string
  name: string
  color?: string
  stackId?: string
}

export interface ChartArea {
  key: string
  name: string
  color?: string
  stackId?: string
}
