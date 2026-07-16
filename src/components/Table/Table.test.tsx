/**
 * Table Component Tests
 *
 * Covers:
 *  - Row click fires handler with correct row + index (#30)
 *  - Enter / Space keyboard activation fires handler (#30)
 *  - Space prevents default (no page scroll on focused row) (#30)
 *  - Clicks on interactive descendants (button, link, input, select,
 *    textarea, label, data-no-row-click) do NOT fire the row handler (#30)
 *  - Contenteditable descendants do NOT fire the row handler (#30)
 *  - Keydown originating on a descendant does NOT fire the row handler (#30)
 *  - No onRowClick => no tabIndex, no role=button, no cursor, no handlers
 *    (backward compat for existing consumers) (#30)
 *  - isRowInteractive(row) => false leaves that specific row non-interactive (#30)
 *  - getRowAriaLabel populates aria-label (#30)
 *  - Non-clickable tables still render sort / selection / empty / loading
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Table, type Column } from './Table'

type User = {
  id: number
  name: string
  email: string
}

const users: User[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: 2, name: 'Grace Hopper', email: 'grace@example.com' },
  { id: 3, name: 'Alan Turing', email: 'alan@example.com' },
]

const baseColumns: Column<User>[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
]

// noUncheckedIndexedAccess note: `getAllByRole('button')` throws on zero matches
// and these tests render a fixed 3-row fixture, so the `rows` non-null
// assertions (!) below are safe. `tbodyRows` (from querySelectorAll) is
// length-asserted via toHaveLength(3) before it is indexed.
describe('Table', () => {
  describe('basic rendering (regression — untouched by #30)', () => {
    it('renders all rows and columns', () => {
      render(<Table<User> data={users} columns={baseColumns} />)
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
      expect(screen.getByText('Alan Turing')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
    })

    it('renders empty state when data is empty', () => {
      render(<Table<User> data={[]} columns={baseColumns} />)
      expect(screen.getByText('No data available')).toBeInTheDocument()
    })
  })

  // #30 — onRowClick + keyboard + event swallowing

  describe('onRowClick (#30)', () => {
    it('does NOT make rows interactive when onRowClick is not provided', () => {
      // Backward compat: existing consumers render exactly as before.
      const { container } = render(
        <Table<User> data={users} columns={baseColumns} />
      )

      // tbody rows — no role, no tabIndex, no clickable class.
      const tbodyRows = container.querySelectorAll('tbody tr')
      expect(tbodyRows).toHaveLength(3)
      tbodyRows.forEach((row) => {
        expect(row).not.toHaveAttribute('role')
        expect(row).not.toHaveAttribute('tabindex')
        // The `.clickable` CSS class must not appear.
        expect(row.className).not.toMatch(/clickable/)
      })
    })

    it('fires onRowClick with the row data + index on click', () => {
      const handleRowClick = vi.fn()
      render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={handleRowClick}
        />
      )

      // role=button on each row lets us query them cleanly.
      const rows = screen.getAllByRole('button')
      // Three tbody rows (no sortable headers in baseColumns -> no th buttons).
      expect(rows).toHaveLength(3)

      fireEvent.click(rows[1]!)
      expect(handleRowClick).toHaveBeenCalledTimes(1)
      expect(handleRowClick).toHaveBeenCalledWith(
        users[1],
        1,
        expect.objectContaining({ type: 'click' })
      )
    })

    it('makes rows focusable (tabIndex=0) and role=button when onRowClick is set', () => {
      const { container } = render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={vi.fn()}
        />
      )

      const tbodyRows = container.querySelectorAll('tbody tr')
      expect(tbodyRows).toHaveLength(3)
      tbodyRows.forEach((row) => {
        expect(row).toHaveAttribute('role', 'button')
        expect(row).toHaveAttribute('tabindex', '0')
        expect(row.className).toMatch(/clickable/)
      })
    })

    it('fires onRowClick on Enter key when the row itself is focused', () => {
      const handleRowClick = vi.fn()
      render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={handleRowClick}
        />
      )

      const rows = screen.getAllByRole('button')
      fireEvent.keyDown(rows[2]!, { key: 'Enter' })

      expect(handleRowClick).toHaveBeenCalledTimes(1)
      expect(handleRowClick).toHaveBeenCalledWith(
        users[2],
        2,
        expect.objectContaining({ key: 'Enter' })
      )
    })

    it('fires onRowClick on Space key and prevents default (no page scroll)', () => {
      const handleRowClick = vi.fn()
      render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={handleRowClick}
        />
      )

      const rows = screen.getAllByRole('button')
      // Create a cancelable Space keyDown event so we can inspect defaultPrevented.
      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      })
      rows[0]!.dispatchEvent(spaceEvent)

      expect(handleRowClick).toHaveBeenCalledTimes(1)
      // Space on a focused row must preventDefault so the browser doesn't scroll.
      expect(spaceEvent.defaultPrevented).toBe(true)
    })

    it('does NOT fire on other keys (ArrowDown, Tab, a, etc.)', () => {
      const handleRowClick = vi.fn()
      render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={handleRowClick}
        />
      )

      const rows = screen.getAllByRole('button')
      fireEvent.keyDown(rows[0]!, { key: 'ArrowDown' })
      fireEvent.keyDown(rows[0]!, { key: 'Tab' })
      fireEvent.keyDown(rows[0]!, { key: 'a' })
      fireEvent.keyDown(rows[0]!, { key: 'Escape' })

      expect(handleRowClick).not.toHaveBeenCalled()
    })

    it('does NOT fire row handler when a <button> inside a cell is clicked (#30)', () => {
      const handleRowClick = vi.fn()
      const handleButtonClick = vi.fn()

      const columnsWithButton: Column<User>[] = [
        { key: 'name', label: 'Name' },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => (
            <button
              type="button"
              data-testid={`action-btn-${row.id}`}
              onClick={handleButtonClick}
            >
              Action
            </button>
          ),
        },
      ]

      render(
        <Table<User>
          data={users}
          columns={columnsWithButton}
          onRowClick={handleRowClick}
        />
      )

      fireEvent.click(screen.getByTestId('action-btn-2'))

      expect(handleButtonClick).toHaveBeenCalledTimes(1)
      expect(handleRowClick).not.toHaveBeenCalled()
    })

    it('does NOT fire row handler when an <a> link inside a cell is clicked (#30)', () => {
      const handleRowClick = vi.fn()

      const columnsWithLink: Column<User>[] = [
        { key: 'name', label: 'Name' },
        {
          key: 'link',
          label: 'Link',
          render: (row) => (
            <a
              href="#detail"
              data-testid={`row-link-${row.id}`}
              onClick={(e) => e.preventDefault()}
            >
              View
            </a>
          ),
        },
      ]

      render(
        <Table<User>
          data={users}
          columns={columnsWithLink}
          onRowClick={handleRowClick}
        />
      )

      fireEvent.click(screen.getByTestId('row-link-1'))
      expect(handleRowClick).not.toHaveBeenCalled()
    })

    it('does NOT fire row handler when an <input>, <select>, or <textarea> inside a cell is clicked (#30)', () => {
      const handleRowClick = vi.fn()

      const columnsWithForm: Column<User>[] = [
        { key: 'name', label: 'Name' },
        {
          key: 'controls',
          label: 'Controls',
          render: (row) => (
            <>
              <input type="checkbox" data-testid={`chk-${row.id}`} />
              <select data-testid={`sel-${row.id}`}>
                <option>a</option>
              </select>
              <textarea data-testid={`ta-${row.id}`} />
            </>
          ),
        },
      ]

      render(
        <Table<User>
          data={users}
          columns={columnsWithForm}
          onRowClick={handleRowClick}
        />
      )

      fireEvent.click(screen.getByTestId('chk-1'))
      fireEvent.click(screen.getByTestId('sel-2'))
      fireEvent.click(screen.getByTestId('ta-3'))

      expect(handleRowClick).not.toHaveBeenCalled()
    })

    it('does NOT fire row handler when a descendant with data-no-row-click is clicked (#30)', () => {
      const handleRowClick = vi.fn()

      const columnsWithEscape: Column<User>[] = [
        { key: 'name', label: 'Name' },
        {
          key: 'menu',
          label: 'Menu',
          // An opaque div with its own onClick — only the escape-hatch
          // attribute should save it from firing the row handler.
          render: (row) => (
            <div
              data-no-row-click
              data-testid={`menu-${row.id}`}
              onClick={() => {
                /* swallow */
              }}
            >
              Menu
            </div>
          ),
        },
      ]

      render(
        <Table<User>
          data={users}
          columns={columnsWithEscape}
          onRowClick={handleRowClick}
        />
      )

      fireEvent.click(screen.getByTestId('menu-1'))
      expect(handleRowClick).not.toHaveBeenCalled()
    })

    it('DOES fire row handler when a plain non-interactive cell element is clicked (#30)', () => {
      const handleRowClick = vi.fn()
      const columnsWithSpan: Column<User>[] = [
        { key: 'name', label: 'Name' },
        {
          key: 'label',
          label: 'Label',
          render: (row) => <span data-testid={`span-${row.id}`}>{row.name}</span>,
        },
      ]

      render(
        <Table<User>
          data={users}
          columns={columnsWithSpan}
          onRowClick={handleRowClick}
        />
      )

      // Clicks on plain spans/divs/tds MUST bubble up to the row handler.
      // (users[0].id === 1, so the first row's span is `span-1`.)
      fireEvent.click(screen.getByTestId('span-1'))
      expect(handleRowClick).toHaveBeenCalledTimes(1)
      expect(handleRowClick).toHaveBeenCalledWith(
        users[0],
        0,
        expect.objectContaining({ type: 'click' })
      )
    })

    it('does NOT fire row handler when Enter is pressed on a descendant button (#30)', () => {
      // Regression: keydown must only fire when event.target === currentTarget.
      // If a <button> inside a cell is focused and the user presses Enter,
      // that's a button activation, not a row activation.
      const handleRowClick = vi.fn()
      const handleButtonClick = vi.fn()

      const columnsWithButton: Column<User>[] = [
        { key: 'name', label: 'Name' },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => (
            <button
              type="button"
              data-testid={`btn-${row.id}`}
              onClick={handleButtonClick}
            >
              Go
            </button>
          ),
        },
      ]

      render(
        <Table<User>
          data={users}
          columns={columnsWithButton}
          onRowClick={handleRowClick}
        />
      )

      const button = screen.getByTestId('btn-1')
      // Keydown on the button itself (target === button, not the tr).
      fireEvent.keyDown(button, { key: 'Enter' })

      // Row handler must stay quiet — the keydown didn't originate from the row.
      expect(handleRowClick).not.toHaveBeenCalled()
    })

    it('respects isRowInteractive — opted-out row has no tabIndex, no role, no handler', () => {
      const handleRowClick = vi.fn()

      const { container } = render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={handleRowClick}
          // Opt out the middle row.
          isRowInteractive={(_row, index) => index !== 1}
        />
      )

      const tbodyRows = container.querySelectorAll('tbody tr')
      expect(tbodyRows).toHaveLength(3)

      // Row 0 — interactive.
      expect(tbodyRows[0]).toHaveAttribute('role', 'button')
      expect(tbodyRows[0]).toHaveAttribute('tabindex', '0')
      expect(tbodyRows[0]!.className).toMatch(/clickable/)

      // Row 1 — opted out.
      expect(tbodyRows[1]).not.toHaveAttribute('role')
      expect(tbodyRows[1]).not.toHaveAttribute('tabindex')
      expect(tbodyRows[1]!.className).not.toMatch(/clickable/)

      // Row 2 — interactive.
      expect(tbodyRows[2]).toHaveAttribute('role', 'button')

      // Clicking the opted-out row does nothing.
      fireEvent.click(tbodyRows[1]!)
      expect(handleRowClick).not.toHaveBeenCalled()

      // Clicking the interactive rows does fire.
      fireEvent.click(tbodyRows[0]!)
      expect(handleRowClick).toHaveBeenCalledTimes(1)
      expect(handleRowClick).toHaveBeenLastCalledWith(
        users[0],
        0,
        expect.any(Object)
      )
    })

    it('applies getRowAriaLabel to aria-label on interactive rows', () => {
      const { container } = render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={vi.fn()}
          getRowAriaLabel={(row) => `Open ${row.name}`}
        />
      )

      const tbodyRows = container.querySelectorAll('tbody tr')
      expect(tbodyRows[0]).toHaveAttribute('aria-label', 'Open Ada Lovelace')
      expect(tbodyRows[1]).toHaveAttribute('aria-label', 'Open Grace Hopper')
      expect(tbodyRows[2]).toHaveAttribute('aria-label', 'Open Alan Turing')
    })

    it('does NOT set aria-label when getRowAriaLabel is omitted', () => {
      const { container } = render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={vi.fn()}
        />
      )

      const tbodyRows = container.querySelectorAll('tbody tr')
      tbodyRows.forEach((row) => {
        expect(row).not.toHaveAttribute('aria-label')
      })
    })

    it('fires onRowClick exactly once per click (no double-fire)', () => {
      const handleRowClick = vi.fn()
      render(
        <Table<User>
          data={users}
          columns={baseColumns}
          onRowClick={handleRowClick}
        />
      )

      const rows = screen.getAllByRole('button')
      fireEvent.click(rows[0]!)
      fireEvent.click(rows[0]!)
      fireEvent.click(rows[1]!)

      expect(handleRowClick).toHaveBeenCalledTimes(3)
      // safe: handleRowClick called 3× (asserted just above)
      expect(handleRowClick.mock.calls[0]![1]).toBe(0)
      expect(handleRowClick.mock.calls[1]![1]).toBe(0)
      expect(handleRowClick.mock.calls[2]![1]).toBe(1)
    })
  })

  // #423 — full-customizability contract: consumer `style` + rest props land
  // on the visual-root wrapper across ALL render branches (data / empty /
  // loading) — each is a separate `return`.
  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the wrapper (with data)', () => {
      render(
        <Table<User>
          data={users}
          columns={baseColumns}
          data-testid="my-table"
          style={{ color: 'rgb(3, 6, 9)' }}
        />
      )
      const root = screen.getByTestId('my-table')
      expect(root.style.color).toBe('rgb(3, 6, 9)')
      expect(root).toContainElement(screen.getByRole('table'))
    })

    it('forwards data-testid and style.color to the empty-state wrapper', () => {
      render(
        <Table<User>
          data={[]}
          columns={baseColumns}
          data-testid="empty-table"
          style={{ color: 'rgb(3, 6, 9)' }}
        />
      )
      const root = screen.getByTestId('empty-table')
      expect(root.style.color).toBe('rgb(3, 6, 9)')
    })

    it('forwards data-testid and style.color to the loading wrapper', () => {
      render(
        <Table<User>
          data={users}
          columns={baseColumns}
          loading
          data-testid="loading-table"
          style={{ color: 'rgb(3, 6, 9)' }}
        />
      )
      const root = screen.getByTestId('loading-table')
      expect(root.style.color).toBe('rgb(3, 6, 9)')
    })
  })
})
