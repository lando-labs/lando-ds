/**
 * DataTable — Sprint 55 #311 (sortable + pageable + selectable data table)
 *
 * Two surfaces:
 *   - `<DataTable>` — interactive (sort + page + selection), client component.
 *   - `<DataTable.Static>` — read-only, SSR-safe, ships zero client JS.
 *
 * The `DataTable.Static` namespace is attached via the default export shape so
 * consumers can use either `DataTable.Static` or import `DataTableStatic`
 * directly.
 */

import { DataTable as DataTableImpl } from './DataTable'
import { DataTableStatic } from './DataTable.Static'

type DataTableComponent = typeof DataTableImpl & {
  Static: typeof DataTableStatic
}

const DataTable = DataTableImpl as DataTableComponent
DataTable.Static = DataTableStatic

export { DataTable, DataTableStatic }
export type {
  DataTableProps,
  DataTableColumn,
  DataTableSort,
  DataTableSortDirection,
} from './DataTable'
export type { DataTableStaticProps } from './DataTable.Static'
