/**
 * EmptyState Component Tests
 *
 * Covers:
 * - title rendering (required)
 * - description rendering (optional)
 * - default + custom icon slots
 * - primary + secondary action buttons
 * - onClick handlers fire
 * - variant defaults switch the rendered icon
 * - axe a11y smoke
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { EmptyState } from './EmptyState'

expect.extend(toHaveNoViolations)

describe('EmptyState', () => {
  it('renders title as heading', () => {
    render(<EmptyState title="No items" />)
    expect(
      screen.getByRole('heading', { name: 'No items', level: 3 })
    ).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Nothing here yet" />)
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
  })

  it('does not render description element when not provided', () => {
    render(<EmptyState title="Empty" />)
    // No <p> tag should exist under the component since description is absent
    const heading = screen.getByRole('heading')
    const container = heading.closest('div')?.parentElement
    expect(container?.querySelector('p')).toBeNull()
  })

  it('renders default icon (SVG) for the variant', () => {
    const { container } = render(<EmptyState title="Empty" variant="search" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders custom icon when provided', () => {
    render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="custom-empty-icon">Custom</span>}
      />
    )
    expect(screen.getByTestId('custom-empty-icon')).toBeInTheDocument()
  })

  it('renders primary action button and fires onClick', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Create task', onClick }}
      />
    )
    const btn = screen.getByRole('button', { name: 'Create task' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders secondary action button and fires onClick', () => {
    const primary = vi.fn()
    const secondary = vi.fn()
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Primary', onClick: primary }}
        secondaryAction={{ label: 'Secondary', onClick: secondary }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Secondary' }))
    expect(secondary).toHaveBeenCalledTimes(1)
    expect(primary).not.toHaveBeenCalled()
  })

  it('does not render action section when no actions provided', () => {
    render(<EmptyState title="Empty" description="nothing" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('forwards className and extra HTML props', () => {
    const { container } = render(
      <EmptyState
        title="Empty"
        className="custom-cls"
        data-testid="empty-root"
      />
    )
    expect(screen.getByTestId('empty-root')).toBeInTheDocument()
    expect(container.querySelector('.custom-cls')).toBeInTheDocument()
  })

  // #424 — Layer-7 polymorphism. asChild delegates the outer `.sizer` host to
  // the single child, merging the root class + forwarded className / style
  // onto it, and preserving the child's own semantics.
  it('asChild renders the child element as the root, carrying the root class', () => {
    render(
      <EmptyState
        asChild
        title="Nothing here"
        className="consumer-cls"
        style={{ color: 'rgb(7, 8, 9)' }}
      >
        <section data-testid="empty-root" />
      </EmptyState>
    )
    const root = screen.getByTestId('empty-root')
    expect(root.tagName).toBe('SECTION')
    // The outer `.sizer` host class + forwarded className land on the child.
    expect(root.className).toMatch(/sizer/)
    expect(root).toHaveClass('consumer-cls')
    expect(root).toHaveStyle({ color: 'rgb(7, 8, 9)' })
    // Inner content still renders inside the delegated host.
    expect(root).toHaveTextContent('Nothing here')
  })

  it('has no a11y violations (axe smoke)', async () => {
    const { container } = render(
      <EmptyState
        title="No tasks"
        description="Create your first task to get started"
        action={{ label: 'Create', onClick: () => {} }}
      />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
