/**
 * Pagination Component Tests
 *
 * Behavioral coverage: page change callbacks, boundary disabled states,
 * ellipsis rendering, aria-current, and keyboard activation.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('renders a page button for each page when total fits the window', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />
    )

    // Pages 1-5 present, no ellipsis.
    for (let i = 1; i <= 5; i++) {
      expect(
        screen.getByRole('button', { name: `Go to page ${i}` })
      ).toBeInTheDocument()
    }
  })

  it('marks the current page with aria-current="page"', () => {
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={() => {}} />
    )

    const current = screen.getByRole('button', { name: 'Go to page 3' })
    expect(current).toHaveAttribute('aria-current', 'page')

    const other = screen.getByRole('button', { name: 'Go to page 1' })
    expect(other).not.toHaveAttribute('aria-current')
  })

  it('calls onPageChange when a page button is clicked', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={onPageChange}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('does not call onPageChange when clicking the current page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={onPageChange}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('disables first/previous buttons on page 1', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />
    )

    expect(
      screen.getByRole('button', { name: 'Go to first page' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Go to previous page' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Go to next page' })
    ).not.toBeDisabled()
  })

  it('disables next/last buttons on the last page', () => {
    render(
      <Pagination currentPage={5} totalPages={5} onPageChange={() => {}} />
    )

    expect(
      screen.getByRole('button', { name: 'Go to next page' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Go to last page' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Go to previous page' })
    ).not.toBeDisabled()
  })

  it('advances via the next-page button', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={onPageChange}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Go to next page' })
    )
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('hides first/last and prev/next buttons when disabled via props', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={() => {}}
        showFirstLast={false}
        showPrevNext={false}
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Go to first page' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Go to previous page' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Go to next page' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Go to last page' })
    ).not.toBeInTheDocument()
  })

  it('renders ellipsis when page range is large enough to require skipping', () => {
    const { container } = render(
      <Pagination currentPage={5} totalPages={20} onPageChange={() => {}} />
    )

    // At least one ellipsis span should be present for currentPage=5 / total=20.
    const ellipses = container.querySelectorAll('[aria-hidden="true"]')
    const ellipsisText = Array.from(ellipses).filter(
      (el) => el.textContent === '...'
    )
    expect(ellipsisText.length).toBeGreaterThan(0)
  })

  it('fires onPageChange on Enter keypress on a page button', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={onPageChange}
      />
    )

    const pageButton = screen.getByRole('button', { name: 'Go to page 3' })
    pageButton.focus()
    await user.keyboard('{Enter}')

    expect(onPageChange).toHaveBeenCalledWith(3)
  })
})

/* -------------------------------------------------------------------- *
 *  #423 — consumer style / ...rest pass-through to the <nav> root
 * -------------------------------------------------------------------- */
describe('Pagination consumer passthrough (#423)', () => {
  it('lands consumer data-testid on the <nav> visual root', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={() => {}}
        data-testid="pg"
      />,
    )
    expect(screen.getByTestId('pg').tagName).toBe('NAV')
  })

  it('applies consumer style.color to the <nav> visual root', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={() => {}}
        data-testid="pg"
        style={{ color: 'rgb(1, 2, 3)' }}
      />,
    )
    expect(screen.getByTestId('pg')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('keeps the internal navigation role authoritative', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={() => {}}
        data-testid="pg"
      />,
    )
    // Role survives; landmark is still exposed as "Pagination".
    expect(
      screen.getByRole('navigation', { name: 'Pagination' }),
    ).toBeInTheDocument()
  })
})
