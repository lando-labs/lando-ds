/**
 * Timeline Component Tests
 *
 * Smoke + behavioral coverage for Timeline + Timeline.Item + Timeline.Group
 * including status coloring, nesting, expandable toggle behavior (click +
 * keyboard), loading, empty state, and jest-axe a11y.
 *
 * v0.9.0 adds activity-feed mode coverage: icon/title/actor slots, Date
 * timestamp formatting, formatTimestamp override, variant->status mapping,
 * and parity between flat <TimelineItem> and compound <Timeline.Item>.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { Timeline, TimelineItem, TimelineGroup } from './Timeline'

describe('Timeline', () => {
  it('renders children items inside an <ol>', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item timestamp="09:00">First</Timeline.Item>
        <Timeline.Item timestamp="09:01">Second</Timeline.Item>
      </Timeline>
    )

    const list = container.querySelector('ol')
    expect(list).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('09:00').tagName.toLowerCase()).toBe('time')
  })

  it('applies status class to items', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item status="success">done</Timeline.Item>
        <Timeline.Item status="error">oops</Timeline.Item>
      </Timeline>
    )

    const items = container.querySelectorAll('li')
    // CSS Modules hash class names — use substring match.
    expect(items[0]?.className).toMatch(/status-success/)
    expect(items[1]?.className).toMatch(/status-error/)
  })

  it('renders nested groups as a second <ol>', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item timestamp="09:00">
          Parent
          <Timeline.Group>
            <Timeline.Item timestamp="09:00.1">Child</Timeline.Item>
          </Timeline.Group>
        </Timeline.Item>
      </Timeline>
    )

    const lists = container.querySelectorAll('ol')
    expect(lists).toHaveLength(2)
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('expandable item renders a toggle button with aria-expanded', () => {
    render(
      <Timeline>
        <Timeline.Item timestamp="09:00" expandable>
          Expandable row
        </Timeline.Item>
      </Timeline>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles aria-expanded on click', async () => {
    const user = userEvent.setup()
    render(
      <Timeline>
        <Timeline.Item timestamp="09:00" expandable>
          Row
          <Timeline.Group>
            <Timeline.Item>Nested</Timeline.Item>
          </Timeline.Group>
        </Timeline.Item>
      </Timeline>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Nested')).not.toBeInTheDocument()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Nested')).toBeInTheDocument()
  })

  it('keyboard Space toggles expanded state', async () => {
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    render(
      <Timeline>
        <Timeline.Item expandable onExpandedChange={onExpandedChange}>
          Row
        </Timeline.Item>
      </Timeline>
    )

    const button = screen.getByRole('button')
    button.focus()
    await user.keyboard(' ')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(onExpandedChange).toHaveBeenCalledWith(true)
  })

  it('respects defaultExpanded for uncontrolled expand', () => {
    render(
      <Timeline>
        <Timeline.Item expandable defaultExpanded>
          Row
          <Timeline.Group>
            <Timeline.Item>Nested</Timeline.Item>
          </Timeline.Group>
        </Timeline.Item>
      </Timeline>
    )

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Nested')).toBeInTheDocument()
  })

  it('honors controlled expanded prop', async () => {
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    const { rerender } = render(
      <Timeline>
        <Timeline.Item expandable expanded={false} onExpandedChange={onExpandedChange}>
          Row
        </Timeline.Item>
      </Timeline>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')

    // Click fires callback but does NOT mutate internal state in controlled mode.
    await user.click(button)
    expect(onExpandedChange).toHaveBeenCalledWith(true)
    expect(button).toHaveAttribute('aria-expanded', 'false')

    // Parent-driven update flips the state.
    rerender(
      <Timeline>
        <Timeline.Item expandable expanded={true} onExpandedChange={onExpandedChange}>
          Row
        </Timeline.Item>
      </Timeline>
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders emptyState when no children are provided', () => {
    render(<Timeline emptyState={<span>No events</span>} />)
    expect(screen.getByText('No events')).toBeInTheDocument()
  })

  it('renders loading state with aria-busy', () => {
    const { container } = render(<Timeline loading />)
    const list = container.querySelector('ol')
    expect(list).toHaveAttribute('aria-busy', 'true')
    // 3 skeleton rows
    expect(container.querySelectorAll('li')).toHaveLength(3)
  })

  it('supports named imports (TimelineItem, TimelineGroup) equivalent to compound syntax', () => {
    render(
      <Timeline>
        <TimelineItem timestamp="09:00" status="info">
          Parent
          <TimelineGroup>
            <TimelineItem status="success">Child</TimelineItem>
          </TimelineGroup>
        </TimelineItem>
      </Timeline>
    )
    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('has no a11y violations', async () => {
    const { container } = render(
      <Timeline aria-label="Session trace">
        <Timeline.Item timestamp="09:42:01" status="success">
          Request started
        </Timeline.Item>
        <Timeline.Item timestamp="09:42:02" status="info" expandable>
          Tool call: search
          <Timeline.Group>
            <Timeline.Item timestamp="09:42:02.1" status="info">
              Fetched 42 results
            </Timeline.Item>
          </Timeline.Group>
        </Timeline.Item>
        <Timeline.Item timestamp="09:42:03" status="error">
          Error: timeout
        </Timeline.Item>
      </Timeline>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  /* ==========================================================================
     Activity-feed mode (v0.9.0 — issue #92)
     ========================================================================== */

  describe('activity-feed mode', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders icon, title, actor, and body when all slots are provided', () => {
      const { container } = render(
        <Timeline>
          <TimelineItem
            icon={<svg data-testid="activity-icon" />}
            timestamp="2 minutes ago"
            title="Story moved to Editor Review"
            actor="claude-opus-4-7"
          >
            The investigator agent completed the draft.
          </TimelineItem>
        </Timeline>
      )

      expect(screen.getByTestId('activity-icon')).toBeInTheDocument()
      expect(screen.getByText('Story moved to Editor Review')).toBeInTheDocument()
      expect(screen.getByText('by claude-opus-4-7')).toBeInTheDocument()
      expect(
        screen.getByText('The investigator agent completed the draft.')
      ).toBeInTheDocument()

      // Item should be flagged as having an icon (drives bezel CSS).
      const item = container.querySelector('li')
      expect(item?.className).toMatch(/hasIcon/)
    })

    it('formats a recent Date timestamp as relative time', () => {
      // Freeze "now" so Intl.RelativeTimeFormat output is deterministic.
      const fakeNow = new Date('2026-04-25T14:30:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(fakeNow)

      const fiveMinutesAgo = new Date(fakeNow.getTime() - 5 * 60 * 1000)

      render(
        <Timeline>
          <TimelineItem timestamp={fiveMinutesAgo} title="Saved draft" />
        </Timeline>
      )

      const time = screen.getByText('Saved draft').parentElement?.querySelector('time')
      expect(time).not.toBeNull()
      // Intl.RelativeTimeFormat('en', { numeric: 'auto' }) renders this
      // as "5 minutes ago" (numeric:auto only swaps to "yesterday"/"now"
      // for boundary values, not arbitrary minute counts).
      expect(time?.textContent).toMatch(/5 minutes ago/i)
    })

    it('formats an older Date timestamp as absolute date', () => {
      const fakeNow = new Date('2026-04-25T14:30:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(fakeNow)

      // 30 days ago -> falls outside relative window -> absolute format.
      const longAgo = new Date(fakeNow.getTime() - 30 * 24 * 60 * 60 * 1000)

      render(
        <Timeline>
          <TimelineItem timestamp={longAgo} title="Archived" />
        </Timeline>
      )

      const time = screen.getByText('Archived').parentElement?.querySelector('time')
      expect(time).not.toBeNull()
      // Absolute format includes a 4-digit year — the relative format
      // never does, so this is a clean discriminator.
      expect(time?.textContent).toMatch(/\d{4}/)
      // And does NOT include the relative "ago" suffix.
      expect(time?.textContent).not.toMatch(/ago/i)
    })

    it('uses formatTimestamp override when provided', () => {
      const formatTimestamp = vi.fn(
        (d: Date) => `custom:${d.toISOString().slice(0, 10)}`
      )
      const date = new Date('2026-04-25T14:30:00Z')

      render(
        <Timeline>
          <TimelineItem
            timestamp={date}
            title="Override"
            formatTimestamp={formatTimestamp}
          />
        </Timeline>
      )

      expect(formatTimestamp).toHaveBeenCalledTimes(1)
      expect(formatTimestamp).toHaveBeenCalledWith(date)
      expect(screen.getByText('custom:2026-04-25')).toBeInTheDocument()
    })

    it('maps variant="success" to the same status-success class as status="success"', () => {
      const { container } = render(
        <Timeline>
          <TimelineItem variant="success" title="Approved" />
          <TimelineItem status="success" title="Approved (status)" />
          <TimelineItem variant="neutral" title="Default" />
        </Timeline>
      )

      const items = container.querySelectorAll('li')
      // Both variant="success" and status="success" should resolve to the
      // same hashed `status-success` class.
      expect(items[0]?.className).toMatch(/status-success/)
      expect(items[1]?.className).toMatch(/status-success/)
      // variant="neutral" maps to status-default.
      expect(items[2]?.className).toMatch(/status-default/)
    })

    it('flat <TimelineItem> activity-feed render is identical to <Timeline.Item> compound render', () => {
      const date = new Date('2026-04-25T14:30:00Z')
      const formatTimestamp = (d: Date) => d.toISOString()

      const Flat = () => (
        <Timeline>
          <TimelineItem
            icon={<svg data-testid="flat-icon" />}
            timestamp={date}
            formatTimestamp={formatTimestamp}
            title="Flat title"
            actor="agent-a"
            variant="success"
          >
            Body text
          </TimelineItem>
        </Timeline>
      )

      const Compound = () => (
        <Timeline>
          <Timeline.Item
            icon={<svg data-testid="compound-icon" />}
            timestamp={date}
            formatTimestamp={formatTimestamp}
            title="Flat title"
            actor="agent-a"
            variant="success"
          >
            Body text
          </Timeline.Item>
        </Timeline>
      )

      const flatRender = render(<Flat />)
      const flatHtml = flatRender.container.innerHTML.replace(
        /flat-icon/g,
        'icon'
      )
      flatRender.unmount()

      const compoundRender = render(<Compound />)
      const compoundHtml = compoundRender.container.innerHTML.replace(
        /compound-icon/g,
        'icon'
      )

      expect(flatHtml).toBe(compoundHtml)
    })

    it('has no a11y violations in activity-feed mode', async () => {
      // No fake timers here — jest-axe's async work needs real timers
      // to complete. We use string timestamps so the test stays
      // deterministic without freezing time.
      const { container } = render(
        <Timeline aria-label="Activity feed">
          <TimelineItem
            icon={<svg aria-hidden="true" />}
            timestamp="2 minutes ago"
            title="Story moved to Editor Review"
            actor="claude-opus-4-7"
          >
            The investigator agent completed the draft.
          </TimelineItem>
          <TimelineItem
            icon={<svg aria-hidden="true" />}
            timestamp="1 minute ago"
            title="Approved by editor"
            actor="user@example.com"
            variant="success"
          />
        </Timeline>
      )

      expect(await axe(container)).toHaveNoViolations()
    })
  })
})

describe('TimelineItem / TimelineGroup — consumer passthrough (#422, regression)', () => {
  it('lands consumer data-testid + style on the TimelineItem <li> root', () => {
    render(
      <Timeline>
        <TimelineItem
          timestamp="09:42:01"
          data-testid="tl-item"
          style={{ color: 'rgb(1, 2, 3)' }}
        >
          Body
        </TimelineItem>
      </Timeline>,
    )
    const el = screen.getByTestId('tl-item')
    expect(el.tagName).toBe('LI')
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('lands consumer data-testid + style on the TimelineGroup <ol> root', () => {
    render(
      <Timeline>
        <TimelineGroup data-testid="tl-group" style={{ color: 'rgb(1, 2, 3)' }}>
          <TimelineItem timestamp="09:42:02">Nested</TimelineItem>
        </TimelineGroup>
      </Timeline>,
    )
    const el = screen.getByTestId('tl-group')
    expect(el.tagName).toBe('OL')
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })
})
