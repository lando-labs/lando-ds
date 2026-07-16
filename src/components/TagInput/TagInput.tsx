'use client'

/**
 * TagInput Component
 *
 * Free-text combobox where users type, press Enter (or a delimiter char),
 * and the text is committed as a chip. Optional `suggestions` enable
 * autocomplete; `allowCustom={false}` rejects values not in the suggestion
 * list (predefined-options "pill select" pattern).
 *
 * Replaces the 4 hand-rolled chip-input modals identified in the primitives
 * audit. Sized to drop into forms next to <Input> with matching height.
 *
 * @example
 * <TagInput
 *   value={tags}
 *   onChange={setTags}
 *   suggestions={['react', 'typescript', 'nextjs']}
 *   placeholder="Add tags..."
 * />
 */

import React, { useId, useRef, useState, useCallback } from 'react'
import { Portal } from '../Portal'
import { usePortalPosition } from '../../hooks/usePortalPosition'
import { useControllableState } from '../../hooks/useControllableState'
import styles from './TagInput.module.css'

export interface TagInputProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'id' | 'defaultValue'
  > {
  /**
   * Current tags (controlled). When provided, the consumer owns the tag list
   * via {@link TagInputProps.onChange}.
   */
  value?: string[]
  /**
   * Initial tags for uncontrolled usage. Ignored when `value` is provided.
   * Defaults to an empty list.
   */
  defaultValue?: string[]
  /**
   * Called with the new tag list whenever it changes. Fires in both controlled
   * and uncontrolled modes (an optional observer when uncontrolled).
   */
  onChange?: (tags: string[]) => void
  /** Optional autocomplete suggestions. Filtered case-insensitively. */
  suggestions?: string[]
  /**
   * If false, only values present in `suggestions` may be added — typing
   * a value not in the list will not commit. Defaults to `true`.
   */
  allowCustom?: boolean
  /** Placeholder for the inner input. */
  placeholder?: string
  /** Hard upper bound on tag count. Input is disabled once reached. */
  maxTags?: number
  /**
   * HTML form field name. When provided, one hidden `<input>` is rendered
   * per tag so `FormData.getAll(name)` returns the array — matching the
   * Select v0.4.1 multi-select contract.
   */
  name?: string
  /**
   * Character that, when typed inside the input, commits the preceding
   * text as a chip. Defaults to `","`. Enter always commits regardless.
   */
  delimiter?: string
  /** Predicate. Tags returning false are rejected (no commit). */
  validateTag?: (tag: string) => boolean
  /** Optional label shown above the combobox. */
  label?: string
  /** Helper text shown below. Suppressed when `error` is set. */
  helperText?: string
  /** Error message — when set, surfaces as role="alert" + error border. */
  error?: string
  /** Mark the field as required. Cosmetic + ARIA only. */
  required?: boolean
  /** Disable all interaction. */
  disabled?: boolean
  /**
   * Extra class on the visual root (the `role="combobox"` element).
   *
   * #422 — `className` now lands on the combobox element (the input-shaped
   * surface that carries the border, focus ring, and chip row), not the outer
   * field `.container`. To style the outer field wrapper (the label + field +
   * footer column) use {@link TagInputProps.wrapperClassName}.
   */
  className?: string
  /**
   * Escape hatch: extra class on the OUTER field `.container` (the flex column
   * that stacks label, combobox, and helper/error footer). Target it for
   * field-level layout overrides (width, margin, grid placement) that
   * previously rode on `className`.
   */
  wrapperClassName?: string
  /** Escape hatch: inline style on the outer field `.container`. */
  wrapperStyle?: React.CSSProperties
  /** Stable id for the combobox wrapper (the `role="combobox"` element). */
  id?: string
}

/*
 * Implementation notes:
 *
 * - Suggestions list is rendered INLINE (position: absolute under the
 *   wrapper), not via Portal. See TagInput.module.css for rationale.
 *
 * - We mark the OUTER wrapper as role="combobox" with aria-expanded /
 *   aria-controls / aria-activedescendant. The actual <input> stays a
 *   plain text input — moving the combobox role to the wrapper avoids
 *   nesting interactive roles inside an editable input.
 *
 * - All state related to the SUGGESTION UI lives in this component. Tags
 *   themselves are fully controlled — we never store `value` internally.
 */
export const TagInput = React.forwardRef<HTMLInputElement, TagInputProps>(
  (props, ref) => {
    const {
      value: valueProp,
      defaultValue = [],
      onChange,
      suggestions,
      allowCustom = true,
      placeholder,
      maxTags,
      name,
      delimiter = ',',
      validateTag,
      label,
      helperText,
      error,
      required,
      disabled,
      className = '',
      wrapperClassName = '',
      wrapperStyle,
      style,
      id,
      ...rest
    } = props
    // Controlled-ness by prop presence, not value.
    const [value, setValue] = useControllableState<string[]>({
      value: valueProp,
      defaultValue,
      onChange,
      controlled: 'value' in props,
    })

    const reactId = useId()
    const wrapperId = id || `taginput-${reactId}`
    const inputId = `${wrapperId}-input`
    const listboxId = `${wrapperId}-listbox`
    const helperId = `${wrapperId}-helper`
    const errorId = `${wrapperId}-error`
    const optionId = (i: number) => `${wrapperId}-opt-${i}`

    const [inputValue, setInputValue] = useState('')
    const [suggestionsOpen, setSuggestionsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [focused, setFocused] = useState(false)

    // Expose the inner input via the forwarded ref AND keep our own copy
    // so chip-row click can refocus the editor.
    const internalRef = useRef<HTMLInputElement>(null)
    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        internalRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
      },
      [ref]
    )

    // Portal positioning for the suggestion list. Anchored to the combobox
    // wrapper so the list aligns with the chip row (not just the input),
    // matching the visual contract consumers expect. Portal-rendered so
    // the dropdown escapes any overflow:hidden ancestor (Card, Modal,
    // table rows). Mirrors Select's pattern.
    const wrapperRef = useRef<HTMLDivElement>(null)
    const listboxRef = useRef<HTMLUListElement>(null)

    const atMax = maxTags != null && value.length >= maxTags
    const inputDisabled = disabled || atMax

    // Filter suggestions against the typed text + already-selected tags.
    // Hide already-selected so users don't get a no-op "commit" that just
    // closes the popup.
    const filteredSuggestions = (suggestions ?? []).filter((s) => {
      if (value.includes(s)) return false
      if (!inputValue) return true
      return s.toLowerCase().includes(inputValue.toLowerCase())
    })

    // The Portal'd listbox mounts only when there's something to show. We
    // anchor positioning to this combined visibility, not just `suggestionsOpen`,
    // so that re-mounts (open with no matches → user keystroke produces matches)
    // re-trigger the measurement loop. Otherwise usePortalPosition stays in
    // its "isReady: false" state from the first mount and never positions
    // subsequent re-mounts of the listbox.
    const showSuggestions = suggestionsOpen && filteredSuggestions.length > 0
    const portalPosition = usePortalPosition(wrapperRef, showSuggestions, {
      align: 'left',
      offset: 4,
      overlayRef: listboxRef,
      matchTriggerWidth: true,
    })

    /**
     * Attempt to commit the current input text (or an explicit `raw`) as
     * a tag. Returns `true` if accepted. Centralizing this logic keeps
     * Enter / delimiter / Tab / blur paths identical.
     */
    const commitTag = (raw?: string): boolean => {
      const candidate = (raw ?? inputValue).trim()
      if (!candidate) return false
      if (atMax) return false
      if (value.includes(candidate)) {
        // Duplicate — clear input but don't add. Treat as accepted so the
        // editor clears and focus moves on naturally.
        setInputValue('')
        return true
      }
      if (!allowCustom && !(suggestions ?? []).includes(candidate)) {
        return false
      }
      if (validateTag && !validateTag(candidate)) {
        return false
      }
      setValue([...value, candidate])
      setInputValue('')
      setHighlightedIndex(-1)
      return true
    }

    const removeTagAt = (index: number) => {
      const next = value.slice(0, index).concat(value.slice(index + 1))
      setValue(next)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let next = e.target.value
      // Delimiter typed mid-stream → commit the prefix, drop the delimiter.
      if (delimiter && next.includes(delimiter)) {
        const [head] = next.split(delimiter)
        if (head?.trim()) {
          const accepted = commitTag(head)
          if (accepted) return
        }
        // Strip delimiter even if commit failed so we don't leave it as
        // a stuck character in the editor.
        next = next.split(delimiter).join('')
      }
      setInputValue(next)
      setSuggestionsOpen(true)
      setHighlightedIndex(-1)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return

      switch (e.key) {
        case 'Enter': {
          e.preventDefault()
          if (
            suggestionsOpen &&
            highlightedIndex >= 0 &&
            filteredSuggestions[highlightedIndex]
          ) {
            commitTag(filteredSuggestions[highlightedIndex])
          } else {
            commitTag()
          }
          break
        }
        case 'Tab': {
          // Tab still navigates focus — but if there's pending text, we
          // commit FIRST so users don't accidentally drop a half-typed tag.
          if (inputValue.trim()) {
            commitTag()
            // Don't preventDefault — let the browser do the focus move.
          }
          break
        }
        case 'Backspace': {
          if (inputValue === '' && value.length > 0) {
            e.preventDefault()
            removeTagAt(value.length - 1)
          }
          break
        }
        case 'ArrowDown': {
          if (filteredSuggestions.length === 0) break
          e.preventDefault()
          setSuggestionsOpen(true)
          setHighlightedIndex((prev) =>
            Math.min(prev + 1, filteredSuggestions.length - 1)
          )
          break
        }
        case 'ArrowUp': {
          if (filteredSuggestions.length === 0) break
          e.preventDefault()
          setHighlightedIndex((prev) => Math.max(prev - 1, 0))
          break
        }
        case 'Escape': {
          if (suggestionsOpen) {
            e.preventDefault()
            setSuggestionsOpen(false)
            setHighlightedIndex(-1)
          }
          break
        }
        case 'Home': {
          if (suggestionsOpen && filteredSuggestions.length > 0) {
            e.preventDefault()
            setHighlightedIndex(0)
          }
          break
        }
        case 'End': {
          if (suggestionsOpen && filteredSuggestions.length > 0) {
            e.preventDefault()
            setHighlightedIndex(filteredSuggestions.length - 1)
          }
          break
        }
      }
    }

    const handleBlur = () => {
      // Commit dangling text on blur. Use a microtask so a click on a
      // suggestion still wins over the blur — the suggestion's onMouseDown
      // (preventDefault'd below) keeps focus in the input.
      if (inputValue.trim()) {
        commitTag()
      }
      setFocused(false)
      setSuggestionsOpen(false)
      setHighlightedIndex(-1)
    }

    const handleSuggestionMouseDown = (
      e: React.MouseEvent<HTMLLIElement>,
      sug: string
    ) => {
      // Prevent the input from blurring before our click registers.
      e.preventDefault()
      commitTag(sug)
      internalRef.current?.focus()
    }

    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // Clicking anywhere in the wrapper that isn't a chip remove button
      // should focus the editor. Filter out clicks on buttons so chip
      // removal works.
      const target = e.target as HTMLElement
      if (target.closest('button')) return
      internalRef.current?.focus()
    }

    // #422 — the consumer's `className` now rides on the `.combobox` visual
    // root (the role="combobox" element carrying the border, focus ring, and
    // chip row). The outer field `.container` is exposed via `wrapperClassName`.
    const comboboxClasses = [
      styles.combobox,
      focused ? styles.focused : '',
      disabled ? styles.disabled : '',
      error ? styles.error : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // The outer field column stays load-bearing (it stacks label + field +
    // footer at full width); expose it via the wrapper escape hatch.
    const containerClasses = [styles.container, wrapperClassName]
      .filter(Boolean)
      .join(' ')

    const describedBy =
      [error ? errorId : null, helperText && !error ? helperId : null]
        .filter(Boolean)
        .join(' ') || undefined

    return (
      <div className={containerClasses} style={wrapperStyle}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && (
              <span className={styles.required} aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        <div
          /*
           * The combobox role lives on the WRAPPER, not the <input>. ARIA
           * 1.2 allows either, but wrapper-as-combobox keeps the inner
           * input semantically a plain textfield while still giving AT a
           * single element with aria-expanded / aria-controls.
           *
           * #422 — consumer `style` + `...rest` are spread FIRST so the
           * component's own combobox contract (role, id, the aria wiring,
           * and the focus onClick) stays authoritative and can't be silently
           * clobbered. `className` is already merged into `comboboxClasses`.
           */
          {...rest}
          style={style}
          ref={wrapperRef}
          role="combobox"
          id={wrapperId}
          className={comboboxClasses}
          aria-expanded={suggestionsOpen}
          aria-controls={suggestionsOpen ? listboxId : undefined}
          aria-haspopup="listbox"
          aria-owns={suggestionsOpen ? listboxId : undefined}
          aria-activedescendant={
            suggestionsOpen && highlightedIndex >= 0
              ? optionId(highlightedIndex)
              : undefined
          }
          aria-disabled={disabled}
          onClick={handleWrapperClick}
        >
          {value.map((tag, i) => (
            <span key={`${tag}-${i}`} className={styles.chip}>
              <span className={styles.chipText}>{tag}</span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={(e) => {
                  e.stopPropagation()
                  removeTagAt(i)
                }}
                aria-label={`Remove ${tag}`}
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
            className={styles.input}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setFocused(true)
              if (filteredSuggestions.length > 0) setSuggestionsOpen(true)
            }}
            onBlur={handleBlur}
            placeholder={value.length === 0 ? placeholder : undefined}
            disabled={inputDisabled}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            aria-autocomplete={suggestions ? 'list' : 'none'}
            aria-required={required}
          />

          {showSuggestions && (
            <Portal>
              <ul
                ref={listboxRef}
                id={listboxId}
                role="listbox"
                className={`${styles.suggestions} ${
                  portalPosition.isReady ? styles.positioned : styles.positioning
                }`}
                style={{
                  top: `${portalPosition.top}px`,
                  left: `${portalPosition.left}px`,
                  width: portalPosition.width
                    ? `${portalPosition.width}px`
                    : undefined,
                }}
                /*
                 * onMouseDown handler on each <li> already prevents blur,
                 * but we ALSO stop mousedown bubbling on the listbox itself
                 * to defend against the click-outside collapse heuristic
                 * some embedders attach to ancestors.
                 */
                onMouseDown={(e) => e.preventDefault()}
              >
                {filteredSuggestions.map((sug, i) => {
                  const isHighlighted = i === highlightedIndex
                  return (
                    <li
                      key={sug}
                      id={optionId(i)}
                      role="option"
                      aria-selected={isHighlighted}
                      className={`${styles.suggestion} ${
                        isHighlighted ? styles.highlighted : ''
                      }`}
                      onMouseDown={(e) => handleSuggestionMouseDown(e, sug)}
                      onMouseEnter={() => setHighlightedIndex(i)}
                    >
                      {sug}
                    </li>
                  )
                })}
              </ul>
            </Portal>
          )}
        </div>

        {/* Hidden inputs for FormData. Mirrors Select v0.4.1 multi pattern:
            one input per value so FormData.getAll(name) returns an array. */}
        {name &&
          value.map((tag, i) => (
            <input
              key={`${name}-${i}`}
              type="hidden"
              name={name}
              value={tag}
            />
          ))}

        {(error || helperText || atMax) && (
          <div className={styles.footer}>
            <div className={styles.helperWrapper}>
              {error && (
                <span id={errorId} className={styles.errorText} role="alert">
                  {error}
                </span>
              )}
              {!error && helperText && (
                <span id={helperId} className={styles.helperText}>
                  {helperText}
                </span>
              )}
            </div>
            {atMax && maxTags != null && (
              <span className={styles.maxHint} aria-live="polite">
                Max {maxTags} tags
              </span>
            )}
          </div>
        )}
      </div>
    )
  }
)

TagInput.displayName = 'TagInput'
