/**
 * DataTable.Static Component Tests — Sprint 55 #311
 *
 * Covers:
 *  - Renders rows + headers (matches DataTable visual surface)
 *  - Custom cell renderer
 *  - Empty state
 *  - NO interactive affordances: no sort buttons, no checkboxes, no pagination
 *  - Renders via renderToStaticMarkup (SSR-safe, zero client globals at render)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DataTable, DataTableStatic, type DataTableColumn } from './index'

type Row = { id: number; label: string; count: number }

const rows: Row[] = [
  { id: 1, label: 'Alpha', count: 5 },
  { id: 2, label: 'Beta', count: 12 },
  { id: 3, label: 'Gamma', count: 7 },
]

const columns: DataTableColumn<Row>[] = [
  // Note: `sortable: true` is intentionally set here to prove the Static
  // variant IGNORES it (no sort button rendered).
  { key: 'label', header: 'Label', sortable: true },
  { key: 'count', header: 'Count' },
]

describe('DataTable.Static', () => {
  it('renders rows + headers', () => {
    render(<DataTableStatic<Row> data={rows} columns={columns} />)
    expect(screen.getByText('Label')).toBeInTheDocument()
    expect(screen.getByText('Count')).toBeInTheDocument()
    for (const r of rows) {
      expect(screen.getByText(r.label)).toBeInTheDocument()
    }
  })

  it('uses custom render when provided', () => {
    const cols: DataTableColumn<Row>[] = [
      { key: 'label', header: 'Label' },
      {
        key: 'count',
        header: 'Count',
        render: (r) => <strong data-testid={`count-${r.id}`}>{r.count}</strong>,
      },
    ]
    render(<DataTableStatic<Row> data={rows.slice(0, 2)} columns={cols} />)
    expect(screen.getByTestId('count-1')).toHaveTextContent('5')
    expect(screen.getByTestId('count-2')).toHaveTextContent('12')
  })

  it('renders empty state', () => {
    render(<DataTableStatic<Row> data={[]} columns={columns} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('honors custom emptyMessage', () => {
    render(
      <DataTableStatic<Row>
        data={[]}
        columns={columns}
        emptyMessage={<em data-testid="empty">crickets</em>}
      />
    )
    expect(screen.getByTestId('empty')).toBeInTheDocument()
  })

  it('does NOT render sort buttons even when columns mark sortable: true', () => {
    render(<DataTableStatic<Row> data={rows} columns={columns} />)
    // No buttons of any kind inside the static variant.
    expect(screen.queryByRole('button')).toBeNull()
    // No aria-sort attributes on any th.
    const ths = document.querySelectorAll('th')
    ths.forEach((th) => expect(th).not.toHaveAttribute('aria-sort'))
  })

  it('does NOT render checkboxes or pagination', () => {
    render(<DataTableStatic<Row> data={rows} columns={columns} />)
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(document.querySelector('nav[aria-label="Pagination"]')).toBeNull()
  })

  it('is exposed as DataTable.Static (namespaced access)', () => {
    expect(DataTable.Static).toBe(DataTableStatic)
  })

  it('renders via renderToStaticMarkup without throwing (SSR safe)', () => {
    // No window/document access at render time — proves the leaf is safe for
    // a React Server Component to render.
    const html = renderToStaticMarkup(
      <DataTableStatic<Row> data={rows} columns={columns} />
    )
    expect(html).toBeTruthy()
    expect(html).toContain('Alpha')
    expect(html).toContain('12')
  })

  it('renders via renderToStaticMarkup with empty data', () => {
    const html = renderToStaticMarkup(
      <DataTableStatic<Row> data={[]} columns={columns} />
    )
    expect(html).toBeTruthy()
    expect(html).toContain('No data')
  })

  // #423 — full-customizability contract: consumer `style` + rest props land
  // on the visual-root wrapper.
  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the wrapper', () => {
      render(
        <DataTableStatic<Row>
          data={rows}
          columns={columns}
          data-testid="my-static-datatable"
          style={{ color: 'rgb(9, 8, 7)' }}
        />
      )
      const root = screen.getByTestId('my-static-datatable')
      expect(root.style.color).toBe('rgb(9, 8, 7)')
      expect(root).toContainElement(screen.getByRole('table'))
    })
  })
})
