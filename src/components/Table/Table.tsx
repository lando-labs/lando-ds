'use client'

/**
 * Table Component
 *
 * A flexible data table with sorting, selection, and responsive behavior.
 * Supports generic data types with customizable column rendering.
 *
 * @example
 * const columns = [
 *   { key: 'name', label: 'Name', sortable: true },
 *   { key: 'email', label: 'Email' },
 *   { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> }
 * ]
 * <Table data={users} columns={columns} sortable selectable />
 *
 * @example Clickable rows (#30)
 * <Table
 *   data={users}
 *   columns={columns}
 *   onRowClick={(row) => openDrawer(row)}
 *   getRowAriaLabel={(row) => `Open ${row.name}`}
 * />
 */

import React, { useState, useCallback } from 'react'
import styles from './Table.module.css'

export interface Column<T> {
  /** Unique key for the column (must match data property) */
  key: keyof T | string
  /** Display label for column header */
  label: string
  /** Enable sorting for this column */
  sortable?: boolean
  /** Custom render function for cell content */
  render?: (row: T, index: number) => React.ReactNode
  /** Custom width for the column */
  width?: string
  /** Alignment for cell content */
  align?: 'left' | 'center' | 'right'
}

export interface TableProps<T>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Array of data objects to display */
  data: T[]
  /** Column definitions */
  columns: Column<T>[]
  /** Enable sorting functionality */
  sortable?: boolean
  /** Callback when sort changes */
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  /** Enable row selection with checkboxes */
  selectable?: boolean
  /** Callback when selection changes */
  onSelectionChange?: (selectedRows: T[]) => void
  /**
   * Callback fired when a row is clicked or activated via keyboard
   * (Enter / Space) (#30).
   *
   * When provided, each row becomes a focusable, button-role element
   * with pointer cursor, hover state, and visible focus ring.
   * Clicks on interactive descendants (`<button>`, `<a>`, `<input>`,
   * `<select>`, `<textarea>`, or any element marked with
   * `data-no-row-click`) will NOT fire this handler.
   */
  onRowClick?: (row: T, index: number, event: React.SyntheticEvent) => void
  /**
   * Optional per-row ARIA label for better screen reader announcements
   * when rows are clickable (#30).
   *
   * Only applied when `onRowClick` is set. If not provided, the row's
   * cell content is announced as usual.
   *
   * @example getRowAriaLabel={(row) => `Open ${row.name}`}
   */
  getRowAriaLabel?: (row: T, index: number) => string
  /**
   * Optional predicate to opt a specific row out of click/keyboard
   * activation, even when `onRowClick` is set (#30).
   *
   * Returning `false` leaves the row non-interactive (no tabIndex,
   * no role=button, no cursor). Returning `true` (or omitting the
   * prop) keeps the default behavior — every row is interactive.
   */
  isRowInteractive?: (row: T, index: number) => boolean
  /** Content to show when data is empty */
  emptyState?: React.ReactNode
  /** Show loading skeleton state */
  loading?: boolean
  /** Enable striped rows */
  striped?: boolean
  /** Additional CSS class */
  className?: string
}

/**
 * HTML tags whose click events should NEVER bubble up to fire
 * `onRowClick`. These elements have their own semantics — activating
 * them is the user's intent, not "click the row around them". (#30)
 */
const INTERACTIVE_TAGS = new Set([
  'BUTTON',
  'A',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'LABEL',
])

/**
 * Walks up from `target` until it reaches `row` (the clicked `<tr>`)
 * and returns `true` if any ancestor along the way is an interactive
 * element or carries `data-no-row-click`. Used to swallow row clicks
 * on buttons, links, form controls, and dropdown triggers inside
 * cells. (#30)
 */
function isClickOnInteractiveDescendant(
  target: EventTarget | null,
  row: HTMLElement
): boolean {
  if (!(target instanceof Element)) return false
  let node: Element | null = target
  while (node && node !== row) {
    if (INTERACTIVE_TAGS.has(node.tagName)) return true
    if (node instanceof HTMLElement && node.dataset.noRowClick !== undefined) {
      return true
    }
    // contenteditable — common rich-text editor pattern
    if (
      node instanceof HTMLElement &&
      node.isContentEditable
    ) {
      return true
    }
    node = node.parentElement
  }
  return false
}

export function Table<T extends object>({
  data,
  columns,
  sortable = false,
  onSort,
  selectable = false,
  onSelectionChange,
  onRowClick,
  getRowAriaLabel,
  isRowInteractive,
  emptyState,
  loading = false,
  striped = false,
  className = '',
  style,
  ...rest
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  const handleSort = useCallback(
    (key: string) => {
      if (!sortable) return

      const newDirection =
        sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc'

      setSortKey(key)
      setSortDirection(newDirection)

      if (onSort) {
        onSort(key, newDirection)
      }
    },
    [sortable, sortKey, sortDirection, onSort]
  )

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allIndices = new Set(data.map((_, index) => index))
        setSelectedRows(allIndices)
        if (onSelectionChange) {
          onSelectionChange(data)
        }
      } else {
        setSelectedRows(new Set())
        if (onSelectionChange) {
          onSelectionChange([])
        }
      }
    },
    [data, onSelectionChange]
  )

  const handleSelectRow = useCallback(
    (index: number, checked: boolean) => {
      const newSelected = new Set(selectedRows)
      if (checked) {
        newSelected.add(index)
      } else {
        newSelected.delete(index)
      }
      setSelectedRows(newSelected)

      if (onSelectionChange) {
        const selected = data.filter((_, i) => newSelected.has(i))
        onSelectionChange(selected)
      }
    },
    [selectedRows, data, onSelectionChange]
  )

  const tableClasses = [
    styles.tableWrapper,
    striped ? styles.striped : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const allSelected = data && selectedRows.size === data.length && data.length > 0
  const someSelected = data && selectedRows.size > 0 && selectedRows.size < data.length

  if (loading) {
    return (
      <div {...rest} className={tableClasses} style={style}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {selectable && (
                <th className={styles.th} style={{ width: '48px' }}>
                  <div className={styles.skeletonCheckbox} />
                </th>
              )}
              {columns.map((_, index) => (
                <th key={index} className={styles.th}>
                  <div className={styles.skeletonHeader} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {[...Array(5)].map((_, rowIndex) => (
              <tr key={rowIndex} className={styles.tr}>
                {selectable && (
                  <td className={styles.td}>
                    <div className={styles.skeletonCheckbox} />
                  </td>
                )}
                {columns.map((_, colIndex) => (
                  <td key={colIndex} className={styles.td}>
                    <div className={styles.skeletonCell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!loading && (!data || data.length === 0)) {
    return (
      <div {...rest} className={tableClasses} style={style}>
        {emptyState || (
          <div className={styles.emptyState}>
            <p>No data available</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div {...rest} className={tableClasses} style={style}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {selectable && (
                <th className={styles.th} style={{ width: '48px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected
                      }
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className={styles.checkbox}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((column, index) => {
                const isSortable = sortable && column.sortable !== false
                const isSorted = sortKey === column.key
                const columnKey = String(column.key)

                return (
                  <th
                    key={index}
                    className={`${styles.th} ${isSortable ? styles.sortable : ''}`}
                    style={{
                      width: column.width,
                      textAlign: column.align || 'left',
                    }}
                    onClick={
                      isSortable ? () => handleSort(columnKey) : undefined
                    }
                    role={isSortable ? 'button' : undefined}
                    tabIndex={isSortable ? 0 : undefined}
                    aria-sort={
                      isSorted
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    <div className={styles.thContent}>
                      <span>{column.label}</span>
                      {isSortable && (
                        <span className={styles.sortIcon}>
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon />
                            ) : (
                              <ChevronDownIcon />
                            )
                          ) : (
                            <SortIcon />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {data.map((row, rowIndex) => {
              // #30: Row is clickable iff onRowClick is provided AND the
              // optional per-row predicate does not opt it out.
              const rowInteractive =
                !!onRowClick &&
                (isRowInteractive ? isRowInteractive(row, rowIndex) : true)

              const handleRowClick = rowInteractive
                ? (event: React.MouseEvent<HTMLTableRowElement>) => {
                    if (
                      isClickOnInteractiveDescendant(
                        event.target,
                        event.currentTarget
                      )
                    ) {
                      return
                    }
                    onRowClick!(row, rowIndex, event)
                  }
                : undefined

              const handleRowKeyDown = rowInteractive
                ? (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                    // Only activate on Enter/Space when the row itself is
                    // the focus target. If a descendant control (button,
                    // input, etc.) is focused and receives the keydown,
                    // its own semantics take over — we must not hijack.
                    if (event.target !== event.currentTarget) return

                    if (event.key === 'Enter' || event.key === ' ') {
                      // Space would scroll the page; Enter would do nothing
                      // native on a <tr>. Either way, prevent default and
                      // fire the handler.
                      event.preventDefault()
                      onRowClick!(row, rowIndex, event)
                    }
                  }
                : undefined

              const rowClasses = [
                styles.tr,
                rowInteractive ? styles.clickable : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <tr
                  key={rowIndex}
                  className={rowClasses}
                  onClick={handleRowClick}
                  onKeyDown={handleRowKeyDown}
                  tabIndex={rowInteractive ? 0 : undefined}
                  role={rowInteractive ? 'button' : undefined}
                  aria-label={
                    rowInteractive && getRowAriaLabel
                      ? getRowAriaLabel(row, rowIndex)
                      : undefined
                  }
                >
                  {selectable && (
                    <td className={styles.td}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(rowIndex)}
                        onChange={(e) =>
                          handleSelectRow(rowIndex, e.target.checked)
                        }
                        className={styles.checkbox}
                        aria-label={`Select row ${rowIndex + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((column, colIndex) => {
                    const columnKey = column.key as keyof T
                    const cellContent = column.render
                      ? column.render(row, rowIndex)
                      : (row[columnKey] as React.ReactNode)

                    return (
                      <td
                        key={colIndex}
                        className={styles.td}
                        style={{ textAlign: column.align || 'left' }}
                      >
                        {cellContent}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

Table.displayName = 'Table'

// Sort Icons
const SortIcon = () => (
  <svg
    width="16"
    height="16"
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
    width="16"
    height="16"
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
    width="16"
    height="16"
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
