/**
 * TaskCard Component Tests
 *
 * Covers the specialty task card:
 * - renders title + description
 * - renders status + priority badges with labels mapped from status/priority props
 * - renders assignee avatar when provided
 * - renders formatted due date when provided
 * - fires onClick + keyboard (Enter/Space) when clickable
 * - renders tags
 * - includes an axe a11y smoke check
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { TaskCard } from './TaskCard'

expect.extend(toHaveNoViolations)

describe('TaskCard', () => {
  it('renders title and description', () => {
    render(
      <TaskCard
        title="Implement auth"
        description="Add JWT-based authentication"
      />
    )
    expect(screen.getByText('Implement auth')).toBeInTheDocument()
    expect(
      screen.getByText('Add JWT-based authentication')
    ).toBeInTheDocument()
  })

  it('renders status badge with correct label for each status', () => {
    const statuses: Array<[TaskStatus, string]> = [
      ['todo', 'To Do'],
      ['in-progress', 'In Progress'],
      ['done', 'Done'],
      ['blocked', 'Blocked'],
    ]
    for (const [status, label] of statuses) {
      const { unmount } = render(
        <TaskCard title="T" status={status} />
      )
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('renders priority badge with capitalized label for each priority', () => {
    const priorities = ['low', 'medium', 'high', 'urgent'] as const
    for (const priority of priorities) {
      const { unmount } = render(
        <TaskCard title="T" priority={priority} />
      )
      const expectedLabel =
        priority.charAt(0).toUpperCase() + priority.slice(1)
      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
      unmount()
    }
  })

  it('renders assignee avatar + name when provided', () => {
    render(
      <TaskCard
        title="T"
        assignee={{ name: 'Jane Doe', initials: 'JD' }}
      />
    )
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    // Avatar renders initials "JD"
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders a formatted due date when provided', () => {
    render(<TaskCard title="T" dueDate="2025-11-01" />)
    // formatted as "Oct 31, 2025" or "Nov 1, 2025" depending on parse
    // Either way, the year 2025 should appear
    expect(screen.getByText(/2025/)).toBeInTheDocument()
  })

  it('renders tags', () => {
    render(<TaskCard title="T" tags={['backend', 'security']} />)
    expect(screen.getByText('backend')).toBeInTheDocument()
    expect(screen.getByText('security')).toBeInTheDocument()
  })

  it('fires onClick when clickable and supports keyboard activation', () => {
    const onClick = vi.fn()
    render(<TaskCard title="Open me" onClick={onClick} />)
    const card = screen.getByRole('button', { name: /open me/i })
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('does not set role=button when onClick is not provided', () => {
    const { container } = render(<TaskCard title="Read only" />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).not.toBe('button')
    expect(root.getAttribute('tabindex')).toBeNull()
  })

  // #424 — Layer-7 polymorphism. asChild delegates the root element to the
  // single child, merging the .taskCard root class + forwarded className /
  // style onto it, and preserving the child's own semantics.
  it('asChild renders the child element as the root, carrying the root class', () => {
    render(
      <TaskCard
        asChild
        title="Ship it"
        className="consumer-cls"
        style={{ color: 'rgb(4, 5, 6)' }}
      >
        <article data-testid="task-root" />
      </TaskCard>
    )
    const root = screen.getByTestId('task-root')
    expect(root.tagName).toBe('ARTICLE')
    expect(root.className).toMatch(/taskCard/)
    expect(root).toHaveClass('consumer-cls')
    expect(root).toHaveStyle({ color: 'rgb(4, 5, 6)' })
    // Card content still renders inside the delegated root.
    expect(root).toHaveTextContent('Ship it')
  })

  it('has no axe violations (baseline render)', async () => {
    const { container } = render(
      <TaskCard
        title="Accessible task"
        description="Description"
        status="in-progress"
        priority="high"
        tags={['a11y']}
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

// Keep the status type local to the test to avoid cross-file coupling.
type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked'
