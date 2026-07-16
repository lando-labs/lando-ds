/**
 * StatCard Component Tests
 *
 * Covers:
 *  - Basic rendering of label/value
 *  - subtitle prop renders below the value (#32)
 *  - subtitle + trend coexist (stacked) (#32)
 *  - Existing consumers without subtitle are unaffected (backward compat)
 *  - Loading state honors subtitle presence
 *  - subtitle accepts ReactNode, not only string
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Users" value="1,234" />)
    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('renders subtitle below the value when provided (#32)', () => {
    // Issue #32: a consumer app needed a contextual subtitle to explain a
    // surprising zero ("all events from Claude Code root").
    render(
      <StatCard
        label="Active Agents"
        value={0}
        subtitle="all events from Claude Code root"
      />
    )
    expect(screen.getByText('Active Agents')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(
      screen.getByText('all events from Claude Code root')
    ).toBeInTheDocument()
  })

  it('omits subtitle element when subtitle prop is not provided (backward compat)', () => {
    // Existing StatCard consumers (no subtitle prop) must render
    // exactly as before — no extra empty nodes.
    const { container } = render(<StatCard label="Users" value={42} />)
    // No subtitle class should be present in the tree
    expect(container.querySelector('[class*="subtitle"]')).toBeNull()
  })

  it('renders subtitle AND trend simultaneously (#32)', () => {
    // The whole point of the new prop: subtitle and trend must coexist
    // so consumers aren't forced to abuse trendLabel as a subtitle
    // carrier.
    render(
      <StatCard
        label="Revenue"
        value="$12.4k"
        subtitle="excluding refunds"
        trend={{ value: 8.2, direction: 'up' }}
        trendLabel="vs last month"
      />
    )
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$12.4k')).toBeInTheDocument()
    expect(screen.getByText('excluding refunds')).toBeInTheDocument()
    // Trend percentage
    expect(screen.getByText('8.2%')).toBeInTheDocument()
    expect(screen.getByText('vs last month')).toBeInTheDocument()
  })

  it('accepts ReactNode subtitle, not just string', () => {
    render(
      <StatCard
        label="Users"
        value={42}
        subtitle={
          <span data-testid="rich-subtitle">
            <strong>42</strong> active
          </span>
        }
      />
    )
    expect(screen.getByTestId('rich-subtitle')).toBeInTheDocument()
  })

  it('renders subtitle skeleton row in loading state when subtitle is set', () => {
    // Loading state must reserve space for the subtitle so the card
    // does not pop in height when data arrives.
    const { container } = render(
      <StatCard label="Users" value={0} subtitle="subtitle text" loading />
    )
    // Skeleton components render with aria-busy="true" on each row.
    const skeletons = container.querySelectorAll('[aria-busy="true"]')
    // label skeleton + value skeleton + subtitle skeleton = 3
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('loading state without subtitle renders only label + value skeletons', () => {
    const { container } = render(
      <StatCard label="Users" value={0} loading />
    )
    const skeletons = container.querySelectorAll('[aria-busy="true"]')
    // label skeleton + value skeleton = 2 (no subtitle, no trend)
    expect(skeletons.length).toBe(2)
  })

  it('renders value as 0 correctly (regression for the consumer use case)', () => {
    // The original bug report: `value={0}` with a subtitle explanation.
    render(
      <StatCard
        label="Active Agents"
        value={0}
        subtitle="0 sub-agents (all events from Claude Code root)"
      />
    )
    // Value "0" must render — not fall through to falsy rendering.
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(
      screen.getByText('0 sub-agents (all events from Claude Code root)')
    ).toBeInTheDocument()
  })

  // #424 — Layer-7 polymorphism. asChild delegates the root element to the
  // single child, merging the .statCard root class + forwarded className /
  // style onto it, and preserving the child's own semantics.
  it('asChild renders the child element as the root, carrying the root class', () => {
    render(
      <StatCard
        asChild
        label="Total Users"
        value="1,234"
        className="consumer-cls"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <article data-testid="stat-root" />
      </StatCard>
    )
    const root = screen.getByTestId('stat-root')
    // Root is the consumer's <article>, not a wrapper <div>.
    expect(root.tagName).toBe('ARTICLE')
    // Primary module class + forwarded className both land on it.
    expect(root.className).toMatch(/statCard/)
    expect(root).toHaveClass('consumer-cls')
    // Forwarded inline style lands on the child.
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    // Content still renders inside the delegated root.
    expect(root).toHaveTextContent('Total Users')
    expect(root).toHaveTextContent('1,234')
  })

  it('default (no asChild) still renders a div root', () => {
    const { container } = render(<StatCard label="Users" value={42} />)
    const root = container.querySelector('[class*="statCard"]')
    expect(root?.tagName).toBe('DIV')
  })

  // #467 — trend color (sentiment) is decoupled from arrow direction so an
  // inverted metric (refund rate, churn, error rate…) can render a rising
  // number in the error color. Default behavior (color derived from direction)
  // is preserved for existing consumers.
  describe('trend sentiment (#467)', () => {
    it('default up trend keeps the positive/success color (backward compat)', () => {
      const { container } = render(
        <StatCard
          label="Revenue"
          value="$12.4k"
          trend={{ value: 8.2, direction: 'up' }}
        />
      )
      const pill = container.querySelector('[class*="trend-positive"]')
      expect(pill).not.toBeNull()
      // Sentiment is derived from direction and surfaced as a stable hook.
      expect(pill).toHaveAttribute('data-sentiment', 'positive')
      expect(pill).toHaveAttribute('data-direction', 'up')
      // The negative (error) color is NOT applied.
      expect(container.querySelector('[class*="trend-negative"]')).toBeNull()
    })

    it('default down trend keeps the negative/error color (backward compat)', () => {
      const { container } = render(
        <StatCard
          label="Active"
          value="42"
          trend={{ value: 3.1, direction: 'down' }}
        />
      )
      const pill = container.querySelector('[class*="trend-negative"]')
      expect(pill).not.toBeNull()
      expect(pill).toHaveAttribute('data-sentiment', 'negative')
      expect(pill).toHaveAttribute('data-direction', 'down')
      expect(container.querySelector('[class*="trend-positive"]')).toBeNull()
    })

    it('inverted metric: up direction + negative sentiment renders an up-arrow in the negative/error color', () => {
      // Refund Rate: the number went UP (true up-arrow) but that is BAD, so the
      // pill must read in the error color — the exact case that forced five
      // independent consumers to abandon the built-in `trend` prop.
      const { container } = render(
        <StatCard
          label="Refund Rate"
          value="3.2%"
          trend={{ value: 0.4, direction: 'up', sentiment: 'negative' }}
          trendLabel="vs last month"
        />
      )
      // COLOR = negative (error), NOT the positive/success color the up-arrow
      // would have hard-coupled pre-#467.
      const pill = container.querySelector('[class*="trend-negative"]')
      expect(pill).not.toBeNull()
      expect(container.querySelector('[class*="trend-positive"]')).toBeNull()
      expect(pill).toHaveAttribute('data-sentiment', 'negative')
      // ARROW still shows the true direction: up.
      expect(pill).toHaveAttribute('data-direction', 'up')
      const svg = pill!.querySelector('svg')
      expect(svg).not.toBeNull()
      // The directional chevron (not the neutral dash) is rendered…
      expect(svg!.querySelector('polyline')).not.toBeNull()
      // …and it points UP — i.e. NOT the 180deg-rotated (down) glyph.
      expect(svg!.getAttribute('style') ?? '').not.toContain('rotate(180deg)')
    })

    it('inverted metric: down direction + positive sentiment (e.g. bounce rate falling is good)', () => {
      const { container } = render(
        <StatCard
          label="Bounce Rate"
          value="18%"
          trend={{ value: 2.0, direction: 'down', sentiment: 'positive' }}
        />
      )
      const pill = container.querySelector('[class*="trend-positive"]')
      expect(pill).not.toBeNull()
      expect(pill).toHaveAttribute('data-direction', 'down')
      expect(pill).toHaveAttribute('data-sentiment', 'positive')
      // Down glyph IS the 180deg-rotated chevron.
      const svg = pill!.querySelector('svg')
      expect(svg!.getAttribute('style') ?? '').toContain('rotate(180deg)')
    })

    it('explicit neutral sentiment renders the neutral color', () => {
      const { container } = render(
        <StatCard
          label="Sessions"
          value="1,024"
          trend={{ value: 0, direction: 'neutral', sentiment: 'neutral' }}
        />
      )
      const pill = container.querySelector('[class*="trend-neutral"]')
      expect(pill).not.toBeNull()
      expect(pill).toHaveAttribute('data-sentiment', 'neutral')
    })
  })
})
