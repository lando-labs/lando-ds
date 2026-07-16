/**
 * Calendar tests (#312).
 *
 * Coverage:
 *   - Renders default to today's month
 *   - Renders the month containing `defaultValue` initially
 *   - Renders the month containing `value` when controlled
 *   - Click selects + fires onChange with midnight-local Date
 *   - Click on an out-of-current-month cell navigates the displayed month
 *   - Prev / next month nav buttons work
 *   - Arrow keys move focus (Left, Right, Up, Down)
 *   - Arrow keys wrap across month boundaries and shift displayed month
 *   - Home / End focus first / last day of the current week
 *   - PageUp / PageDown change month
 *   - Shift+PageUp / Shift+PageDown change year
 *   - Enter / Space select the focused day
 *   - min/max disables out-of-range days (aria-disabled, not clickable)
 *   - aria-selected on the selected day
 *   - aria-current="date" on today (and only today)
 *   - Roving tabIndex — exactly one cell has tabIndex=0
 *   - Whole-component `disabled` prop blocks interaction
 *   - Live region announces month changes
 *   - `label` prop maps to aria-label on the root
 *   - className passes through
 *   - jest-axe a11y smoke
 */

import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Calendar } from './Calendar'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve every focusable day-button (the buttons inside `[role="gridcell"]`). */
function dayButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="gridcell"] button')
  )
}

/** Find a day-button by its visible day-of-month text and (optionally) month label.
 *  When duplicates exist across out-of-month grid cells, we filter to the
 *  current month using the prev/next-month dimming class. */
function findDayInDisplayedMonth(day: number): HTMLButtonElement {
  const all = dayButtons()
  // The grid renders 42 cells; some show day "1" from the next month or
  // day "29/30/31" from the prev month. We pick the one that is NOT marked
  // as outside (its className will not contain the dayOutside class).
  const candidates = all.filter((b) => b.textContent?.trim() === String(day))
  const inMonth = candidates.find((b) => !b.className.includes('dayOutside'))
  if (!inMonth) {
    throw new Error(`Could not find day ${day} in the displayed month`)
  }
  return inMonth
}

/** Read the visible "Month Year" header label. */
function getMonthLabel(): string {
  // It's the only element between the two nav buttons; locate via the prev
  // button's sibling sequence. Simpler: query the row and read the middle.
  const navButtons = screen.getAllByRole('button', {
    name: /(previous|next) month/i,
  })
  expect(navButtons).toHaveLength(2)
  const prev = navButtons[0]
  const labelEl = prev?.nextElementSibling
  return labelEl?.textContent?.trim() ?? ''
}

// Fix "today" so the `today` indicator + "renders current month by default"
// tests don't depend on the wall clock. We pick June 15, 2026 (Monday) so the
// month grid keeps a Monday-first layout that's easy to reason about.
const FIXED_TODAY = new Date(2026, 5, 15) // June 15, 2026

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Initial render
// ---------------------------------------------------------------------------

describe('Calendar — initial render', () => {
  it('renders the current month by default (no value, no defaultValue)', () => {
    render(<Calendar />)
    expect(getMonthLabel()).toBe('June 2026')
  })

  it('renders the month containing `defaultValue` initially (uncontrolled)', () => {
    render(<Calendar defaultValue="2026-03-10" />)
    expect(getMonthLabel()).toBe('March 2026')
  })

  it('renders the month containing `value` when controlled', () => {
    render(<Calendar value="2026-09-20" onChange={() => {}} />)
    expect(getMonthLabel()).toBe('September 2026')
  })

  it('renders a 6×7 grid of day cells (42 total)', () => {
    render(<Calendar />)
    expect(document.querySelectorAll('[role="gridcell"]')).toHaveLength(42)
  })

  it('uses Monday as the first weekday header column', () => {
    render(<Calendar />)
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('applies the `label` prop as aria-label on the application root', () => {
    render(<Calendar label="Pick a meeting date" />)
    const app = screen.getByRole('application')
    expect(app).toHaveAttribute('aria-label', 'Pick a meeting date')
  })

  it('defaults aria-label to "Choose a date"', () => {
    render(<Calendar />)
    expect(screen.getByRole('application')).toHaveAttribute(
      'aria-label',
      'Choose a date'
    )
  })

  it('passes className through to the root', () => {
    render(<Calendar className="custom-cal" />)
    const app = screen.getByRole('application')
    expect(app).toHaveClass('custom-cal')
  })

  // #422 — Calendar extends HTMLAttributes and spreads `...rest`, so
  // data-testid / style / arbitrary attributes land on the visual root.
  it('routes data-testid to the visual root (the application element)', () => {
    render(<Calendar data-testid="cal" />)
    expect(screen.getByTestId('cal')).toBe(screen.getByRole('application'))
  })

  it('consumer inline style wins on the visual root', () => {
    render(<Calendar style={{ color: 'rgb(1, 2, 3)' }} />)
    expect(screen.getByRole('application')).toHaveStyle({
      color: 'rgb(1, 2, 3)',
    })
  })
})

// ---------------------------------------------------------------------------
// Selection — click
// ---------------------------------------------------------------------------

describe('Calendar — selection by click', () => {
  it('fires onChange with the clicked date at midnight local', () => {
    const onChange = vi.fn()
    render(<Calendar defaultValue="2026-06-15" onChange={onChange} />)
    fireEvent.click(findDayInDisplayedMonth(20))
    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0]![0] as Date // safe: toHaveBeenCalledTimes(1) asserted above
    expect(arg).toBeInstanceOf(Date)
    expect(arg.getFullYear()).toBe(2026)
    expect(arg.getMonth()).toBe(5) // June
    expect(arg.getDate()).toBe(20)
    expect(arg.getHours()).toBe(0)
    expect(arg.getMinutes()).toBe(0)
    expect(arg.getSeconds()).toBe(0)
  })

  it('updates aria-selected on the chosen day (uncontrolled)', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const btn = findDayInDisplayedMonth(22)
    fireEvent.click(btn)
    // The td (gridcell), not the button, carries aria-selected.
    const cell = btn.closest('[role="gridcell"]')
    expect(cell).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking an out-of-current-month cell navigates to that month', () => {
    // June 2026: the grid contains some July 2026 leading cells (after the 30th).
    const onChange = vi.fn()
    render(<Calendar defaultValue="2026-06-15" onChange={onChange} />)
    // Find a "1" that IS marked dayOutside (the July 1 in the trailing slots).
    const all = dayButtons()
    const julyOne = all.find(
      (b) =>
        b.textContent?.trim() === '1' && b.className.includes('dayOutside')
    )
    expect(julyOne).toBeDefined()
    fireEvent.click(julyOne!)
    expect(getMonthLabel()).toBe('July 2026')
    expect(onChange).toHaveBeenCalledTimes(1)
    const d = onChange.mock.calls[0]![0] as Date // safe: toHaveBeenCalledTimes(1) asserted above
    expect(d.getMonth()).toBe(6) // July (0-indexed)
    expect(d.getDate()).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Month navigation buttons
// ---------------------------------------------------------------------------

describe('Calendar — month navigation buttons', () => {
  it('clicking "Previous month" steps back one month', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    expect(getMonthLabel()).toBe('May 2026')
  })

  it('clicking "Next month" steps forward one month', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(getMonthLabel()).toBe('July 2026')
  })

  it('crosses the year boundary correctly', () => {
    render(<Calendar defaultValue="2026-01-15" />)
    fireEvent.click(screen.getByRole('button', { name: /previous month/i }))
    expect(getMonthLabel()).toBe('December 2025')
  })
})

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

describe('Calendar — keyboard navigation', () => {
  it('ArrowLeft moves focus one day earlier', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowLeft' })
    const next = findDayInDisplayedMonth(14)
    expect(document.activeElement).toBe(next)
  })

  it('ArrowRight moves focus one day later', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(findDayInDisplayedMonth(16))
  })

  it('ArrowUp moves focus one week earlier', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(findDayInDisplayedMonth(8))
  })

  it('ArrowDown moves focus one week later', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(findDayInDisplayedMonth(22))
  })

  it('arrow nav across a month boundary updates the displayed month', () => {
    // June 1, 2026 is a Monday → ArrowLeft on the 1st jumps to May 31 (Sunday).
    render(<Calendar defaultValue="2026-06-01" />)
    const start = findDayInDisplayedMonth(1)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowLeft' })
    expect(getMonthLabel()).toBe('May 2026')
    // Now "31" should be the focused/in-current-month cell of May.
    expect(findDayInDisplayedMonth(31)).toBe(document.activeElement)
  })

  it('Home moves focus to Monday of the current week', () => {
    // June 17, 2026 is a Wednesday → Home should land on Monday June 15.
    render(<Calendar defaultValue="2026-06-17" />)
    const start = findDayInDisplayedMonth(17)
    start.focus()
    fireEvent.keyDown(start, { key: 'Home' })
    expect(document.activeElement).toBe(findDayInDisplayedMonth(15))
  })

  it('End moves focus to Sunday of the current week', () => {
    // June 17, 2026 is a Wednesday → End should land on Sunday June 21.
    render(<Calendar defaultValue="2026-06-17" />)
    const start = findDayInDisplayedMonth(17)
    start.focus()
    fireEvent.keyDown(start, { key: 'End' })
    expect(document.activeElement).toBe(findDayInDisplayedMonth(21))
  })

  it('PageDown advances the displayed month by one', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'PageDown' })
    expect(getMonthLabel()).toBe('July 2026')
  })

  it('PageUp retreats the displayed month by one', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'PageUp' })
    expect(getMonthLabel()).toBe('May 2026')
  })

  it('Shift+PageDown advances the displayed year', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'PageDown', shiftKey: true })
    expect(getMonthLabel()).toBe('June 2027')
  })

  it('Shift+PageUp retreats the displayed year', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'PageUp', shiftKey: true })
    expect(getMonthLabel()).toBe('June 2025')
  })

  it('Enter on a focused day commits selection', () => {
    const onChange = vi.fn()
    render(<Calendar defaultValue="2026-06-15" onChange={onChange} />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    // Active element is now June 16
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    const arg = onChange.mock.calls.at(-1)![0] as Date
    expect(arg.getDate()).toBe(16)
  })

  it('Space on a focused day commits selection', () => {
    const onChange = vi.fn()
    render(<Calendar defaultValue="2026-06-15" onChange={onChange} />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: ' ' })
    const arg = onChange.mock.calls.at(-1)![0] as Date
    expect(arg.getDate()).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// Min / max constraints
// ---------------------------------------------------------------------------

describe('Calendar — min/max constraints', () => {
  it('disables days before `min`', () => {
    render(<Calendar defaultValue="2026-06-15" min="2026-06-10" />)
    const before = findDayInDisplayedMonth(5)
    expect(before).toBeDisabled()
    expect(before).toHaveAttribute('aria-disabled', 'true')
  })

  it('disables days after `max`', () => {
    render(<Calendar defaultValue="2026-06-15" max="2026-06-20" />)
    const after = findDayInDisplayedMonth(25)
    expect(after).toBeDisabled()
    expect(after).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not fire onChange when an out-of-range day is clicked', () => {
    const onChange = vi.fn()
    render(
      <Calendar
        defaultValue="2026-06-15"
        min="2026-06-10"
        onChange={onChange}
      />
    )
    fireEvent.click(findDayInDisplayedMonth(5))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps in-range days clickable', () => {
    const onChange = vi.fn()
    render(
      <Calendar
        defaultValue="2026-06-15"
        min="2026-06-10"
        max="2026-06-20"
        onChange={onChange}
      />
    )
    fireEvent.click(findDayInDisplayedMonth(12))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// ARIA wiring — selected / today / roving tabIndex
// ---------------------------------------------------------------------------

describe('Calendar — ARIA wiring', () => {
  it('marks aria-selected only on the selected gridcell', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const selectedCells = document.querySelectorAll(
      '[role="gridcell"][aria-selected="true"]'
    )
    expect(selectedCells).toHaveLength(1)
    const btn = selectedCells[0]?.querySelector('button')
    expect(btn?.textContent?.trim()).toBe('15')
  })

  it('marks aria-current="date" only on today', () => {
    // FIXED_TODAY is June 15, 2026. Render a calendar showing June with no
    // selection; only the 15th should be marked current.
    render(<Calendar />)
    const currents = document.querySelectorAll('[aria-current="date"]')
    expect(currents).toHaveLength(1)
    expect(currents[0]?.textContent?.trim()).toBe('15')
  })

  it('roving tabIndex — exactly one day-button has tabIndex=0', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const tabbables = dayButtons().filter((b) => b.tabIndex === 0)
    expect(tabbables).toHaveLength(1)
    expect(tabbables[0]?.textContent?.trim()).toBe('15')
  })

  it('roving tabIndex follows arrow-key focus', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const start = findDayInDisplayedMonth(15)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    const tabbables = dayButtons().filter((b) => b.tabIndex === 0)
    expect(tabbables).toHaveLength(1)
    expect(tabbables[0]?.textContent?.trim()).toBe('16')
  })
})

// ---------------------------------------------------------------------------
// Disabled (whole-component)
// ---------------------------------------------------------------------------

describe('Calendar — disabled prop', () => {
  it('sets aria-disabled on the application root', () => {
    render(<Calendar disabled />)
    const app = screen.getByRole('application')
    expect(app).toHaveAttribute('aria-disabled', 'true')
  })

  it('disables all day buttons and nav buttons', () => {
    render(<Calendar disabled defaultValue="2026-06-15" />)
    for (const btn of dayButtons()) {
      expect(btn).toBeDisabled()
    }
    expect(
      screen.getByRole('button', { name: /previous month/i })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /next month/i })
    ).toBeDisabled()
  })

  it('does not fire onChange on click when disabled', () => {
    const onChange = vi.fn()
    render(<Calendar disabled defaultValue="2026-06-15" onChange={onChange} />)
    fireEvent.click(findDayInDisplayedMonth(20))
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Live region
// ---------------------------------------------------------------------------

describe('Calendar — aria-live month announcement', () => {
  it('renders a polite live region with the current month label', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    const live = document.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live?.textContent?.trim()).toBe('June 2026')
  })

  it('updates the live region content when the month changes', () => {
    render(<Calendar defaultValue="2026-06-15" />)
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    const live = document.querySelector('[aria-live="polite"]')
    expect(live?.textContent?.trim()).toBe('July 2026')
  })
})

// ---------------------------------------------------------------------------
// Controlled mode follow-through
// ---------------------------------------------------------------------------

describe('Calendar — controlled mode', () => {
  it('snaps the displayed month to a controlled value change', () => {
    function Controlled() {
      const [value, setValue] = useState<Date | string>('2026-06-15')
      return (
        <div>
          <button type="button" onClick={() => setValue('2027-02-10')}>
            Jump
          </button>
          <Calendar value={value} onChange={setValue} />
        </div>
      )
    }
    render(<Controlled />)
    expect(getMonthLabel()).toBe('June 2026')
    fireEvent.click(screen.getByRole('button', { name: 'Jump' }))
    expect(getMonthLabel()).toBe('February 2027')
  })

  it('does NOT mutate internal selection when controlled and click occurs', () => {
    // The selected aria state should ONLY reflect the controlled value,
    // not the latest click — that's the controlled contract.
    const onChange = vi.fn()
    render(<Calendar value="2026-06-15" onChange={onChange} />)
    fireEvent.click(findDayInDisplayedMonth(22))
    expect(onChange).toHaveBeenCalledTimes(1)
    // aria-selected still on the 15th, NOT the 22nd.
    const selected = document.querySelector(
      '[role="gridcell"][aria-selected="true"]'
    )
    expect(selected?.querySelector('button')?.textContent?.trim()).toBe('15')
  })
})

// ---------------------------------------------------------------------------
// a11y smoke
// ---------------------------------------------------------------------------

describe('Calendar — a11y', () => {
  it('has no axe violations in a representative render', async () => {
    // axe's internal scheduler relies on real timers — restore them for this
    // test so the async assertion doesn't stall behind our fake clock.
    vi.useRealTimers()
    const { container } = render(
      <Calendar defaultValue="2026-06-15" min="2026-06-05" max="2026-06-25" />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

