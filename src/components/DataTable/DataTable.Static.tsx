/**
 * DataTable.Static Component
 *
 * Read-only, SSR-safe variant of {@link DataTable}. NO interactivity — no
 * sort, no pagination, no selection. Just renders rows. Ships zero client
 * JS, so it's the right choice for dashboards that have N read-only tables
 * plus a single interactive `<DataTable>`.
 *
 * Shares the same visual surface and the same `DataTableColumn<T>` shape as
 * `<DataTable>`, so consumers can swap between them with no API churn.
 *
 * Sprint 55 (#311) — Lane A of v0.34.0.
 *
 * @example
 *   <DataTable.Static
 *     data={rows}
 *     columns={[
 *       { key: 'name', header: 'Name' },
 *       { key: 'role', header: 'Role' },
 *     ]}
 *   />
 */

import React from 'react'
import type { DataTableColumn } from './DataTable'
import styles from './DataTable.module.css'

export interface DataTableStaticProps<T>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Array of rows. */
  data: T[]
  /** Column definitions (shared shape with `DataTable`). */
  columns: DataTableColumn<T>[]
  /** Compact / comfortable / spacious cell padding. Defaults to `'md'`. */
  size?: 'sm' | 'md' | 'lg'
  /** Message shown when `data` is empty. Defaults to "No data". */
  emptyMessage?: React.ReactNode
  /** Extra class on the outer wrapper. */
  className?: string
}

export function DataTableStatic<T extends object>({
  data,
  columns,
  size = 'md',
  emptyMessage = 'No data',
  className = '',
  style: rootStyle,
  ...rest
}: DataTableStaticProps<T>) {
  const wrapperClasses = [styles.wrapper, styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ')
  const isEmpty = data.length === 0

  return (
    <div {...rest} className={wrapperClasses} style={rootStyle}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {columns.map((column) => {
                const columnKey = String(column.key)
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
                  >
                    <span>{column.header}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {isEmpty && (
              <tr className={styles.tr}>
                <td className={styles.emptyCell} colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!isEmpty &&
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className={styles.tr}>
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
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
