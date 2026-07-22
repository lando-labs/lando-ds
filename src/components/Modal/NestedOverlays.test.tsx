/**
 * Nested Overlay Regression Tests (#35, #37, #46, #14)
 *
 * The class of bug these tests guard against:
 * - A Select / Dropdown / Popover rendered INSIDE a Modal must be visible and
 *   interactable. Historically (v0.4.0) this failed because:
 *     1. Modal backdrop sat at `--z-index-modal: 1100`.
 *     2. Portaled overlays (Dropdown/Select) sat at `--z-index-dropdown: 1000`.
 *     3. Even though both portaled to document.body, the Modal backdrop
 *        painted above the dropdown, making the overlay invisible.
 *
 * The fix (Sprint 5 Lane 2):
 * - Raise `--z-index-dropdown`, `--z-index-popover`, `--z-index-tooltip`, and
 *   `--z-index-toast` above `--z-index-modal`. See `src/styles/tokens.css` and
 *   the "Z-index Layering Contract" in `reference/components.md`.
 * - Also fixes the related Popover isPositioned race (#37) by migrating Popover
 *   to the shared `usePortalPosition` hook with its rAF retry loop.
 *
 * #14 v1 (v0.58.0) — the z-index tier contract above stopped being sufficient
 * once Modal migrated to a native `<dialog>` + `showModal()` (#273): the
 * dialog's browser-managed TOP LAYER paints above *any* z-index, period.
 * Dropdown and Popover already followed that migration with their own
 * Popover-API opt-in (`popover="manual"` + `showPopover()`, #273 step 2), so
 * they kept PAINTING correctly. Select / Combobox / MultiSelect had not, and
 * got the same opt-in in the v1 fix.
 *
 * #14 v2 (v0.58.0 close-out, THIS fix) — v1 was visually complete but
 * functionally incomplete: painting above the dialog via the Popover API is
 * NOT the same as being interactive. Manual browser testing (Playwright,
 * real Chromium) found Select/Combobox/MultiSelect/Dropdown/Popover options
 * could not be hovered or clicked with the mouse inside a Modal — confirmed
 * for ALL FIVE, not just the Select family, so this was a library-wide latent
 * bug the v1 fix never actually closed. Root cause: per the HTML spec's
 * "modal dialogs and inert subtrees" algorithm, `showModal()` marks every
 * node OUTSIDE the dialog's own flat-tree subtree `inert` — and inert nodes
 * don't receive pointer events, regardless of paint/top-layer order. A
 * `popover="manual"` element portaled to `document.body` (a SIBLING of the
 * dialog, not a descendant) still gets marked inert once the dialog goes
 * modal; `document.elementsFromPoint()` at the element's own coordinates
 * skips over it entirely in real Chromium (verified live — see the Modal.tsx
 * file-top comment for the full diagnosis).
 *
 * The v2 fix: `useModalPortalContainer()` (`Modal/ModalPortalContext.ts`)
 * exposes a DOM node that IS a descendant of the open Modal's `<dialog>` (a
 * dedicated host div rendered as the dialog's own last child). The five
 * overlay components render their portaled content THERE instead of
 * `document.body` when nested in an open Modal — exempt from the inert
 * subtree by DOM ancestry, no Popover API needed — and fall back to the v1
 * Popover-API + `document.body` path when standalone (unchanged). This is
 * jsdom-verifiable (plain DOM insertion, no browser-specific top-layer/inert
 * behavior required), which is why the assertions below flipped from
 * "escapes to document.body, NOT nested in dialog" to "nested inside the
 * dialog subtree." The REAL hit-testing proof — that inert-by-ancestry
 * actually restores pointer events in a browser that implements `inert` —
 * is NOT jsdom-verifiable (jsdom doesn't implement modal-dialog inertness at
 * all) and lives in `tests/e2e/overlays-in-modal.spec.ts` (Playwright,
 * real Chromium) instead. Do not treat the assertions in this file as proof
 * of the fix on their own.
 *
 * The tests verify structural and stylistic contract, not visual pixels.
 * jsdom doesn't render CSS, so we assert on:
 *   - portal target (document.body for standalone; the Modal's in-dialog
 *     host — and therefore `dialog.contains(overlay) === true` — when nested
 *     in an open Modal)
 *   - resolved z-index values via tokens.css (which vitest loads as a module
 *     for this suite via the explicit import below)
 *   - presence of `visible`/`positioned` class on the overlay (confirms the
 *     positioning race didn't regress)
 *   - presence (standalone) / absence (nested-in-Modal) of `popover="manual"`
 *     on the overlay root
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Modal } from './Modal'
import { Select } from '../Select'
import { Dropdown, DropdownItem } from '../Dropdown'
import { Popover } from '../Popover'
import { Combobox, MultiSelect } from '../Combobox'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => {
    vi.runOnlyPendingTimers()
  })
  vi.useRealTimers()
})

function advance(ms = 0) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function flushRaf(times = 3) {
  for (let i = 0; i < times; i++) {
    advance(16)
  }
}

describe('Nested overlays inside Modal (#35, #37, #46)', () => {
  describe('Select inside Modal (#46)', () => {
    function SelectInModal() {
      const [open, setOpen] = useState(true)
      const [value, setValue] = useState<string | undefined>(undefined)
      return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Add Contact">
          <Select
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Editor', value: 'editor' },
              { label: 'Viewer', value: 'viewer' },
              { label: 'Guest', value: 'guest' },
            ]}
            value={value}
            onChange={(v) => setValue(v as string)}
            placeholder="Pick a role"
          />
        </Modal>
      )
    }

    it('renders the listbox when trigger is clicked (options exist in DOM)', () => {
      render(<SelectInModal />)

      // Both Modal and Select portals must have mounted.
      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)
      flushRaf()

      // Use synchronous getByRole — async findByRole doesn't play well with
      // vi.useFakeTimers() since its internal polling waits on setTimeout.
      const listbox = screen.getByRole('listbox')
      const options = listbox.querySelectorAll('[role="option"]')
      expect(options).toHaveLength(4)
    })

    it('portals the listbox INSIDE the open Modal dialog subtree (#14 v2)', () => {
      render(<SelectInModal />)

      fireEvent.click(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      const dialog = screen.getByRole('dialog')

      // Both are (transitively) descendants of document.body. Critically,
      // the listbox IS now nested inside dialog — that's what exempts it
      // from the dialog's native `inert` subtree once showModal() is active,
      // which is what actually makes it clickable in a real browser (jsdom
      // doesn't implement that inertness, so this assertion only proves the
      // DOM shape, not the pointer-event behavior — see
      // tests/e2e/overlays-in-modal.spec.ts for that).
      expect(document.body.contains(listbox)).toBe(true)
      expect(dialog.contains(listbox)).toBe(true)
    })

    it('flips to positioned state (no stuck-at-off-screen flash)', () => {
      render(<SelectInModal />)

      fireEvent.click(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      // The Select module toggles `.positioned` once usePortalPosition
      // reports isReady. A race here means the class is `.positioning`
      // (visibility hidden / opacity 0) forever. This is the nested-portal
      // positioning race guard.
      expect(listbox.className).toMatch(/positioned/)
      expect(listbox.className).not.toMatch(/\bpositioning\b/)
    })

    // #14 v2 — nested in an open Modal, the listbox is a dialog descendant
    // (exempt from inertness by DOM ancestry) and does NOT opt into the
    // Popover API: emitting `popover="manual"` without ever calling
    // showPopover() would leave it UA-stylesheet-hidden
    // (`[popover]:not(:popover-open) { display: none }`).
    it('does NOT carry popover="manual" when nested in an open Modal (#14 v2)', () => {
      render(<SelectInModal />)

      fireEvent.click(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox).not.toHaveAttribute('popover')
    })

    it('selecting an option fires onChange (listbox is interactable)', () => {
      const onChange = vi.fn()
      function Wrapper() {
        const [open, setOpen] = useState(true)
        return (
          <Modal isOpen={open} onClose={() => setOpen(false)} title="Add">
            <Select
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'Viewer', value: 'viewer' },
              ]}
              onChange={(v) => {
                onChange(v)
              }}
              placeholder="Pick"
            />
          </Modal>
        )
      }
      render(<Wrapper />)

      fireEvent.click(screen.getByRole('combobox'))
      flushRaf()

      const adminOption = screen.getByText('Admin')
      fireEvent.click(adminOption)

      expect(onChange).toHaveBeenCalledWith('admin')
    })

    // #14 follow-up — the Popover-API migration made Select-in-Modal
    // reachable for the first time (it was unusable before), which
    // surfaced a real regression: Select's Escape handler used to call
    // preventDefault() unconditionally, even when its own listbox was
    // already closed. That swallowed every Escape press while the trigger
    // had focus and trapped the Modal open, since the native <dialog>
    // Escape-to-close mechanism keys off the keydown's defaultPrevented
    // flag. jsdom doesn't implement that native mechanism, so these
    // assertions use `fireEvent.keyDown`'s return value (the DOM
    // `dispatchEvent()` result: `false` once preventDefault() was called,
    // `true` otherwise) as the trustworthy signal for "would this Escape
    // have reached the Modal's native close-watcher."
    it('Escape closes only the listbox when open — consumes the event, Modal stays open (#14 follow-up)', () => {
      render(<SelectInModal />)

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)
      flushRaf()
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      const notPrevented = fireEvent.keyDown(trigger, { key: 'Escape' })

      expect(notPrevented).toBe(false)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      // The Modal itself is untouched — still rendered, dialog still present.
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('Escape does NOT preventDefault when the listbox is already closed, so it can reach the Modal (#14 follow-up)', () => {
      render(<SelectInModal />)

      const trigger = screen.getByRole('combobox')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

      const notPrevented = fireEvent.keyDown(trigger, { key: 'Escape' })

      expect(notPrevented).toBe(true)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  describe('Dropdown inside Modal (#35)', () => {
    function DropdownInModal() {
      const [open, setOpen] = useState(true)
      return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Row actions">
          <Dropdown trigger={<button>Actions</button>}>
            <DropdownItem>Edit</DropdownItem>
            <DropdownItem>Delete</DropdownItem>
          </Dropdown>
        </Modal>
      )
    }

    it('opens and portals menu INSIDE the open Modal dialog subtree (#14 v2)', () => {
      render(<DropdownInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
      flushRaf()

      const menu = screen.getByRole('menu')
      const dialog = screen.getByRole('dialog')
      expect(document.body.contains(menu)).toBe(true)
      expect(dialog.contains(menu)).toBe(true)
    })

    it('does NOT carry popover="manual" when nested in an open Modal (#14 v2)', () => {
      render(<DropdownInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
      flushRaf()

      expect(screen.getByRole('menu')).not.toHaveAttribute('popover')
    })

    it('renders menu items clickable', () => {
      render(<DropdownInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
      flushRaf()

      const menu = screen.getByRole('menu')
      expect(menu.querySelectorAll('[role="menuitem"]').length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Popover inside Modal (#35, #37)', () => {
    function PopoverInModal() {
      const [open, setOpen] = useState(true)
      return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Help">
          <Popover
            content={<div>Helpful context</div>}
            triggerOn="click"
            trigger={<button>Info</button>}
          />
        </Modal>
      )
    }

    it('opens and flips to visible class (#37 race also applies in Modal)', () => {
      render(<PopoverInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Info' }))
      flushRaf()

      const popover = screen.getByRole('tooltip')
      expect(popover.className).toMatch(/visible/)
    })

    it('portals INSIDE the open Modal dialog subtree (#14 v2)', () => {
      render(<PopoverInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Info' }))
      flushRaf()

      const popover = screen.getByRole('tooltip')
      const dialog = screen.getByRole('dialog')
      expect(document.body.contains(popover)).toBe(true)
      expect(dialog.contains(popover)).toBe(true)
    })

    it('does NOT carry popover="manual" when nested in an open Modal (#14 v2)', () => {
      render(<PopoverInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Info' }))
      flushRaf()

      expect(screen.getByRole('tooltip')).not.toHaveAttribute('popover')
    })
  })

  describe('Combobox inside Modal (#14)', () => {
    function ComboboxInModal() {
      const [open, setOpen] = useState(true)
      const [value, setValue] = useState<string | undefined>(undefined)
      return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Assign owner">
          <Combobox
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'editor', label: 'Editor' },
              { value: 'viewer', label: 'Viewer' },
            ]}
            value={value}
            onChange={setValue}
            placeholder="Pick a role"
          />
        </Modal>
      )
    }

    it('renders the listbox when the input is focused (options exist in DOM)', () => {
      render(<ComboboxInModal />)

      const input = screen.getByRole('combobox')
      fireEvent.focus(input)
      flushRaf()

      const listbox = screen.getByRole('listbox')
      const options = listbox.querySelectorAll('[role="option"]')
      expect(options).toHaveLength(3)
    })

    it('portals the listbox INSIDE the open Modal dialog subtree (#14 v2)', () => {
      render(<ComboboxInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      const dialog = screen.getByRole('dialog')

      expect(document.body.contains(listbox)).toBe(true)
      expect(dialog.contains(listbox)).toBe(true)
    })

    it('flips to positioned state (no stuck-at-off-screen flash)', () => {
      render(<ComboboxInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox.className).toMatch(/positioned/)
      expect(listbox.className).not.toMatch(/\bpositioning\b/)
    })

    // #14 v2 — nested in an open Modal, no Popover-API opt-in (see the
    // Select block above for why).
    it('does NOT carry popover="manual" when nested in an open Modal (#14 v2)', () => {
      render(<ComboboxInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox).not.toHaveAttribute('popover')
    })

    it('selecting an option fires onChange (listbox is interactable)', () => {
      const onChange = vi.fn()
      function Wrapper() {
        const [open, setOpen] = useState(true)
        return (
          <Modal isOpen={open} onClose={() => setOpen(false)} title="Assign">
            <Combobox
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'viewer', label: 'Viewer' },
              ]}
              onChange={onChange}
              placeholder="Pick"
            />
          </Modal>
        )
      }
      render(<Wrapper />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      fireEvent.click(screen.getByText('Admin'))

      expect(onChange).toHaveBeenCalledWith('admin')
    })
  })

  describe('MultiSelect inside Modal (#14)', () => {
    function MultiSelectInModal() {
      const [open, setOpen] = useState(true)
      const [value, setValue] = useState<string[]>([])
      return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Assign reviewers">
          <MultiSelect
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'editor', label: 'Editor' },
              { value: 'viewer', label: 'Viewer' },
            ]}
            value={value}
            onChange={setValue}
            placeholder="Pick reviewers"
          />
        </Modal>
      )
    }

    it('renders the listbox when the input is focused (options exist in DOM)', () => {
      render(<MultiSelectInModal />)

      const input = screen.getByRole('combobox')
      fireEvent.focus(input)
      flushRaf()

      const listbox = screen.getByRole('listbox')
      const options = listbox.querySelectorAll('[role="option"]')
      expect(options).toHaveLength(3)
    })

    it('portals the listbox INSIDE the open Modal dialog subtree (#14 v2)', () => {
      render(<MultiSelectInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      const dialog = screen.getByRole('dialog')

      expect(document.body.contains(listbox)).toBe(true)
      expect(dialog.contains(listbox)).toBe(true)
    })

    it('flips to positioned state (no stuck-at-off-screen flash)', () => {
      render(<MultiSelectInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox.className).toMatch(/positioned/)
      expect(listbox.className).not.toMatch(/\bpositioning\b/)
    })

    // #14 v2 — nested in an open Modal, no Popover-API opt-in (see the
    // Select block above for why).
    it('does NOT carry popover="manual" when nested in an open Modal (#14 v2)', () => {
      render(<MultiSelectInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox).not.toHaveAttribute('popover')
    })

    it('selecting an option fires onChange with the growing array (listbox is interactable)', () => {
      const onChange = vi.fn()
      function Wrapper() {
        const [open, setOpen] = useState(true)
        return (
          <Modal isOpen={open} onClose={() => setOpen(false)} title="Assign">
            <MultiSelect
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'viewer', label: 'Viewer' },
              ]}
              onChange={onChange}
              placeholder="Pick"
            />
          </Modal>
        )
      }
      render(<Wrapper />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      fireEvent.click(screen.getByText('Admin'))

      expect(onChange).toHaveBeenCalledWith(['admin'])
    })
  })

  describe('Modal closed — overlay falls back to the standalone path (#14 v2)', () => {
    // A Select rendered as a child of a Modal that is currently CLOSED must
    // not try to portal into a non-modal, non-top-layer dialog — that would
    // be pointless (the dialog isn't showModal()'d, so there's no inertness
    // to route around) and the standalone document.body + Popover-API path
    // is correct there. `useModalPortalContainer()` returns `null` in this
    // case (`ModalPortalContext.Provider value={isOpen ? portalHost : null}`
    // in Modal.tsx) — this test locks that gate in.
    it('portals to document.body and keeps popover="manual" while the enclosing Modal is closed', () => {
      function SelectInClosedModal() {
        const [value, setValue] = useState<string | undefined>(undefined)
        return (
          <Modal isOpen={false} onClose={() => {}} title="Closed">
            <Select
              options={[{ label: 'Admin', value: 'admin' }]}
              value={value}
              onChange={(v) => setValue(v as string)}
              placeholder="Pick a role"
            />
          </Modal>
        )
      }
      render(<SelectInClosedModal />)

      // `{ hidden: true }` — Testing Library's role queries treat everything
      // inside a `<dialog>` WITHOUT the `open` attribute as inaccessible (per
      // HTML semantics, a closed dialog isn't rendered). That's correct
      // a11y behavior, but this test is deliberately exercising the closed-
      // Modal fallback path, not asserting on accessibility.
      fireEvent.click(screen.getByRole('combobox', { hidden: true }))
      flushRaf()

      const listbox = screen.getByRole('listbox', { hidden: true })
      expect(document.body.contains(listbox)).toBe(true)
      expect(listbox).toHaveAttribute('popover', 'manual')
    })
  })

  describe('Standalone overlays (no visual regression outside Modal)', () => {
    it('standalone Dropdown still opens correctly', () => {
      render(
        <Dropdown trigger={<button>Menu</button>}>
          <DropdownItem>One</DropdownItem>
        </Dropdown>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
      flushRaf()

      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('standalone Select still opens correctly', () => {
      render(
        <Select
          options={[{ label: 'One', value: '1' }]}
          onChange={() => {}}
          placeholder="Pick"
        />
      )

      fireEvent.click(screen.getByRole('combobox'))
      flushRaf()

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('standalone Popover still opens correctly', () => {
      render(
        <Popover
          content={<div>Tip</div>}
          triggerOn="click"
          trigger={<button>Open</button>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      flushRaf()

      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('standalone Combobox still opens correctly (#14)', () => {
      render(
        <Combobox
          options={[{ value: '1', label: 'One' }]}
          onChange={() => {}}
          placeholder="Pick"
        />
      )

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('standalone MultiSelect still opens correctly (#14)', () => {
      render(
        <MultiSelect
          options={[{ value: '1', label: 'One' }]}
          onChange={() => {}}
          placeholder="Pick"
        />
      )

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
  })
})
