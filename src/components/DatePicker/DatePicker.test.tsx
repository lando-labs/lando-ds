/**
 * DatePicker tests (#312).
 *
 * Coverage:
 *   - Renders input with empty value (placeholder shown)
 *   - Click input opens popover (Calendar renders inside)
 *   - Selecting a day in Calendar closes popover + updates input
 *   - Controlled value: external prop change updates the input display
 *   - Uncontrolled: defaultValue seeds, onChange fires
 *   - Escape closes popover without clearing selection
 *   - Clear button (when clearable=true + value present) clears + fires undefined
 *   - min/max pass through to Calendar (out-of-range dates disabled)
 *   - Disabled state: click does nothing
 *   - aria-expanded reflects open state
 *   - aria-haspopup="dialog"
 *   - onOpenChange fires for both open + close
 *   - Formatted date in input matches `format` prop
 *   - defaultOpen=true opens initially
 *   - error renders below input + aria-invalid set
 *   - Hidden form input emits ISO date when `name` provided
 *   - ArrowDown / Enter / Space on input opens popover
 *   - clearable=false hides the clear button
 *   - Controlled open: prop change drives visibility
 *   - jest-axe a11y smoke
 */

import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { DatePicker } from './DatePicker'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the trigger input (`role="combobox"`). */
function getTrigger(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement
}

/** True when the Portal-rendered dialog is in the DOM. */
function dialogIsOpen(): boolean {
  return screen.queryByRole('dialog') !== null
}

/** Find a day-button by its visible day-of-month text in the displayed month. */
function findDayInDisplayedMonth(day: number): HTMLButtonElement {
  const all = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="gridcell"] button')
  )
  const candidates = all.filter((b) => b.textContent?.trim() === String(day))
  const inMonth = candidates.find((b) => !b.className.includes('dayOutside'))
  if (!inMonth) {
    throw new Error(`Could not find day ${day} in the displayed month`)
  }
  return inMonth
}

// Fix "today" so date-dependent rendering doesn't depend on the wall clock.
// June 15, 2026 (Monday) — same anchor Calendar.test.tsx uses.
const FIXED_TODAY = new Date(2026, 5, 15)

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

describe('DatePicker — initial render', () => {
  it('renders an empty input with the placeholder when no value is provided', () => {
    render(<DatePicker placeholder="Pick a date" />)
    const input = getTrigger()
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Pick a date')
    expect(input.value).toBe('')
    expect(input).toHaveAttribute('aria-haspopup', 'dialog')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveAttribute('readonly')
  })

  it('renders the label and wires htmlFor to the input id', () => {
    render(<DatePicker label="Start date" />)
    const input = getTrigger()
    const label = screen.getByText('Start date')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', input.id)
  })

  it('displays the formatted defaultValue date in the input', () => {
    render(<DatePicker defaultValue="2026-06-15" />)
    const input = getTrigger()
    // Default formatter is toLocaleDateString — whatever the test runner's
    // locale resolves it to, the year/month/day digits must appear in it.
    expect(input.value).toContain('2026')
    expect(input.value.length).toBeGreaterThan(0)
  })

  it('uses the custom `format` prop when provided', () => {
    render(
      <DatePicker
        defaultValue="2026-06-15"
        format={(d) => `Year ${d.getFullYear()} day ${d.getDate()}`}
      />
    )
    expect(getTrigger().value).toBe('Year 2026 day 15')
  })

  it('does not render the popover initially (defaultOpen=false)', () => {
    render(<DatePicker />)
    expect(dialogIsOpen()).toBe(false)
  })

  it('renders the popover initially when `defaultOpen=true`', () => {
    render(<DatePicker defaultOpen />)
    expect(dialogIsOpen()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Open / close lifecycle
// ---------------------------------------------------------------------------

describe('DatePicker — open/close lifecycle', () => {
  it('clicking the input opens the popover and flips aria-expanded', () => {
    render(<DatePicker />)
    const input = getTrigger()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(dialogIsOpen()).toBe(true)
    const dialog = screen.getByRole('dialog')
    expect(input).toHaveAttribute('aria-controls', dialog.id)
  })

  it('focusing the input opens the popover', () => {
    render(<DatePicker />)
    fireEvent.focus(getTrigger())
    expect(dialogIsOpen()).toBe(true)
  })

  it('ArrowDown on the input opens the popover', () => {
    render(<DatePicker />)
    fireEvent.keyDown(getTrigger(), { key: 'ArrowDown' })
    expect(dialogIsOpen()).toBe(true)
  })

  it('Enter on the input opens the popover', () => {
    render(<DatePicker />)
    fireEvent.keyDown(getTrigger(), { key: 'Enter' })
    expect(dialogIsOpen()).toBe(true)
  })

  it('Space on the input opens the popover', () => {
    render(<DatePicker />)
    fireEvent.keyDown(getTrigger(), { key: ' ' })
    expect(dialogIsOpen()).toBe(true)
  })

  it('Escape closes the popover WITHOUT clearing the selection', () => {
    render(<DatePicker defaultValue="2026-06-15" />)
    const input = getTrigger()
    const valueBefore = input.value
    fireEvent.click(input)
    expect(dialogIsOpen()).toBe(true)
    // Escape on the dialog (the keydown handler is attached to the dialog
    // wrapper since Calendar's cells own the inner keydown handlers).
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(dialogIsOpen()).toBe(false)
    // Selection preserved.
    expect(input.value).toBe(valueBefore)
  })

  it('outside click closes the popover', async () => {
    render(
      <div>
        <DatePicker />
        <button>outside</button>
      </div>
    )
    fireEvent.click(getTrigger())
    expect(dialogIsOpen()).toBe(true)
    // Outside-click listener attaches via setTimeout(0); advance fake timers
    // past that boundary so the listener is live, then dispatch mousedown.
    vi.advanceTimersByTime(10)
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(dialogIsOpen()).toBe(false)
  })

  it('onOpenChange fires for open and close transitions', () => {
    const onOpenChange = vi.fn()
    render(<DatePicker onOpenChange={onOpenChange} />)
    fireEvent.click(getTrigger())
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(onOpenChange).toHaveBeenCalledTimes(2)
  })

  it('controlled open: external `open` prop drives visibility', () => {
    const { rerender } = render(<DatePicker open={false} />)
    expect(dialogIsOpen()).toBe(false)
    rerender(<DatePicker open onOpenChange={() => {}} />)
    expect(dialogIsOpen()).toBe(true)
    rerender(<DatePicker open={false} onOpenChange={() => {}} />)
    expect(dialogIsOpen()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('DatePicker — selection', () => {
  it('selecting a day in Calendar fires onChange and closes the popover', () => {
    const onChange = vi.fn()
    render(<DatePicker defaultValue="2026-06-15" onChange={onChange} />)
    fireEvent.click(getTrigger())
    expect(dialogIsOpen()).toBe(true)
    fireEvent.click(findDayInDisplayedMonth(20))
    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0]![0] as Date // safe: toHaveBeenCalledTimes(1) asserted above → calls[0] present
    expect(arg).toBeInstanceOf(Date)
    expect(arg.getFullYear()).toBe(2026)
    expect(arg.getMonth()).toBe(5)
    expect(arg.getDate()).toBe(20)
    expect(dialogIsOpen()).toBe(false)
  })

  it('uncontrolled: the input display updates after selecting a day', () => {
    render(<DatePicker defaultValue="2026-06-15" />)
    const input = getTrigger()
    const before = input.value
    fireEvent.click(input)
    fireEvent.click(findDayInDisplayedMonth(22))
    expect(input.value).not.toBe(before)
    expect(input.value).toContain('2026')
  })

  it('controlled: input display reflects the parent value, not internal state', () => {
    function Controlled() {
      const [v, setV] = useState<Date | undefined>(new Date(2026, 5, 15))
      return (
        <div>
          <button type="button" onClick={() => setV(new Date(2027, 1, 10))}>
            Jump
          </button>
          <DatePicker value={v} onChange={setV} />
        </div>
      )
    }
    render(<Controlled />)
    const input = getTrigger()
    const firstValue = input.value
    fireEvent.click(screen.getByRole('button', { name: 'Jump' }))
    expect(input.value).not.toBe(firstValue)
    expect(input.value).toContain('2027')
  })
})

// ---------------------------------------------------------------------------
// Clear button
// ---------------------------------------------------------------------------

describe('DatePicker — clear button', () => {
  it('renders the clear button when clearable=true and a value is present', () => {
    render(<DatePicker defaultValue="2026-06-15" />)
    expect(
      screen.getByRole('button', { name: /clear date/i })
    ).toBeInTheDocument()
  })

  it('does not render the clear button when clearable=false', () => {
    render(<DatePicker defaultValue="2026-06-15" clearable={false} />)
    expect(
      screen.queryByRole('button', { name: /clear date/i })
    ).not.toBeInTheDocument()
  })

  it('does not render the clear button when no value is set', () => {
    render(<DatePicker />)
    expect(
      screen.queryByRole('button', { name: /clear date/i })
    ).not.toBeInTheDocument()
  })

  it('clicking clear fires onChange(undefined) and empties the input', () => {
    const onChange = vi.fn()
    render(<DatePicker defaultValue="2026-06-15" onChange={onChange} />)
    const input = getTrigger()
    expect(input.value.length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /clear date/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(undefined)
    expect(input.value).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Min / max passthrough
// ---------------------------------------------------------------------------

describe('DatePicker — min/max passthrough', () => {
  it('disables days before `min` inside the popover Calendar', () => {
    render(<DatePicker defaultValue="2026-06-15" min="2026-06-10" />)
    fireEvent.click(getTrigger())
    expect(dialogIsOpen()).toBe(true)
    const before = findDayInDisplayedMonth(5)
    expect(before).toBeDisabled()
    expect(before).toHaveAttribute('aria-disabled', 'true')
  })

  it('disables days after `max` inside the popover Calendar', () => {
    render(<DatePicker defaultValue="2026-06-15" max="2026-06-20" />)
    fireEvent.click(getTrigger())
    const after = findDayInDisplayedMonth(25)
    expect(after).toBeDisabled()
    expect(after).toHaveAttribute('aria-disabled', 'true')
  })

  it('clicking an out-of-range day does not fire onChange or close', () => {
    const onChange = vi.fn()
    render(
      <DatePicker
        defaultValue="2026-06-15"
        min="2026-06-10"
        onChange={onChange}
      />
    )
    fireEvent.click(getTrigger())
    fireEvent.click(findDayInDisplayedMonth(5))
    expect(onChange).not.toHaveBeenCalled()
    // Calendar swallowed the click as no-op; popover stays open.
    expect(dialogIsOpen()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Disabled
// ---------------------------------------------------------------------------

describe('DatePicker — disabled', () => {
  it('clicking a disabled trigger does not open the popover', () => {
    render(<DatePicker disabled />)
    fireEvent.click(getTrigger())
    expect(dialogIsOpen()).toBe(false)
  })

  it('sets aria-disabled on the input', () => {
    render(<DatePicker disabled />)
    expect(getTrigger()).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not render the clear button when disabled', () => {
    render(<DatePicker disabled defaultValue="2026-06-15" />)
    expect(
      screen.queryByRole('button', { name: /clear date/i })
    ).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Error + helper text
// ---------------------------------------------------------------------------

describe('DatePicker — error and helper text', () => {
  it('renders the error text below the input + flips aria-invalid', () => {
    render(<DatePicker error="Pick a date" />)
    const input = getTrigger()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Pick a date')).toBeInTheDocument()
    expect(screen.getByText('Pick a date')).toHaveAttribute('role', 'alert')
  })

  it('renders helper text when no error is set', () => {
    render(<DatePicker helperText="ISO format expected" />)
    expect(screen.getByText('ISO format expected')).toBeInTheDocument()
  })

  it('error supersedes helperText when both are provided', () => {
    render(<DatePicker error="Bad date" helperText="Pick something" />)
    expect(screen.getByText('Bad date')).toBeInTheDocument()
    expect(screen.queryByText('Pick something')).not.toBeInTheDocument()
  })

  it('does not set aria-invalid when no error', () => {
    render(<DatePicker helperText="Required" />)
    const input = getTrigger()
    // aria-invalid should be absent (or false), not 'true'
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
  })
})

// ---------------------------------------------------------------------------
// Hidden form input
// ---------------------------------------------------------------------------

describe('DatePicker — hidden form input', () => {
  it('renders a hidden input with ISO yyyy-mm-dd value when `name` is set', () => {
    const { container } = render(
      <DatePicker name="meetingDate" defaultValue="2026-06-15" />
    )
    const hidden = container.querySelector<HTMLInputElement>(
      'input[type="hidden"]'
    )
    expect(hidden).not.toBeNull()
    expect(hidden!.name).toBe('meetingDate')
    expect(hidden!.value).toBe('2026-06-15')
  })

  it('hidden input is empty when no date is selected', () => {
    const { container } = render(<DatePicker name="meetingDate" />)
    const hidden = container.querySelector<HTMLInputElement>(
      'input[type="hidden"]'
    )
    expect(hidden!.value).toBe('')
  })

  it('does not render a hidden input when `name` is omitted', () => {
    const { container } = render(<DatePicker defaultValue="2026-06-15" />)
    expect(container.querySelector('input[type="hidden"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Customizability passthrough (#422)
// ---------------------------------------------------------------------------

describe('DatePicker — className / style passthrough (#422)', () => {
  // The trigger `.container` is the visual root and is the input's parent.
  function getTriggerContainer(): HTMLElement {
    return getTrigger().parentElement as HTMLElement
  }

  it('routes data-testid to the visual root (the trigger container), not the outer wrapper', () => {
    render(<DatePicker data-testid="dp" />)
    const container = getTriggerContainer()
    expect(screen.getByTestId('dp')).toBe(container)
    // The outer field wrapper is the container's parent and must NOT carry it.
    expect(
      (container.parentElement as HTMLElement).getAttribute('data-testid')
    ).toBeNull()
  })

  it('consumer inline style wins on the trigger container', () => {
    render(<DatePicker style={{ color: 'rgb(1, 2, 3)' }} data-testid="dp" />)
    expect(screen.getByTestId('dp')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('consumer className lands on the trigger container, not the outer wrapper', () => {
    render(<DatePicker className="custom-cls" data-testid="dp" />)
    const container = getTriggerContainer()
    expect(container).toHaveClass('custom-cls')
    expect(container.parentElement as HTMLElement).not.toHaveClass('custom-cls')
  })

  it('wrapperClassName / wrapperStyle land on the outer field wrapper', () => {
    render(
      <DatePicker
        wrapperClassName="wrap-cls"
        wrapperStyle={{ marginTop: '8px' }}
        data-testid="dp"
      />
    )
    const wrapper = getTriggerContainer().parentElement as HTMLElement
    expect(wrapper).toHaveClass('wrap-cls')
    expect(wrapper).toHaveStyle({ marginTop: '8px' })
    expect(getTriggerContainer()).not.toHaveClass('wrap-cls')
  })
})

// ---------------------------------------------------------------------------
// a11y smoke
// ---------------------------------------------------------------------------

describe('DatePicker — a11y', () => {
  it('has no axe violations in the closed-trigger state', async () => {
    // axe needs real timers — restore them for this assertion.
    vi.useRealTimers()
    const { container } = render(
      <DatePicker label="Start date" defaultValue="2026-06-15" />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
