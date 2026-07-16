'use client'

/**
 * DataTable Component
 *
 * A higher-level data table that adds sort + pagination + row selection on
 * top of the lower-level `<Table>` primitive. Composes — does NOT duplicate —
 * the existing chrome.
 *
 * Sprint 55 (#311) — Lane A of v0.34.0.
 *
 * Scope is deliberately MINIMAL VIABLE for v1. The following are NOT built
 * and are tracked as follow-ups (see `DataTable/README` or the issue):
 *   - Virtualization
 *   - Column resize / reorder
 *   - Multi-column sort
 *   - Expandable rows
 *   - Column groups / nested headers
 *   - Cell editing
 *   - Server-side data (consumer can simulate by passing fresh `data`)
 *
 * For zero-JS read-only rendering on the server, see `DataTable.Static`.
 *
 * @example Basic
 *   <DataTable
 *     data={users}
 *     columns={[
 *       { key: 'name', header: 'Name', sortable: true },
 *       { key: 'email', header: 'Email' },
 *     ]}
 *     pageSize={10}
 *     selectable
 *   />
 *
 * @example Custom cell renderer
 *   <DataTable
 *     data={tasks}
 *     columns={[
 *       { key: 'title', header: 'Title', sortable: true },
 *       {
 *         key: 'status',
 *         header: 'Status',
 *         render: (row) => <Badge>{row.status}</Badge>,
 *       },
 *     ]}
 *   />
 */

import React, { useCallback, useMemo, useState } from 'react'
import { Pagination } from '../Pagination'
import styles from './DataTable.module.css'

/* -------------------------------------------------------------------------- *
 *  Types
 * -------------------------------------------------------------------------- */

export type DataTableSortDirection = 'asc' | 'desc'

export interface DataTableSort {
  key: string
  direction: DataTableSortDirection
}

export interface DataTableColumn<T> {
  /** Accessor key (must be unique). Used to read default cell content and as sort key. */
  key: keyof T | string
  /** Column header content. */
  header: React.ReactNode
  /** Enable sort affordance for this column. */
  sortable?: boolean
  /** Cell alignment. Applied to both header and cells. */
  align?: 'left' | 'center' | 'right'
  /** CSS width for the column (string or number-as-px). */
  width?: string | number
  /** Custom cell renderer. Receives the full row. Defaults to `row[key]`. */
  render?: (row: T) => React.ReactNode
}

export interface DataTableProps<T>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Array of rows. */
  data: T[]
  /** Column definitions. */
  columns: DataTableColumn<T>[]

  /* ---- Sorting (controlled + uncontrolled) ---- */
  /** Uncontrolled initial sort. */
  defaultSort?: DataTableSort | null
  /** Controlled sort. When set, `defaultSort` is ignored and `onSortChange` is required to mutate. */
  sort?: DataTableSort | null
  /** Called when the sort cycles. Receives `null` when sort is cleared. */
  onSortChange?: (sort: DataTableSort | null) => void

  /* ---- Pagination (omit to render all rows) ---- */
  /** Page size. Omit to disable pagination (renders all rows). */
  pageSize?: number
  /** Uncontrolled initial page (1-indexed). */
  defaultPage?: number
  /** Controlled current page (1-indexed). */
  page?: number
  /** Called when the user navigates to a different page. */
  onPageChange?: (page: number) => void

  /* ---- Selection (optional) ---- */
  /** Enable per-row checkboxes + a header select-all. */
  selectable?: boolean
  /** Controlled selected rows. Identity comparison via `getRowId` (or `===` if omitted). */
  selectedRows?: T[]
  /** Uncontrolled initial selection. */
  defaultSelectedRows?: T[]
  /** Called when the selection set changes. */
  onSelectionChange?: (rows: T[]) => void
  /**
   * Optional row-id accessor. Used to dedupe selection across re-renders and to
   * derive checkbox `aria-label`s. If omitted, selection is tracked by row
   * object identity (`===`) — fine for stable data, but selection clears when
   * `data` is reconstructed each render.
   */
  getRowId?: (row: T) => string | number

  /* ---- Appearance ---- */
  /** Pin the header row to the top of the scroll viewport. */
  stickyHeader?: boolean
  /** Compact/comfortable/spacious cell padding. Defaults to `'md'`. */
  size?: 'sm' | 'md' | 'lg'

  /* ---- Empty state ---- */
  /** Message shown when `data` is empty. Defaults to "No data". */
  emptyMessage?: React.ReactNode

  /** Extra class on the outer wrapper. */
  className?: string
}

/* -------------------------------------------------------------------------- *
 *  Internal helpers
 * -------------------------------------------------------------------------- */

/**
 * Sort cycle: clicking a sortable header walks `none → asc → desc → none`.
 * Click a *different* column → reset to `asc` on that column.
 * Documented because expectations vary across libraries (some use `asc ↔ desc`).
 */
function nextSort(current: DataTableSort | null, key: string): DataTableSort | null {
  if (!current || current.key !== key) {
    return { key, direction: 'asc' }
  }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  // direction === 'desc' → clear
  return null
}

/**
 * Default comparator. Handles numbers, strings, dates, booleans, and `null`/
 * `undefined` (which always sort to the end). For richer ordering, consumers
 * can pre-sort `data` or expose a `comparator` per column in a follow-up.
 */
function defaultCompare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1
  }
  return String(a).localeCompare(String(b))
}

function sortedRows<T>(
  rows: T[],
  sort: DataTableSort | null,
  columns: DataTableColumn<T>[]
): T[] {
  if (!sort) return rows
  const column = columns.find((c) => String(c.key) === sort.key)
  if (!column) return rows
  const key = column.key as keyof T
  // Stable: copy + sort.
  const copy = [...rows]
  copy.sort((a, b) => {
    const cmp = defaultCompare(a[key], b[key])
    return sort.direction === 'asc' ? cmp : -cmp
  })
  return copy
}

function pagedRows<T>(rows: T[], page: number, pageSize: number | undefined): T[] {
  if (!pageSize) return rows
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

function totalPagesOf(total: number, pageSize: number | undefined): number {
  if (!pageSize) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

function selectionMatcher<T>(
  getRowId: ((row: T) => string | number) | undefined
): (a: T, b: T) => boolean {
  if (getRowId) {
    return (a, b) => getRowId(a) === getRowId(b)
  }
  return (a, b) => a === b
}

function rowAriaLabel<T>(
  row: T,
  index: number,
  getRowId: ((row: T) => string | number) | undefined
): string {
  if (getRowId) {
    return `Select row ${getRowId(row)}`
  }
  return `Select row ${index + 1}`
}

/* -------------------------------------------------------------------------- *
 *  Component
 * -------------------------------------------------------------------------- */

export function DataTable<T extends object>({
  data,
  columns,
  defaultSort = null,
  sort: controlledSort,
  onSortChange,
  pageSize,
  defaultPage = 1,
  page: controlledPage,
  onPageChange,
  selectable = false,
  selectedRows: controlledSelected,
  defaultSelectedRows,
  onSelectionChange,
  getRowId,
  stickyHeader = false,
  size = 'md',
  emptyMessage = 'No data',
  className = '',
  style: rootStyle,
  ...rest
}: DataTableProps<T>) {
  /* ---- Sort state ---- */
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(
    defaultSort
  )
  const sort = controlledSort !== undefined ? controlledSort : internalSort

  const handleHeaderClick = useCallback(
    (key: string) => {
      const next = nextSort(sort, key)
      if (controlledSort === undefined) setInternalSort(next)
      onSortChange?.(next)
    },
    [sort, controlledSort, onSortChange]
  )

  /* ---- Page state ---- */
  const [internalPage, setInternalPage] = useState(defaultPage)
  const page = controlledPage !== undefined ? controlledPage : internalPage

  const handlePageChange = useCallback(
    (next: number) => {
      if (controlledPage === undefined) setInternalPage(next)
      onPageChange?.(next)
    },
    [controlledPage, onPageChange]
  )

  /* ---- Selection state ---- */
  const [internalSelected, setInternalSelected] = useState<T[]>(
    defaultSelectedRows ?? []
  )
  const selected =
    controlledSelected !== undefined ? controlledSelected : internalSelected

  const matchRow = useMemo(() => selectionMatcher(getRowId), [getRowId])

  const isRowSelected = useCallback(
    (row: T) => selected.some((s) => matchRow(s, row)),
    [selected, matchRow]
  )

  const commitSelection = useCallback(
    (next: T[]) => {
      if (controlledSelected === undefined) setInternalSelected(next)
      onSelectionChange?.(next)
    },
    [controlledSelected, onSelectionChange]
  )

  const toggleRow = useCallback(
    (row: T, checked: boolean) => {
      if (checked) {
        if (selected.some((s) => matchRow(s, row))) return
        commitSelection([...selected, row])
      } else {
        commitSelection(selected.filter((s) => !matchRow(s, row)))
      }
    },
    [selected, matchRow, commitSelection]
  )

  /* ---- Derived views ---- */
  // Apply sort to the full dataset first, then page.
  const sortedAll = useMemo(
    () => sortedRows(data, sort, columns),
    [data, sort, columns]
  )
  const totalPages = totalPagesOf(sortedAll.length, pageSize)
  // Clamp page to valid range (defensive — controlled consumers may pass stale).
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const visibleRows = useMemo(
    () => pagedRows(sortedAll, safePage, pageSize),
    [sortedAll, safePage, pageSize]
  )

  /* ---- Select-all (header checkbox) ---- *
   * Decision: header checkbox toggles selection on the CURRENT PAGE only
   * (not the entire dataset). Rationale:
   *   - Matches Gmail / Mantine / Linear semantics for paginated tables.
   *   - "Select all 10,000 rows" is a destructive surprise on a checkbox click.
   *   - A consumer who wants "select all data" can render their own affordance
   *     above the table and call into a controlled `onSelectionChange`.
   */
  const pageSelectableRows = visibleRows
  const pageSelectedCount = pageSelectableRows.filter(isRowSelected).length
  const allPageSelected =
    pageSelectableRows.length > 0 &&
    pageSelectedCount === pageSelectableRows.length
  const somePageSelected =
    pageSelectedCount > 0 && pageSelectedCount < pageSelectableRows.length

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        // Union: keep selections outside this page, add anything on this page
        // not yet selected.
        const additions = pageSelectableRows.filter((row) => !isRowSelected(row))
        commitSelection([...selected, ...additions])
      } else {
        // Remove only rows on the current page from selection.
        commitSelection(
          selected.filter(
            (s) => !pageSelectableRows.some((row) => matchRow(s, row))
          )
        )
      }
    },
    [
      pageSelectableRows,
      isRowSelected,
      selected,
      commitSelection,
      matchRow,
    ]
  )

  /* ---- Render ---- */
  const wrapperClasses = [
    styles.wrapper,
    stickyHeader ? styles.stickyHeader : '',
    styles[`size-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const isEmpty = data.length === 0

  // Selection-column width is fixed.
  const selectColumnWidth = '48px'

  return (
    <div {...rest} className={wrapperClasses} style={rootStyle}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {selectable && (
                <th
                  className={styles.th}
                  style={{ width: selectColumnWidth }}
                  scope="col"
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected
                    }}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    aria-label="Select all rows on this page"
                    disabled={pageSelectableRows.length === 0}
                  />
                </th>
              )}
              {columns.map((column) => {
                const columnKey = String(column.key)
                const isSorted = sort?.key === columnKey
                const ariaSort: 'ascending' | 'descending' | 'none' = isSorted
                  ? sort!.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                const style: React.CSSProperties = {
                  width:
                    typeof column.width === 'number'
                      ? `${column.width}px`
                      : column.width,
                  textAlign: column.align ?? 'left',
                }
                return (
                  <th
                    key={columnKey}
                    className={styles.th}
                    style={style}
                    scope="col"
                    aria-sort={column.sortable ? ariaSort : undefined}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => handleHeaderClick(columnKey)}
                      >
                        <span>{column.header}</span>
                        <span className={styles.sortIcon} aria-hidden="true">
                          {!isSorted && <SortIcon />}
                          {isSorted && sort!.direction === 'asc' && (
                            <ChevronUpIcon />
                          )}
                          {isSorted && sort!.direction === 'desc' && (
                            <ChevronDownIcon />
                          )}
                        </span>
                      </button>
                    ) : (
                      <span>{column.header}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {isEmpty && (
              <tr className={styles.tr}>
                <td
                  className={styles.emptyCell}
                  colSpan={columns.length + (selectable ? 1 : 0)}
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!isEmpty &&
              visibleRows.map((row, rowIndex) => {
                const rowSelected = isRowSelected(row)
                return (
                  <tr
                    key={
                      getRowId
                        ? String(getRowId(row))
                        : `${safePage}-${rowIndex}`
                    }
                    className={[
                      styles.tr,
                      rowSelected ? styles.selected : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-selected={selectable ? rowSelected : undefined}
                  >
                    {selectable && (
                      <td className={styles.td} style={{ width: selectColumnWidth }}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={rowSelected}
                          onChange={(e) => toggleRow(row, e.target.checked)}
                          aria-label={rowAriaLabel(row, rowIndex, getRowId)}
                        />
                      </td>
                    )}
                    {columns.map((column) => {
                      const columnKey = String(column.key)
                      const cell = column.render
                        ? column.render(row)
                        : (row[column.key as keyof T] as React.ReactNode)
                      return (
                        <td
                          key={columnKey}
                          className={styles.td}
                          style={{ textAlign: column.align ?? 'left' }}
                        >
                          {cell}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      {pageSize && totalPages > 1 && (
        <div className={styles.paginationRow}>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- *
 *  Sort icons (inline SVG — matches Table.tsx pattern, avoids icon dep churn)
 * -------------------------------------------------------------------------- */

const SortIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
  </svg>
)

const ChevronUpIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
