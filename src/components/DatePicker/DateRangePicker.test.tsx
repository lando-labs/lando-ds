/**
 * DateRangePicker tests (#312).
 *
 * Coverage:
 *   - Renders trigger Input with empty value (uses placeholder)
 *   - Renders trigger with formatted range when value is set
 *   - Default formatter: "MM/DD/YYYY – MM/DD/YYYY"
 *   - Custom `format` prop overrides visible text
 *   - Click on trigger opens popover
 *   - First Calendar click sets provisional start; popover STAYS open
 *   - Second click AFTER provisional commits range + closes popover
 *   - Second click BEFORE provisional swaps so earlier date is start
 *   - Controlled value: external value prop updates display
 *   - Uncontrolled defaultValue + onChange fires once on commit
 *   - Escape closes without clearing
 *   - Clear button (when clearable + value present) fires onChange(undefined)
 *   - min/max pass through to Calendar (out-of-range cells disabled)
 *   - Disabled state: no interaction (trigger doesn't open popover)
 *   - aria-expanded reflects open state on the trigger
 *   - aria-haspopup="dialog" on the trigger
 *   - Popover content has role="dialog" + aria-label="Choose date range"
 *   - Range visual highlight (data-in-range attribute on cells) between
 *     provisional start + hovered cell
 *   - Re-opening with existing range: starts fresh "select start" mode
 *     (no provisionalStart leak from previous session)
 */

import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { DateRangePicker } from './DateRangePicker'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find all focusable day-button elements in the rendered calendar. */
function dayButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="gridcell"] button')
  )
}

/** Find a day-button by visible day-number, ignoring out-of-month duplicates. */
function findDayInDisplayedMonth(day: number): HTMLButtonElement {
  const all = dayButtons()
  const candidates = all.filter((b) => b.textContent?.trim() === String(day))
  // Prefer the one NOT marked as dayOutside (Calendar's class name).
  const inMonth = candidates.find((b) => !b.className.includes('dayOutside'))
  if (!inMonth) {
    throw new Error(`Could not find day ${day} in the displayed month`)
  }
  return inMonth
}

/** The trigger Input rendered as a combobox. */
function getTrigger(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement
}

/** Open the popover by clicking the trigger; runs rAF so Popover positions. */
function openPopover() {
  fireEvent.click(getTrigger())
  flushRaf()
}

/** Flush Popover's measurement rAFs (mirrors the pattern used by other tests). */
function flushRaf() {
  // Popover schedules up to 10 rAFs for position measurement; we tick them
  // all so the dialog reaches its visible state and the cells render.
  for (let i = 0; i < 12; i++) {
    act(() => {
      // jsdom rAF executes the callback synchronously via setTimeout(0)
      // after we advance timers, so a tiny tick suffices.
      vi.advanceTimersByTime(20)
    })
  }
}

// Fix "today" so seeding is deterministic. June 15, 2026 is a Monday.
const FIXED_TODAY = new Date(2026, 5, 15)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Trigger rendering
// ---------------------------------------------------------------------------

describe('DateRangePicker — trigger rendering', () => {
  it('renders an empty trigger input when no value is set', () => {
    render(<DateRangePicker />)
    const trigger = getTrigger()
    expect(trigger).toBeInTheDocument()
    expect(trigger.value).toBe('')
    expect(trigger).toHaveAttribute('placeholder', 'Select date range')
  })

  it('renders the formatted range in the trigger when value is set', () => {
    render(
      <DateRangePicker
        value={[new Date(2026, 5, 1), new Date(2026, 5, 7)]}
      />
    )
    expect(getTrigger().value).toBe('06/01/2026 – 06/07/2026')
  })

  it('uses a custom `format` function for visible text', () => {
    render(
      <DateRangePicker
        value={[new Date(2026, 5, 1), new Date(2026, 5, 7)]}
        format={(range) => `${range[0].getDate()}~${range[1].getDate()}`}
      />
    )
    expect(getTrigger().value).toBe('1~7')
  })

  it('renders the `placeholder` prop when no value', () => {
    render(<DateRangePicker placeholder="Pick a window" />)
    expect(getTrigger()).toHaveAttribute('placeholder', 'Pick a window')
  })
})

// ---------------------------------------------------------------------------
// ARIA wiring
// ---------------------------------------------------------------------------

describe('DateRangePicker — ARIA wiring', () => {
  it('trigger has role="combobox" and aria-haspopup="dialog"', () => {
    render(<DateRangePicker />)
    const trigger = getTrigger()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('aria-expanded reflects open state on the trigger', () => {
    render(<DateRangePicker />)
    const trigger = getTrigger()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    openPopover()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('popover content carries role="dialog" with aria-label="Choose date range"', () => {
    render(<DateRangePicker />)
    openPopover()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Choose date range')
  })
})

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------

describe('DateRangePicker — open / close', () => {
  it('clicking the trigger opens the popover', () => {
    render(<DateRangePicker />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    openPopover()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Escape closes the popover without clearing the value', () => {
    const onChange = vi.fn()
    render(
      <DateRangePicker
        defaultValue={[new Date(2026, 5, 1), new Date(2026, 5, 7)]}
        onChange={onChange}
      />
    )
    openPopover()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Value preserved
    expect(getTrigger().value).toBe('06/01/2026 – 06/07/2026')
    // No onChange fire for Escape-close
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disabled prop prevents the popover from opening', () => {
    render(<DateRangePicker disabled />)
    fireEvent.click(getTrigger())
    flushRaf()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Selection flow — two-click range
// ---------------------------------------------------------------------------

describe('DateRangePicker — selection flow', () => {
  it('first click sets provisional start; popover stays open; no onChange yet', () => {
    const onChange = vi.fn()
    render(<DateRangePicker onChange={onChange} />)
    openPopover()
    // Calendar seeded to today's month (June 2026); click June 10.
    fireEvent.click(findDayInDisplayedMonth(10))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('second click after provisional commits range + closes popover', () => {
    const onChange = vi.fn()
    render(<DateRangePicker onChange={onChange} />)
    openPopover()
    fireEvent.click(findDayInDisplayedMonth(10))
    fireEvent.click(findDayInDisplayedMonth(20))
    expect(onChange).toHaveBeenCalledTimes(1)
    const range = onChange.mock.calls[0]![0] as [Date, Date] // safe: toHaveBeenCalledTimes(1) asserted above
    expect(range[0].getDate()).toBe(10)
    expect(range[1].getDate()).toBe(20)
    // Popover closed after commit.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('second click BEFORE provisional swaps so earlier date is start', () => {
    const onChange = vi.fn()
    render(<DateRangePicker onChange={onChange} />)
    openPopover()
    fireEvent.click(findDayInDisplayedMonth(20))
    fireEvent.click(findDayInDisplayedMonth(10))
    expect(onChange).toHaveBeenCalledTimes(1)
    const range = onChange.mock.calls[0]![0] as [Date, Date] // safe: toHaveBeenCalledTimes(1) asserted above
    // Swapped: 10 = start, 20 = end.
    expect(range[0].getDate()).toBe(10)
    expect(range[1].getDate()).toBe(20)
  })

  it('uncontrolled: onChange fires exactly once per range commit', () => {
    const onChange = vi.fn()
    render(<DateRangePicker onChange={onChange} />)
    openPopover()
    fireEvent.click(findDayInDisplayedMonth(5))
    fireEvent.click(findDayInDisplayedMonth(15))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('uncontrolled: the committed range updates the trigger display', () => {
    render(<DateRangePicker />)
    openPopover()
    fireEvent.click(findDayInDisplayedMonth(5))
    fireEvent.click(findDayInDisplayedMonth(15))
    expect(getTrigger().value).toBe('06/05/2026 – 06/15/2026')
  })
})

// ---------------------------------------------------------------------------
// Controlled mode
// ---------------------------------------------------------------------------

describe('DateRangePicker — controlled mode', () => {
  it('external value prop change updates the display', () => {
    function Controlled() {
      const [value, setValue] = useState<[Date, Date] | undefined>([
        new Date(2026, 5, 1),
        new Date(2026, 5, 5),
      ])
      return (
        <>
          <DateRangePicker value={value} onChange={setValue} />
          <button onClick={() => setValue([new Date(2026, 5, 10), new Date(2026, 5, 20)])}>
            Bump
          </button>
        </>
      )
    }
    render(<Controlled />)
    expect(getTrigger().value).toBe('06/01/2026 – 06/05/2026')
    fireEvent.click(screen.getByText('Bump'))
    expect(getTrigger().value).toBe('06/10/2026 – 06/20/2026')
  })
})

// ---------------------------------------------------------------------------
// Re-opening behavior
// ---------------------------------------------------------------------------

describe('DateRangePicker — re-open behavior', () => {
  it('re-opening with an existing range returns to "select start" mode', () => {
    const onChange = vi.fn()
    render(
      <DateRangePicker
        defaultValue={[new Date(2026, 5, 1), new Date(2026, 5, 7)]}
        onChange={onChange}
      />
    )
    // Open, close (Escape), re-open.
    openPopover()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    openPopover()
    // First click after re-open is a NEW provisional start — not the end of
    // a continued range. So clicking June 15 → no commit yet, popover open.
    fireEvent.click(findDayInDisplayedMonth(15))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    // Second click commits the NEW range — replacing the old one.
    fireEvent.click(findDayInDisplayedMonth(22))
    expect(onChange).toHaveBeenCalledTimes(1)
    const range = onChange.mock.calls[0]![0] as [Date, Date] // safe: toHaveBeenCalledTimes(1) asserted above
    expect(range[0].getDate()).toBe(15)
    expect(range[1].getDate()).toBe(22)
  })
})

// ---------------------------------------------------------------------------
// Clearable
// ---------------------------------------------------------------------------

describe('DateRangePicker — clear button', () => {
  it('renders a Clear button when clearable + value is present', () => {
    render(
      <DateRangePicker
        defaultValue={[new Date(2026, 5, 1), new Date(2026, 5, 7)]}
        clearable
      />
    )
    expect(
      screen.getByRole('button', { name: /clear date range/i })
    ).toBeInTheDocument()
  })

  it('clicking Clear fires onChange(undefined) and removes the visible range', () => {
    const onChange = vi.fn()
    function Controlled() {
      const [value, setValue] = useState<[Date, Date] | undefined>([
        new Date(2026, 5, 1),
        new Date(2026, 5, 7),
      ])
      return (
        <DateRangePicker
          clearable
          value={value}
          onChange={(next) => {
            onChange(next)
            setValue(next)
          }}
        />
      )
    }
    render(<Controlled />)
    fireEvent.click(screen.getByRole('button', { name: /clear date range/i }))
    expect(onChange).toHaveBeenCalledWith(undefined)
    expect(getTrigger().value).toBe('')
  })

  it('does NOT render a Clear button without clearable prop', () => {
    render(
      <DateRangePicker
        defaultValue={[new Date(2026, 5, 1), new Date(2026, 5, 7)]}
      />
    )
    expect(
      screen.queryByRole('button', { name: /clear date range/i })
    ).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// min / max pass-through
// ---------------------------------------------------------------------------

describe('DateRangePicker — min / max pass-through', () => {
  it('disables out-of-range cells in the calendar (min)', () => {
    render(<DateRangePicker min="2026-06-10" />)
    openPopover()
    // June 5 should be disabled (before min). Find a "5" in the displayed
    // month and check disabled state.
    const day5 = findDayInDisplayedMonth(5)
    expect(day5).toBeDisabled()
    // June 15 should be enabled.
    const day15 = findDayInDisplayedMonth(15)
    expect(day15).not.toBeDisabled()
  })

  it('disables out-of-range cells in the calendar (max)', () => {
    render(<DateRangePicker max="2026-06-10" />)
    openPopover()
    const day25 = findDayInDisplayedMonth(25)
    expect(day25).toBeDisabled()
    const day5 = findDayInDisplayedMonth(5)
    expect(day5).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Range highlight (data-in-range attribute)
// ---------------------------------------------------------------------------

describe('DateRangePicker — visual range highlight', () => {
  it('paints data-in-range between provisional start and hovered cell', () => {
    render(<DateRangePicker />)
    openPopover()
    // Click June 10 as provisional start.
    fireEvent.click(findDayInDisplayedMonth(10))
    // Hover June 14 → paint should cover 10–14.
    const day14 = findDayInDisplayedMonth(14)
    fireEvent.mouseOver(day14)
    // June 12 should be marked in-range.
    expect(findDayInDisplayedMonth(12)).toHaveAttribute('data-in-range', 'true')
    // June 17 should NOT be in-range.
    const day17 = findDayInDisplayedMonth(17)
    expect(day17.hasAttribute('data-in-range')).toBe(false)
    // The hovered end-preview cell gets a separate marker.
    expect(day14).toHaveAttribute('data-range-preview-end', 'true')
  })

  it('paints data-in-range across the committed range when popover re-opens', () => {
    // Edge case: when popover is open AND a value exists AND no provisional —
    // the highlight should show the existing range.
    function Controlled() {
      const [value] = useState<[Date, Date]>([
        new Date(2026, 5, 5),
        new Date(2026, 5, 12),
      ])
      return <DateRangePicker value={value} defaultOpen />
    }
    render(<Controlled />)
    flushRaf()
    // Day 8 should be in range, day 20 should not.
    expect(findDayInDisplayedMonth(8)).toHaveAttribute('data-in-range', 'true')
    expect(findDayInDisplayedMonth(20).hasAttribute('data-in-range')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Customizability passthrough (#422)
// ---------------------------------------------------------------------------

describe('DateRangePicker — className / style passthrough (#422)', () => {
  it('routes data-testid to the visual root (the trigger row)', () => {
    render(<DateRangePicker data-testid="drp" />)
    const root = screen.getByTestId('drp')
    expect(root.tagName).toBe('DIV')
    // The trigger row wraps the combobox Input.
    expect(root).toContainElement(getTrigger())
  })

  it('consumer inline style wins on the trigger row', () => {
    render(<DateRangePicker style={{ color: 'rgb(1, 2, 3)' }} data-testid="drp" />)
    expect(screen.getByTestId('drp')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('consumer className lands on the trigger row', () => {
    render(<DateRangePicker className="custom-cls" data-testid="drp" />)
    expect(screen.getByTestId('drp')).toHaveClass('custom-cls')
  })
})

// ---------------------------------------------------------------------------
// a11y smoke (open dialog)
// ---------------------------------------------------------------------------

describe('DateRangePicker — a11y', () => {
  it('is accessible per axe-core (open popover)', async () => {
    // axe needs real timers — restore them for this assertion.
    vi.useRealTimers()
    const { container, getByRole } = render(
      <DateRangePicker label="Test range" />
    )
    fireEvent.click(getByRole('combobox'))
    await waitFor(() => expect(getByRole('dialog')).toBeInTheDocument())
    expect(await axe(container)).toHaveNoViolations()
  })
})
