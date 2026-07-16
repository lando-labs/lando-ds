/**
 * CommandPalette Component Tests (#378).
 *
 * Coverage:
 *   - Controlled open/close — palette renders only when `open`, onOpenChange
 *     fires on Esc (via Modal's native `cancel` bridge).
 *   - Listbox semantics — `role="listbox"` exists, items have `role="option"`
 *     and are DOM-children of the listbox (the bug we're fixing).
 *   - Keyboard nav — ArrowDown/Up move `aria-activedescendant` on the input;
 *     Enter invokes the active item's `onSelect`; Home/End jump to extremes.
 *   - Filter — typing into the search input narrows visible items; empty
 *     filter shows everything; consumer-supplied `searchValue` wins over
 *     text content.
 *   - Groups — group heading renders with `aria-labelledby` wiring to its
 *     `role="group"` container; items inside groups remain options of the
 *     OUTER listbox (no nested listboxes).
 *   - Disabled item — not selectable via Enter; aria-disabled is set.
 *   - Empty state — renders when nothing matches; consumer can override.
 *   - a11y smoke — jest-axe on a representative full render.
 *
 * Note on jsdom + <dialog>: jsdom doesn't implement `showModal()`, so
 * Modal.tsx falls back to setting the `open` attribute manually. The role
 * `dialog` still resolves and the cancel event still dispatches via
 * fireEvent. The Esc test below uses `fireEvent` on the dialog's cancel
 * event, mirroring how the browser would deliver it.
 */

import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import {
  CommandPalette,
  CommandPaletteGroup,
  CommandPaletteItem,
} from './CommandPalette'

/**
 * Test-library helpers — `getAllByRole('option')` / `getAllByRole('group')`
 * filter by accessible-name resolution that doesn't flow cleanly through our
 * nested label/description divs in jsdom (the role is computed but the
 * accessibility-tree visibility heuristic excludes them from `getByRole`'s
 * default scan). Axe sees the roles fine — it's purely a testing-library
 * resolver quirk, mirrored in src/components/Select/Select.test.tsx which
 * queries `[role="option"]` directly for the same reason.
 *
 * We query the attribute directly so the test asserts the LITERAL ARIA shape
 * — the precise constraint we're enforcing for issue #378.
 */
function queryOptions(root: Element | Document = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'))
}
function queryGroups(root: Element | Document = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="group"]'))
}
function findOptionByText(re: RegExp): HTMLElement {
  const match = queryOptions().find((o) => re.test(o.textContent ?? ''))
  if (!match) throw new Error(`No option matching ${re}`)
  return match
}

/**
 * A representative palette with two groups, icons, descriptions, and
 * shortcuts — the shape consumers will actually use.
 */
function Harness({
  open = true,
  onOpenChange = () => {},
  value,
  onValueChange,
  onSelectHome = vi.fn(),
  onSelectSearch = vi.fn(),
  onSelectSettings = vi.fn(),
  onSelectLogout = vi.fn(),
  logoutDisabled = false,
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  value?: string
  onValueChange?: (v: string) => void
  onSelectHome?: () => void
  onSelectSearch?: () => void
  onSelectSettings?: () => void
  onSelectLogout?: () => void
  logoutDisabled?: boolean
}) {
  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      value={value}
      onValueChange={onValueChange}
    >
      <CommandPaletteGroup heading="Navigation">
        <CommandPaletteItem onSelect={onSelectHome} shortcut="⌘1">
          Home
        </CommandPaletteItem>
        <CommandPaletteItem onSelect={onSelectSearch} shortcut="⌘K">
          Search
        </CommandPaletteItem>
      </CommandPaletteGroup>
      <CommandPaletteGroup heading="Account">
        <CommandPaletteItem
          onSelect={onSelectSettings}
          description="Application preferences"
        >
          Settings
        </CommandPaletteItem>
        <CommandPaletteItem
          onSelect={onSelectLogout}
          disabled={logoutDisabled}
        >
          Log out
        </CommandPaletteItem>
      </CommandPaletteGroup>
    </CommandPalette>
  )
}

// ---------------------------------------------------------------------------
// Controlled open/close
// ---------------------------------------------------------------------------

describe('CommandPalette — controlled open/close', () => {
  it('renders nothing visible when open={false}', () => {
    render(<Harness open={false} />)
    // The native <dialog> is always in the React tree (Modal renders it
    // unconditionally to support enter/exit animations). What changes is
    // whether the `open` attribute is set. We assert via that.
    const dialog = document.querySelector('dialog')
    expect(dialog).not.toBeNull()
    expect(dialog!.hasAttribute('open')).toBe(false)
  })

  it('renders the palette when open={true}', () => {
    render(<Harness open />)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    // Sanity-check options via a direct attribute query so this test doesn't
    // depend on the accessible-name resolver (see commentary below).
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(4)
  })

  it('invokes onOpenChange(false) when the dialog cancels (Esc)', () => {
    const onOpenChange = vi.fn()
    render(<Harness open onOpenChange={onOpenChange} />)
    const dialog = document.querySelector('dialog') as HTMLDialogElement
    // Native Esc → cancel → close. Fire cancel first (preventDefault check),
    // then close (which is what fires onClose).
    act(() => {
      dialog.dispatchEvent(new Event('cancel'))
      dialog.dispatchEvent(new Event('close'))
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

// ---------------------------------------------------------------------------
// Listbox semantics — the core bug fix.
// ---------------------------------------------------------------------------

describe('CommandPalette — autofocus on open (browser-verify finding)', () => {
  /**
   * Browser-verified regression (Sprint 50): without an explicit setTimeout(0)
   * focus-aim on open, Modal's own initial-focus override (Modal.tsx:207, sets
   * focus to the dialog body — tabindex=-1) was winning, leaving the user
   * unable to type or use ArrowDown/Enter without first clicking the input.
   * The whole UX contract of a ⌘K palette is "open → type" — this test pins
   * that the search input owns focus the moment the palette opens.
   */
  it('focuses the search input when open flips to true', async () => {
    render(<Harness open />)
    const input = screen.getByRole('combobox')
    // The fix schedules focus on a setTimeout(0) AND races Modal's own rAF
    // initial-focus override. A flat `setTimeout(0)` flush races the
    // component's own setTimeout(0) under CI's slower scheduler — fixed
    // locally, flakes in CI. `waitFor` retries the assertion until it holds
    // (or times out), which is the correct primitive for "wait until this
    // async expectation is true." Local: <50ms; CI: pads to whatever's needed.
    await waitFor(() => expect(document.activeElement).toBe(input))
  })
})

describe('CommandPalette — listbox semantics (the #378 fix)', () => {
  it('renders exactly one role="listbox"', () => {
    render(<Harness />)
    const listboxes = screen.getAllByRole('listbox')
    expect(listboxes).toHaveLength(1)
  })

  it('renders items with role="option"', () => {
    render(<Harness />)
    const options = queryOptions()
    expect(options).toHaveLength(4)
    // Every option has a stable id (for aria-activedescendant).
    for (const opt of options) {
      expect(opt.id).toBeTruthy()
    }
  })

  it('every role="option" is a DESCENDANT of the role="listbox"', () => {
    // This is the precise ARIA constraint that the lab's hand-rolled palette
    // violated. We assert it directly — every option must be inside the one
    // listbox.
    render(<Harness />)
    const listbox = screen.getByRole('listbox')
    const options = queryOptions()
    expect(options.length).toBeGreaterThan(0)
    for (const opt of options) {
      expect(listbox.contains(opt)).toBe(true)
    }
  })

  it('does NOT nest a second listbox inside groups', () => {
    // Groups use role="group", not role="listbox" — otherwise screen readers
    // would announce four separate lists.
    render(<Harness />)
    expect(screen.getAllByRole('listbox')).toHaveLength(1)
    expect(queryGroups()).toHaveLength(2)
  })

  it('input has role="combobox" with aria-controls pointing at the listbox', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    const listbox = screen.getByRole('listbox')
    expect(input.getAttribute('aria-controls')).toBe(listbox.id)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
  })

  it('group heading is linked to its group via aria-labelledby', () => {
    render(<Harness />)
    const groups = queryGroups()
    expect(groups).toHaveLength(2)
    for (const group of groups) {
      const labelledBy = group.getAttribute('aria-labelledby')
      expect(labelledBy).toBeTruthy()
      const headingEl = document.getElementById(labelledBy!)
      expect(headingEl).not.toBeNull()
      expect(headingEl!.textContent).toMatch(/Navigation|Account/)
    }
  })
})

// ---------------------------------------------------------------------------
// Keyboard navigation — aria-activedescendant tracking.
// ---------------------------------------------------------------------------

describe('CommandPalette — keyboard navigation', () => {
  it('initial aria-activedescendant points at the first visible option', async () => {
    // Effect-driven; allow the post-render microtask to run.
    render(<Harness />)
    // Run pending effects.
    await act(async () => { await Promise.resolve() })
    const input = screen.getByRole('combobox')
    const firstOption = queryOptions()[0]
    expect(input.getAttribute('aria-activedescendant')).toBe(firstOption?.id)
  })

  it('ArrowDown moves aria-activedescendant to the next option', async () => {
    render(<Harness />)
    await act(async () => { await Promise.resolve() })
    const input = screen.getByRole('combobox') as HTMLInputElement
    const options = queryOptions()
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]?.id)
  })

  it('ArrowUp from first option wraps to the last', async () => {
    render(<Harness />)
    await act(async () => { await Promise.resolve() })
    const input = screen.getByRole('combobox') as HTMLInputElement
    const options = queryOptions()
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.getAttribute('aria-activedescendant')).toBe(
      options[options.length - 1]?.id
    )
  })

  it('ArrowDown from last option wraps to the first', async () => {
    render(<Harness />)
    await act(async () => { await Promise.resolve() })
    const input = screen.getByRole('combobox') as HTMLInputElement
    const options = queryOptions()
    input.focus()
    // Jump to last via End, then ArrowDown wraps to first.
    fireEvent.keyDown(input, { key: 'End' })
    expect(input.getAttribute('aria-activedescendant')).toBe(
      options[options.length - 1]?.id
    )
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id)
  })

  it('Home jumps to first, End jumps to last', async () => {
    render(<Harness />)
    await act(async () => { await Promise.resolve() })
    const input = screen.getByRole('combobox') as HTMLInputElement
    const options = queryOptions()
    input.focus()
    // fireEvent.keyDown rather than user.keyboard for Home/End — user-event
    // routes Home/End through the native text-input behaviour first (cursor
    // to start/end), and in jsdom the resulting React-synthetic event isn't
    // delivered reliably (the native handler consumes it before bubble).
    // fireEvent.keyDown synthesizes a React synthetic event directly on the
    // element, bypassing the native intermediary. This matches the
    // upstream React-Testing-Library guidance for Home/End on text inputs.
    fireEvent.keyDown(input, { key: 'End' })
    expect(input.getAttribute('aria-activedescendant')).toBe(
      options[options.length - 1]?.id
    )
    fireEvent.keyDown(input, { key: 'Home' })
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id)
  })

  it('Enter invokes the active item onSelect', async () => {
    const onSelectHome = vi.fn()
    const onSelectSearch = vi.fn()
    render(<Harness onSelectHome={onSelectHome} onSelectSearch={onSelectSearch} />)
    await act(async () => { await Promise.resolve() })
    const input = screen.getByRole('combobox') as HTMLInputElement
    input.focus()
    // fireEvent.keyDown for the same reason as the filter tests above
    // (deterministic under full-suite load).
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectHome).toHaveBeenCalledTimes(1)
    expect(onSelectSearch).not.toHaveBeenCalled()
    // Arrow down to "Search" and Enter.
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectSearch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

describe('CommandPalette — filter', () => {
  it('empty filter shows all items', () => {
    render(<Harness />)
    expect(queryOptions()).toHaveLength(4)
  })

  // For filter-input changes we use fireEvent.change rather than
  // user.type — user-event v14 dispatches through React's batched event
  // system, and under load (full-suite runs with many prior renders) the
  // serial keystroke batching can drop intermediate inputs in jsdom. A
  // single fireEvent.change is deterministic and exercises the same code
  // path (input → handleValueChange → setInternalValue).

  it('typing narrows the visible options by label substring (case-insensitive)', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'set' } })
    const options = queryOptions()
    expect(options).toHaveLength(1)
    expect(options[0]?.textContent).toMatch(/Settings/)
  })

  it('renders default empty state when nothing matches', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzz-no-such-command' } })
    expect(queryOptions()).toHaveLength(0)
    expect(screen.getByText(/no results/i)).toBeInTheDocument()
  })

  it('honors a custom emptyState node', () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        emptyState={<div>Custom empty</div>}
      >
        <CommandPaletteItem onSelect={() => {}}>Home</CommandPaletteItem>
      </CommandPalette>
    )
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'xxx' } })
    expect(screen.getByText('Custom empty')).toBeInTheDocument()
  })

  it('emptyState={null} suppresses the empty UI entirely', () => {
    render(
      <CommandPalette open onOpenChange={() => {}} emptyState={null}>
        <CommandPaletteItem onSelect={() => {}}>Home</CommandPaletteItem>
      </CommandPalette>
    )
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'xxx' } })
    expect(screen.queryByText(/no results/i)).not.toBeInTheDocument()
  })

  it('matches against searchValue prop when provided (synonyms)', () => {
    render(
      <CommandPalette open onOpenChange={() => {}}>
        <CommandPaletteItem onSelect={() => {}} searchValue="exit quit signout">
          Log out
        </CommandPaletteItem>
        <CommandPaletteItem onSelect={() => {}}>Settings</CommandPaletteItem>
      </CommandPalette>
    )
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'quit' } })
    const options = queryOptions()
    expect(options).toHaveLength(1)
    expect(options[0]?.textContent).toMatch(/Log out/)
  })

  it('exposes controlled value via onValueChange', () => {
    const onValueChange = vi.fn()
    render(
      <CommandPalette open onOpenChange={() => {}} value="" onValueChange={onValueChange}>
        <CommandPaletteItem onSelect={() => {}}>Home</CommandPaletteItem>
      </CommandPalette>
    )
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'h' } })
    expect(onValueChange).toHaveBeenCalledWith('h')
  })
})

// ---------------------------------------------------------------------------
// Disabled
// ---------------------------------------------------------------------------

describe('CommandPalette — disabled items', () => {
  it('aria-disabled is set on the disabled item', () => {
    render(<Harness logoutDisabled />)
    const logout = findOptionByText(/Log out/)
    expect(logout.getAttribute('aria-disabled')).toBe('true')
  })

  it('Enter does not invoke onSelect on a disabled item', async () => {
    const onSelectLogout = vi.fn()
    render(<Harness onSelectLogout={onSelectLogout} logoutDisabled />)
    await act(async () => { await Promise.resolve() })
    const input = screen.getByRole('combobox') as HTMLInputElement
    input.focus()
    // Disabled items are excluded from the keyboard-nav list
    // (getVisibleOptionIds filters them out), so End lands on the last
    // ENABLED item — Settings — not on Log out.
    fireEvent.keyDown(input, { key: 'End' })
    const settings = findOptionByText(/Settings/)
    expect(input.getAttribute('aria-activedescendant')).toBe(settings.id)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectLogout).not.toHaveBeenCalled()
  })

  it('click on a disabled item is a no-op', () => {
    const onSelectLogout = vi.fn()
    render(<Harness onSelectLogout={onSelectLogout} logoutDisabled />)
    const logout = findOptionByText(/Log out/)
    fireEvent.click(logout)
    expect(onSelectLogout).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Mouse interaction
// ---------------------------------------------------------------------------

describe('CommandPalette — mouse interaction', () => {
  it('clicking an item invokes its onSelect', () => {
    const onSelectHome = vi.fn()
    render(<Harness onSelectHome={onSelectHome} />)
    fireEvent.click(findOptionByText(/Home/))
    expect(onSelectHome).toHaveBeenCalledTimes(1)
  })

  it('mousemove over an item updates aria-activedescendant', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    const search = findOptionByText(/Search/)
    fireEvent.mouseMove(search)
    expect(input.getAttribute('aria-activedescendant')).toBe(search.id)
  })
})

// ---------------------------------------------------------------------------
// Render order — items inside groups belong to the OUTER listbox in DOM order
// ---------------------------------------------------------------------------

describe('CommandPalette — option ordering across groups', () => {
  it('options inside groups appear in source order in the listbox', () => {
    render(<Harness />)
    const listbox = screen.getByRole('listbox')
    const options = queryOptions(listbox)
    const texts = options.map((o) => o.textContent?.trim() ?? '')
    expect(texts[0]).toMatch(/Home/)
    expect(texts[1]).toMatch(/Search/)
    expect(texts[2]).toMatch(/Settings/)
    expect(texts[3]).toMatch(/Log out/)
  })
})

// ---------------------------------------------------------------------------
// a11y smoke (jest-axe)
// ---------------------------------------------------------------------------

describe('CommandPalette — a11y smoke (jest-axe)', () => {
  it('open palette has no violations', async () => {
    const { container } = render(<Harness />)
    // Let registry effects settle.
    await Promise.resolve()
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('filtered-down palette (showing only some options) has no violations', async () => {
    const { container } = render(<Harness />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'set' } })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

/* ------------------------------------------------------------------ *
 *  #422 — className / style / ...rest pass-through
 *
 *  Each of the three exports gets its overrides on its own styled root:
 *    - CommandPalette       → the `.root` container inside the Modal
 *    - CommandPaletteGroup  → the `role="group"` wrapper
 *    - CommandPaletteItem   → the `role="option"` element
 * ------------------------------------------------------------------ */
describe('CommandPalette — root pass-through (#422)', () => {
  it('forwards data-testid and a winning style onto the palette .root', () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        data-testid="palette-root"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <CommandPaletteItem onSelect={() => {}}>Home</CommandPaletteItem>
      </CommandPalette>
    )
    const root = screen.getByTestId('palette-root')
    expect(root.style.color).toBe('rgb(1, 2, 3)')
    // The search combobox is a descendant of the palette root.
    expect(root.querySelector('[role="combobox"]')).not.toBeNull()
  })

  it('merges a consumer className onto the palette .root', () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        data-testid="palette-root"
        className="consumer-palette"
      >
        <CommandPaletteItem onSelect={() => {}}>Home</CommandPaletteItem>
      </CommandPalette>
    )
    const root = screen.getByTestId('palette-root')
    expect(root.className).toContain('consumer-palette')
    expect(root.className.split(' ').length).toBeGreaterThan(1)
  })

  it('forwards data-testid + style onto the group wrapper', () => {
    render(
      <CommandPalette open onOpenChange={() => {}}>
        <CommandPaletteGroup
          heading="Nav"
          data-testid="group-root"
          style={{ color: 'rgb(1, 2, 3)' }}
        >
          <CommandPaletteItem onSelect={() => {}}>Home</CommandPaletteItem>
        </CommandPaletteGroup>
      </CommandPalette>
    )
    const group = screen.getByTestId('group-root')
    expect(group).toHaveAttribute('role', 'group')
    expect(group.style.color).toBe('rgb(1, 2, 3)')
  })

  it('forwards data-testid + style onto the option, retaining item classes', () => {
    render(
      <CommandPalette open onOpenChange={() => {}}>
        <CommandPaletteItem
          onSelect={() => {}}
          data-testid="option-root"
          className="consumer-item"
          style={{ color: 'rgb(1, 2, 3)' }}
        >
          Home
        </CommandPaletteItem>
      </CommandPalette>
    )
    const option = screen.getByTestId('option-root')
    expect(option).toHaveAttribute('role', 'option')
    expect(option.style.color).toBe('rgb(1, 2, 3)')
    expect(option.className).toContain('consumer-item')
    // The component's own item class survives the merge.
    expect(option.className.split(' ').length).toBeGreaterThan(1)
  })
})
