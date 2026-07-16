/**
 * DateDisplay tests (#312).
 *
 * Server-safe leaf — verifies the `<time datetime="...">` semantic contract,
 * locale formatting default, custom formatters, the `as="span"` escape hatch,
 * and graceful handling of invalid input.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { DateDisplay } from './DateDisplay'

describe('DateDisplay', () => {
  it('renders a <time> element by default with ISO dateTime attribute', () => {
    render(<DateDisplay value="2026-06-29" />)
    // toLocaleDateString varies by env locale; we assert structure, not exact text.
    const el = document.querySelector('time')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('dateTime', '2026-06-29')
    expect(el?.textContent?.length).toBeGreaterThan(0)
  })

  it('accepts a Date instance and emits the local-date ISO string', () => {
    const d = new Date(2026, 5, 29) // June 29, 2026 local time
    render(<DateDisplay value={d} />)
    const el = document.querySelector('time')
    expect(el).toHaveAttribute('dateTime', '2026-06-29')
  })

  it('applies a custom format function to the visible text', () => {
    render(
      <DateDisplay
        value="2026-06-29"
        format={(d) => `Day ${d.getDate()} of month ${d.getMonth() + 1}`}
      />
    )
    expect(screen.getByText('Day 29 of month 6')).toBeInTheDocument()
  })

  it('renders a <span> when as="span" — no dateTime attribute', () => {
    render(<DateDisplay value="2026-06-29" as="span" />)
    const span = document.querySelector('span')
    expect(span).toBeInTheDocument()
    expect(span).not.toHaveAttribute('dateTime')
    // No <time> element rendered.
    expect(document.querySelector('time')).toBeNull()
  })

  it('falls back to raw string on invalid ISO input (no throw, no dateTime)', () => {
    render(<DateDisplay value="not-a-real-date" />)
    expect(screen.getByText('not-a-real-date')).toBeInTheDocument()
    // Invalid input → no dateTime attribute set.
    const el = document.querySelector('time')
    expect(el).not.toHaveAttribute('dateTime')
  })

  it('applies className to the rendered element', () => {
    render(<DateDisplay value="2026-06-29" className="custom-cls" />)
    expect(document.querySelector('time')).toHaveClass('custom-cls')
  })

  // #422 — DateDisplay extends HTMLAttributes and spreads `...rest`, so
  // data-testid / style / arbitrary attributes land on the visual root.
  it('routes data-testid + style to the visual root (the <time> element)', () => {
    render(
      <DateDisplay
        value="2026-06-29"
        data-testid="dd"
        style={{ color: 'rgb(1, 2, 3)' }}
      />
    )
    const el = screen.getByTestId('dd')
    expect(el.tagName).toBe('TIME')
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('passthrough lands on the <span> when as="span"', () => {
    render(<DateDisplay value="2026-06-29" as="span" data-testid="dd-span" />)
    expect(screen.getByTestId('dd-span').tagName).toBe('SPAN')
  })

  it('passthrough lands on the rendered element for invalid input too', () => {
    render(<DateDisplay value="not-a-real-date" data-testid="dd-bad" />)
    expect(screen.getByTestId('dd-bad')).toBeInTheDocument()
  })

  it('has no a11y violations', async () => {
    const { container } = render(
      <div>
        <DateDisplay value="2026-06-29" />
        <DateDisplay value={new Date(2026, 0, 1)} />
        <DateDisplay value="2026-12-31" as="span" />
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
