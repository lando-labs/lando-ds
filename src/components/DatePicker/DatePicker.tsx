'use client'

/**
 * DatePicker — input + Calendar-anchored popover (#312).
 *
 * Sprint 56 — fourth commit of the DatePicker family. Wraps the shipped
 * `<Calendar>` in an Input-shaped trigger + Portal-rendered dialog panel
 * so consumers get a single-date picker without rolling the popover wiring
 * themselves.
 *
 * What it is
 * ----------
 * The mainstream date-selection surface — a text input that displays the
 * selected date, click/focus opens a popover-anchored Calendar, picking a
 * day commits the selection and closes the popover. Mirrors the shape every
 * dashboard form needs.
 *
 * What it is NOT (v1 deferrals)
 * -----------------------------
 *   - Not a free-text input — typing into the input is a no-op for now. The
 *     consumer can compose `<Combobox>` + `parseISODateString` if they want
 *     keyboard-typed dates. Free-text parsing is locale-thorny and the
 *     issue (#312) explicitly defers it.
 *   - Not a range picker — see `<DateRangePicker>` (Lane C).
 *   - Not a time picker.
 *
 * Architectural choice — Portal + `usePortalPosition`, NOT `<Popover>`
 * --------------------------------------------------------------------
 * The lane brief suggested trying `<Popover>` first since Calendar isn't a
 * tooltip-shaped surface like a Combobox listbox. On read-through, three
 * things steered me to Portal + usePortalPosition (the Combobox precedent):
 *
 *  1. Popover clones its `trigger` element and grafts handlers (`onClick`
 *     calls `e.preventDefault()` which kills caret behaviour on inputs).
 *     The DatePicker trigger is a styled `<div>` wrapping an `<input>` and
 *     a `<button>` — cloneElement on the outer div would mishandle the
 *     child input's own click/focus.
 *  2. The dialog popover needs `role="dialog"` per the `aria-haspopup="dialog"`
 *     contract. Popover hardcodes `role="tooltip"` on its rendered content.
 *  3. Popover wires `aria-describedby` on the trigger; we want
 *     `aria-controls` semantics so screen readers walk to the dialog.
 *
 * Calendar's keyboard handling already lives inside Calendar (roving
 * tabIndex, arrow nav, Enter/Space select), so on open we just have to MOVE
 * focus into Calendar's tabbable day-button and let it drive from there.
 * On close we return focus to the input — standard dialog-popover focus
 * round-trip.
 *
 * A11y model
 * ----------
 *   - Trigger input: `role="combobox"` + `aria-haspopup="dialog"` +
 *     `aria-expanded` toggling with open state, `aria-controls` pointing at
 *     the dialog id when open, `aria-invalid` mirroring error state.
 *   - Panel: `role="dialog"` + `aria-modal="false"` (non-modal — we don't
 *     trap focus the way Modal does; Tab can leave to whatever's next in
 *     the page) + `aria-label="Date picker"`.
 *   - Focus moves into Calendar's tabbable cell on open; Escape returns
 *     focus to the input.
 *   - The input is `readOnly` so screen readers don't promise text editing
 *     that the v1 picker doesn't actually accept. (Removes the
 *     virtual-keyboard prompt on mobile too — the right UX since picking
 *     happens in the dialog.)
 *
 * Controlled / uncontrolled
 * -------------------------
 * Two independent controlled axes:
 *   - `value` / `defaultValue` / `onChange` for the selected date.
 *   - `open` / `defaultOpen` / `onOpenChange` for popover visibility.
 *
 * Either or both can be controlled. Consumer's `value` is the source of
 * truth when provided; otherwise we track internal state seeded from
 * `defaultValue`.
 *
 * @example Uncontrolled
 *   <DatePicker label="Start date" defaultValue="2026-07-01" onChange={fn} />
 *
 * @example Controlled
 *   const [date, setDate] = useState<Date | undefined>()
 *   <DatePicker value={date} onChange={setDate} min="2026-01-01" />
 *
 * @example Controlled open
 *   <DatePicker open={isOpen} onOpenChange={setIsOpen} />
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { Portal } from '../Portal'
import { Icon } from '../Icon'
import { usePortalPosition } from '../../hooks/usePortalPosition'
import { Calendar } from './Calendar'
import type { DateValue } from './DateDisplay'
import { isValidDate, toDate } from './dateUtils'
import styles from './DatePicker.module.css'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DatePickerSize = 'sm' | 'md' | 'lg'

export interface DatePickerProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'id' | 'defaultValue'
  > {
  /** Selected date (controlled). */
  value?: DateValue
  /** Initial selected date (uncontrolled). */
  defaultValue?: DateValue
  /**
   * Selection callback. Fires with the new Date when the user picks a day,
   * or `undefined` when the field is cleared via the clear button.
   */
  onChange?: (date: Date | undefined) => void
  /** Open state of the calendar popover (controlled). */
  open?: boolean
  /** Initial open state (uncontrolled). Default false. */
  defaultOpen?: boolean
  /** Open/close callback. Fires for trigger click, day select, Escape, outside click. */
  onOpenChange?: (open: boolean) => void
  /** Disable dates before this. Passes through to the underlying Calendar. */
  min?: DateValue
  /** Disable dates after this. Passes through to the underlying Calendar. */
  max?: DateValue
  /** Whole-component disabled — no popover, no clear. */
  disabled?: boolean
  /** Visible label above the input. */
  label?: string
  /** Placeholder when empty. Default "Select date". */
  placeholder?: string
  /** Visible-text formatter for the input. Default `(d) => d.toLocaleDateString()`. */
  format?: (date: Date) => string
  /** Size — mirrors Input / Combobox. Default "md". */
  size?: DatePickerSize
  /** Error text for invalid state. Renders below the input + flips aria-invalid. */
  error?: string
  /** Helper text under the input (hidden when `error` is set). */
  helperText?: string
  /**
   * Allow clear button (×) inside the input when a value is present.
   * Default `true`.
   */
  clearable?: boolean
  /**
   * Extra class on the visual root (the trigger `.container` — the
   * Input-shaped surface carrying the border and focus ring).
   *
   * #422 — `className` now lands on the trigger container (the visual root),
   * not the outer field `.wrapper`. To style the outer field wrapper (the
   * label + trigger + footer column) use {@link DatePickerProps.wrapperClassName}.
   */
  className?: string
  /**
   * Escape hatch: extra class on the OUTER field `.wrapper` (the flex column
   * that stacks the label, trigger, and helper/error footer). Target it for
   * field-level layout overrides (width, margin, grid placement) that
   * previously rode on `className`.
   */
  wrapperClassName?: string
  /** Escape hatch: inline style on the outer field `.wrapper`. */
  wrapperStyle?: React.CSSProperties
  /** Stable id for the input — auto-generated if omitted. */
  id?: string
  /**
   * HTML form field name. When provided, a hidden `<input>` is rendered so
   * `FormData` / Server Actions receive the selected date in ISO yyyy-mm-dd
   * form. Mirrors Combobox / Select.
   */
  name?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDate(value: DateValue | undefined): Date | undefined {
  if (value === undefined) return undefined
  const d = toDate(value)
  return isValidDate(d) ? d : undefined
}

/** Local-zone ISO yyyy-mm-dd for the hidden form value (mirrors dateUtils.toISODateString). */
function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// DatePicker
// ---------------------------------------------------------------------------

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
    {
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
      placeholder = 'Select date',
      format,
      size = 'md',
      error,
      helperText,
      clearable = true,
      className = '',
      wrapperClassName = '',
      wrapperStyle,
      style,
      id,
      name,
      ...rest
    },
    forwardedRef
  ) {
    // -----------------------------------------------------------------------
    // Controlled / uncontrolled selection bridge.
    // -----------------------------------------------------------------------
    const isValueControlled = controlledValue !== undefined
    const [internalValue, setInternalValue] = useState<Date | undefined>(
      () => normalizeDate(defaultValue)
    )
    const selected = isValueControlled
      ? normalizeDate(controlledValue)
      : internalValue

    // -----------------------------------------------------------------------
    // Controlled / uncontrolled open bridge.
    // -----------------------------------------------------------------------
    const isOpenControlled = controlledOpen !== undefined
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
    const open = isOpenControlled ? controlledOpen : uncontrolledOpen

    const setOpen = useCallback(
      (next: boolean) => {
        if (!isOpenControlled) {
          setUncontrolledOpen(next)
        }
        onOpenChange?.(next)
      },
      [isOpenControlled, onOpenChange]
    )

    // -----------------------------------------------------------------------
    // Refs + ids — stable across renders for ARIA wiring.
    // -----------------------------------------------------------------------
    const reactId = useId()
    const inputId = id || `datepicker-${reactId}`
    const dialogId = `datepicker-dialog-${reactId}`
    const labelId = `datepicker-label-${reactId}`
    const errorId = `datepicker-error-${reactId}`
    const helperId = `datepicker-helper-${reactId}`

    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)

    // Merge external forwarded ref so consumers can `ref={...}` to the input.
    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          ;(
            forwardedRef as React.MutableRefObject<HTMLInputElement | null>
          ).current = node
        }
      },
      [forwardedRef]
    )

    // -----------------------------------------------------------------------
    // Portal positioning. Anchored to the trigger container, aligned to its
    // left edge with a small offset. We don't `matchTriggerWidth` — the
    // Calendar has its own intrinsic width (~17rem) that the input shouldn't
    // pin.
    // -----------------------------------------------------------------------
    const position = usePortalPosition(containerRef, open, {
      align: 'left',
      offset: 4,
      overlayRef: dialogRef,
    })

    // -----------------------------------------------------------------------
    // Outside-click / focus-out → close. Same setTimeout(0) defer Combobox
    // uses so the just-opened click doesn't immediately fire as the outside
    // event. We also exclude clicks inside the dialog (Calendar's nav
    // buttons live there).
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (!open) return

      const handleOutside = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node
        if (containerRef.current?.contains(target)) return
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
    }, [open, setOpen])

    // -----------------------------------------------------------------------
    // Move focus INTO Calendar's tabbable cell when the popover opens. The
    // standard date-picker UX: pressing Enter / clicking the trigger opens
    // the popover AND moves focus to the calendar so the user can keyboard-
    // navigate immediately. Calendar exposes exactly one cell with
    // tabIndex=0 (the roving tabIndex), so we just query for it.
    //
    // We use rAF so the dialog has actually rendered + the Portal mounted
    // before we go looking for the cell.
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (!open) return
      // Bail in non-DOM environments (SSR) — defensive, the 'use client'
      // directive at top already prevents this in practice.
      if (typeof window === 'undefined') return

      let cancelled = false
      const focusFirstCell = () => {
        if (cancelled) return
        const cell = dialogRef.current?.querySelector<HTMLButtonElement>(
          '[role="gridcell"] button[tabindex="0"]'
        )
        if (cell && typeof cell.focus === 'function') {
          cell.focus()
        }
      }
      // Two rAFs — first for Portal mount, second for Calendar render.
      const id1 = requestAnimationFrame(() => {
        const id2 = requestAnimationFrame(focusFirstCell)
        // Stash on outer cancel via closure.
        ;(focusFirstCell as { rafId?: number }).rafId = id2
      })

      return () => {
        cancelled = true
        cancelAnimationFrame(id1)
        const id2 = (focusFirstCell as { rafId?: number }).rafId
        if (id2 !== undefined) cancelAnimationFrame(id2)
      }
    }, [open])

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const openDialog = useCallback(() => {
      if (disabled) return
      if (!open) setOpen(true)
    }, [disabled, open, setOpen])

    const closeDialog = useCallback(
      (returnFocus = true) => {
        setOpen(false)
        if (returnFocus) {
          // Defer to next tick so the dialog has fully unmounted before we
          // grab focus — avoids a same-frame focus race with React's render.
          requestAnimationFrame(() => {
            inputRef.current?.focus()
          })
        }
      },
      [setOpen]
    )

    const handleCalendarChange = useCallback(
      (date: Date) => {
        if (!isValueControlled) {
          setInternalValue(date)
        }
        onChange?.(date)
        closeDialog()
      },
      [isValueControlled, onChange, closeDialog]
    )

    const handleClear = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        if (disabled) return
        if (!isValueControlled) {
          setInternalValue(undefined)
        }
        onChange?.(undefined)
        // Keep focus on the input — same UX as Input's clear button.
        inputRef.current?.focus()
      },
      [disabled, isValueControlled, onChange]
    )

    // Capture Escape on the dialog wrapper so Calendar's own internal
    // handlers don't block us. We render this as an onKeyDown on the dialog;
    // Calendar doesn't preventDefault on Escape, so the event reaches us.
    const handleDialogKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          closeDialog()
        }
      },
      [closeDialog]
    )

    const handleInputKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return
        switch (e.key) {
          case 'Enter':
          case ' ':
          case 'ArrowDown':
            // All three open the popover from the input — standard combobox-
            // dialog pattern (down-arrow expand is the WAI-ARIA hint).
            e.preventDefault()
            openDialog()
            return
          case 'Escape':
            if (open) {
              e.preventDefault()
              closeDialog()
            }
            return
        }
      },
      [disabled, open, openDialog, closeDialog]
    )

    // -----------------------------------------------------------------------
    // Derived rendering values.
    // -----------------------------------------------------------------------
    const displayValue = selected
      ? format
        ? format(selected)
        : selected.toLocaleDateString()
      : ''

    const hasError = !!error
    const showClearButton =
      clearable && selected !== undefined && !disabled

    // #422 — the consumer's `className` / `style` / `...rest` now ride on the
    // trigger `.container` (the visual root — the Input-shaped surface with the
    // border + focus ring). The outer field `.wrapper` is exposed via
    // `wrapperClassName` / `wrapperStyle`.
    const containerClasses = [
      styles.container,
      styles[`size_${size}`],
      open && styles.open,
      disabled && styles.disabled,
      hasError && styles.error,
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // The outer field column stays load-bearing (label + trigger + footer at
    // full width); expose it via the wrapper escape hatch.
    const wrapperClasses = [styles.wrapper, wrapperClassName]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={wrapperClasses} style={wrapperStyle}>
        {label && (
          <label id={labelId} htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}

        <div ref={containerRef} className={containerClasses} style={style} {...rest}>
          <input
            ref={setInputRef}
            id={inputId}
            type="text"
            role="combobox"
            className={styles.input}
            // readOnly: typing into the v1 picker is a no-op, and readOnly
            // suppresses the mobile virtual keyboard so users don't get a
            // misleading "you can type here" affordance.
            readOnly
            value={displayValue}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            onClick={openDialog}
            onFocus={openDialog}
            onKeyDown={handleInputKeyDown}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? dialogId : undefined}
            aria-labelledby={label ? labelId : undefined}
            aria-invalid={hasError || undefined}
            aria-disabled={disabled || undefined}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
          />

          <div className={styles.iconGroup}>
            {showClearButton ? (
              <button
                type="button"
                className={styles.iconButton}
                onClick={handleClear}
                // Keep focus from leaving the input when the mouse-down lands
                // on the clear button (prevents a flash of focus-loss + an
                // unwanted blur-close round-trip).
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Clear date"
                tabIndex={-1}
              >
                <Icon size="sm">
                  <X />
                </Icon>
              </button>
            ) : (
              <span className={styles.calendarGlyph} aria-hidden="true">
                <Icon size="sm">
                  <CalendarIcon />
                </Icon>
              </span>
            )}
          </div>
        </div>

        {/* Hidden form input — emits ISO yyyy-mm-dd so server-side parsers
         * see a deterministic, locale-free date string. Mirrors Combobox /
         * Select. */}
        {name && (
          <input
            type="hidden"
            name={name}
            value={selected ? toISO(selected) : ''}
          />
        )}

        {(error || helperText) && (
          <div className={styles.footer}>
            {error ? (
              <span id={errorId} className={styles.errorText} role="alert">
                {error}
              </span>
            ) : (
              <span id={helperId} className={styles.helperText}>
                {helperText}
              </span>
            )}
          </div>
        )}

        {open && (
          <Portal>
            <div
              ref={dialogRef}
              id={dialogId}
              role="dialog"
              aria-modal="false"
              aria-label="Date picker"
              className={`${styles.panel} ${
                position.isReady ? styles.positioned : styles.positioning
              }`}
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
              }}
              data-portal-content
              data-placement={position.placement}
              onKeyDown={handleDialogKeyDown}
            >
              <Calendar
                value={selected}
                onChange={handleCalendarChange}
                min={min}
                max={max}
                disabled={disabled}
              />
            </div>
          </Portal>
        )}
      </div>
    )
  }
)

DatePicker.displayName = 'DatePicker'
