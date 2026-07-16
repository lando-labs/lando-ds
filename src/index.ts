/**
 * Lando Labs Design System
 * A comprehensive, production-ready design system and component library
 *
 * @packageDocumentation
 */

import './styles/index.css'

export * from './components'

// #464 — DataTable's companion public types reach the root only via the
// `export * from './components'` above, so they are NOT literally present in the
// emitted `dist/index.d.ts` (a thin barrel of `export *`), only in
// `dist/components/index.d.ts`. That broke the natural consumer import
// `import { DataTable, type DataTableColumn } from '@lando-labs/lando-ds'`.
// Re-export them EXPLICITLY from the root barrel so `DataTableColumn` (and its
// sibling column/config types) resolve directly from the package root.
export type {
  DataTableColumn,
  DataTableProps,
  DataTableSort,
  DataTableSortDirection,
  DataTableStaticProps,
} from './components'

export * from './tokens'

export * from './utils'

export * from './hooks'

// #468 — VERSION is auto-derived from package.json at build time. Vite/Vitest
// replace `__DS_VERSION__` with the real version string via `define` (see
// vite.config.ts + vitest.config.ts). This replaces the stale hardcoded
// '0.1.0' that shipped in dist/index.d.ts for every release.
declare const __DS_VERSION__: string
export const VERSION: string = __DS_VERSION__
