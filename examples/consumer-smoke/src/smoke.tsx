/**
 * External-consumer type-resolution smoke test (#365) — the CI guard that
 * replaces committed-dist (#468).
 *
 * This file is compiled by `tsc --noEmit` under `moduleResolution: "bundler"`
 * (create-next-app's default) against the PACKED @lando-labs/lando-ds
 * tarball installed into node_modules. It exercises the two import surfaces a
 * real consumer uses:
 *
 *   1. the package ROOT barrel  — `@lando-labs/lando-ds`
 *   2. a per-module SUBPATH     — `@lando-labs/lando-ds/components/...`
 *
 * WHY THE `IsAny` GUARD (non-vacuous): #468's failure mode is subtle. When
 * `dist/components.d.ts` is missing, `export * from './components'` in
 * `dist/index.d.ts` resolves to the untyped JS barrel, collapsing every
 * re-exported type to `any`. A bare `import { type DataTableColumn }` would
 * then STILL compile (any absorbs everything), so a plain import is a vacuous
 * check. Asserting the resolved types are NOT `any` makes this fail `tsc` the
 * moment the published surface regresses:
 *   - a missing barrel / dropped `export *`  -> types become `any`  -> TS2344
 *   - a dropped named type/value export       -> missing member      -> TS2305
 */

// 1. ROOT-barrel imports: a value, a component, and a type-only re-export
//    (`DataTableColumn` — exactly the #464 fix that #468 says is invisible to
//    git/file: consumers of the stale committed tree).
import { Button, DataTable, type DataTableColumn } from '@lando-labs/lando-ds'

// 2. SUBPATH import via the `./components/*` export map entry (v0.22.0 `<Dir>/<Module>` form).
import { Badge } from '@lando-labs/lando-ds/components/Badge/Badge'

// 3. CLEAN per-component specifier (#283) — single-segment `components/<Name>`,
//    resolving the FULL barrel (Card + compound parts). Proves the flat shim
//    resolves types + values via the same `./components/*` map entry.
import { Card, CardBody } from '@lando-labs/lando-ds/components/Card'

/* --------------------------------------------------------------------------
 * Non-vacuous type-level guard: fail compilation if any resolved export is `any`.
 * ------------------------------------------------------------------------ */
type IsAny<T> = 0 extends 1 & T ? true : false
// `ExpectFalse<T extends false>` errors (TS2344) if T is `true` — i.e. if the
// wrapped export resolved to `any`.
type ExpectFalse<T extends false> = T

// DataTableColumn is generic and REQUIRES a type argument in the healthy case,
// so we always supply one; in the any-collapsed case it is `any` regardless.
type _RootTypeReexport = ExpectFalse<IsAny<DataTableColumn<{ id: string }>>>
type _RootValueExport = ExpectFalse<IsAny<typeof Button>>
type _RootComponentExport = ExpectFalse<IsAny<typeof DataTable>>
type _SubpathExport = ExpectFalse<IsAny<typeof Badge>>
// #283 — the clean specifier's compound member must resolve to a real type, not `any`.
type _CleanSpecifierExport = ExpectFalse<IsAny<typeof CardBody>>

/* --------------------------------------------------------------------------
 * Value-level usage: also trips on a totally missing VALUE export, and proves
 * the real prop types resolve (not just that a symbol exists).
 * ------------------------------------------------------------------------ */
interface Row {
  id: string
  name: string
}

const columns: DataTableColumn<Row>[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name', sortable: true },
]

const rows: Row[] = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Linus' },
]

export function Smoke() {
  return (
    <div>
      <Button variant="primary">Save</Button>
      <Badge variant="success">New</Badge>
      <Card>
        <CardBody>Clean specifier</CardBody>
      </Card>
      <DataTable columns={columns} data={rows} />
    </div>
  )
}
