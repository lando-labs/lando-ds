/**
 * DataTable Component Tests — Sprint 55 #311 (Lane A of v0.34.0)
 *
 * Covers:
 *  - Rendering (rows + columns + custom render)
 *  - Sort cycle (none → asc → desc → none), state survives data changes
 *  - aria-sort reflects column state
 *  - Pagination (navigation, edge cases, custom page sizes)
 *  - Selection (per-row toggle, header select-all on current page,
 *    selection survives sort + pagination)
 *  - Controlled mode for sort / page / selection
 *  - Empty state renders `emptyMessage`
 *  - DataTable.Static: renders, no interactivity affordances
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DataTable, type DataTableColumn } from './index'

type User = {
  id: number
  name: string
  age: number
}

const users: User[] = [
  { id: 1, name: 'Ada Lovelace', age: 36 },
  { id: 2, name: 'Grace Hopper', age: 85 },
  { id: 3, name: 'Alan Turing', age: 41 },
  { id: 4, name: 'Donald Knuth', age: 86 },
  { id: 5, name: 'Linus Torvalds', age: 54 },
]

const baseColumns: DataTableColumn<User>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'age', header: 'Age', sortable: true },
]

// noUncheckedIndexedAccess note: the Testing-Library `getAllBy*` queries throw on
// zero matches and every test renders a known, fixed fixture, so the non-null
// assertions (!) applied to their indexed results below are provably safe.
// `users` accesses index the 5-element fixture literal declared above.
describe('DataTable', () => {
  /* ------------------------------------------------------------------ *
   *  Rendering
   * ------------------------------------------------------------------ */

  describe('rendering', () => {
    it('renders all rows and headers', () => {
      render(<DataTable<User> data={users} columns={baseColumns} />)
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Age')).toBeInTheDocument()
      for (const u of users) {
        expect(screen.getByText(u.name)).toBeInTheDocument()
      }
    })

    it('uses custom column render function when provided', () => {
      const columns: DataTableColumn<User>[] = [
        { key: 'name', header: 'Name' },
        {
          key: 'age',
          header: 'Age',
          render: (row) => <span data-testid={`age-${row.id}`}>{row.age}y</span>,
        },
      ]
      render(<DataTable<User> data={users.slice(0, 2)} columns={columns} />)
      expect(screen.getByTestId('age-1')).toHaveTextContent('36y')
      expect(screen.getByTestId('age-2')).toHaveTextContent('85y')
    })

    it('renders empty state when data is empty', () => {
      render(<DataTable<User> data={[]} columns={baseColumns} />)
      expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('renders custom emptyMessage when provided', () => {
      render(
        <DataTable<User>
          data={[]}
          columns={baseColumns}
          emptyMessage={<em data-testid="empty">Nothing yet</em>}
        />
      )
      expect(screen.getByTestId('empty')).toBeInTheDocument()
    })
  })

  /* ------------------------------------------------------------------ *
   *  Sorting
   * ------------------------------------------------------------------ */

  describe('sorting', () => {
    it('starts with no sort — natural data order is preserved', () => {
      render(<DataTable<User> data={users} columns={baseColumns} />)
      const cells = screen.getAllByRole('cell').map((c) => c.textContent)
      // Name appears in column 1 of each row — first row should be 'Ada Lovelace'
      // (the natural order).
      const rows = screen.getAllByRole('row')
      // Row 0 is the header; row 1 is the first body row.
      expect(within(rows[1]!).getByText('Ada Lovelace')).toBeInTheDocument()
      expect(cells.length).toBeGreaterThan(0)
    })

    it('cycles sort on header click: none → asc → desc → none', () => {
      render(<DataTable<User> data={users} columns={baseColumns} />)
      const nameHeader = screen.getByRole('button', { name: /Name/ })
      const nameTh = nameHeader.closest('th')!

      // none → asc
      fireEvent.click(nameHeader)
      expect(nameTh).toHaveAttribute('aria-sort', 'ascending')
      let bodyRows = screen.getAllByRole('row').slice(1)
      expect(within(bodyRows[0]!).getByText('Ada Lovelace')).toBeInTheDocument()
      expect(within(bodyRows[4]!).getByText('Linus Torvalds')).toBeInTheDocument()

      // asc → desc
      fireEvent.click(nameHeader)
      expect(nameTh).toHaveAttribute('aria-sort', 'descending')
      bodyRows = screen.getAllByRole('row').slice(1)
      expect(within(bodyRows[0]!).getByText('Linus Torvalds')).toBeInTheDocument()
      expect(within(bodyRows[4]!).getByText('Ada Lovelace')).toBeInTheDocument()

      // desc → none (natural order restored)
      fireEvent.click(nameHeader)
      expect(nameTh).toHaveAttribute('aria-sort', 'none')
      bodyRows = screen.getAllByRole('row').slice(1)
      expect(within(bodyRows[0]!).getByText('Ada Lovelace')).toBeInTheDocument()
    })

    it('sorts numbers numerically (not lexicographically)', () => {
      render(<DataTable<User> data={users} columns={baseColumns} />)
      const ageHeader = screen.getByRole('button', { name: /Age/ })

      fireEvent.click(ageHeader) // asc
      const bodyRows = screen.getAllByRole('row').slice(1)
      // Ada (36) < Alan (41) < Linus (54) < Grace (85) < Knuth (86)
      expect(within(bodyRows[0]!).getByText('36')).toBeInTheDocument()
      expect(within(bodyRows[4]!).getByText('86')).toBeInTheDocument()
    })

    it('switching sort to a different column resets to asc on that column', () => {
      render(<DataTable<User> data={users} columns={baseColumns} />)
      fireEvent.click(screen.getByRole('button', { name: /Name/ })) // name asc
      fireEvent.click(screen.getByRole('button', { name: /Name/ })) // name desc
      fireEvent.click(screen.getByRole('button', { name: /Age/ })) // → age asc

      const nameTh = screen.getByRole('button', { name: /Name/ }).closest('th')!
      const ageTh = screen.getByRole('button', { name: /Age/ }).closest('th')!
      expect(nameTh).toHaveAttribute('aria-sort', 'none')
      expect(ageTh).toHaveAttribute('aria-sort', 'ascending')
    })

    it('non-sortable columns get no sort button and no aria-sort', () => {
      const columns: DataTableColumn<User>[] = [
        { key: 'name', header: 'Name' }, // sortable omitted
        { key: 'age', header: 'Age', sortable: true },
      ]
      render(<DataTable<User> data={users} columns={columns} />)
      const nameTh = screen.getByText('Name').closest('th')!
      expect(nameTh).not.toHaveAttribute('aria-sort')
      expect(within(nameTh).queryByRole('button')).toBeNull()
    })

    it('defaultSort applies on mount', () => {
      render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          defaultSort={{ key: 'name', direction: 'desc' }}
        />
      )
      const bodyRows = screen.getAllByRole('row').slice(1)
      expect(within(bodyRows[0]!).getByText('Linus Torvalds')).toBeInTheDocument()
    })

    it('sort state survives data changes (controlled by parent re-render)', () => {
      const { rerender } = render(
        <DataTable<User>
          data={users.slice(0, 3)}
          columns={baseColumns}
          defaultSort={{ key: 'age', direction: 'asc' }}
        />
      )
      // Re-render with a different data slice; sort should still apply.
      rerender(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          defaultSort={{ key: 'age', direction: 'asc' }}
        />
      )
      const bodyRows = screen.getAllByRole('row').slice(1)
      // All 5 users, sorted by age asc — Ada (36) is first.
      expect(within(bodyRows[0]!).getByText('36')).toBeInTheDocument()
    })

    it('controlled sort: clicks call onSortChange and do not mutate internal state', () => {
      const onSortChange = vi.fn()
      const { rerender } = render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          sort={null}
          onSortChange={onSortChange}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Name/ }))
      expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })

      // Without the consumer applying the change, sort stays null → no sort applied.
      let bodyRows = screen.getAllByRole('row').slice(1)
      expect(within(bodyRows[0]!).getByText('Ada Lovelace')).toBeInTheDocument() // natural order

      // Now consumer "applies" the change.
      rerender(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          sort={{ key: 'name', direction: 'desc' }}
          onSortChange={onSortChange}
        />
      )
      bodyRows = screen.getAllByRole('row').slice(1)
      expect(within(bodyRows[0]!).getByText('Linus Torvalds')).toBeInTheDocument()
    })
  })

  /* ------------------------------------------------------------------ *
   *  Pagination
   * ------------------------------------------------------------------ */

  describe('pagination', () => {
    it('renders only `pageSize` rows per page', () => {
      render(
        <DataTable<User> data={users} columns={baseColumns} pageSize={2} />
      )
      // 2 body rows on page 1.
      const bodyRows = screen.getAllByRole('row').slice(1)
      expect(bodyRows).toHaveLength(2)
      expect(within(bodyRows[0]!).getByText('Ada Lovelace')).toBeInTheDocument()
      expect(within(bodyRows[1]!).getByText('Grace Hopper')).toBeInTheDocument()
    })

    it('navigates to next page via Pagination', () => {
      render(
        <DataTable<User> data={users} columns={baseColumns} pageSize={2} />
      )
      // Click "Go to page 2" via the pagination nav.
      const next = screen.getByRole('button', { name: /Go to page 2/ })
      fireEvent.click(next)
      const bodyRows = screen.getAllByRole('row').slice(1)
      expect(within(bodyRows[0]!).getByText('Alan Turing')).toBeInTheDocument()
      expect(within(bodyRows[1]!).getByText('Donald Knuth')).toBeInTheDocument()
    })

    it('renders a partial last page when total is not a multiple of pageSize', () => {
      render(
        <DataTable<User> data={users} columns={baseColumns} pageSize={2} />
      )
      // 5 rows, pageSize 2 → page 3 has 1 row.
      fireEvent.click(screen.getByRole('button', { name: /Go to page 3/ }))
      const bodyRows = screen.getAllByRole('row').slice(1)
      expect(bodyRows).toHaveLength(1)
      expect(within(bodyRows[0]!).getByText('Linus Torvalds')).toBeInTheDocument()
    })

    it('hides pagination affordance when all rows fit in one page', () => {
      const { container } = render(
        <DataTable<User> data={users.slice(0, 2)} columns={baseColumns} pageSize={5} />
      )
      // Single page → no nav rendered.
      expect(
        container.querySelector('nav[aria-label="Pagination"]')
      ).toBeNull()
    })

    it('renders no pagination when pageSize is omitted (renders all rows)', () => {
      const { container } = render(
        <DataTable<User> data={users} columns={baseColumns} />
      )
      expect(
        container.querySelector('nav[aria-label="Pagination"]')
      ).toBeNull()
      const bodyRows = screen.getAllByRole('row').slice(1)
      expect(bodyRows).toHaveLength(users.length)
    })

    it('handles empty data with pageSize set (no crash, empty state renders)', () => {
      render(<DataTable<User> data={[]} columns={baseColumns} pageSize={10} />)
      expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('clamps a controlled page that exceeds totalPages', () => {
      // 5 rows, pageSize 2 → totalPages = 3. page=999 should clamp to 3.
      render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          pageSize={2}
          page={999}
          onPageChange={() => {}}
        />
      )
      const bodyRows = screen.getAllByRole('row').slice(1)
      // Last page has only 1 row (Linus).
      expect(bodyRows).toHaveLength(1)
      expect(within(bodyRows[0]!).getByText('Linus Torvalds')).toBeInTheDocument()
    })

    it('controlled page: clicking pagination calls onPageChange (does not mutate)', () => {
      const onPageChange = vi.fn()
      render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          pageSize={2}
          page={1}
          onPageChange={onPageChange}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Go to page 2/ }))
      expect(onPageChange).toHaveBeenCalledWith(2)
      // Without the parent re-rendering with page=2, we should still be on page 1.
      const bodyRows = screen.getAllByRole('row').slice(1)
      expect(within(bodyRows[0]!).getByText('Ada Lovelace')).toBeInTheDocument()
    })
  })

  /* ------------------------------------------------------------------ *
   *  Selection
   * ------------------------------------------------------------------ */

  describe('selection', () => {
    it('does not render select-all or row checkboxes when selectable is false', () => {
      render(<DataTable<User> data={users} columns={baseColumns} />)
      expect(screen.queryByLabelText(/Select all rows/)).toBeNull()
      expect(screen.queryByLabelText(/Select row/)).toBeNull()
    })

    it('renders a select-all header checkbox + one checkbox per row when selectable', () => {
      render(
        <DataTable<User> data={users} columns={baseColumns} selectable />
      )
      expect(
        screen.getByLabelText('Select all rows on this page')
      ).toBeInTheDocument()
      // 5 row checkboxes.
      const rowChecks = screen.getAllByLabelText(/^Select row /)
      expect(rowChecks).toHaveLength(5)
    })

    it('toggling a row fires onSelectionChange with the row', () => {
      const onSelectionChange = vi.fn()
      render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          selectable
          onSelectionChange={onSelectionChange}
        />
      )
      const rowChecks = screen.getAllByLabelText(/^Select row /)
      fireEvent.click(rowChecks[1]!)
      expect(onSelectionChange).toHaveBeenLastCalledWith([users[1]])

      // Toggle a second row → both selected.
      fireEvent.click(rowChecks[3]!)
      expect(onSelectionChange).toHaveBeenLastCalledWith([users[1], users[3]])

      // Untoggle the first → only the second remains.
      fireEvent.click(rowChecks[1]!)
      expect(onSelectionChange).toHaveBeenLastCalledWith([users[3]])
    })

    it('header checkbox selects all rows ON THE CURRENT PAGE only', () => {
      const onSelectionChange = vi.fn()
      render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          pageSize={2}
          selectable
          onSelectionChange={onSelectionChange}
        />
      )
      const headerCheck = screen.getByLabelText('Select all rows on this page')
      fireEvent.click(headerCheck)
      // Only page 1's two rows are in the selection.
      expect(onSelectionChange).toHaveBeenLastCalledWith([users[0], users[1]])

      // Going to page 2 — the page 1 selections persist.
      fireEvent.click(screen.getByRole('button', { name: /Go to page 2/ }))
      // Click the page 2 header checkbox → both pages now selected.
      fireEvent.click(screen.getByLabelText('Select all rows on this page'))
      expect(onSelectionChange).toHaveBeenLastCalledWith([
        users[0],
        users[1],
        users[2],
        users[3],
      ])
    })

    it('header checkbox is indeterminate when some (not all) page rows are selected', () => {
      render(
        <DataTable<User> data={users} columns={baseColumns} selectable />
      )
      const rowChecks = screen.getAllByLabelText(
        /^Select row /
      ) as HTMLInputElement[]
      fireEvent.click(rowChecks[0]!)
      const header = screen.getByLabelText(
        'Select all rows on this page'
      ) as HTMLInputElement
      expect(header.indeterminate).toBe(true)
      expect(header.checked).toBe(false)

      // Select the rest → header becomes fully checked, not indeterminate.
      for (let i = 1; i < rowChecks.length; i++) {
        fireEvent.click(rowChecks[i]!)
      }
      expect(header.indeterminate).toBe(false)
      expect(header.checked).toBe(true)
    })

    it('header checkbox unselects only the rows on the current page', () => {
      const onSelectionChange = vi.fn()
      // Start with all of page 1 + page 2 selected (i.e. all 4 of users 0..3).
      render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          pageSize={2}
          selectable
          defaultSelectedRows={[users[0]!, users[1]!, users[2]!, users[3]!]} // safe: users fixture has 5 elements
          onSelectionChange={onSelectionChange}
        />
      )
      // On page 1 — header checkbox is checked. Click it to clear page 1's
      // selection. The page-2 rows should remain.
      fireEvent.click(screen.getByLabelText('Select all rows on this page'))
      expect(onSelectionChange).toHaveBeenLastCalledWith([users[2], users[3]])
    })

    it('selection survives sort + pagination', () => {
      const onSelectionChange = vi.fn()
      render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          pageSize={2}
          selectable
          onSelectionChange={onSelectionChange}
        />
      )
      // Select first visible row on page 1 (Ada).
      const rowChecks = screen.getAllByLabelText(
        /^Select row /
      ) as HTMLInputElement[]
      fireEvent.click(rowChecks[0]!)
      expect(onSelectionChange).toHaveBeenLastCalledWith([users[0]])

      // Sort by age desc — Knuth (86) leads. Ada is now on page 3.
      fireEvent.click(screen.getByRole('button', { name: /Age/ })) // asc
      fireEvent.click(screen.getByRole('button', { name: /Age/ })) // desc

      // Go to page 3 where Ada now lives.
      fireEvent.click(screen.getByRole('button', { name: /Go to page 3/ }))
      // Ada's checkbox is still selected — find it.
      const adaCheck = screen
        .getAllByLabelText(/^Select row /)
        .find((el) => (el as HTMLInputElement).checked) as HTMLInputElement
      expect(adaCheck).toBeDefined()
      expect(adaCheck.checked).toBe(true)
    })

    it('controlled selection: external selectedRows drives the checkboxes', () => {
      const { rerender } = render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          selectable
          selectedRows={[users[2]!]} // safe: users fixture has 5 elements
          onSelectionChange={() => {}}
        />
      )
      const rowChecks = screen.getAllByLabelText(
        /^Select row /
      ) as HTMLInputElement[]
      expect(rowChecks[0]!.checked).toBe(false)
      expect(rowChecks[2]!.checked).toBe(true)

      rerender(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          selectable
          selectedRows={[users[0]!, users[2]!]} // safe: users fixture has 5 elements
          onSelectionChange={() => {}}
        />
      )
      const updated = screen.getAllByLabelText(
        /^Select row /
      ) as HTMLInputElement[]
      expect(updated[0]!.checked).toBe(true)
      expect(updated[2]!.checked).toBe(true)
    })

    it('getRowId is used in checkbox aria-labels when provided', () => {
      render(
        <DataTable<User>
          data={users.slice(0, 2)}
          columns={baseColumns}
          selectable
          getRowId={(row) => row.id}
        />
      )
      expect(screen.getByLabelText('Select row 1')).toBeInTheDocument()
      expect(screen.getByLabelText('Select row 2')).toBeInTheDocument()
    })

    it('header select-all is disabled when there are no rows', () => {
      render(
        <DataTable<User>
          data={[]}
          columns={baseColumns}
          selectable
        />
      )
      const header = screen.getByLabelText(
        'Select all rows on this page'
      ) as HTMLInputElement
      expect(header.disabled).toBe(true)
    })
  })

  /* ------------------------------------------------------------------ *
   *  #423 — style + rest passthrough
   * ------------------------------------------------------------------ */
  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the wrapper', () => {
      render(
        <DataTable<User>
          data={users}
          columns={baseColumns}
          data-testid="my-datatable"
          style={{ color: 'rgb(2, 4, 6)' }}
        />
      )
      const root = screen.getByTestId('my-datatable')
      expect(root.style.color).toBe('rgb(2, 4, 6)')
      expect(root).toContainElement(screen.getByRole('table'))
    })
  })
})
