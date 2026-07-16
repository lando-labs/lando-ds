/**
 * GridItem Component (#374)
 *
 * Item-level sizing helper for `<Grid>`. Before this lived in the DS,
 * consumers reached into `style={{ gridColumn: 'span 2' }}` (or the
 * raw `1 / -1` form for full-row spans) inline — perfectly valid CSS but
 * the readability cost piled up in dashboards with many spans.
 *
 * `<GridItem span={n}>` → `grid-column: span n;`
 * `<GridItem span="full">` → `grid-column: 1 / -1;` (full-row span)
 * `<GridItem rowSpan={n}>` → `grid-row: span n;`
 * `<GridItem rowSpan="full">` → `grid-row: 1 / -1;`
 *
 * Composes with `<Grid>` as a child wrapper:
 *
 * ```tsx
 * <Grid columns={4} gap="md">
 *   <GridItem span={2}><Card>Half-width</Card></GridItem>
 *   <GridItem><Card>Quarter</Card></GridItem>
 *   <GridItem><Card>Quarter</Card></GridItem>
 *   <GridItem span="full"><Banner>Full-width footer</Banner></GridItem>
 * </Grid>
 * ```
 *
 * The implementation is intentionally thin: GridItem just emits the
 * grid-column/grid-row inline style and renders a `<div>` (or any element
 * via `as`). It does NOT enforce that it's a child of `<Grid>` at
 * runtime — CSS grid will simply no-op these properties for a non-grid
 * parent, matching native behavior.
 */

import React from 'react'

/** Numeric span (1+) OR the "full" sentinel that maps to `1 / -1`. */
export type GridItemSpan = number | 'full'

export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of columns to span (`grid-column: span <n>`), OR `'full'` for
   * a full-row span (`grid-column: 1 / -1`). Omit to take a single column
   * (CSS default — `grid-column: auto`).
   */
  span?: GridItemSpan
  /**
   * Number of rows to span (`grid-row: span <n>`), OR `'full'` for a
   * full-column span (`grid-row: 1 / -1`). Omit to use the grid's
   * implicit row sizing.
   */
  rowSpan?: GridItemSpan
  /**
   * Explicit start column (1-indexed). Use when you need exact placement
   * instead of `span`. Mutually overlapping with `span`; if both are
   * provided, `columnStart` wins and `span` is ignored.
   */
  columnStart?: number
  /**
   * Explicit end column (1-indexed, or negative for from-end like `-1`).
   * Pairs with `columnStart` for a `grid-column: <start> / <end>` placement.
   */
  columnEnd?: number
  /** Explicit start row (1-indexed). See `columnStart` semantics. */
  rowStart?: number
  /** Explicit end row. See `columnEnd` semantics. */
  rowEnd?: number
  /**
   * HTML element to render as.
   * @default 'div'
   */
  as?: React.ElementType
  /** Content to render inside the grid item. */
  children?: React.ReactNode
  /** Additional CSS class merged onto the element. */
  className?: string
  /**
   * Inline styles. The GridItem-computed grid-column/grid-row values are
   * applied AFTER user style, so prop-driven placement always wins on
   * conflict (mirrors the Grid component's policy).
   */
  style?: React.CSSProperties
}

/** Resolve a `span` value into a CSS `grid-column` / `grid-row` string. */
const resolveSpan = (span: GridItemSpan): string => {
  if (span === 'full') return '1 / -1'
  // Defensive cap so `span={0}` / `span={-1}` don't emit invalid CSS.
  // CSS would just no-op them, but the inline style is observable in
  // tests and we'd rather emit a clean placeholder than a misleading value.
  if (typeof span === 'number' && span >= 1 && Number.isFinite(span)) {
    return `span ${Math.floor(span)}`
  }
  return 'auto'
}

export const GridItem = React.forwardRef<HTMLDivElement, GridItemProps>(
  (
    {
      span,
      rowSpan,
      columnStart,
      columnEnd,
      rowStart,
      rowEnd,
      as: Component = 'div',
      children,
      className = '',
      style,
      ...rest
    },
    ref,
  ) => {
    const itemStyle: React.CSSProperties = {}

    // Column placement. Explicit start/end wins over span.
    if (columnStart !== undefined || columnEnd !== undefined) {
      // CSS accepts `<start> / <end>` or just `<start>` / `<end>` on the
      // individual longhand. Use the longhands to avoid clobbering when
      // only one side is set.
      if (columnStart !== undefined) itemStyle.gridColumnStart = columnStart
      if (columnEnd !== undefined) itemStyle.gridColumnEnd = columnEnd
    } else if (span !== undefined) {
      itemStyle.gridColumn = resolveSpan(span)
    }

    // Row placement. Same precedence as columns.
    if (rowStart !== undefined || rowEnd !== undefined) {
      if (rowStart !== undefined) itemStyle.gridRowStart = rowStart
      if (rowEnd !== undefined) itemStyle.gridRowEnd = rowEnd
    } else if (rowSpan !== undefined) {
      itemStyle.gridRow = resolveSpan(rowSpan)
    }

    // User style first; computed item-placement second so the prop-driven
    // grid placement always wins on conflict.
    const mergedStyle: React.CSSProperties = { ...style, ...itemStyle }

    return (
      <Component
        ref={ref as React.Ref<HTMLDivElement>}
        {...rest}
        className={className || undefined}
        style={mergedStyle}
      >
        {children}
      </Component>
    )
  },
)

GridItem.displayName = 'GridItem'
