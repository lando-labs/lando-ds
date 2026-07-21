'use client'

/**
 * Select Component
 *
 * A flexible dropdown select with search, keyboard navigation, and multi-select support.
 *
 * @example
 * <Select
 *   options={[
 *     { label: 'Apple', value: 'apple' },
 *     { label: 'Banana', value: 'banana' }
 *   ]}
 *   value="apple"
 *   onChange={(value) => console.log(value)}
 *   searchable
 * />
 */

import React, { useState, useRef, useEffect, useId } from 'react'
import { Portal } from '../Portal'
import { Badge } from '../Badge'
import { useModalPortalContainer } from '../Modal/ModalPortalContext'
import { usePortalPosition } from '../../hooks/usePortalPosition'
import { useControllableState } from '../../hooks/useControllableState'
import { supportsPopoverApi, syncPopoverState } from '../../utils/popoverApi'
import styles from './Select.module.css'

export interface SelectOption<T = unknown> {
  label: string
  value: T
  disabled?: boolean
  group?: string
}

export interface SelectProps<T = unknown>
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'value' | 'defaultValue'
  > {
  /** Available options */
  options: SelectOption<T>[]
  /**
   * Current value(s) — controlled. When provided, the consumer owns the
   * selection via {@link SelectProps.onChange}.
   *
   * Note: a clearable single-select uses `undefined` as its "cleared" value
   * (#328). Because `undefined` also signals "uncontrolled," do **not** pass
   * both `value` and `defaultValue` — pick one mode (controlled *or*
   * uncontrolled), matching React's own controlled/uncontrolled rule.
   */
  value?: T | T[]
  /**
   * Initial value(s) for uncontrolled usage. Ignored when `value` is provided.
   * Omit both for an uncontrolled Select that starts empty.
   */
  defaultValue?: T | T[]
  /**
   * Change handler. Fires in both controlled and uncontrolled modes.
   *
   * Emits `undefined` (single-select) or `[]` (multi-select) when the user
   * clears via the clear button — distinct from "user selected an option
   * whose value happens to be empty string." (#328)
   */
  onChange?: (value: T | T[] | undefined) => void
  /** Placeholder text */
  placeholder?: string
  /** Enable search/filter */
  searchable?: boolean
  /** Enable clear button */
  clearable?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Loading state */
  loading?: boolean
  /** Multiple selection */
  multiple?: boolean
  /** Maximum dropdown height */
  maxHeight?: number
  /** Custom option renderer */
  renderOption?: (option: SelectOption<T>) => React.ReactNode
  /** Error message */
  error?: string
  /** Label */
  label?: string
  /** Additional CSS class */
  className?: string
  /**
   * HTML form field name. When provided, a hidden `<input>` is rendered so
   * `FormData` / Server Actions receive the value.
   *
   * Single-select: one hidden input with the string-coerced value.
   * Multi-select:  one hidden input **per selected value** so that
   * `FormData.getAll(name)` returns a standard array — matching native
   * `<select multiple>` behaviour.
   */
  name?: string
}

export const Select = <T = unknown,>(props: SelectProps<T>) => {
  const {
    options,
    value: valueProp,
    defaultValue,
    onChange,
    placeholder = 'Select...',
    searchable = false,
    clearable = false,
    disabled = false,
    loading = false,
    multiple = false,
    maxHeight = 300,
    renderOption,
    error,
    label,
    className = '',
    name,
    style,
    ...rest
  } = props
  // Controlled-ness by prop PRESENCE, not value — `undefined` is a meaningful
  // controlled value for a clearable single-select (#328), so `value={undefined}`
  // must stay controlled rather than silently fall back to internal state.
  const [value, setValue] = useControllableState<T | T[] | undefined>({
    value: valueProp,
    defaultValue,
    onChange,
    controlled: 'value' in props,
  })
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const selectRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const reactId = useId()
  const listboxId = `select-listbox-${reactId}`
  const makeOptionId = (index: number) => `select-opt-${reactId}-${index}`

  const selectedValues = Array.isArray(value) ? value : value ? [value] : []

  const filteredOptions = searchQuery
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options

  // Keep highlight within bounds as the filtered list shrinks/grows.
  // Without this, aria-activedescendant can point at an option that no
  // longer exists in the DOM — screen readers then announce nothing.
  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(Math.max(0, filteredOptions.length - 1))
    }
  }, [filteredOptions.length, highlightedIndex])

  const position = usePortalPosition(selectRef, isOpen, {
    align: 'left',
    offset: 4,
    overlayRef: dropdownRef,
    matchTriggerWidth: true,
  })

  // Nearest enclosing OPEN Modal's in-dialog portal container, or `null`
  // (#14 follow-up — see the long comment at the top of Modal.tsx). Non-null
  // means: render the dropdown as a descendant of that Modal's <dialog>
  // instead of document.body, which is what actually makes it interactive —
  // see below.
  const modalPortalContainer = useModalPortalContainer()

  // Popover API top-layer promotion (#14) — STANDALONE path only. Previously
  // the dropdown was a plain Portal + position:fixed + z-index element, which
  // paints UNDER a native <dialog> Modal + its ::backdrop regardless of
  // z-index (top-layer stacking cannot be beaten by z-index). That's still
  // true and still fixed by Popover API promotion for the case this Select
  // is NOT nested inside one of our own open Modals (e.g. an ancestor
  // z-index/stacking-context trap in a consumer's own layout).
  //
  // #14 follow-up: promoting into the top layer is NOT enough when nested in
  // an open Modal — a document.body-portaled popover is a SIBLING of the
  // dialog, and showModal()'s native `inert` algorithm marks every node
  // outside the dialog's own subtree inert, which blocks pointer events
  // regardless of paint order (verified live in Chromium: the element paints
  // on top but document.elementsFromPoint() skips it entirely). When
  // `modalPortalContainer` is non-null we instead render as a DOM descendant
  // of that Modal's dialog (see the `<Portal container>` below), which
  // exempts us from inertness by ancestry — no top-layer promotion needed,
  // so we skip it here and don't emit `popover="manual"` in that branch
  // either (see the JSX below): a `popover` attribute with `showPopover()`
  // never called would leave the element UA-stylesheet-hidden
  // (`[popover]:not(:popover-open) { display: none }`).
  useEffect(() => {
    if (modalPortalContainer) return
    if (!supportsPopoverApi()) return
    syncPopoverState(dropdownRef.current, isOpen && position.isReady)
  }, [isOpen, position.isReady, modalPortalContainer])

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, searchable])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node

      // Don't close if clicking on the trigger or dropdown
      if (
        selectRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }

      setIsOpen(false)
    }

    // Add listeners with slight delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      setSearchQuery('')
      setHighlightedIndex(0)
    }
  }

  const handleSelect = (option: SelectOption<T>) => {
    if (option.disabled) return

    if (multiple) {
      const newValues = selectedValues.includes(option.value)
        ? selectedValues.filter((v) => v !== option.value)
        : [...selectedValues, option.value]
      setValue(newValues)
    } else {
      setValue(option.value)
      setIsOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Clearing a multi-select returns an empty array; single-select returns
    // `undefined` (#328) — distinct from `""` so consumers can tell "user
    // cleared" apart from "user picked an empty-string-valued option."
    setValue(multiple ? ([] as T[]) : undefined)
  }

  // Single keyboard handler used by both the combobox trigger AND the search
  // input (when searchable). Previously, handlers were attached only to the
  // combobox div; opening a searchable Select moved focus into the search
  // input and Arrow/Enter/Escape stopped working entirely. See issue #13.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (isOpen && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex])
        } else {
          setIsOpen(true)
        }
        break
      case 'Escape':
        // Only consume Escape when we actually have something to close.
        // Gated on `isOpen` (mirrors Combobox/MultiSelect's `if (open)`
        // pattern) — this handler is permanently attached to the trigger
        // div regardless of open state, so an unconditional preventDefault()
        // here would swallow every Escape press while the trigger has
        // focus, even after the listbox is already closed. Since a Select
        // opened inside a Modal (#14) is now reachable, that unconditional
        // swallow would trap the Modal open: its native `<dialog>`
        // Escape-to-close depends on this keydown reaching completion
        // un-prevented. See #14 follow-up.
        if (isOpen) {
          e.preventDefault()
          setIsOpen(false)
          // Return focus to the combobox trigger so keyboard users don't
          // lose their place after dismissing the listbox via Escape.
          selectRef.current?.focus()
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          setHighlightedIndex((prev) =>
            Math.min(prev + 1, filteredOptions.length - 1)
          )
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (isOpen) {
          setHighlightedIndex((prev) => Math.max(prev - 1, 0))
        }
        break
      case 'Home':
        if (isOpen) {
          e.preventDefault()
          setHighlightedIndex(0)
        }
        break
      case 'End':
        if (isOpen) {
          e.preventDefault()
          setHighlightedIndex(Math.max(0, filteredOptions.length - 1))
        }
        break
    }
  }

  const getDisplayValue = () => {
    if (selectedValues.length === 0) return placeholder

    if (multiple) {
      return (
        <div className={styles.chips}>
          {selectedValues.map((val) => {
            const opt = options.find((o) => o.value === val)
            return opt ? (
              <Badge key={String(val)} variant="primary" size="sm">
                {opt.label}
              </Badge>
            ) : null
          })}
        </div>
      )
    }

    const selected = options.find((opt) => opt.value === value)
    return selected?.label || placeholder
  }

  const selectClasses = [
    styles.select,
    isOpen ? styles.open : '',
    disabled ? styles.disabled : '',
    error ? styles.error : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label}>
          {label}
        </label>
      )}

      <div
        {...rest}
        ref={selectRef}
        className={selectClasses}
        style={style}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        aria-controls={isOpen ? listboxId : undefined}
        /*
         * aria-activedescendant lets screen readers announce the virtually
         * focused option without moving DOM focus. Without this, the user
         * arrow-keys through the list but AT has nothing to announce — the
         * highlighted option is a purely visual affordance. See issue #13.
         */
        aria-activedescendant={
          isOpen && filteredOptions[highlightedIndex]
            ? makeOptionId(highlightedIndex)
            : undefined
        }
      >
        <div className={styles.value}>
          {loading ? 'Loading...' : getDisplayValue()}
        </div>

        <div className={styles.indicators}>
          {clearable && selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              aria-label="Clear selection"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          <svg
            className={styles.chevron}
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M6 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {name && (
        multiple
          ? (selectedValues as T[]).map((val, i) => (
              <input
                key={i}
                type="hidden"
                name={name}
                value={String(val)}
              />
            ))
          : <input
              type="hidden"
              name={name}
              value={String(selectedValues[0] ?? '')}
            />
      )}

      {isOpen && (
        // `container={modalPortalContainer}` — `null` falls through to
        // Portal's own `container || document.body` default (see
        // Portal.tsx), so this is a no-op for the standalone case and only
        // changes behavior when nested in an open Modal (#14 follow-up).
        <Portal container={modalPortalContainer}>
          <div
            ref={dropdownRef}
            className={`${styles.dropdown} ${position.isReady ? styles.positioned : styles.positioning}`}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
              maxHeight: `${maxHeight}px`,
            }}
            id={listboxId}
            role="listbox"
            aria-multiselectable={multiple}
            aria-activedescendant={
              filteredOptions[highlightedIndex]
                ? makeOptionId(highlightedIndex)
                : undefined
            }
            data-portal-content
            data-placement={position.placement}
            // Popover API opt-in (#14) — STANDALONE path only (see the
            // useEffect above). Omitted entirely when nested in an open
            // Modal: the UA stylesheet hides `[popover]:not(:popover-open)`,
            // and we never call showPopover() in that branch, so leaving the
            // attribute on would hide the dropdown outright.
            popover={modalPortalContainer ? undefined : 'manual'}
          >
            {searchable && (
              <div className={styles.searchWrapper}>
                <input
                  ref={searchInputRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  /*
                   * Share the keyboard handler so Arrow/Enter/Escape work
                   * while focus is in the search input. Without this, focus
                   * moves into the search on open and all keyboard
                   * navigation is lost — you can type, but can't pick an
                   * option without reaching for the mouse. See issue #13.
                   */
                  onKeyDown={handleKeyDown}
                  /*
                   * The search input is a secondary control inside the
                   * combobox widget. Screen readers should route arrow/enter
                   * announcements through the parent combobox's
                   * aria-activedescendant, so we mirror the same id here.
                   */
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    filteredOptions[highlightedIndex]
                      ? makeOptionId(highlightedIndex)
                      : undefined
                  }
                />
              </div>
            )}

            <div className={styles.options}>
              {filteredOptions.length === 0 ? (
                <div className={styles.empty}>No options found</div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = selectedValues.includes(option.value)
                  const isHighlighted = index === highlightedIndex

                  const optionClasses = [
                    styles.option,
                    isSelected ? styles.selected : '',
                    isHighlighted ? styles.highlighted : '',
                    option.disabled ? styles.disabled : '',
                  ].filter(Boolean).join(' ')

                  return (
                    <div
                      key={String(option.value)}
                      id={makeOptionId(index)}
                      className={optionClasses}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {renderOption ? renderOption(option) : option.label}
                      {isSelected && (
                        <svg
                          className={styles.checkmark}
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M13.333 4L6 11.333 2.667 8"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}

// `Select` is a generic arrow function, so a direct `Select.displayName =`
// assignment trips TypeScript's expando restriction (only `function`
// declarations get expando property support). Attach it via a precise cast
// that just mutates the underlying function object at runtime.
;(Select as { displayName?: string }).displayName = 'Select'
