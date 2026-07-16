/**
 * ApprovalCard Component Tests
 *
 * Covers the approval workflow card:
 * - Binary mode (regression):
 *   - renders title and description
 *   - renders status badge for each state (pending/approved/rejected)
 *   - renders priority badge when provided
 *   - renders metadata grid (label + value pairs)
 *   - fires onApprove and onReject callbacks via action buttons
 *   - action buttons only render when status=pending AND a handler is provided
 *   - respects custom approve/reject labels
 *   - disabled prop disables both action buttons
 *   - includes axe a11y smoke check
 * - Workflow mode (#95):
 *   - renders a "Take action" trigger instead of approve/reject buttons
 *   - opens the dropdown listing all transitions on click
 *   - fires onTransition with the correct value when an item is picked
 *   - destructive variant gets the destructive class
 *   - description renders as a secondary line
 *   - workflow takes precedence over approve/reject (those don't render)
 *   - keyboard navigation: Enter opens, ArrowDown moves focus, Escape closes
 *   - jest-axe smoke check on workflow mode
 * - Workflow mode fires-once regression (#103):
 *   - onTransition is invoked exactly once per click. ApprovalCard
 *     historically carried a transitionFiringRef workaround for the
 *     Dropdown double-fire bug; the workaround was removed in v0.12.0
 *     (commit 8fb96df), so this test guards against silent regression.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ApprovalCard } from './ApprovalCard'

expect.extend(toHaveNoViolations)

describe('ApprovalCard — binary mode (regression)', () => {
  it('renders title and description', () => {
    render(
      <ApprovalCard
        title="Budget Request #1234"
        description="Q4 marketing campaign budget increase"
      />
    )
    expect(screen.getByText('Budget Request #1234')).toBeInTheDocument()
    expect(
      screen.getByText('Q4 marketing campaign budget increase')
    ).toBeInTheDocument()
  })

  it('renders the correct status badge for each state', () => {
    const { rerender } = render(<ApprovalCard title="T" status="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()

    rerender(<ApprovalCard title="T" status="approved" />)
    expect(screen.getByText('Approved')).toBeInTheDocument()

    rerender(<ApprovalCard title="T" status="rejected" />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('renders priority badge when priority provided', () => {
    // ApprovalCard renders the priority badge with the `dot` prop, which
    // makes Badge render an icon-only dot (no visible text content).
    // Assert on the variant class instead so we still validate that the
    // right priority level is reflected in the DOM.
    const { container, rerender } = render(
      <ApprovalCard title="T" priority="high" />
    )
    // priority=high → Badge variant=danger + dot
    expect(
      container.querySelector('[class*="danger"][class*="dot"]')
    ).not.toBeNull()

    rerender(<ApprovalCard title="T" priority="medium" />)
    expect(
      container.querySelector('[class*="warning"][class*="dot"]')
    ).not.toBeNull()

    rerender(<ApprovalCard title="T" priority="low" />)
    expect(
      container.querySelector('[class*="info"][class*="dot"]')
    ).not.toBeNull()

    // When priority is omitted, no dot badge is rendered
    rerender(<ApprovalCard title="T" />)
    expect(container.querySelector('[class*="dot"]')).toBeNull()
  })

  it('renders metadata grid with label and value', () => {
    render(
      <ApprovalCard
        title="T"
        metadata={[
          { label: 'Amount', value: '$50,000' },
          { label: 'Submitted', value: '2 days ago' },
        ]}
      />
    )
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.getByText('$50,000')).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
  })

  it('fires onApprove callback when approve button clicked', () => {
    const onApprove = vi.fn()
    render(
      <ApprovalCard title="T" status="pending" onApprove={onApprove} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  it('fires onReject callback when reject button clicked', () => {
    const onReject = vi.fn()
    render(
      <ApprovalCard title="T" status="pending" onReject={onReject} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('does not render action buttons when status is not pending', () => {
    render(
      <ApprovalCard
        title="T"
        status="approved"
        onApprove={() => {}}
        onReject={() => {}}
      />
    )
    expect(
      screen.queryByRole('button', { name: 'Approve' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reject' })
    ).not.toBeInTheDocument()
  })

  it('respects custom approve/reject labels', () => {
    render(
      <ApprovalCard
        title="T"
        status="pending"
        onApprove={() => {}}
        onReject={() => {}}
        approveLabel="Confirm"
        rejectLabel="Cancel"
      />
    )
    expect(
      screen.getByRole('button', { name: 'Confirm' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('disables both action buttons when disabled prop is true', () => {
    render(
      <ApprovalCard
        title="T"
        status="pending"
        onApprove={() => {}}
        onReject={() => {}}
        disabled
      />
    )
    const approve = screen.getByRole('button', {
      name: 'Approve',
    }) as HTMLButtonElement
    const reject = screen.getByRole('button', {
      name: 'Reject',
    }) as HTMLButtonElement
    expect(approve.disabled).toBe(true)
    expect(reject.disabled).toBe(true)
  })

  it('has no axe violations', async () => {
    const { container } = render(
      <ApprovalCard
        title="Budget Request"
        description="Approve or reject this budget"
        status="pending"
        priority="high"
        metadata={[{ label: 'Amount', value: '$50,000' }]}
        onApprove={() => {}}
        onReject={() => {}}
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

/**
 * Workflow mode tests — issue #95.
 *
 * The DS Dropdown uses a portal + rAF positioning. We use fake timers and
 * advance them after click so the menu is fully positioned + visible before
 * we assert on its contents (mirrors the pattern from Dropdown.test.tsx).
 */
describe('ApprovalCard — workflow mode (#95)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
  })

  function flushRaf(times = 3) {
    for (let i = 0; i < times; i++) {
      act(() => {
        vi.advanceTimersByTime(16)
      })
    }
  }

  const transitions = [
    {
      value: 'revision',
      label: 'Send back for revision',
      description: 'Author will revise',
    },
    {
      value: 'second_review',
      label: 'Promote to second review',
      description: 'Senior editor will review',
    },
    {
      value: 'killed',
      label: 'Kill the story',
      description: 'Will not publish',
      variant: 'danger' as const,
    },
  ]

  it('renders a "Take action" trigger instead of approve/reject buttons', () => {
    render(
      <ApprovalCard
        title="The morning investigation"
        status="pending"
        workflow={{ transitions, onTransition: () => {} }}
      />
    )
    // The trigger renders with the default label
    expect(
      screen.getByRole('button', { name: /Take action on/i })
    ).toBeInTheDocument()
    // The binary buttons are NOT rendered
    expect(
      screen.queryByRole('button', { name: 'Approve' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reject' })
    ).not.toBeInTheDocument()
  })

  it('respects a custom triggerLabel', () => {
    render(
      <ApprovalCard
        title="X"
        workflow={{
          transitions,
          onTransition: () => {},
          triggerLabel: 'Choose status',
        }}
      />
    )
    expect(
      screen.getByRole('button', { name: /Choose status on/i })
    ).toBeInTheDocument()
  })

  it('opens the dropdown listing all transitions on click', () => {
    render(
      <ApprovalCard
        title="The morning investigation"
        workflow={{ transitions, onTransition: () => {} }}
      />
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Take action on/i })
    )
    flushRaf()

    expect(screen.getByText('Send back for revision')).toBeInTheDocument()
    expect(screen.getByText('Promote to second review')).toBeInTheDocument()
    expect(screen.getByText('Kill the story')).toBeInTheDocument()
  })

  it('renders descriptions as secondary text inside each menu item', () => {
    render(
      <ApprovalCard
        title="X"
        workflow={{ transitions, onTransition: () => {} }}
      />
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Take action on/i })
    )
    flushRaf()

    expect(screen.getByText('Author will revise')).toBeInTheDocument()
    expect(screen.getByText('Senior editor will review')).toBeInTheDocument()
    expect(screen.getByText('Will not publish')).toBeInTheDocument()
  })

  it('fires onTransition with the correct value when a menu item is clicked', () => {
    const onTransition = vi.fn()
    render(
      <ApprovalCard
        title="X"
        workflow={{ transitions, onTransition }}
      />
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Take action on/i })
    )
    flushRaf()

    fireEvent.click(screen.getByText('Promote to second review'))
    expect(onTransition).toHaveBeenCalledTimes(1)
    expect(onTransition).toHaveBeenCalledWith('second_review')
  })

  it("applies destructive styling to transitions with variant: 'danger'", () => {
    render(
      <ApprovalCard
        title="X"
        workflow={{ transitions, onTransition: () => {} }}
      />
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Take action on/i })
    )
    flushRaf()

    // Find the menuitem button whose label is "Kill the story". The
    // DropdownItem applies the hashed `destructive` class to the button.
    const killItem = screen
      .getByText('Kill the story')
      .closest('button[role="menuitem"]')
    expect(killItem).not.toBeNull()
    expect(killItem!.className).toMatch(/destructive/)
  })

  it('does NOT render approve/reject buttons even if those handlers are also passed', () => {
    // Suppress the dev-only console.warn for the mutually-exclusive case.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <ApprovalCard
        title="X"
        status="pending"
        onApprove={() => {}}
        onReject={() => {}}
        workflow={{ transitions, onTransition: () => {} }}
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Approve' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reject' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Take action on/i })
    ).toBeInTheDocument()

    warnSpy.mockRestore()
  })

  it('warns in dev when both workflow and approve/reject handlers are provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <ApprovalCard
        title="X"
        onApprove={() => {}}
        workflow={{ transitions, onTransition: () => {} }}
      />
    )

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]![0]).toMatch(/mutually exclusive/i) // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present

    warnSpy.mockRestore()
  })

  it('disables the workflow trigger when disabled prop is set', () => {
    render(
      <ApprovalCard
        title="X"
        disabled
        workflow={{ transitions, onTransition: () => {} }}
      />
    )
    const trigger = screen.getByRole('button', {
      name: /Take action on/i,
    }) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
  })

  it('keyboard nav: trigger opens menu with tabbable items, Escape closes', () => {
    render(
      <ApprovalCard
        title="X"
        workflow={{ transitions, onTransition: () => {} }}
      />
    )
    const trigger = screen.getByRole('button', {
      name: /Take action on/i,
    })

    // Native <button> handles Enter/Space via the browser by dispatching a
    // synthetic click — fire click directly since that's the post-Enter
    // outcome we care about. The goal here is to verify the menu opens and
    // its items are reachable via the keyboard once open.
    fireEvent.click(trigger)
    flushRaf()

    // After opening, all transitions render as menuitems with tabIndex=0,
    // so the focus-trap inside Dropdown can rotate through them via Tab/
    // Shift+Tab. (DS Dropdown uses useFocusTrap; ArrowUp/ArrowDown are
    // not bound at this layer — Tab is the keyboard contract.)
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems).toHaveLength(3)
    menuItems.forEach((item) => {
      expect(item.getAttribute('tabindex')).toBe('0')
    })

    // Escape closes the menu — Dropdown listens at the document level via
    // useKeyPress, so dispatch keydown on document.
    fireEvent.keyDown(document, { key: 'Escape' })
    flushRaf()

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('fires onTransition exactly once per click (#103 regression)', () => {
    // Explicit guard for the v0.12.0 Dropdown double-fire fix. The
    // transitionFiringRef workaround that previously dedup'd these calls
    // has been removed; if Dropdown regresses we want this to fail here.
    const onTransition = vi.fn()
    render(
      <ApprovalCard
        title="The morning investigation"
        workflow={{ transitions, onTransition }}
      />
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Take action on/i })
    )
    flushRaf()

    fireEvent.click(screen.getByText('Send back for revision'))
    expect(onTransition).toHaveBeenCalledTimes(1)
    expect(onTransition).toHaveBeenCalledWith('revision')
  })

  it('has no axe violations in workflow mode (closed menu)', async () => {
    // jest-axe relies on real timers (its internal scheduling uses microtask
    // / setTimeout queues). Restore real timers for this assertion, then
    // re-enable fake timers before the suite's afterEach runs (which expects
    // fake timers).
    vi.useRealTimers()
    const { container } = render(
      <ApprovalCard
        title="The morning investigation"
        description="Lead story"
        status="pending"
        priority="high"
        metadata={[{ label: 'Editor', value: 'JD' }]}
        workflow={{ transitions, onTransition: () => {} }}
      />
    )
    try {
      expect(await axe(container)).toHaveNoViolations()
    } finally {
      vi.useFakeTimers()
    }
  })
})

describe('ApprovalCard — consumer passthrough (#422)', () => {
  it('lands consumer data-testid on the Card visual root', () => {
    render(
      <ApprovalCard
        title="Budget Request"
        status="pending"
        data-testid="approval-root"
      />,
    )
    const el = screen.getByTestId('approval-root')
    expect(el.tagName).toBe('DIV')
    // root is the outermost Card element — the title lives inside it
    expect(el).toContainElement(screen.getByText('Budget Request'))
  })

  it('applies consumer style to the Card visual root', () => {
    render(
      <ApprovalCard
        title="Budget Request"
        status="pending"
        data-testid="approval-root"
        style={{ color: 'rgb(1, 2, 3)' }}
      />,
    )
    expect(screen.getByTestId('approval-root')).toHaveStyle({
      color: 'rgb(1, 2, 3)',
    })
  })
})

describe('ApprovalCard — polymorphism (#424)', () => {
  // asChild delegates the card root to the consumer's single child, merging
  // the card class + forwarded props onto it, while the ApprovalCard's
  // structured content renders inside.
  it('asChild renders the child element as the root, carrying the card class', () => {
    render(
      <ApprovalCard
        asChild
        title="Delegated request"
        status="pending"
        className="consumer-cls"
        style={{ color: 'rgb(25, 26, 27)' }}
      >
        <article data-testid="approval-root" />
      </ApprovalCard>,
    )
    const root = screen.getByTestId('approval-root')
    // Root is the consumer's <article>, not a wrapper <div>.
    expect(root.tagName).toBe('ARTICLE')
    expect(root.className).toMatch(/card/)
    expect(root).toHaveClass('consumer-cls')
    expect(root).toHaveStyle({ color: 'rgb(25, 26, 27)' })
    // Structured content renders inside the delegated root.
    expect(root).toContainElement(screen.getByText('Delegated request'))
  })
})
