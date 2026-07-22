'use client'

/**
 * Combobox — searchable single-select with type-to-filter + ARIA combobox
 * pattern (#310).
 *
 * Why this exists
 * ---------------
 * The existing `<Select>` is a *button-driven* picker — clicking the trigger
 * opens a listbox, an optional `searchable` mode renders a secondary text
 * input INSIDE the dropdown. That's fine for short lists, but every modern
 * app has lists > 20 items where the type-to-filter affordance needs to live
 * on the trigger itself, not behind a click. shadcn, Mantine, Chakra, MUI all
 * ship this as a distinct primitive; Lando did not — until now.
 *
 * Architectural choice — Portal + `usePortalPosition`, NOT `<Popover>`
 * --------------------------------------------------------------------
 * The Sprint 54 lane brief recommended composing on top of `Popover` (which
 * landed a controlled-open API in #329). On read-through Popover is
 * fundamentally a *tooltip-class* surface — it owns hover/click triggers,
 * adds `aria-describedby` to its trigger, renders content with
 * `role="tooltip"`, and clones the trigger element to attach mouse handlers.
 * A combobox needs the OPPOSITE shape: focus stays on the input through
 * arrow navigation, the listbox carries `role="listbox"` (not tooltip), and
 * the input owns its own keydown/change/value bindings — wrapping it in
 * Popover's `trigger` clone would clobber those handlers in subtle ways
 * (e.g. Popover's click handler calls `e.preventDefault()` which kills the
 * caret position).
 *
 * The existing project consensus is the right answer here: `Select`,
 * `Dropdown`, `TagInput`, `CommandPalette` all compose `Portal` +
 * `usePortalPosition` directly. That's the same infrastructure Popover wraps
 * internally, so we still inherit the #37 mount-robust measurement, the
 * capture-phase scroll tracking, and the viewport-aware flip. We just skip
 * Popover's tooltip-shaped wrapper. See the "judgment calls" note in the
 * Sprint 54 close-out for the back-and-forth.
 *
 * Keyboard focus model
 * --------------------
 * **`aria-activedescendant`**, not roving focus. DOM focus stays on the
 * `<input role="combobox">` the whole time so the user can keep typing while
 * arrow-navigating — moving focus to the active option would steal focus
 * from the input and break the search experience. Same model as
 * `CommandPalette` and `Select`. WAI-ARIA Practices' combobox-with-listbox
 * pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 *
 * Filter model
 * ------------
 * Two modes, switched on the presence of `onSearch`:
 *
 * - **Sync (default)** — consumer hands us the full `options` array; we
 *   case-insensitively substring-match against `option.label` on every
 *   keystroke and render the filtered subset.
 *
 * - **Async (when `onSearch` is provided)** — we call `onSearch(query)` on
 *   every keystroke and render whatever the consumer ships in `options`.
 *   The consumer is responsible for the debounce / fetch / state mgmt.
 *   `loading` toggles a spinner inside the listbox while the consumer is
 *   in-flight.
 *
 * This is the same shape `react-select`, `cmdk`, and `downshift` converge
 * on — async mode just means "you control `options`, we own UI state."
 *
 * @example Sync filter
 *   const [value, setValue] = useState<string | undefined>()
 *   <Combobox
 *     label="Country"
 *     options={countries.map(c => ({ value: c.code, label: c.name }))}
 *     value={value}
 *     onChange={setValue}
 *   />
 *
 * @example Async filter
 *   const [query, setQuery] = useState('')
 *   const [options, setOptions] = useState<ComboboxOption[]>([])
 *   const [loading, setLoading] = useState(false)
 *   useEffect(() => {
 *     setLoading(true)
 *     fetchUsers(query).then(users => {
 *       setOptions(users.map(u => ({ value: u.id, label: u.name })))
 *       setLoading(false)
 *     })
 *   }, [query])
 *   <Combobox
 *     options={options}
 *     onSearch={setQuery}
 *     loading={loading}
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
import { useModalPortalContainer } from '../Modal/ModalPortalContext'
import { usePortalPosition } from '../../hooks/usePortalPosition'
import { supportsPopoverApi, syncPopoverState } from '../../utils/popoverApi'
import styles from './Combobox.module.css'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ComboboxOption {
  /** Unique value committed via `onChange`. String for simplicity / serialization. */
  value: string
  /** Visible label rendered in the listbox AND in the input when selected. */
  label: string
  /** Disabled options render but are not keyboard-reachable / clickable. */
  disabled?: boolean
}

export type ComboboxSize = 'sm' | 'md' | 'lg'

export interface ComboboxProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'value' | 'defaultValue' | 'id'
  > {
  /** Available options. In async mode, this is the consumer-filtered subset. */
  options: ComboboxOption[]
  /** Controlled selection. Pass `undefined` for "nothing selected." */
  value?: string
  /** Initial uncontrolled selection. Ignored when `value` is set. */
  defaultValue?: string
  /**
   * Notified when the user picks an option, or `undefined` when the selection
   * is cleared (user erases the input text). Distinct from "selected an
   * option whose value happens to be empty string."
   */
  onChange?: (value: string | undefined) => void
  /**
   * Async filter callback. When provided, we fire on every keystroke and
   * delegate filtering to the consumer — they manage debounce + fetch and
   * re-render `options` with the result. When absent, we sync-filter the
   * `options` prop by case-insensitive substring match on `label`.
   */
  onSearch?: (query: string) => void
  /** Placeholder shown when nothing is selected and the input is empty. */
  placeholder?: string
  /** Label rendered above the input. */
  label?: string
  /** Disable all interaction. */
  disabled?: boolean
  /**
   * Show a spinner in the listbox area. Wire this to the consumer's async
   * fetch state in async (`onSearch`) mode.
   */
  loading?: boolean
  /** Message rendered when the filtered list is empty. Defaults to "No results". */
  emptyMessage?: string
  /** Visual size scale. Default: "md". */
  size?: ComboboxSize
  /** Extra class on the outer container. */
  className?: string
  /** Stable id for the input — auto-generated if omitted. */
  id?: string
  /**
   * HTML form field name. When provided, a hidden `<input>` is rendered so
   * `FormData` / Server Actions receive the selected value. Mirrors
   * `Select`'s contract.
   */
  name?: string
}

// ---------------------------------------------------------------------------
// Combobox
// ---------------------------------------------------------------------------

export const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(
  function Combobox(
    {
      options,
      value: controlledValue,
      defaultValue,
      onChange,
      onSearch,
      placeholder = 'Search...',
      label,
      disabled = false,
      loading = false,
      emptyMessage = 'No results',
      size = 'md',
      className = '',
      id,
      name,
      style,
      ...rest
    },
    forwardedRef
  ) {
    // -----------------------------------------------------------------------
    // Controlled / uncontrolled selection bridge — mirrors the Popover #329
    // pattern. Consumer's `value` is the source of truth when provided.
    // -----------------------------------------------------------------------
    const isControlled = controlledValue !== undefined
    const [internalValue, setInternalValue] = useState<string | undefined>(
      defaultValue
    )
    const selectedValue = isControlled ? controlledValue : internalValue

    const setValue = useCallback(
      (next: string | undefined) => {
        if (!isControlled) setInternalValue(next)
        onChange?.(next)
      },
      [isControlled, onChange]
    )

    // -----------------------------------------------------------------------
    // Input text (filter query) — always uncontrolled inside the component.
    // The displayed text reflects either the user's typing OR the selected
    // option's label, depending on whether the listbox is open.
    // -----------------------------------------------------------------------
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)

    // When closed AND a selection exists, the input shows the selected label.
    // When open OR no selection, the input shows the live `query`. This
    // matches the pattern in shadcn/cmdk — opening the listbox switches into
    // "type to filter" mode; closing snaps back to "showing the selection."
    const selectedOption = selectedValue
      ? options.find((o) => o.value === selectedValue)
      : undefined
    const inputValue = open ? query : selectedOption?.label ?? ''

    // -----------------------------------------------------------------------
    // Filter — sync vs async. In async mode the consumer owns the filter,
    // so we render `options` as-is. In sync mode we substring-match.
    // -----------------------------------------------------------------------
    const isAsync = onSearch !== undefined
    const filteredOptions = isAsync
      ? options
      : query.trim()
      ? options.filter((opt) =>
          opt.label.toLowerCase().includes(query.toLowerCase().trim())
        )
      : options

    // Selectable subset for keyboard nav — disabled options stay in the DOM
    // (so users see they exist) but skip in the activedescendant walk.
    const selectableIndexes = filteredOptions
      .map((o, i) => (o.disabled ? -1 : i))
      .filter((i) => i !== -1)

    // -----------------------------------------------------------------------
    // Keep `activeIndex` valid when the list changes (filter shrunk it past
    // the current active option, or `options` was re-shipped by an async
    // consumer). Snap to the first selectable option, or -1 if the list is
    // empty. Without this, aria-activedescendant points at a dead id.
    // -----------------------------------------------------------------------
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
        filteredOptions[activeIndex]?.disabled
      ) {
        setActiveIndex(selectableIndexes[0]!) // safe: length > 0 checked above
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, filteredOptions.length, activeIndex])

    // -----------------------------------------------------------------------
    // Refs + ids — stable across renders for ARIA wiring.
    // -----------------------------------------------------------------------
    const reactId = useId()
    const inputId = id || `combobox-${reactId}`
    const listboxId = `combobox-listbox-${reactId}`
    const labelId = `combobox-label-${reactId}`
    const makeOptionId = (index: number) => `combobox-opt-${reactId}-${index}`

    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const listboxRef = useRef<HTMLUListElement>(null)

    // Merge external ref so consumers can `inputRef={...}` if they want.
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

    // -----------------------------------------------------------------------
    // Portal positioning. Anchored to the container (which holds the input)
    // so the listbox aligns to the input's full width. matchTriggerWidth =
    // true mirrors the Select / TagInput pattern — the listbox width is
    // pinned to the input width regardless of viewport size.
    // -----------------------------------------------------------------------
    const position = usePortalPosition(containerRef, open, {
      align: 'left',
      offset: 4,
      overlayRef: listboxRef,
      matchTriggerWidth: true,
    })

    // -----------------------------------------------------------------------
    // Nearest enclosing OPEN Modal's in-dialog portal container (#14
    // follow-up — see the long comment at the top of Modal.tsx). Non-null
    // means: render the listbox as a descendant of that Modal's <dialog>
    // instead of document.body — that's what actually makes it interactive,
    // not just visible. See the Portal/popover JSX below.
    // -----------------------------------------------------------------------
    const modalPortalContainer = useModalPortalContainer()

    // -----------------------------------------------------------------------
    // Popover API top-layer promotion (#14) — STANDALONE path only. A
    // document.body-portaled `popover="manual"` element paints above a
    // native <dialog> Modal's top layer, but showModal()'s `inert` algorithm
    // marks every node outside the dialog's own subtree inert regardless of
    // paint order — verified live in Chromium, the element paints on top but
    // is click/hover-through. When `modalPortalContainer` is non-null we
    // instead render as a dialog descendant (exempt from inertness by DOM
    // ancestry) and skip Popover API promotion entirely — see the JSX below
    // for why the `popover` attribute itself must also be omitted in that
    // branch, not just left un-shown.
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (modalPortalContainer) return
      if (!supportsPopoverApi()) return
      syncPopoverState(listboxRef.current, open && position.isReady)
    }, [open, position.isReady, modalPortalContainer])

    // -----------------------------------------------------------------------
    // Outside-click / outside-focus → close. Mirrors Select's pattern with a
    // setTimeout(0) defer to avoid the just-opened click also being the
    // "outside" click. We also include focus-out so tabbing away closes.
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const openListbox = () => {
      if (disabled) return
      if (!open) {
        setOpen(true)
        // Opening preserves the prior query so the user can resume editing.
        // The activedescendant useEffect picks an initial active option.
      }
    }

    const closeListbox = () => {
      setOpen(false)
      // Clear the in-flight query — next open starts fresh, and the input
      // re-displays the committed selection's label via the `inputValue`
      // derivation. If the consumer wired an async `onSearch`, also tell
      // them the query reset so they can clear any stale filter results.
      setQuery('')
      if (isAsync) onSearch?.('')
    }

    const selectIndex = (index: number) => {
      const opt = filteredOptions[index]
      if (!opt || opt.disabled) return
      setValue(opt.value)
      setOpen(false)
      setQuery('')
      if (isAsync) onSearch?.('')
      // Return focus to the input so the user can keep typing or tab away.
      inputRef.current?.focus()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value
      setQuery(next)
      if (!open) setOpen(true)
      // If the user erased everything, clear the committed selection too —
      // this matches the user's mental model: an empty input means "no
      // selection." Without this, the chip-or-label would silently reappear
      // when they close the listbox without picking anything new.
      if (next === '' && selectedValue !== undefined) {
        setValue(undefined)
      }
      // Fire async callback every keystroke. Consumer is responsible for
      // debounce / fetch / cancellation.
      if (isAsync) onSearch?.(next)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return

      switch (e.key) {
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
          selectIndex(activeIndex)
          break
        }
        case 'Escape': {
          // Spec: Esc closes the listbox WITHOUT clearing the selection.
          if (open) {
            e.preventDefault()
            closeListbox()
          }
          break
        }
        case 'Tab': {
          // Don't preventDefault — let Tab move focus naturally. Just
          // close the listbox so the dropdown doesn't linger.
          if (open) setOpen(false)
          break
        }
      }
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    const containerClasses = [
      styles.container,
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
        >
          <input
            ref={setInputRef}
            id={inputId}
            type="text"
            role="combobox"
            className={styles.input}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={openListbox}
            onClick={openListbox}
            placeholder={placeholder}
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

          <span className={styles.chevron} aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        {/* Hidden input for FormData. Mirrors Select.tsx. */}
        {name && (
          <input
            type="hidden"
            name={name}
            value={selectedValue ?? ''}
          />
        )}

        {open && (
          // `container={modalPortalContainer}` — `null` falls through to
          // Portal's own `container || document.body` default, a no-op for
          // the standalone case; only changes behavior nested in an open
          // Modal (#14 follow-up).
          <Portal container={modalPortalContainer}>
            <ul
              ref={listboxRef}
              id={listboxId}
              role="listbox"
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
              // Popover API opt-in (#14) — STANDALONE path only (see the
              // useEffect above). Omitted when nested in an open Modal: the
              // UA stylesheet hides `[popover]:not(:popover-open)` and we
              // never call showPopover() in that branch.
              popover={modalPortalContainer ? undefined : 'manual'}
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
                  const isSelected = opt.value === selectedValue
                  const optionClasses = [
                    styles.option,
                    isActive && styles.optionActive,
                    isSelected && styles.optionSelected,
                    opt.disabled && styles.optionDisabled,
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <li
                      key={opt.value}
                      id={makeOptionId(i)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      className={optionClasses}
                      onMouseDown={(e) => {
                        // Prevent input blur from racing the click.
                        e.preventDefault()
                      }}
                      onClick={() => selectIndex(i)}
                      onMouseMove={() => {
                        if (!opt.disabled && activeIndex !== i) {
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
  }
)

Combobox.displayName = 'Combobox'
