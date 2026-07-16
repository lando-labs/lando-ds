'use client'

/**
 * DateRangePicker — Portal-anchored two-end calendar (#312).
 *
 * Lane C of Sprint 56 (v0.35.0). Composes the existing pieces:
 *   - `Input` for the formatted-range trigger
 *   - `Portal` + `usePortalPosition` for the floating dialog surface
 *   - `Calendar` (Lane A) for the month grid
 *
 * Architectural choice — Portal + `usePortalPosition`, NOT `<Popover>`
 * --------------------------------------------------------------------
 * Mirrors the rationale already shipped by Lane B's `<DatePicker>`. Three
 * reasons we lift out of `<Popover>`:
 *
 *  1. Popover clones its `trigger` element and grafts handlers (`onClick`
 *     calls `e.preventDefault()`) — that clobbers the input bindings + caret
 *     and is silently masked here because the trigger is `readOnly`.
 *  2. Popover hardcodes `role="tooltip"` on its rendered wrapper. We need
 *     `role="dialog"` to honour `aria-haspopup="dialog"` on the trigger.
 *     Without the lift you end up with `<div role="tooltip"><div role="dialog">`
 *     — semantically wrong for an interactive picker.
 *  3. Popover wires `aria-describedby` on the trigger; the combobox-dialog
 *     pattern needs `aria-controls` so screen readers walk to the dialog.
 *
 * We DO NOT reimplement or fork Calendar. The range-highlight chrome
 * (between provisional start and the hover cell) is painted from a
 * wrapper that toggles `data-in-range` / `data-range-preview-end`
 * attributes on Calendar's day buttons via a layout effect. CSS in
 * `DateRangePicker.module.css` keys the tint off those attributes.
 *
 * Selection flow
 * --------------
 *   1. User opens the dialog (click the input).
 *   2. First Calendar click → `provisionalStart` is set. Dialog stays
 *      open; Calendar shows `value={provisionalStart}` so the cell wears
 *      the selected style.
 *   3. User hovers (or arrow-key focuses) a cell → highlight paints
 *      between provisional start and the hovered cell.
 *   4. Second click:
 *       - If after provisional start → `[provisional, click]` is the
 *         range; fires `onChange`, closes dialog.
 *       - If before provisional start → swap so the earlier date is
 *         start; still fires `onChange`, still closes.
 *   5. Re-opening after a range is set returns to "select start" mode
 *      (the provisional state is cleared on close).
 *
 * Tracking displayed month without modifying Calendar
 * ---------------------------------------------------
 * Calendar owns its displayed-month state internally and we can't read
 * it directly. We mirror it via two intercepts:
 *   - Click delegation on the dialog host: if the click targets the
 *     "Previous month" / "Next month" nav button, we update our mirror
 *     accordingly.
 *   - When Calendar's `onChange` fires, we follow the clicked date's
 *     month (same behavior Calendar performs internally for
 *     out-of-month clicks).
 * The mirror is only used to derive the date from a hover/focus event
 * (by indexing into `buildMonthGrid(mirroredMonth)`). If our mirror
 * drifts (e.g. an unforeseen interaction), the highlight will look
 * wrong for a frame but the SELECTION path is still authoritative —
 * Calendar's `onChange` always gives us the right date.
 *
 * A11y
 * ----
 *   - Trigger input: `role="combobox" aria-haspopup="dialog"
 *     aria-expanded`. `aria-controls` points at the dialog id while open.
 *   - Dialog: `role="dialog" aria-label="Choose date range"`.
 *     Calendar's own `role="application"` still names the inner
 *     surface — the dialog wrapper is a navigable container above it.
 *   - aria-live polite region announces:
 *       - "Start selected: {date}. Click an end date." between clicks
 *       - "Selected range: {start} to {end}" after second click
 *   - Escape closes WITHOUT clearing — a document-level keydown listener
 *     catches the key regardless of focus location.
 *   - Outside click closes (defers via setTimeout(0) so the opening
 *     click doesn't immediately fire as the outside event).
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Input } from '../Input'
import { Portal } from '../Portal'
import { usePortalPosition } from '../../hooks/usePortalPosition'
import { Calendar } from './Calendar'
import type { DateValue } from './DateDisplay'
import {
  buildMonthGrid,
  compareDays,
  isSameMonth,
  isValidDate,
  startOfDay,
  startOfMonth,
} from './dateUtils'
import styles from './DateRangePicker.module.css'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DateRangePickerProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'defaultValue'
  > {
  /** Selected range (controlled). */
  value?: [Date, Date]
  /** Initial range (uncontrolled). */
  defaultValue?: [Date, Date]
  /** Selection callback; `undefined` when cleared. */
  onChange?: (range: [Date, Date] | undefined) => void
  /** Open state of the calendar dialog (controlled). */
  open?: boolean
  /** Initial open state (uncontrolled). */
  defaultOpen?: boolean
  /** Open-state callback. */
  onOpenChange?: (open: boolean) => void
  /** Min selectable date. */
  min?: DateValue
  /** Max selectable date. */
  max?: DateValue
  /** Disable the whole control. */
  disabled?: boolean
  /** Label rendered above the trigger input. */
  label?: string
  /** Placeholder when no range is selected. */
  placeholder?: string
  /** Custom formatter for the visible range text. Default `MM/DD/YYYY – MM/DD/YYYY`. */
  format?: (range: [Date, Date]) => string
  /** Trigger size — passes through to Input. */
  size?: 'sm' | 'md' | 'lg'
  /** Error message (input enters error state). */
  error?: string
  /** Helper text under the input. */
  helperText?: string
  /** Show a clear button when a range is selected. */
  clearable?: boolean
  /**
   * Extra class on the visual root.
   *
   * #422 — DateRangePicker's top-level render is a Fragment (the trigger row,
   * a Portal-rendered dialog, and an off-screen live region). The trigger row
   * is the inline visual anchor, so `className` / `style` / `...rest` land on
   * it. The Portal dialog + live region are detached and unaffected.
   */
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRange(
  value: [Date, Date] | undefined
): [Date, Date] | undefined {
  if (!value) return undefined
  const [a, b] = value
  if (!isValidDate(a) || !isValidDate(b)) return undefined
  const startA = startOfDay(a)
  const startB = startOfDay(b)
  return compareDays(startA, startB) <= 0 ? [startA, startB] : [startB, startA]
}

function defaultFormat(range: [Date, Date]): string {
  return `${formatOne(range[0])} – ${formatOne(range[1])}`
}

function formatOne(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const y = d.getFullYear()
  return `${m}/${day}/${y}`
}

/**
 * Build the inclusive set of dates between `a` and `b` (order-agnostic).
 * Day-precision, midnight-local timestamps as keys.
 */
function buildRangeKeys(a: Date, b: Date): Set<number> {
  const [lo, hi] = compareDays(a, b) <= 0 ? [a, b] : [b, a]
  const out = new Set<number>()
  const day = startOfDay(lo)
  const end = startOfDay(hi).getTime()
  while (day.getTime() <= end) {
    out.add(day.getTime())
    day.setDate(day.getDate() + 1)
  }
  return out
}

// ---------------------------------------------------------------------------
// DateRangePicker
// ---------------------------------------------------------------------------

export function DateRangePicker({
  value: controlledValue,
  defaultValue,
  onChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  min,
  max,
  disabled = false,
  label,
  placeholder = 'Select date range',
  format = defaultFormat,
  size = 'md',
  error,
  helperText,
  clearable = false,
  className = '',
  style,
  ...rest
}: DateRangePickerProps) {
  // -------------------------------------------------------------------------
  // Value — controlled vs uncontrolled.
  // -------------------------------------------------------------------------
  const isControlledValue = controlledValue !== undefined
  const normalizedControlled = useMemo(
    () => normalizeRange(controlledValue),
    [controlledValue]
  )
  const [internalValue, setInternalValue] = useState<[Date, Date] | undefined>(
    () => normalizeRange(defaultValue)
  )
  const value = isControlledValue ? normalizedControlled : internalValue

  // -------------------------------------------------------------------------
  // Open state — controlled vs uncontrolled.
  // -------------------------------------------------------------------------
  const isControlledOpen = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = isControlledOpen ? controlledOpen : internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      // Disabled control may not OPEN the dialog. Closing is always
      // allowed (defensive — covers prop-changes-while-open).
      if (disabled && next) return
      if (!isControlledOpen) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlledOpen, onOpenChange, disabled]
  )

  // -------------------------------------------------------------------------
  // Provisional start — set on the first Calendar click. Cleared on close
  // (so re-opening returns to "select start" mode).
  // -------------------------------------------------------------------------
  const [provisionalStart, setProvisionalStart] = useState<Date | undefined>(
    undefined
  )

  // -------------------------------------------------------------------------
  // Hovered date — drives the in-range preview. Computed from event
  // delegation on the dialog host (see `handleHostMouseOver`).
  // -------------------------------------------------------------------------
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined)

  // -------------------------------------------------------------------------
  // Mirrored displayed-month. Seeded from value/today; updated by:
  //   - Calendar onChange (the clicked date's month, since Calendar
  //     auto-navigates to that month for out-of-month clicks).
  //   - Click delegation on the dialog host (prev/next nav buttons).
  // -------------------------------------------------------------------------
  const [displayedMonth, setDisplayedMonth] = useState<Date>(() => {
    const seed = value?.[0] ?? new Date()
    return startOfMonth(seed)
  })

  // When the dialog OPENS, re-seed the displayed month from the current
  // value (or today). This keeps re-open consistent if the consumer changed
  // `value` while we were closed.
  useEffect(() => {
    if (!isOpen) return
    const seed = value?.[0] ?? new Date()
    setDisplayedMonth(startOfMonth(seed))
  }, [isOpen, value])

  // When the dialog closes, clear provisional + hover state so we start
  // fresh on re-open.
  useEffect(() => {
    if (isOpen) return
    setProvisionalStart(undefined)
    setHoveredDate(undefined)
  }, [isOpen])

  // -------------------------------------------------------------------------
  // ids — for ARIA wiring (combobox -> dialog, live region).
  // -------------------------------------------------------------------------
  const reactId = useId()
  const dialogId = `drp-dialog-${reactId}`
  const liveRegionId = `drp-live-${reactId}`

  // -------------------------------------------------------------------------
  // Refs — trigger container drives portal positioning + outside-click; the
  // dialog ref is the overlay measurement target for usePortalPosition.
  // -------------------------------------------------------------------------
  const triggerRowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // -------------------------------------------------------------------------
  // Portal positioning — anchored to the trigger row, aligned to its left
  // edge. We don't `matchTriggerWidth` because Calendar has an intrinsic
  // width (~17rem) that the input shouldn't pin.
  // -------------------------------------------------------------------------
  const position = usePortalPosition(triggerRowRef, isOpen, {
    align: 'left',
    offset: 4,
    overlayRef: dialogRef,
  })

  // -------------------------------------------------------------------------
  // Live announcement string — flips between selection phases.
  // -------------------------------------------------------------------------
  const liveMessage = useMemo(() => {
    if (provisionalStart) {
      return `Start selected: ${formatOne(provisionalStart)}. Click an end date.`
    }
    if (value) {
      return `Selected range: ${formatOne(value[0])} to ${formatOne(value[1])}`
    }
    return ''
  }, [provisionalStart, value])

  // -------------------------------------------------------------------------
  // Visible trigger text — formatted range or placeholder.
  // -------------------------------------------------------------------------
  const displayText = useMemo(() => {
    if (!value) return ''
    try {
      return format(value)
    } catch {
      return defaultFormat(value)
    }
  }, [value, format])

  // -------------------------------------------------------------------------
  // Commit a complete range. Fires onChange, closes dialog, clears
  // provisional state.
  // -------------------------------------------------------------------------
  const commitRange = useCallback(
    (a: Date, b: Date) => {
      const normalized = normalizeRange([startOfDay(a), startOfDay(b)])
      if (!normalized) return
      if (!isControlledValue) setInternalValue(normalized)
      onChange?.(normalized)
      setProvisionalStart(undefined)
      setHoveredDate(undefined)
      setOpen(false)
    },
    [isControlledValue, onChange, setOpen]
  )

  // -------------------------------------------------------------------------
  // Calendar onChange — drives the two-phase selection flow.
  // -------------------------------------------------------------------------
  const handleCalendarChange = useCallback(
    (date: Date) => {
      const day = startOfDay(date)
      // Always mirror displayed month — Calendar navigates internally on
      // out-of-month clicks, so we follow.
      if (!isSameMonth(day, displayedMonth)) {
        setDisplayedMonth(startOfMonth(day))
      }
      if (!provisionalStart) {
        // First click → set provisional start.
        setProvisionalStart(day)
        return
      }
      // Second click → commit range. swap if before provisional.
      commitRange(provisionalStart, day)
    },
    [provisionalStart, displayedMonth, commitRange]
  )

  // -------------------------------------------------------------------------
  // Click delegation on the dialog host — intercept prev/next month nav so
  // we can mirror Calendar's displayed-month state.
  // -------------------------------------------------------------------------
  const handleHostClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      const button = target.closest('button')
      if (!button) return
      const navLabel = button.getAttribute('aria-label')
      if (navLabel === 'Previous month') {
        setDisplayedMonth((m) => {
          const next = new Date(m.getFullYear(), m.getMonth() - 1, 1)
          return next
        })
        return
      }
      if (navLabel === 'Next month') {
        setDisplayedMonth((m) => {
          const next = new Date(m.getFullYear(), m.getMonth() + 1, 1)
          return next
        })
        return
      }
    },
    []
  )

  // -------------------------------------------------------------------------
  // Derive date from a day-button event by finding its index in Calendar's
  // gridcell list. Combined with our mirrored displayedMonth, the index
  // resolves uniquely to the cell's Date via buildMonthGrid.
  // -------------------------------------------------------------------------
  const dateFromCellButton = useCallback(
    (button: HTMLButtonElement): Date | undefined => {
      const host = dialogRef.current
      if (!host) return undefined
      const cellButtons = Array.from(
        host.querySelectorAll<HTMLButtonElement>('[role="gridcell"] button')
      )
      const idx = cellButtons.indexOf(button)
      if (idx < 0 || idx >= 42) return undefined
      const grid = buildMonthGrid(displayedMonth)
      return grid[idx]?.date
    },
    [displayedMonth]
  )

  // -------------------------------------------------------------------------
  // Hover tracking — mouseover/focus delegation on the dialog host. We
  // only care about day-cell buttons; nav buttons are skipped.
  // -------------------------------------------------------------------------
  const handleHostMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!provisionalStart) return
      const target = e.target as HTMLElement
      const button = target.closest<HTMLButtonElement>(
        '[role="gridcell"] button'
      )
      if (!button) return
      if (button.disabled) return
      const date = dateFromCellButton(button)
      if (date) setHoveredDate(date)
    },
    [provisionalStart, dateFromCellButton]
  )

  const handleHostMouseOut = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const related = e.relatedTarget as HTMLElement | null
      // If the pointer left the host entirely (or moved into a non-grid area),
      // drop the hover. We don't clear when moving between cells — the next
      // mouseover will overwrite.
      if (!related || !dialogRef.current?.contains(related)) {
        setHoveredDate(undefined)
        return
      }
      const stillOnCell = related.closest('[role="gridcell"] button')
      if (!stillOnCell) {
        setHoveredDate(undefined)
      }
    },
    []
  )

  const handleHostFocusIn = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!provisionalStart) return
      const target = e.target as HTMLElement
      const button = target.closest<HTMLButtonElement>(
        '[role="gridcell"] button'
      )
      if (!button) return
      if (button.disabled) return
      const date = dateFromCellButton(button)
      if (date) setHoveredDate(date)
    },
    [provisionalStart, dateFromCellButton]
  )

  // -------------------------------------------------------------------------
  // Paint the range-highlight on Calendar's day buttons via data-attributes.
  // Layout-effect so the paint lands in the same commit as React's render —
  // no visible flash between Calendar re-render and our attribute toggle.
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    const host = dialogRef.current
    if (!host) return
    const cellButtons = Array.from(
      host.querySelectorAll<HTMLButtonElement>('[role="gridcell"] button')
    )

    // The set of timestamps to paint as "in range". Three sources:
    //   1. Final value (always painted when dialog is OPEN with no provisional)
    //   2. Provisional + hovered (in-progress range preview)
    //   3. Nothing (no provisional, no committed value)
    let inRangeKeys: Set<number> | null = null
    let previewEndKey: number | null = null

    if (provisionalStart && hoveredDate) {
      inRangeKeys = buildRangeKeys(provisionalStart, hoveredDate)
      previewEndKey = startOfDay(hoveredDate).getTime()
    } else if (!provisionalStart && value) {
      inRangeKeys = buildRangeKeys(value[0], value[1])
    }

    cellButtons.forEach((btn) => {
      const date = dateFromCellButton(btn)
      if (!date) {
        btn.removeAttribute('data-in-range')
        btn.removeAttribute('data-range-preview-end')
        return
      }
      const key = startOfDay(date).getTime()
      if (inRangeKeys && inRangeKeys.has(key)) {
        btn.setAttribute('data-in-range', 'true')
      } else {
        btn.removeAttribute('data-in-range')
      }
      if (previewEndKey !== null && key === previewEndKey) {
        btn.setAttribute('data-range-preview-end', 'true')
      } else {
        btn.removeAttribute('data-range-preview-end')
      }
    })
  }, [
    isOpen,
    provisionalStart,
    hoveredDate,
    value,
    displayedMonth,
    dateFromCellButton,
  ])

  // -------------------------------------------------------------------------
  // Outside click → close. Mirrors DatePicker's setTimeout(0) defer so the
  // opening click doesn't immediately fire as the outside event. We exclude
  // both the trigger row (so re-clicking the input doesn't double-toggle)
  // and the portal-rendered dialog itself.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (triggerRowRef.current?.contains(target)) return
      if (dialogRef.current?.contains(target)) return
      setOpen(false)
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleOutside)
      document.addEventListener('touchstart', handleOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [isOpen, setOpen])

  // -------------------------------------------------------------------------
  // Document-level Escape handler. We listen on document (instead of the
  // dialog) so the key reaches us regardless of where focus is — the
  // DateRangePicker test pattern fires `keydown` on `document` directly,
  // and real users may have focus on Calendar's roving cell or anywhere
  // inside the dialog when they hit Escape.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      // Return focus to the trigger so the user lands back at the field
      // they opened. Defer one frame so the dialog has fully unmounted
      // before we grab focus.
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, setOpen])

  // -------------------------------------------------------------------------
  // Clear handler.
  // -------------------------------------------------------------------------
  const handleClear = useCallback(() => {
    if (!isControlledValue) setInternalValue(undefined)
    onChange?.(undefined)
  }, [isControlledValue, onChange])

  // -------------------------------------------------------------------------
  // Trigger interactions. The input is `readOnly`, so we drive open/close
  // from explicit click + keyboard handlers (Enter / Space / ArrowDown to
  // open — standard combobox-dialog WAI-ARIA convention).
  // -------------------------------------------------------------------------
  const openDialog = useCallback(() => {
    if (disabled) return
    if (!isOpen) setOpen(true)
  }, [disabled, isOpen, setOpen])

  const handleTriggerClick = useCallback(() => {
    if (disabled) return
    setOpen(!isOpen)
  }, [disabled, isOpen, setOpen])

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(!isOpen)
      } else if (e.key === 'ArrowDown' && !isOpen) {
        e.preventDefault()
        openDialog()
      }
    },
    [disabled, isOpen, openDialog, setOpen]
  )

  // -------------------------------------------------------------------------
  // Which date does Calendar consider "selected"? During provisional state
  // we pass `provisionalStart` so its cell wears the saved-selection tint.
  // After commit we pass the range start (the simpler choice — selected
  // state on the start is consistent with "you picked a range starting
  // here"; the highlight CSS paints the rest).
  // -------------------------------------------------------------------------
  const calendarValue = provisionalStart ?? value?.[0]

  // -------------------------------------------------------------------------
  // Suppress the unused-warning for `size`: it's reserved for future
  // sizing pass-through; documenting it now in the public API avoids a
  // breaking change later.
  // -------------------------------------------------------------------------
  void size

  const showClear = clearable && value !== undefined && !disabled

  // #422 — the trigger row is the inline visual anchor for this Fragment-rooted
  // component, so the consumer's `className` / `style` / `...rest` ride on it.
  const triggerRowClasses = [styles.triggerRow, className]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        ref={triggerRowRef}
        className={triggerRowClasses}
        style={style}
        {...rest}
      >
        <Input
          ref={inputRef}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? dialogId : undefined}
          readOnly
          label={label}
          placeholder={placeholder}
          value={displayText}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
          error={error}
          helperText={helperText}
        />
        {showClear && (
          <button
            type="button"
            className={styles.clearButton}
            aria-label="Clear date range"
            onMouseDown={(e) => {
              // Prevent the trigger Input from receiving focus + opening the
              // dialog before our click handler runs.
              e.stopPropagation()
              e.preventDefault()
            }}
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4 L12 12 M12 4 L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <Portal>
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="false"
            aria-label="Choose date range"
            data-size={size}
            data-portal-content
            data-placement={position.placement}
            className={`${styles.panel} ${styles.calendarHost} ${
              position.isReady ? styles.positioned : styles.positioning
            }`}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
            onClick={handleHostClick}
            onMouseOver={handleHostMouseOver}
            onMouseOut={handleHostMouseOut}
            onFocus={handleHostFocusIn}
          >
            <Calendar
              value={calendarValue}
              onChange={handleCalendarChange}
              min={min}
              max={max}
              disabled={disabled}
              label="Choose date range"
            />
          </div>
        </Portal>
      )}

      {/* aria-live announces selection phases. Placed outside the dialog so
          it persists when the dialog unmounts after a commit. */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {liveMessage}
      </div>
    </>
  )
}

DateRangePicker.displayName = 'DateRangePicker'
