'use client'

/**
 * Calendar — standalone month-grid date picker (#312).
 *
 * Sprint 56 — third commit of the DatePicker family. Builds on the
 * shipped foundation:
 *   - `DateDisplay` (v0.34.0) for read-only formatted dates
 *   - `dateUtils` (Sprint 55) for the local-timezone date math, the
 *     Monday-first-day rule, and `buildMonthGrid` returning the
 *     42-cell 6×7 grid that keeps the calendar's vertical size stable
 *     across months
 *
 * What it is
 * ----------
 * The bare inline calendar — no input, no popover. A consumer who needs
 * a calendar surface (booking widget, range picker bottom-half, inline
 * date filter) gets the grid + month navigation + keyboard handling +
 * ARIA wiring without having to roll one.
 *
 * What it is NOT (v1 deferrals — see the `DatePicker` follow-ups)
 * ---------------------------------------------------------------
 *   - Not a popover-anchored input — see `DatePicker` (#312 follow-up).
 *   - Not a range surface — see `DateRangePicker` (#312 follow-up).
 *   - Not a multi-month view, time picker, year-picker grid, locale
 *     override beyond "Monday-first + browser locale", or custom day
 *     renderer. Those land after the v1 trio if there's demand.
 *
 * A11y model — WAI-ARIA "Date Picker Dialog" pattern
 * --------------------------------------------------
 *   - Root: `role="application"` with `aria-label` (default "Choose a
 *     date"). The grid is interactive enough that screen readers should
 *     treat it as an application surface, not a generic region.
 *   - Grid: `<table role="grid">` with `<th scope="col" abbr="…">`
 *     column headers. Each cell is `<td role="gridcell">` wrapping a
 *     focusable `<button>` per day.
 *   - Day button:
 *       - `aria-selected={isSelected}`
 *       - `aria-current="date"` on TODAY
 *       - `aria-disabled` when outside [min, max] or whole-component
 *         disabled
 *       - `aria-label` is the full date ("Monday, June 29, 2026") so
 *         screen readers announce more than a bare day number
 *   - Roving tabIndex: exactly ONE cell has `tabIndex=0` at a time
 *     (the focused cell). All others have `tabIndex=-1`. This is the
 *     ARIA pattern for grids — `aria-activedescendant` is the OTHER
 *     legal model, but roving focus fits a grid better because it lets
 *     the user Tab OUT of the calendar after Tab-ing IN, which
 *     activedescendant on a wrapper button would break.
 *   - aria-live region announces the displayed month/year on change.
 *
 * Keyboard model
 * --------------
 *   - Arrows: ←/→/↑/↓ move focus by one day. At a grid edge they wrap
 *     into the prev/next month (and update the displayed month so the
 *     newly-focused cell is visible).
 *   - Home / End: first / last day of the CURRENT WEEK (Monday → Sunday
 *     in our Monday-first model).
 *   - PageUp / PageDown: previous / next month.
 *   - Shift+PageUp / Shift+PageDown: previous / next year.
 *   - Enter / Space: select the focused day (calls `onChange` with
 *     midnight local Date).
 *
 * Out-of-range vs out-of-month
 * ----------------------------
 *   - Out-of-range (per `min` / `max`): rendered, NOT clickable,
 *     `aria-disabled`, visually muted, NOT focusable by keyboard nav.
 *   - Out-of-month (leading/trailing cells from buildMonthGrid):
 *     rendered MUTED but STILL clickable — clicking navigates to that
 *     month AND selects the day. Arrow keys can navigate into them and
 *     the displayed month updates to follow focus.
 *
 * Controlled vs uncontrolled
 * --------------------------
 *   - `value` (controlled) wins over `defaultValue` if both are passed
 *     (React convention — and we surface this only for the selected
 *     date, not the displayed month, which is always internal state
 *     seeded from value/defaultValue/today).
 *
 * @example Standalone, uncontrolled
 *   <Calendar onChange={(d) => console.log(d)} />
 *
 * @example Controlled with min/max
 *   <Calendar value={value} onChange={setValue} min="2026-01-01" max="2026-12-31" />
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { DateValue } from './DateDisplay'
import {
  addDays,
  addMonths,
  addYears,
  buildMonthGrid,
  isDateInRange,
  isSameDay,
  isSameMonth,
  isValidDate,
  MONTH_LONG_LABELS,
  startOfDay,
  startOfMonth,
  toDate,
  WEEKDAY_LONG_LABELS,
  WEEKDAY_SHORT_LABELS,
} from './dateUtils'
import styles from './Calendar.module.css'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CalendarProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'defaultValue'
  > {
  /** Selected date (controlled). */
  value?: DateValue
  /** Initial selected date (uncontrolled). */
  defaultValue?: DateValue
  /** Selection callback. Fires with a Date at midnight local time. */
  onChange?: (date: Date) => void
  /** Disable dates before this. */
  min?: DateValue
  /** Disable dates after this. */
  max?: DateValue
  /** Whole-component disabled. No interaction; all cells non-clickable. */
  disabled?: boolean
  /** Accessible label for the application surface. */
  label?: string
  /** Extra class on the root (the visual root — the `role="application"` div). */
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a DateValue input → Date | undefined. Returns `undefined` for
 * `undefined`/invalid input so downstream code can branch on existence
 * without re-running `isValidDate`.
 */
function normalizeDate(value: DateValue | undefined): Date | undefined {
  if (value === undefined) return undefined
  const d = toDate(value)
  return isValidDate(d) ? d : undefined
}

/** A Date for "today" at local midnight. Recomputed once per render. */
function getToday(): Date {
  return startOfDay(new Date())
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function Calendar({
  value: controlledValue,
  defaultValue,
  onChange,
  min,
  max,
  disabled = false,
  label = 'Choose a date',
  className,
  style,
  ...rest
}: CalendarProps) {
  // -------------------------------------------------------------------------
  // Selected date — controlled or uncontrolled.
  // -------------------------------------------------------------------------
  const isControlled = controlledValue !== undefined
  const normalizedControlled = useMemo(
    () => normalizeDate(controlledValue),
    [controlledValue]
  )
  const [internalSelected, setInternalSelected] = useState<Date | undefined>(
    () => normalizeDate(defaultValue)
  )
  const selected = isControlled ? normalizedControlled : internalSelected

  // -------------------------------------------------------------------------
  // Min / max — normalized once per prop change.
  // -------------------------------------------------------------------------
  const minDate = useMemo(() => normalizeDate(min), [min])
  const maxDate = useMemo(() => normalizeDate(max), [max])

  // -------------------------------------------------------------------------
  // Displayed month — internal state. Seeded ONCE from selected → today on
  // mount via lazy initializer, and snapped to the selected month when
  // controlled value changes (via the effect below). Using a lazy initializer
  // (rather than a memo + initial state) avoids the "selected" exhaustive-deps
  // warning while preserving the intent: re-seeding every time `selected`
  // changes would prevent the user from navigating away from the selected
  // month (clicking "next" then having a controlled-value change snap them
  // back). The controlled-snap behaviour lives in a separate effect.
  // -------------------------------------------------------------------------
  const [displayedMonth, setDisplayedMonth] = useState<Date>(() => {
    const seed = selected ?? getToday()
    return startOfMonth(seed)
  })

  // When controlled `value` changes to a date in a DIFFERENT month, follow
  // the consumer's lead and display that month. (Common case: form reset.)
  // We compare with the LIVE displayedMonth via a ref to avoid making this
  // effect depend on it (which would re-snap whenever the user navigated).
  const displayedMonthRef = useRef(displayedMonth)
  useEffect(() => {
    displayedMonthRef.current = displayedMonth
  }, [displayedMonth])

  useEffect(() => {
    if (!isControlled) return
    if (!normalizedControlled) return
    if (!isSameMonth(normalizedControlled, displayedMonthRef.current)) {
      setDisplayedMonth(startOfMonth(normalizedControlled))
    }
  }, [isControlled, normalizedControlled])

  // -------------------------------------------------------------------------
  // Focused date — drives the roving tabIndex. Default to selected → today.
  // Always normalized to a date that exists in the displayed-or-adjacent
  // months (since arrow keys can roam across month boundaries).
  // -------------------------------------------------------------------------
  const [focusedDate, setFocusedDate] = useState<Date>(() => {
    const seed = selected ?? getToday()
    return startOfDay(seed)
  })

  // Keep focused date sensible when controlled value changes externally.
  useEffect(() => {
    if (!isControlled) return
    if (!normalizedControlled) return
    setFocusedDate(startOfDay(normalizedControlled))
  }, [isControlled, normalizedControlled])

  // Whether DOM focus should be moved into the focused cell. We only want to
  // shift focus when the user has actively driven it (keyboard nav / clicks
  // inside the grid) — not on initial mount, which would steal focus from
  // the page. A ref so toggling it doesn't trigger a re-render.
  const shouldShiftFocusRef = useRef(false)

  // -------------------------------------------------------------------------
  // ARIA ids — stable across renders.
  // -------------------------------------------------------------------------
  const reactId = useId()
  const monthLabelId = `cal-month-${reactId}`
  const liveRegionId = `cal-live-${reactId}`

  // -------------------------------------------------------------------------
  // Month grid.
  // -------------------------------------------------------------------------
  const grid = useMemo(() => buildMonthGrid(displayedMonth), [displayedMonth])
  const today = getToday()

  // -------------------------------------------------------------------------
  // Cell ref map — keyed by ISO yyyy-mm-dd of the cell's date — so we can
  // imperatively focus a cell after a state change (arrow nav, page nav).
  // A ref to a Map (not state) so we don't trigger re-renders on each mount.
  // -------------------------------------------------------------------------
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())
  const dateKey = useCallback((d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }, [])

  // After every render where shouldShiftFocusRef is set, move DOM focus to
  // the focused cell. Reset the ref after applying. We use a layout effect
  // wouldn't help here — focus must land AFTER the new grid commits, so a
  // regular effect (post-paint) is correct.
  useEffect(() => {
    if (!shouldShiftFocusRef.current) return
    shouldShiftFocusRef.current = false
    const key = dateKey(focusedDate)
    const btn = cellRefs.current.get(key)
    if (btn && typeof btn.focus === 'function') {
      btn.focus()
    }
  }, [focusedDate, displayedMonth, dateKey])

  // -------------------------------------------------------------------------
  // aria-live announcement string — month + year text. Updated when the
  // displayed month changes; the polite region picks it up automatically.
  // -------------------------------------------------------------------------
  const monthLabel = useMemo(() => {
    const m = MONTH_LONG_LABELS[displayedMonth.getMonth()]
    const y = displayedMonth.getFullYear()
    return `${m} ${y}`
  }, [displayedMonth])

  // -------------------------------------------------------------------------
  // Day-cell helpers.
  // -------------------------------------------------------------------------

  /**
   * True iff the cell's date is forbidden by min/max OR the whole component
   * is disabled. Out-of-current-month is NOT "disabled" in this sense — those
   * cells stay interactive (the standard date-picker UX).
   */
  const isCellDisabled = useCallback(
    (date: Date): boolean => {
      if (disabled) return true
      if (!isDateInRange(date, minDate, maxDate)) return true
      return false
    },
    [disabled, minDate, maxDate]
  )

  /** Full date string for a cell's `aria-label`. */
  const formatDateLabel = useCallback((d: Date): string => {
    // Browser locale by default — matches DateDisplay's default formatting.
    // Falls back gracefully when Intl is missing (older targets in our
    // browser-floor support `dateStyle: 'full'`; we still wrap defensively).
    try {
      return d.toLocaleDateString(undefined, { dateStyle: 'full' })
    } catch {
      const weekday = WEEKDAY_LONG_LABELS[(d.getDay() + 6) % 7]
      const month = MONTH_LONG_LABELS[d.getMonth()]
      return `${weekday}, ${month} ${d.getDate()}, ${d.getFullYear()}`
    }
  }, [])

  // -------------------------------------------------------------------------
  // Commit a selection. Always emits a fresh Date at local midnight so the
  // consumer doesn't inherit our internal Date reference.
  // -------------------------------------------------------------------------
  const commitSelection = useCallback(
    (date: Date) => {
      if (disabled) return
      if (!isDateInRange(date, minDate, maxDate)) return
      const day = startOfDay(date)
      if (!isControlled) {
        setInternalSelected(day)
      }
      onChange?.(new Date(day.getTime()))
    },
    [disabled, minDate, maxDate, isControlled, onChange]
  )

  // -------------------------------------------------------------------------
  // Click on a day cell. If the cell is out-of-current-month, the displayed
  // month follows the click (per the "Out-of-range vs out-of-month" rule
  // above).
  // -------------------------------------------------------------------------
  const handleDayClick = useCallback(
    (date: Date) => {
      if (isCellDisabled(date)) return
      setFocusedDate(startOfDay(date))
      if (!isSameMonth(date, displayedMonth)) {
        setDisplayedMonth(startOfMonth(date))
      }
      commitSelection(date)
    },
    [isCellDisabled, displayedMonth, commitSelection]
  )

  // -------------------------------------------------------------------------
  // Move focus to `next`, syncing the displayed month if necessary. Used by
  // every keyboard handler so focus + month + cell-DOM-focus all stay in
  // sync via one path.
  // -------------------------------------------------------------------------
  const moveFocus = useCallback(
    (next: Date) => {
      const nextDay = startOfDay(next)
      setFocusedDate(nextDay)
      if (!isSameMonth(nextDay, displayedMonth)) {
        setDisplayedMonth(startOfMonth(nextDay))
      }
      shouldShiftFocusRef.current = true
    },
    [displayedMonth]
  )

  // -------------------------------------------------------------------------
  // Day-button keyboard handler — the WAI-ARIA grid keymap.
  // -------------------------------------------------------------------------
  const handleDayKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, cellDate: Date) => {
      if (disabled) return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          moveFocus(addDays(cellDate, -1))
          return
        case 'ArrowRight':
          e.preventDefault()
          moveFocus(addDays(cellDate, 1))
          return
        case 'ArrowUp':
          e.preventDefault()
          moveFocus(addDays(cellDate, -7))
          return
        case 'ArrowDown':
          e.preventDefault()
          moveFocus(addDays(cellDate, 7))
          return
        case 'Home': {
          e.preventDefault()
          // Move to MONDAY of the current week (Monday-first). In our system,
          // (getDay() + 6) % 7 → 0 = Monday, 6 = Sunday — the offset INTO
          // the week. Subtract that to land on Monday.
          const offset = (cellDate.getDay() + 6) % 7
          moveFocus(addDays(cellDate, -offset))
          return
        }
        case 'End': {
          e.preventDefault()
          const offset = (cellDate.getDay() + 6) % 7
          moveFocus(addDays(cellDate, 6 - offset))
          return
        }
        case 'PageUp': {
          e.preventDefault()
          const next = e.shiftKey ? addYears(cellDate, -1) : addMonths(cellDate, -1)
          moveFocus(next)
          return
        }
        case 'PageDown': {
          e.preventDefault()
          const next = e.shiftKey ? addYears(cellDate, 1) : addMonths(cellDate, 1)
          moveFocus(next)
          return
        }
        case 'Enter':
        case ' ':
          // Space (' ') is the standard "activate button" key — `<button>`
          // browsers already handle Space on click, but we preventDefault
          // for parity with Enter and to keep selection logic in one path.
          e.preventDefault()
          commitSelection(cellDate)
          return
      }
    },
    [disabled, moveFocus, commitSelection]
  )

  // -------------------------------------------------------------------------
  // Month-nav button handlers. Drive the displayed month and slide focus
  // forward by the same delta so the focused cell stays in view.
  // -------------------------------------------------------------------------
  const handlePrevMonth = useCallback(() => {
    if (disabled) return
    setDisplayedMonth((m) => addMonths(m, -1))
    setFocusedDate((d) => addMonths(d, -1))
    // We did NOT call moveFocus — that would shift DOM focus into the grid.
    // The user clicked the prev button, which already has DOM focus; keep it.
  }, [disabled])

  const handleNextMonth = useCallback(() => {
    if (disabled) return
    setDisplayedMonth((m) => addMonths(m, 1))
    setFocusedDate((d) => addMonths(d, 1))
  }, [disabled])

  // -------------------------------------------------------------------------
  // Roving tabIndex — exactly one cell is tabbable. We pick the focused
  // date's cell IF it lives in the current 42-cell grid; otherwise the first
  // in-month day (fallback for the rare case where focusedDate falls outside
  // the grid e.g. after a programmatic value change to a far-away month).
  // -------------------------------------------------------------------------
  const tabbableKey = useMemo(() => {
    const focusKey = dateKey(focusedDate)
    if (grid.some((cell) => dateKey(cell.date) === focusKey)) {
      return focusKey
    }
    // Fallback: first in-current-month cell, or the very first cell.
    const firstInMonth = grid.find((cell) => cell.inCurrentMonth) ?? grid[0]
    return firstInMonth ? dateKey(firstInMonth.date) : focusKey
  }, [focusedDate, grid, dateKey])

  // -------------------------------------------------------------------------
  // Build the rows (6 rows × 7 cells) once per grid recalc.
  // -------------------------------------------------------------------------
  const rows = useMemo(() => {
    const out: typeof grid[] = []
    for (let i = 0; i < 6; i++) {
      out.push(grid.slice(i * 7, i * 7 + 7))
    }
    return out
  }, [grid])

  // -------------------------------------------------------------------------
  // Render.
  // -------------------------------------------------------------------------
  const rootClass = [styles.root, disabled && styles.disabled, className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      // #422 — consumer `style` + `...rest` are spread FIRST so Calendar's own
      // application semantics (role + aria-label + aria-disabled) stay
      // authoritative. `className` is already merged into `rootClass`.
      {...rest}
      style={style}
      role="application"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={rootClass}
    >
      {/* ===== Header — prev | "Month Year" | next ===== */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navButton}
          onClick={handlePrevMonth}
          disabled={disabled}
          aria-label="Previous month"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 4 L6 8 L10 12"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          id={monthLabelId}
          className={styles.monthLabel}
          // Title above the grid that the table also points at via
          // aria-labelledby — single source for the grid's accessible name
          // beyond the application root.
        >
          {monthLabel}
        </div>
        <button
          type="button"
          className={styles.navButton}
          onClick={handleNextMonth}
          disabled={disabled}
          aria-label="Next month"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 4 L10 8 L6 12"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* ===== Grid ===== */}
      <table
        role="grid"
        aria-labelledby={monthLabelId}
        className={styles.grid}
      >
        <thead>
          <tr>
            {WEEKDAY_SHORT_LABELS.map((short, i) => (
              <th
                key={short}
                scope="col"
                abbr={WEEKDAY_LONG_LABELS[i]}
                className={styles.weekdayHeader}
              >
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell) => {
                const key = dateKey(cell.date)
                const cellDisabled = isCellDisabled(cell.date)
                const isSelectedDay =
                  selected !== undefined && isSameDay(cell.date, selected)
                const isToday = isSameDay(cell.date, today)
                const isTabbable = key === tabbableKey

                const buttonClass = [
                  styles.day,
                  !cell.inCurrentMonth && styles.dayOutside,
                  isSelectedDay && styles.daySelected,
                  isToday && styles.dayToday,
                  cellDisabled && styles.dayDisabled,
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <td
                    key={key}
                    role="gridcell"
                    aria-selected={isSelectedDay || undefined}
                    className={styles.cell}
                  >
                    <button
                      ref={(el) => {
                        if (el) cellRefs.current.set(key, el)
                        else cellRefs.current.delete(key)
                      }}
                      type="button"
                      className={buttonClass}
                      tabIndex={isTabbable ? 0 : -1}
                      disabled={cellDisabled}
                      aria-disabled={cellDisabled || undefined}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={formatDateLabel(cell.date)}
                      onClick={() => handleDayClick(cell.date)}
                      onKeyDown={(e) => handleDayKeyDown(e, cell.date)}
                    >
                      {cell.date.getDate()}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== Live region — announces month changes politely ===== */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {monthLabel}
      </div>
    </div>
  )
}

Calendar.displayName = 'Calendar'
