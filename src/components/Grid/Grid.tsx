/**
 * Grid Component
 *
 * Declarative CSS Grid wrapper with responsive column support.
 * Provides simple API for common grid layouts.
 *
 * @example
 * // Fixed 3 columns
 * <Grid columns={3} gap="16px">
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </Grid>
 *
 * // Responsive columns
 * <Grid columns={{ sm: 1, md: 2, lg: 3 }} gap={24}>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 * </Grid>
 *
 * // Separate row/column gap (#374) — accept an object so authors don't have
 * // to remember which side is row vs column in a positional tuple.
 * <Grid columns={3} gap={{ row: 8, column: 24 }}>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 * </Grid>
 *
 * // Auto-fit with minimum column width
 * <Grid autoRows="minmax(200px, auto)" gap="1rem">
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 * </Grid>
 *
 * // Responsive card grid (auto-fill with minimum column width)
 * <Grid autoFill minColumnWidth="340px" gap={24}>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </Grid>
 */

import React from 'react'
import styles from './Grid.module.css'

/**
 * Object form for `Grid.gap` (#374). Each side accepts any CSS length
 * (number → px, string → verbatim). Omit a side to leave that axis unset.
 *
 * Object was chosen over a `[row, column]` tuple so authors don't have to
 * remember positional order — `gap={{ row: 8, column: 24 }}` reads at the
 * call site without needing the docs open. A tuple variant is intentionally
 * NOT supported to keep the type surface narrow.
 */
export interface GridGapAxes {
  row?: string | number
  column?: string | number
}

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns or responsive column object */
  columns?: number | { sm?: number; md?: number; lg?: number }
  /**
   * Gap between grid items.
   *
   * - `number` → emitted as `<n>px`
   * - `string` → emitted verbatim (`'1rem'`, `'var(--spacing-md)'`)
   * - `{ row, column }` → split into `row-gap` + `column-gap` (#374)
   *
   * When the object form is used, `rowGap` / `columnGap` props are ignored.
   */
  gap?: string | number | GridGapAxes
  /** Gap between rows. Ignored when `gap` is an object. */
  rowGap?: string | number
  /** Gap between columns. Ignored when `gap` is an object. */
  columnGap?: string | number
  /** Auto rows template (e.g., 'minmax(200px, auto)') */
  autoRows?: string
  /** Grid auto flow direction */
  autoFlow?: 'row' | 'column' | 'dense'
  /** Align items on block axis */
  align?: 'start' | 'center' | 'end' | 'stretch'
  /** Justify items on inline axis */
  justify?: 'start' | 'center' | 'end' | 'stretch'
  /**
   * Switch to `grid-template-columns: repeat(auto-fill, minmax(<minColumnWidth>, 1fr))`.
   * When true, the `columns` prop is ignored (responsive column classes are
   * also skipped). Use `minColumnWidth` to control the minimum track size.
   * @default false
   */
  autoFill?: boolean
  /**
   * Minimum column width when `autoFill` is true. Accepts any CSS length
   * (e.g. `'340px'`, `'20rem'`). Ignored when `autoFill` is false.
   * @default '280px'
   */
  minColumnWidth?: string
  /**
   * Opt into CSS `subgrid` on the named axis. The Grid takes its tracks
   * from the nearest grid ancestor instead of defining its own. Use this
   * to align nested grid children to the parent's track grid (e.g. a
   * `<Card>` aligning its internals to the page rhythm).
   *
   * - `'columns'` — `grid-template-columns: subgrid` (overrides the
   *   `columns` / `autoFill` props on the columns axis)
   * - `'rows'` — `grid-template-rows: subgrid` (overrides the `autoRows`
   *   prop)
   * - `'both'` — apply subgrid on both axes
   *
   * Requires the parent element to be `display: grid`. Browser baseline:
   * Chrome 117 (Sep 2023), Firefox 71 (Dec 2019), Safari 16 (Sep 2022).
   * No fallback emitted — verify your support matrix before shipping.
   */
  subgrid?: 'rows' | 'columns' | 'both'
  /** Content to render */
  children: React.ReactNode
  /** Additional CSS class */
  className?: string
  /**
   * Inline styles merged with Grid's computed grid-template/gap/etc.
   * The computed Grid styles win on conflict so prop-driven layout is
   * never silently overridden — use this for positioning the Grid
   * itself (e.g. `gridRow: 'span 3'` on a subgridded child).
   */
  style?: React.CSSProperties
}

const formatValue = (value: string | number): string => {
  if (typeof value === 'number') {
    return `${value}px`
  }
  return value
}

/** Type guard for the `{ row, column }` gap form (#374). */
const isGapAxes = (value: unknown): value is GridGapAxes => {
  if (value === null || typeof value !== 'object') return false
  // Defensive: arrays are objects too — explicitly reject them so a
  // consumer who passed a tuple (unsupported) gets a clean fallback
  // rather than a confusing `gap-axes` interpretation.
  if (Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return 'row' in obj || 'column' in obj
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      columns = 1,
      gap,
      rowGap,
      columnGap,
      autoRows,
      autoFlow,
      align,
      justify,
      autoFill = false,
      minColumnWidth,
      subgrid,
      children,
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
    // Build inline styles for dynamic values
    const gridStyle: React.CSSProperties = {}

    const subgridColumns = subgrid === 'columns' || subgrid === 'both'
    const subgridRows = subgrid === 'rows' || subgrid === 'both'

    // Track whether responsive-class columns should be applied. When
    // autoFill is true OR subgrid covers the columns axis, we ignore both
    // the fixed `columns` number and the responsive columns object.
    const useResponsiveColumns =
      !autoFill && !subgridColumns && typeof columns === 'object'

    // Handle columns. Precedence: subgrid > autoFill > numeric/object `columns`.
    if (subgridColumns) {
      gridStyle.gridTemplateColumns = 'subgrid'
    } else if (autoFill) {
      const minWidth = minColumnWidth || '280px'
      gridStyle.gridTemplateColumns = `repeat(auto-fill, minmax(${minWidth}, 1fr))`
    } else if (typeof columns === 'number') {
      gridStyle.gridTemplateColumns = `repeat(${columns}, 1fr)`
    }

    // Gap handling. Three call sites:
    //   - `gap={'string' | number}` → shorthand `gap`
    //   - `gap={{ row, column }}`   → split into row-gap + column-gap (#374)
    //   - omitted, fall through to rowGap/columnGap props
    if (isGapAxes(gap)) {
      // Object form: each side is optional. Skipping a side leaves that
      // axis unset (CSS default — `gap: normal`).
      if (gap.row !== undefined) {
        gridStyle.rowGap = formatValue(gap.row)
      }
      if (gap.column !== undefined) {
        gridStyle.columnGap = formatValue(gap.column)
      }
    } else if (gap !== undefined) {
      gridStyle.gap = formatValue(gap)
    } else {
      if (rowGap !== undefined) {
        gridStyle.rowGap = formatValue(rowGap)
      }
      if (columnGap !== undefined) {
        gridStyle.columnGap = formatValue(columnGap)
      }
    }

    // Rows. Subgrid on the rows axis takes precedence over autoRows.
    if (subgridRows) {
      gridStyle.gridTemplateRows = 'subgrid'
    } else if (autoRows) {
      gridStyle.gridAutoRows = autoRows
    }

    // Auto flow
    if (autoFlow) {
      gridStyle.gridAutoFlow = autoFlow
    }

    // Alignment
    if (align) {
      gridStyle.alignItems = align
    }

    if (justify) {
      gridStyle.justifyItems = justify
    }

    // Build CSS classes for responsive columns. When `autoFill` is true,
    // the responsive helper classes are intentionally skipped — auto-fill
    // already handles responsiveness via the track sizing itself.
    const responsiveColumns =
      useResponsiveColumns && typeof columns === 'object' ? columns : null
    const gridClasses = [
      styles.grid,
      responsiveColumns ? styles.responsive : '',
      responsiveColumns?.sm ? styles[`cols-sm-${responsiveColumns.sm}`] : '',
      responsiveColumns?.md ? styles[`cols-md-${responsiveColumns.md}`] : '',
      responsiveColumns?.lg ? styles[`cols-lg-${responsiveColumns.lg}`] : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // Merge: user `style` first, computed `gridStyle` second so the
    // Grid's own track/gap/etc. always wins over user attempts to set
    // them inline. User style is for positioning the Grid in its
    // parent (e.g. `gridRow`, `gridColumn`, `transform`).
    const mergedStyle: React.CSSProperties = { ...style, ...gridStyle }

    return (
      <div ref={ref} {...rest} className={gridClasses} style={mergedStyle}>
        {children}
      </div>
    )
  }
)

Grid.displayName = 'Grid'
