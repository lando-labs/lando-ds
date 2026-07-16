/**
 * Internal date utilities for the DatePicker family (#312).
 *
 * Design constraints (per Sprint 55 lane brief):
 *  - **No external date libs** (no moment / date-fns / dayjs). Native `Date` only.
 *  - **Browser-local timezone** — we never apply UTC offsets. An ISO string
 *    `"2026-06-29"` is parsed as June 29 2026 in the user's *local* zone.
 *    (Naively `new Date("2026-06-29")` treats the string as UTC midnight,
 *    which can shift the displayed day by ±1 depending on the user's offset.
 *    `parseISODateString` constructs the Date with the local zone instead.)
 *  - **First day of week**: Monday (ISO 8601). Documented in the Calendar
 *    component. We default to Monday because:
 *      (a) it's the international standard,
 *      (b) Lando's posture is non-US-centric,
 *      (c) it's a single deferred prop away if a consumer needs Sunday.
 *
 * No `'use client'` — these are pure functions, server-safe.
 */

import type { DateValue } from './DateDisplay'

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/** ISO `yyyy-mm-dd` matcher. Strict — no time component, no timezone. */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Parse an ISO `yyyy-mm-dd` string into a Date in the LOCAL timezone.
 *
 * `new Date("2026-06-29")` treats the string as UTC midnight, which causes a
 * ±1-day shift depending on the user's offset (e.g. -07:00 renders "Jun 28"
 * for that string). We sidestep that by constructing via the `(y, m, d)`
 * overload, which is always local.
 *
 * Returns `null` if the string is malformed.
 */
export function parseISODateString(input: string): Date | null {
  const match = ISO_DATE_RE.exec(input.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  // Reject 2026-02-30 etc — the constructor silently rolls over.
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}

/**
 * Coerce a `DateValue` into a Date. String inputs are parsed as ISO
 * yyyy-mm-dd in the local zone (see `parseISODateString`). Date instances
 * are returned as-is (cloned to avoid mutation leaks).
 *
 * Returns an Invalid Date if the input cannot be parsed — callers should
 * gate on `isValidDate()` before using the result.
 */
export function toDate(value: DateValue): Date {
  if (value instanceof Date) return new Date(value.getTime())
  const parsed = parseISODateString(value)
  if (parsed) return parsed
  // Fall back to Date constructor for any other string (eg consumer-provided
  // RFC2822). Returns Invalid Date for unparseable strings.
  return new Date(value)
}

export function isValidDate(d: Date): boolean {
  return d instanceof Date && !Number.isNaN(d.getTime())
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a Date as ISO `yyyy-mm-dd` (LOCAL date, NOT UTC).
 *
 * `date.toISOString().slice(0, 10)` would silently shift the day for users
 * whose local zone crosses midnight differently from UTC. We build the string
 * manually from the local getters instead.
 */
export function toISODateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/** True iff `a` and `b` denote the same calendar day in local time. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** True iff `a` and `b` are in the same calendar month + year. */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** Strip the time portion — returns the same Date at 00:00:00 local. */
export function startOfDay(date: Date): Date {
  const d = new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Compare two Dates by calendar day only (ignoring time). Returns -1/0/1.
 */
export function compareDays(a: Date, b: Date): -1 | 0 | 1 {
  const aDay = startOfDay(a).getTime()
  const bDay = startOfDay(b).getTime()
  if (aDay < bDay) return -1
  if (aDay > bDay) return 1
  return 0
}

/** True iff `date` falls in `[min, max]` (day-precision, inclusive on both ends). */
export function isDateInRange(
  date: Date,
  min: Date | undefined,
  max: Date | undefined
): boolean {
  if (min && compareDays(date, min) < 0) return false
  if (max && compareDays(date, max) > 0) return false
  return true
}

// ---------------------------------------------------------------------------
// Month navigation
// ---------------------------------------------------------------------------

/**
 * Return the first day (midnight, local) of `date`'s month.
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Add `months` to `date`. Day-of-month is clamped (Mar 31 + 1mo = Apr 30). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  const targetMonth = d.getMonth() + months
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const desiredDay = d.getDate()
  d.setFullYear(targetYear, normalizedMonth, 1)
  const daysInTarget = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  d.setDate(Math.min(desiredDay, daysInTarget))
  return d
}

/** Add `years` to `date`. Feb 29 → Feb 28 in non-leap years. */
export function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12)
}

/** Add `days` to `date` (handles month + year rollover via native Date). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + days)
  return d
}

// ---------------------------------------------------------------------------
// Calendar grid
// ---------------------------------------------------------------------------

/**
 * First-day-of-week constant. Monday (ISO 8601) — see file header rationale.
 *
 * `Date.getDay()` returns 0 = Sunday … 6 = Saturday. Our grid offset uses
 * `(getDay() + 7 - 1) % 7` so Monday = 0 … Sunday = 6.
 */
export const FIRST_DAY_OF_WEEK = 1 // Monday

/** Weekday header labels (short form), aligned to FIRST_DAY_OF_WEEK = Monday. */
export const WEEKDAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** Full weekday names used for the column-header `aria-label`. */
export const WEEKDAY_LONG_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/** Month names for the calendar header. */
export const MONTH_LONG_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * Build the 6×7 (42-cell) day grid for the given `month`. Always returns
 * exactly 42 cells (six weeks) so the calendar's vertical size never jumps
 * between months — a UX hostility we explicitly avoid.
 *
 * Cells before the 1st-of-month are the trailing days of the previous month;
 * cells after the last-of-month are leading days of the next. Each cell is
 * tagged with `inCurrentMonth` so the renderer can dim or hide them.
 */
export interface CalendarCell {
  date: Date
  inCurrentMonth: boolean
}

export function buildMonthGrid(month: Date): CalendarCell[] {
  const monthStart = startOfMonth(month)
  // Day-of-week of the 1st, expressed in our Monday=0 system.
  const startOffset = (monthStart.getDay() + 7 - FIRST_DAY_OF_WEEK) % 7
  // First grid cell = the Monday on or before the 1st.
  const gridStart = addDays(monthStart, -startOffset)
  const cells: CalendarCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i)
    cells.push({
      date: d,
      inCurrentMonth: isSameMonth(d, month),
    })
  }
  return cells
}
