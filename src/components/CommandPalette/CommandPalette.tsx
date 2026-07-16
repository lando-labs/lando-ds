'use client'

/**
 * CommandPalette — first-class ⌘K palette primitive (#378).
 *
 * Background
 * ----------
 * A consumer app hand-rolled a command palette on top of DS `Modal` + `Input`,
 * but everything else (listbox shell, grouped categories, item layout, keyboard
 * navigation, ARIA wiring) was custom — and the items were marked
 * `role="option"` with no `role="listbox"` ancestor. That is **invalid ARIA**:
 * an option without a listbox/menu owner has no defined semantics, so screen
 * readers either drop the role or announce the items as plain content. Several
 * other consumer apps were on track to copy the same shape.
 *
 * This primitive fixes the bug architecturally and ships the missing
 * affordances (groups, shortcuts, descriptions, filter, empty state) so
 * consumers don't have to.
 *
 * Composition
 * -----------
 * The palette is **controlled-only** (`open` + `onOpenChange`). Consumers own
 * the ⌘K hotkey via their own keyboard hook — the palette doesn't try to be a
 * global keyboard listener, because hotkeys are an app-shell concern (some
 * apps want ⌘K, some want ⌘P, some want `/`). The palette opens whatever
 * dialog the consumer routes into it.
 *
 * Internally we **compose v0.29's native `<dialog>` Modal** as the shell — that
 * gives us top-layer promotion, the `::backdrop` pseudo-element, focus-trap,
 * the body scroll-lock, the initial-focus override, and Esc dismissal for free.
 * The palette never owns "what is a dialog" — it owns "what lives inside the
 * dialog" (the input, the listbox, the items).
 *
 * Listbox semantics
 * -----------------
 *   <dialog>                                            ← Modal
 *     <input role="combobox" aria-controls="lb-..."
 *            aria-activedescendant="opt-..." />          ← search input
 *     <div role="listbox" id="lb-...">                  ← THE FIX
 *       <div role="group" aria-labelledby="grp-...">    ← optional group
 *         <div id="grp-...">Heading</div>
 *         <div role="option" id="opt-..." />            ← item
 *         <div role="option" id="opt-..." />
 *       </div>
 *     </div>
 *   </dialog>
 *
 * `role="group"` is legal inside `role="listbox"` (WAI-ARIA Practices'
 * grouped-listbox pattern; used by GitHub's command-k, Vercel's, etc).
 * Options inside the group remain options of the OUTER listbox — they are not
 * scoped to the group — so keyboard navigation flows through every option in
 * DOM order regardless of grouping.
 *
 * Keyboard focus model
 * --------------------
 * **aria-activedescendant**, not roving focus. DOM focus stays on the input
 * the whole time (so the user can keep typing), and `aria-activedescendant`
 * points at the currently-active option's id. This matches the combobox-with-
 * listbox pattern in WAI-ARIA Practices and is the same model the DS `Select`
 * uses. Roving focus would steal focus from the input on every Arrow press,
 * which breaks the search experience.
 *
 * Filter model
 * ------------
 * Built-in case-insensitive substring filter against each item's `searchValue`
 * (or the item's text children if `searchValue` is not provided). The filter
 * is intentionally simple. Consumers who want async or fuzzy matching should
 * control `value` themselves and re-render only the items they want shown —
 * the palette does no extra work in that mode.
 *
 * Why a Context-based registry
 * ----------------------------
 * The root needs to (a) know which items match the current filter to compute
 * the visible flat list for keyboard nav, and (b) wire the active option's id
 * onto its own `aria-activedescendant`. Items are arbitrary depth (group →
 * item, or item alone), so the root reaches them via React Context — each
 * item registers itself with `useId`-stable id, `onSelect`, `disabled`,
 * `searchValue`, and the parent root keeps a Map keyed by id. After every
 * render the root queries the DOM (`[role="option"]:not([aria-disabled])`) to
 * get the flat list in render order for keyboard nav — cheap, robust, and
 * survives any DOM ordering the consumer can compose.
 *
 * @example
 *   const [open, setOpen] = useState(false)
 *   useHotkey('mod+k', () => setOpen(o => !o))
 *
 *   <CommandPalette open={open} onOpenChange={setOpen}>
 *     <CommandPaletteGroup heading="Navigation">
 *       <CommandPaletteItem
 *         icon={<Home />}
 *         shortcut={<Kbd shortcut="meta+1" />}
 *         onSelect={() => router.push('/')}
 *       >
 *         Home
 *       </CommandPaletteItem>
 *     </CommandPaletteGroup>
 *   </CommandPalette>
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Modal } from '../Modal'
import styles from './CommandPalette.module.css'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CommandPaletteProps
  // Pass-through onto the palette's own `.root` container (the styled box
  // INSIDE the Modal that holds the search input + listbox). `children` is
  // redefined below as the group/item nodes.
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Whether the palette is open. */
  open: boolean
  /** Notified when the palette wants to open or close (Esc, backdrop click). */
  onOpenChange: (open: boolean) => void
  /**
   * Controlled filter value. If omitted, the palette manages an internal
   * empty-string-initial value. Useful when the consumer wants async / fuzzy
   * matching — in that mode they render only the items they want shown.
   */
  value?: string
  /** Notified on every keystroke into the search input. */
  onValueChange?: (value: string) => void
  /** Placeholder for the search input. Default: "Type a command or search…". */
  placeholder?: string
  /**
   * Node rendered when the filter matches zero items. Default: a muted
   * "No results" line. Pass `null` to render nothing.
   */
  emptyState?: React.ReactNode
  /** `<CommandPaletteGroup>` and/or `<CommandPaletteItem>` children. */
  children: React.ReactNode
  /** Accessible label for the listbox. Default: "Commands". */
  'aria-label'?: string
  /** Additional CSS class merged onto the palette's `.root` container. */
  className?: string
  /**
   * Inline styles applied to the palette's `.root` container. The component
   * sets no inline style there, so consumer keys apply directly.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

export interface CommandPaletteGroupProps
  // Pass-through onto the `role="group"` wrapper. `children` is redefined
  // below as the item nodes.
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Heading rendered above the group; also wires `aria-labelledby`. */
  heading: string
  /** `<CommandPaletteItem>` children. */
  children: React.ReactNode
  /** Additional CSS class merged onto the `role="group"` wrapper. */
  className?: string
  /**
   * Inline styles applied to the `role="group"` wrapper. The component sets
   * no inline style there, so consumer keys apply directly.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

export interface CommandPaletteItemProps
  // Pass-through onto the `role="option"` element (the item's visual +
  // interactive root). `children`, `id`, and `onSelect` are redefined below
  // with item-specific semantics, so they're omitted from the inherited set.
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'children' | 'id' | 'onSelect'
  > {
  /** Stable id for `aria-activedescendant`. Auto-generated if omitted. */
  id?: string
  /** Primary label text. */
  children: React.ReactNode
  /** Secondary description, rendered under the label. */
  description?: React.ReactNode
  /**
   * Right-aligned shortcut hint. Typically a `<Kbd shortcut="…" />`, but any
   * node is accepted (a Badge, plain text, etc).
   */
  shortcut?: React.ReactNode
  /** Leading icon. */
  icon?: React.ReactNode
  /** Action invoked on Enter / click. */
  onSelect: () => void
  /** Disable selection. The item still renders but is not keyboard-reachable. */
  disabled?: boolean
  /**
   * Filter key. If provided, the built-in filter matches against THIS string;
   * otherwise it matches against the item's text children (best-effort,
   * extracted via `String(children)`). Provide this when the label is non-text
   * (e.g. wrapped in a Heading) or when you want to match against synonyms.
   */
  searchValue?: string
  /**
   * Additional CSS class merged onto the `role="option"` element, after the
   * component's own item / active / disabled classes.
   */
  className?: string
  /**
   * Inline styles applied to the `role="option"` element. The component sets
   * no inline style there, so consumer keys apply directly.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Context — the root publishes wiring to items via this; items register
// themselves and read whether they match the filter / are active.
// ---------------------------------------------------------------------------

interface CommandPaletteContextValue {
  /**
   * Currently-active option id. Mirrors `aria-activedescendant` on the input.
   */
  activeId: string | null
  /** Set `activeId` (called on mouse hover so cursor + arrow stay in sync). */
  setActiveId: (id: string | null) => void
  /** Lowercased filter query. Empty string = match everything. */
  query: string
  /**
   * Register an item with the root. Returns an unregister function for the
   * effect's cleanup. The root uses this map to look up an item's onSelect by
   * id when Enter is pressed and to count visible items for the empty state.
   */
  registerItem: (id: string, data: RegisteredItem) => () => void
  /** Update an item's registration (re-fire on prop changes). */
  updateItem: (id: string, data: RegisteredItem) => void
}

interface RegisteredItem {
  onSelect: () => void
  disabled: boolean
  searchValue?: string
  /** Best-effort text extraction of `children` for the default filter. */
  textContent: string
}

const CommandPaletteContext =
  React.createContext<CommandPaletteContextValue | null>(null)

function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) {
    throw new Error(
      'CommandPaletteGroup and CommandPaletteItem must be rendered inside <CommandPalette>'
    )
  }
  return ctx
}

// Group context — items use this to know which group heading id to participate
// in. Items at the root (no group ancestor) skip the linkage.
const CommandPaletteGroupContext = React.createContext<{
  groupId: string
} | null>(null)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort text extraction for filter matching when `searchValue` is not
 * provided. Walks React children, concatenating string/number nodes. Avoids
 * pulling in a heavy `react-to-text` dependency — we only need a stable
 * fallback when the consumer hasn't told us the searchable text.
 */
function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join(' ')
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode }
    return extractText(props.children)
  }
  return ''
}

function itemMatches(item: RegisteredItem, query: string): boolean {
  if (!query) return true
  const haystack = (item.searchValue ?? item.textContent).toLowerCase()
  return haystack.includes(query)
}

// ---------------------------------------------------------------------------
// CommandPalette (root)
// ---------------------------------------------------------------------------

export function CommandPalette({
  open,
  onOpenChange,
  value: controlledValue,
  onValueChange,
  placeholder = 'Type a command or search…',
  emptyState,
  children,
  'aria-label': ariaLabel = 'Commands',
  className,
  style,
  ...rest
}: CommandPaletteProps) {
  // -------------------------------------------------------------------------
  // Filter value — controlled or internal.
  // -------------------------------------------------------------------------
  const [internalValue, setInternalValue] = useState('')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue
  const handleValueChange = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next)
      onValueChange?.(next)
    },
    [isControlled, onValueChange]
  )

  // Reset the internal filter every time the palette re-opens — otherwise the
  // previous session's query lingers. Controlled consumers manage this
  // themselves (they own `value`).
  useEffect(() => {
    if (open && !isControlled) setInternalValue('')
  }, [open, isControlled])

  // -------------------------------------------------------------------------
  // Autofocus the search input every time the palette opens. Browser-verified
  // gap (Sprint 50): without this, the parent <dialog>'s native showModal()
  // initial-focus put focus on the dialog element (a DIV), so the first Enter
  // never reached the input's onKeyDown handler. A command palette MUST be
  // immediately keyboard-driven — that's the whole point. Microtask defer so
  // the focus call runs AFTER the dialog's own initial-focus side-effects
  // settle (otherwise the dialog's showModal focus would clobber ours).
  // -------------------------------------------------------------------------
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    // Modal's own initial-focus override (Modal.tsx:207) schedules a
    // requestAnimationFrame on open that focuses Modal.body (a tabindex=-1
    // div). We need to land focus on our input AFTER that. A setTimeout(0)
    // runs as a macrotask, deferring past both Modal's rAF and any synchronous
    // layout effects in the dialog open chain. The dialog is already open and
    // the input is mounted by the time this fires, so focus lands reliably.
    // A command palette MUST be immediately keyboard-driven — that's the
    // whole point — so this defer is load-bearing for the UX contract.
    // 20ms > one 60fps frame (~16.7ms), so this macrotask is guaranteed to
    // fire AFTER Modal's rAF — in BOTH a real browser AND jsdom (where rAF
    // and setTimeout(0) order differs from spec). A bare setTimeout(0) won
    // the race in real Chrome but lost in jsdom, leaving the unit test flaky.
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(id)
  }, [open])

  // -------------------------------------------------------------------------
  // Item registry — items register on mount, the root looks them up on Enter
  // for the active-id-to-onSelect bridge. Mutating a ref instead of state so
  // re-registration doesn't trigger a render loop with the items.
  // -------------------------------------------------------------------------
  const itemsRef = useRef(new Map<string, RegisteredItem>())

  const registerItem = useCallback((id: string, data: RegisteredItem) => {
    itemsRef.current.set(id, data)
    return () => {
      itemsRef.current.delete(id)
    }
  }, [])

  const updateItem = useCallback((id: string, data: RegisteredItem) => {
    if (itemsRef.current.has(id)) {
      itemsRef.current.set(id, data)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Active descendant — keyboard nav target.
  // -------------------------------------------------------------------------
  const [activeId, setActiveId] = useState<string | null>(null)
  const listboxRef = useRef<HTMLDivElement>(null)

  /**
   * Read the visible (filter-passing, non-disabled) option ids out of the DOM
   * in render order. This is the single source of truth for keyboard nav — it
   * survives any DOM ordering the consumer composes (groups, conditional
   * sections, etc) without having to mirror that ordering in React state.
   */
  const getVisibleOptionIds = useCallback((): string[] => {
    const lb = listboxRef.current
    if (!lb) return []
    return Array.from(
      lb.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])'
      )
    )
      .map((el) => el.id)
      .filter(Boolean)
  }, [])

  // After every render that affects visibility, make sure activeId still
  // points at a visible option. If not, snap to the first visible one (or
  // null if the list is empty). This guards against the case where the user
  // arrows down then types — the previously-active item may have filtered
  // out, and we don't want aria-activedescendant pointing at a dead id.
  useEffect(() => {
    if (!open) {
      setActiveId(null)
      return
    }
    const visible = getVisibleOptionIds()
    if (visible.length === 0) {
      if (activeId !== null) setActiveId(null)
      return
    }
    if (!activeId || !visible.includes(activeId)) {
      setActiveId(visible[0]!) // safe: length > 0 checked above
    }
    // We intentionally include `value` and `children` so this re-runs when
    // the filter changes or the consumer hands us a different child set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, children, getVisibleOptionIds])

  // -------------------------------------------------------------------------
  // Keyboard handling — Arrow nav, Enter to invoke. Esc bubbles to the
  // dialog's `cancel` event, which we let Modal translate into onClose.
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const visible = getVisibleOptionIds()
        if (visible.length === 0) return
        e.preventDefault()
        const currentIndex = activeId ? visible.indexOf(activeId) : -1
        let nextIndex: number
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % visible.length
        } else {
          nextIndex =
            currentIndex <= 0
              ? visible.length - 1
              : currentIndex - 1
        }
        const nextId = visible[nextIndex]! // safe: nextIndex in [0, visible.length)
        setActiveId(nextId)
        // Scroll the newly-active item into view. Defensive: jsdom lacks
        // `CSS.escape` and `scrollIntoView`; we feature-detect both. Browsers
        // get the polished behaviour; tests still pass.
        if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
          const nextEl = listboxRef.current?.querySelector<HTMLElement>(
            `#${CSS.escape(nextId)}`
          )
          if (nextEl && typeof nextEl.scrollIntoView === 'function') {
            nextEl.scrollIntoView({ block: 'nearest' })
          }
        }
      } else if (e.key === 'Home') {
        const visible = getVisibleOptionIds()
        if (visible.length === 0) return
        e.preventDefault()
        setActiveId(visible[0]!) // safe: length > 0 checked above
      } else if (e.key === 'End') {
        const visible = getVisibleOptionIds()
        if (visible.length === 0) return
        e.preventDefault()
        setActiveId(visible[visible.length - 1]!) // safe: length > 0 checked above
      } else if (e.key === 'Enter') {
        if (!activeId) return
        const data = itemsRef.current.get(activeId)
        if (!data || data.disabled) return
        e.preventDefault()
        data.onSelect()
      }
      // Esc bubbles — Modal's cancel handler closes the dialog via onOpenChange.
    },
    [activeId, getVisibleOptionIds]
  )

  // -------------------------------------------------------------------------
  // Modal → onOpenChange bridge.
  // -------------------------------------------------------------------------
  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  // -------------------------------------------------------------------------
  // Ids — stable across renders for ARIA wiring.
  // -------------------------------------------------------------------------
  const reactId = useId()
  const listboxId = `cmdp-listbox-${reactId}`
  const inputId = `cmdp-input-${reactId}`

  // -------------------------------------------------------------------------
  // Empty-state detection — true when zero registered items pass the filter.
  // Reads from the registry (not the DOM) so we can decide before the render
  // pass commits.
  //
  // Computed inline (no useMemo) because the only invalidation signal is the
  // registry itself, which is a ref (no React-visible change). useMemo on
  // `[lowerQuery]` alone misses the case where items register/unregister
  // after the first render with the same query; useMemo on `[lowerQuery,
  // children]` overdraws AND tripped react-hooks/exhaustive-deps because
  // `children` isn't read in the body. The cost is one Map iteration per
  // render (small in absolute terms — typical palettes have 5–50 commands).
  // -------------------------------------------------------------------------
  const lowerQuery = value.toLowerCase().trim()
  let hasAnyMatch = false
  if (itemsRef.current.size === 0) {
    // First render before items have mounted — assume there's data so the
    // empty-state UI doesn't flash. The post-mount activeId useEffect
    // re-runs after items register, which triggers a re-render where this
    // flips false correctly if nothing actually matches.
    hasAnyMatch = true
  } else {
    for (const item of itemsRef.current.values()) {
      if (itemMatches(item, lowerQuery)) {
        hasAnyMatch = true
        break
      }
    }
  }

  const contextValue: CommandPaletteContextValue = useMemo(
    () => ({
      activeId,
      setActiveId,
      query: lowerQuery,
      registerItem,
      updateItem,
    }),
    [activeId, lowerQuery, registerItem, updateItem]
  )

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      size="md"
      // The palette IS the surface — we don't want a centered title row or a
      // close-X eating valuable space above the search input. Consumers can
      // wrap content in a header themselves if they want.
      showCloseButton={false}
      accent={false}
      // Reuse Modal's dismissal semantics.
      closeOnEscape
      closeOnOverlayClick
    >
      <CommandPaletteContext.Provider value={contextValue}>
        <div
          // Consumer escape hatch — `data-*`, `id`, etc. Spread BEFORE the
          // component's own className/style so they win on conflict.
          {...rest}
          className={[styles.root, className].filter(Boolean).join(' ')}
          style={style}
        >
          <div className={styles.searchRow}>
            <svg
              className={styles.searchIcon}
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M14.5 14.5L18 18M16.5 9.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              className={styles.searchInput}
              placeholder={placeholder}
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              // Combobox-with-listbox pattern. The listbox is rendered inline
              // (not popping out of a closed state), so `aria-expanded` is
              // always true while the palette is mounted.
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeId ?? undefined}
              aria-label={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className={styles.listbox}
          >
            {children}
            {!hasAnyMatch && emptyState !== null ? (
              <div className={styles.empty} role="presentation">
                {emptyState ?? 'No results.'}
              </div>
            ) : null}
          </div>
        </div>
      </CommandPaletteContext.Provider>
    </Modal>
  )
}

CommandPalette.displayName = 'CommandPalette'

// ---------------------------------------------------------------------------
// CommandPaletteGroup
// ---------------------------------------------------------------------------

export function CommandPaletteGroup({
  heading,
  children,
  className,
  style,
  ...rest
}: CommandPaletteGroupProps) {
  // Subscribe to the palette context so a query change re-renders the group
  // (its children's match results depend on it). We don't read the value
  // directly — children consume it via their own useCommandPalette() calls —
  // but consuming the context here keeps the group in sync with palette
  // state without extra wiring.
  useCommandPalette()

  const reactId = useId()
  const headingId = `cmdp-group-${reactId}`
  const groupCtx = useMemo(() => ({ groupId: headingId }), [headingId])

  // Hide the entire group when no items inside match. We don't track this in
  // React — items return `null` from render when they don't match the filter,
  // and CSS `:has(> [role="option"])` collapses the surrounding group when
  // no option survives. See CommandPalette.module.css for the rule. This
  // keeps the React tree small and lets the browser do the layout pass.
  return (
    <CommandPaletteGroupContext.Provider value={groupCtx}>
      <div
        // Consumer escape hatch — spread BEFORE the component's own
        // role/aria/className/style so they win on conflict.
        {...rest}
        role="group"
        aria-labelledby={headingId}
        className={[styles.group, className].filter(Boolean).join(' ')}
        style={style}
      >
        <div id={headingId} className={styles.groupHeading}>
          {heading}
        </div>
        {children}
      </div>
    </CommandPaletteGroupContext.Provider>
  )
}

CommandPaletteGroup.displayName = 'CommandPaletteGroup'

// ---------------------------------------------------------------------------
// CommandPaletteItem
// ---------------------------------------------------------------------------

export function CommandPaletteItem({
  id: idProp,
  children,
  description,
  shortcut,
  icon,
  onSelect,
  disabled = false,
  searchValue,
  className: classNameProp,
  style,
  ...rest
}: CommandPaletteItemProps) {
  const {
    activeId,
    setActiveId,
    query,
    registerItem,
    updateItem,
  } = useCommandPalette()

  const reactId = useId()
  const id = idProp ?? `cmdp-option-${reactId}`

  // Extract filter text from children — best-effort fallback when consumer
  // didn't pass `searchValue`. Recomputed every render but cheap (string ops).
  const textContent = useMemo(() => extractText(children), [children])

  // Decide whether THIS item passes the filter. The root's activeId / DOM-
  // query approach reads only [role="option"] elements, so non-matching items
  // simply don't render that attribute (the wrapper div renders but without
  // role/id — effectively invisible to the listbox).
  const matches = useMemo(() => {
    if (!query) return true
    const haystack = (searchValue ?? textContent).toLowerCase()
    return haystack.includes(query)
  }, [query, searchValue, textContent])

  // Register on mount; unregister on unmount.
  useEffect(() => {
    return registerItem(id, {
      onSelect,
      disabled,
      searchValue,
      textContent,
    })
    // We deliberately register on mount only — updates land via `updateItem`
    // in the effect below. Re-registering would clear/restore the entry
    // every render, which works but creates needless churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Keep the registry in sync with prop changes (consumers might swap
  // onSelect on every render — common in inline arrow-function consumers).
  useEffect(() => {
    updateItem(id, { onSelect, disabled, searchValue, textContent })
  }, [id, onSelect, disabled, searchValue, textContent, updateItem])

  if (!matches) {
    // Render nothing so the item isn't reachable by the DOM-querying keyboard
    // nav — and so the group's :has() rule can collapse empty groups.
    return null
  }

  const isActive = activeId === id
  const className = [
    styles.item,
    isActive && styles.itemActive,
    disabled && styles.itemDisabled,
    classNameProp,
  ]
    .filter(Boolean)
    .join(' ')

  const handleClick = () => {
    if (disabled) return
    onSelect()
  }

  const handleMouseMove = () => {
    if (disabled) return
    if (activeId !== id) setActiveId(id)
  }

  return (
    <div
      // Consumer escape hatch — `data-*`, etc. Spread BEFORE the component's
      // own identity/state attributes so id, role, aria-*, the option's
      // own handlers, className, and style win on conflict.
      {...rest}
      id={id}
      role="option"
      aria-selected={isActive}
      aria-disabled={disabled || undefined}
      className={className}
      style={style}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      // pointer cursor only via CSS — no role="button" hijacking, the option
      // role + click handler is the correct semantics.
    >
      {icon ? (
        <span className={styles.itemIcon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className={styles.itemBody}>
        <div className={styles.itemLabel}>{children}</div>
        {description ? (
          <div className={styles.itemDescription}>{description}</div>
        ) : null}
      </div>
      {shortcut ? (
        <span className={styles.itemShortcut} aria-hidden="true">
          {shortcut}
        </span>
      ) : null}
    </div>
  )
}

CommandPaletteItem.displayName = 'CommandPaletteItem'
