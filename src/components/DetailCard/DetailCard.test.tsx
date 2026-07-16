/**
 * DetailCard Component Tests
 *
 * Covers the generic detail card:
 * - renders title + subtitle + icon
 * - renders description
 * - renders fields (label/value pairs) including React node values
 * - renders prominent date section
 * - renders badges slot
 * - renders actions footer
 * - clickable mode (via onClick or clickable prop) wires role=button + keyboard
 * - size prop applies CSS class
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetailCard } from './DetailCard'

function classAttr(el: Element | null): string {
  if (!el) return ''
  return el.getAttribute('class') ?? ''
}

describe('DetailCard', () => {
  it('renders title, subtitle, and icon', () => {
    render(
      <DetailCard
        title="Project Milestone"
        subtitle="Q4 Release"
        icon={<span data-testid="header-icon">*</span>}
      />
    )
    expect(screen.getByText('Project Milestone')).toBeInTheDocument()
    expect(screen.getByText('Q4 Release')).toBeInTheDocument()
    expect(screen.getByTestId('header-icon')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(
      <DetailCard title="T" description="Complete feature development phase" />
    )
    expect(
      screen.getByText('Complete feature development phase')
    ).toBeInTheDocument()
  })

  it('renders string fields as label/value pairs', () => {
    render(
      <DetailCard
        title="T"
        fields={[
          { label: 'Owner', value: 'Sarah Chen' },
          { label: 'Budget', value: '$125,000' },
        ]}
      />
    )
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('$125,000')).toBeInTheDocument()
  })

  it('renders React node field values', () => {
    render(
      <DetailCard
        title="T"
        fields={[
          {
            label: 'Status',
            value: <span data-testid="status-node">On Track</span>,
          },
        ]}
      />
    )
    expect(screen.getByTestId('status-node')).toBeInTheDocument()
  })

  it('renders the prominent date section', () => {
    render(
      <DetailCard
        title="T"
        date={{ label: 'Due Date', value: 'Dec 15, 2024' }}
      />
    )
    expect(screen.getByText('Due Date')).toBeInTheDocument()
    expect(screen.getByText('Dec 15, 2024')).toBeInTheDocument()
  })

  it('renders badges in the header', () => {
    render(
      <DetailCard
        title="T"
        badges={[<span key="a" data-testid="badge-a">Active</span>]}
      />
    )
    expect(screen.getByTestId('badge-a')).toBeInTheDocument()
  })

  it('renders actions in the footer', () => {
    render(
      <DetailCard
        title="T"
        actions={<button>Edit</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('exposes role=button and tabIndex=0 when onClick is provided', () => {
    render(<DetailCard title="Open me" onClick={() => {}} />)
    const card = screen.getByRole('button')
    expect(card.getAttribute('tabindex')).toBe('0')
  })

  it('activates onClick via keyboard (Enter and Space)', () => {
    const onClick = vi.fn()
    render(<DetailCard title="Open me" onClick={onClick} />)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(card, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('activates onClick via mouse click (#75 regression)', () => {
    // Regression for #75 — DetailCard previously dropped mouse clicks
    // because it forwarded onClick through <Card> without flipping Card's
    // internal `clickable` prop. Fix: DetailCard now passes `clickable`
    // through when isClickable is true, so Card renders a <button> and
    // wires the handler.
    const onClick = vi.fn()
    render(<DetailCard title="Open me" onClick={onClick} />)
    const card = screen.getByRole('button')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies size class (size-sm/md/lg/xl)', () => {
    const { container } = render(<DetailCard title="T" size="xl" />)
    // The Card is the outer element — size class is applied to the Card
    // Look for any element with a class containing size-xl
    const sized = container.querySelector('[class*="size-xl"]')
    expect(sized).not.toBeNull()
    expect(classAttr(sized)).toMatch(/size-xl/)
  })

  // #423 — rest-prop passthrough + style. DetailCard's props now extend
  // HTMLAttributes, so consumer data-* / id / style land on the visual root.
  it('forwards rest HTML attributes and style to the card root', () => {
    render(
      <DetailCard
        title="Milestone"
        data-testid="detail-root"
        id="milestone-1"
        style={{ color: 'rgb(19, 20, 21)' }}
      />
    )
    const root = screen.getByTestId('detail-root')
    expect(root).toHaveAttribute('id', 'milestone-1')
    expect(root).toHaveStyle({ color: 'rgb(19, 20, 21)' })
    expect(classAttr(root)).toMatch(/card/)
  })

  // #424 — Layer-7 polymorphism. asChild delegates the card root to the
  // consumer's single child, merging the card class + forwarded props onto it,
  // while the DetailCard's structured content renders inside.
  it('asChild renders the child element as the root, carrying the card class', () => {
    render(
      <DetailCard
        asChild
        title="Delegated milestone"
        subtitle="Q4"
        className="consumer-cls"
        style={{ color: 'rgb(22, 23, 24)' }}
      >
        <article data-testid="detail-root" />
      </DetailCard>
    )
    const root = screen.getByTestId('detail-root')
    // Root is the consumer's <article>.
    expect(root.tagName).toBe('ARTICLE')
    // Card base class + DetailCard class both land on it.
    expect(classAttr(root)).toMatch(/card/)
    expect(root).toHaveClass('consumer-cls')
    expect(root).toHaveStyle({ color: 'rgb(22, 23, 24)' })
    // Structured content renders inside the delegated root.
    expect(root).toHaveTextContent('Delegated milestone')
    expect(root).toHaveTextContent('Q4')
  })
})
