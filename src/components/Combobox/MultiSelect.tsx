'use client'

/**
 * MultiSelect — searchable multi-select with chip display (#310).
 *
 * Variant of {@link Combobox} that holds an array of selected values and
 * renders them as removable chips INSIDE the combobox affordance. Selecting
 * an already-selected option toggles it off; Backspace at an empty input
 * removes the last chip (matching the convention shadcn / Mantine /
 * `react-select` all use).
 *
 * Why a separate component (not a `multiple` prop on Combobox)
 * ------------------------------------------------------------
 * The UX shape diverges enough that branching on a `multiple` prop produces
 * a worse API than two focused components:
 *
 *   - **Input text behavior**: single-Combobox shows the selected label
 *     when closed. MultiSelect always shows the live query (chips display
 *     the selections), so the open/closed input-display split doesn't
 *     apply.
 *   - **Wrapper layout**: the chip row + flex-wrap behavior changes the
 *     wrapper's CSS contract substantially — single is a fixed-height
 *     pill, multi grows vertically with chip wrap.
 *   - **`onChange` signature**: `string | undefined` vs `string[]`. A
 *     polymorphic union prop forces consumers to type-narrow on every
 *     callback. Two components let TypeScript inference do its job.
 *
 * Same architecture, same a11y model, shared CSS
 * ----------------------------------------------
 * Both components live in `src/components/Combobox/` and share
 * `Combobox.module.css` for the listbox / option styles. MultiSelect
 * adds chip-specific styles in the same module. Portal positioning,
 * activedescendant keyboard model, async vs sync filter — all identical
 * to single Combobox.
 *
 * @example
 *   const [tags, setTags] = useState<string[]>([])
 *   <MultiSelect
 *     label="Skills"
 *     options={[
 *       { value: 'react', label: 'React' },
 *       { value: 'ts', label: 'TypeScript' },
 *       { value: 'next', label: 'Next.js' },
 *     ]}
 *     value={tags}
 *     onChange={setTags}
 *     maxSelectable={5}
 *   />
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Portal } from '../Portal'
import { Spinner } from '../Spinner'
import { usePortalPosition } from '../../hooks/usePortalPosition'
import type { ComboboxOption, ComboboxSize } from './Combobox'
import styles from './Combobox.module.css'

export interface MultiSelectProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'value' | 'defaultValue' | 'id'
  > {
  /** Available options. In async mode, this is the consumer-filtered subset. */
  options: ComboboxOption[]
  /** Controlled selection — array of option values. */
  value?: string[]
  /** Initial uncontrolled selection. Ignored when `value` is set. */
  defaultValue?: string[]
  /** Notified with the new selection array on every change. */
  onChange?: (value: string[]) => void
  /**
   * Async filter callback. When provided, we fire on every keystroke and
   * delegate filtering to the consumer (same contract as `Combobox.onSearch`).
   */
  onSearch?: (query: string) => void
  /** Placeholder shown when nothing is selected and the input is empty. */
  placeholder?: string
  /** Label rendered above the input. */
  label?: string
  /** Disable all interaction. */
  disabled?: boolean
  /** Show a spinner in the listbox area. Wire to async fetch state. */
  loading?: boolean
  /** Message rendered when the filtered list is empty. */
  emptyMessage?: string
  /** Visual size scale. Default: "md". */
  size?: ComboboxSize
  /** Hard upper bound on selection count. */
  maxSelectable?: number
  /** Extra class on the outer container. */
  className?: string
  /** Stable id for the input — auto-generated if omitted. */
  id?: string
  /**
   * HTML form field name. When provided, one hidden `<input>` is rendered
   * per selected value so `FormData.getAll(name)` returns the array —
   * matching `Select` multi-select and `TagInput`.
   */
  name?: string
}

export const MultiSelect = React.forwardRef<
  HTMLInputElement,
  MultiSelectProps
>(function MultiSelect(
  {
    options,
    value: controlledValue,
    defaultValue,
    onChange,
    onSearch,
    placeholder,
    label,
    disabled = false,
    loading = false,
    emptyMessage = 'No results',
    size = 'md',
    maxSelectable,
    className = '',
    id,
    name,
    style,
    ...rest
  },
  forwardedRef
) {
  // -------------------------------------------------------------------------
  // Controlled / uncontrolled selection bridge — array form.
  // -------------------------------------------------------------------------
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState<string[]>(
    defaultValue ?? []
  )
  const selectedValues = isControlled
    ? controlledValue
    : internalValue

  const setValues = useCallback(
    (next: string[]) => {
      if (!isControlled) setInternalValue(next)
      onChange?.(next)
    },
    [isControlled, onChange]
  )

  // -------------------------------------------------------------------------
  // Editor state
  // -------------------------------------------------------------------------
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // -------------------------------------------------------------------------
  // Filter — sync vs async (see Combobox.tsx for rationale).
  // -------------------------------------------------------------------------
  const isAsync = onSearch !== undefined
  const filteredOptions = isAsync
    ? options
    : query.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(query.toLowerCase().trim())
      )
    : options

  const atMax =
    maxSelectable !== undefined && selectedValues.length >= maxSelectable

  // For multi-select the user's mental model: "selecting an already-selected
  // option deselects it." So we DON'T filter selected options out of the
  // listbox — we show them with the active checkmark instead. This matches
  // shadcn / Mantine / Chakra's MultiSelect behaviour.
  const selectableIndexes = filteredOptions
    .map((o, i) => {
      if (o.disabled) return -1
      if (atMax && !selectedValues.includes(o.value)) return -1
      return i
    })
    .filter((i) => i !== -1)

  // Keep activeIndex valid (see Combobox.tsx for the same logic).
  useEffect(() => {
    if (!open) {
      setActiveIndex(-1)
      return
    }
    if (selectableIndexes.length === 0) {
      if (activeIndex !== -1) setActiveIndex(-1)
      return
    }
    if (
      activeIndex < 0 ||
      activeIndex >= filteredOptions.length ||
      !selectableIndexes.includes(activeIndex)
    ) {
      setActiveIndex(selectableIndexes[0]!) // safe: length > 0 checked above
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filteredOptions.length, activeIndex, atMax])

  // -------------------------------------------------------------------------
  // Refs + ids
  // -------------------------------------------------------------------------
  const reactId = useId()
  const inputId = id || `multiselect-${reactId}`
  const listboxId = `multiselect-listbox-${reactId}`
  const labelId = `multiselect-label-${reactId}`
  const makeOptionId = (index: number) =>
    `multiselect-opt-${reactId}-${index}`

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef)
        (
          forwardedRef as React.MutableRefObject<HTMLInputElement | null>
        ).current = node
    },
    [forwardedRef]
  )

  // Portal positioning. Anchored to the chip-row container so the listbox
  // aligns to the FULL wrapper width (chips included), not just the inner
  // input. Matches the visual contract consumers expect.
  const position = usePortalPosition(containerRef, open, {
    align: 'left',
    offset: 4,
    overlayRef: listboxRef,
    matchTriggerWidth: true,
  })

  // Outside click → close.
  useEffect(() => {
    if (!open) return

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (listboxRef.current?.contains(target)) return
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
  }, [open])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const openListbox = () => {
    if (disabled) return
    if (!open) setOpen(true)
  }

  const toggleOption = (index: number) => {
    const opt = filteredOptions[index]
    if (!opt || opt.disabled) return

    const alreadySelected = selectedValues.includes(opt.value)
    if (alreadySelected) {
      // Deselect — always allowed.
      setValues(selectedValues.filter((v) => v !== opt.value))
    } else {
      // Add — respect maxSelectable cap.
      if (atMax) return
      setValues([...selectedValues, opt.value])
    }
    // Multi-select stays OPEN after a pick (the user is likely picking
    // several in a row) — shadcn / Mantine / Chakra all behave this way.
    // Clear the query so the next pick filters from the full list again.
    setQuery('')
    if (isAsync) onSearch?.('')
    inputRef.current?.focus()
  }

  const removeAt = (index: number) => {
    const next = selectedValues.slice(0, index).concat(
      selectedValues.slice(index + 1)
    )
    setValues(next)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setQuery(next)
    if (!open) setOpen(true)
    if (isAsync) onSearch?.(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    switch (e.key) {
      case 'Backspace': {
        // Empty input + selections present → remove last chip. Matches
        // shadcn / Mantine / Chakra / react-select. Don't preventDefault
        // when there's text — let it delete characters normally.
        if (query === '' && selectedValues.length > 0) {
          e.preventDefault()
          removeAt(selectedValues.length - 1)
        }
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        if (!open) {
          setOpen(true)
          return
        }
        if (selectableIndexes.length === 0) return
        const currentSlot = selectableIndexes.indexOf(activeIndex)
        const nextSlot =
          currentSlot < 0 ? 0 : (currentSlot + 1) % selectableIndexes.length
        setActiveIndex(selectableIndexes[nextSlot]!) // safe: nextSlot in [0, length)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        if (!open) {
          setOpen(true)
          return
        }
        if (selectableIndexes.length === 0) return
        const currentSlot = selectableIndexes.indexOf(activeIndex)
        const prevSlot =
          currentSlot <= 0
            ? selectableIndexes.length - 1
            : currentSlot - 1
        setActiveIndex(selectableIndexes[prevSlot]!) // safe: prevSlot in [0, length)
        break
      }
      case 'Home': {
        if (!open) return
        if (selectableIndexes.length === 0) return
        e.preventDefault()
        setActiveIndex(selectableIndexes[0]!) // safe: length > 0 checked above
        break
      }
      case 'End': {
        if (!open) return
        if (selectableIndexes.length === 0) return
        e.preventDefault()
        setActiveIndex(selectableIndexes[selectableIndexes.length - 1]!) // safe: length > 0 checked above
        break
      }
      case 'Enter': {
        if (!open) return
        if (activeIndex < 0) return
        e.preventDefault()
        toggleOption(activeIndex)
        break
      }
      case 'Escape': {
        if (open) {
          e.preventDefault()
          setOpen(false)
          setQuery('')
          if (isAsync) onSearch?.('')
        }
        break
      }
      case 'Tab': {
        if (open) setOpen(false)
        break
      }
    }
  }

  // -------------------------------------------------------------------------
  // Click on wrapper (not a chip remove btn) → focus input. Mirrors
  // TagInput.handleWrapperClick.
  // -------------------------------------------------------------------------
  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    inputRef.current?.focus()
    if (!open) setOpen(true)
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  const containerClasses = [
    styles.container,
    styles.multi,
    styles[`size_${size}`],
    open && styles.open,
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const activeId =
    open && activeIndex >= 0 && filteredOptions[activeIndex]
      ? makeOptionId(activeIndex)
      : undefined

  // Resolve labels for the chip row. Selected values may not appear in
  // `filteredOptions` (consumer's `options` might not include already-picked
  // items in async mode), so we look up across the full `options` prop and
  // fall back to the bare value when no label exists.
  const chips = selectedValues.map((v) => {
    const found = options.find((o) => o.value === v)
    return { value: v, label: found?.label ?? v }
  })

  return (
    <div className={styles.wrapper}>
      {label && (
        <label id={labelId} htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}

      <div
        {...rest}
        ref={containerRef}
        className={containerClasses}
        style={style}
        onClick={handleWrapperClick}
      >
        {chips.map((chip, i) => (
          <span key={`${chip.value}-${i}`} className={styles.chip}>
            <span className={styles.chipText}>{chip.label}</span>
            <button
              type="button"
              className={styles.chipRemove}
              onClick={(e) => {
                e.stopPropagation()
                removeAt(i)
                // Keep focus on the input after removal.
                inputRef.current?.focus()
              }}
              aria-label={`Remove ${chip.label}`}
              disabled={disabled}
              tabIndex={disabled ? -1 : 0}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        <input
          ref={setInputRef}
          id={inputId}
          type="text"
          role="combobox"
          className={styles.multiInput}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={openListbox}
          placeholder={
            selectedValues.length === 0 ? placeholder : undefined
          }
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-labelledby={label ? labelId : undefined}
          aria-disabled={disabled}
        />
      </div>

      {/* Hidden inputs for FormData. Mirrors TagInput / Select-multi. */}
      {name &&
        selectedValues.map((v, i) => (
          <input
            key={`${name}-${i}`}
            type="hidden"
            name={name}
            value={v}
          />
        ))}

      {open && (
        <Portal>
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            className={`${styles.listbox} ${
              position.isReady ? styles.positioned : styles.positioning
            }`}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: position.width
                ? `${position.width}px`
                : undefined,
            }}
            data-portal-content
            data-placement={position.placement}
          >
            {loading ? (
              <li className={styles.loading} role="presentation">
                <Spinner size="sm" label="Loading options" />
              </li>
            ) : filteredOptions.length === 0 ? (
              <li className={styles.empty} role="presentation">
                {emptyMessage}
              </li>
            ) : (
              filteredOptions.map((opt, i) => {
                const isActive = i === activeIndex
                const isSelected = selectedValues.includes(opt.value)
                const isMaxLocked =
                  atMax && !isSelected && !opt.disabled
                const optionClasses = [
                  styles.option,
                  isActive && styles.optionActive,
                  isSelected && styles.optionSelected,
                  (opt.disabled || isMaxLocked) && styles.optionDisabled,
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <li
                    key={opt.value}
                    id={makeOptionId(i)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={
                      opt.disabled || isMaxLocked || undefined
                    }
                    className={optionClasses}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (isMaxLocked) return
                      toggleOption(i)
                    }}
                    onMouseMove={() => {
                      if (
                        !opt.disabled &&
                        !isMaxLocked &&
                        activeIndex !== i
                      ) {
                        setActiveIndex(i)
                      }
                    }}
                  >
                    <span className={styles.optionLabel}>{opt.label}</span>
                    {isSelected && (
                      <svg
                        className={styles.optionCheck}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
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
                  </li>
                )
              })
            )}
          </ul>
        </Portal>
      )}
    </div>
  )
})

MultiSelect.displayName = 'MultiSelect'
