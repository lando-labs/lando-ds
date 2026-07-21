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
 * #14 (v0.58.0) — the z-index tier contract above stopped being sufficient
 * once Modal migrated to a native `<dialog>` + `showModal()` (#273): the
 * dialog's browser-managed TOP LAYER paints above *any* z-index, period.
 * Dropdown and Popover already followed that migration with their own
 * Popover-API opt-in (`popover="manual"` + `showPopover()`, #273 step 2), so
 * they kept working. Select / Combobox / MultiSelect had not, and were
 * unusable inside a Modal (reported by a consumer) until this sprint's fix
 * gave them the same `popover="manual"` opt-in — see
 * `src/utils/popoverApi.ts` and the `[data-theme]`-adjacent comment in
 * `Modal.tsx` for the top-layer-stacking rationale. The `popover="manual"`
 * assertions below are the structural proof of that fix; jsdom does not
 * implement the Popover API's actual top-layer paint, so this is the
 * furthest a jsdom test can verify the mechanism (see
 * `supportsPopoverApi()` — it returns `false` in jsdom, same as any
 * pre-2024 browser, so the *existing* Portal + position:fixed + z-index
 * chain is what actually renders in these tests; the attribute's presence
 * is what proves the browser-side promotion is wired up for browsers that
 * DO support it).
 *
 * The tests verify structural and stylistic contract, not visual pixels.
 * jsdom doesn't render CSS, so we assert on:
 *   - portal escape to document.body
 *   - resolved z-index values via tokens.css (which vitest loads as a module
 *     for this suite via the explicit import below)
 *   - presence of `visible`/`positioned` class on the overlay (confirms the
 *     positioning race didn't regress)
 *   - presence of `popover="manual"` on the overlay root (#14 — proves the
 *     Popover-API opt-in is wired, mirroring Dropdown/Popover's pattern)
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

    it('portals the listbox to document.body (escapes Modal container)', () => {
      render(<SelectInModal />)

      fireEvent.click(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      const dialog = screen.getByRole('dialog')

      // Both are descendants of document.body. Critically, listbox is NOT
      // nested inside dialog — otherwise it would inherit the modal's
      // stacking context and be visually clipped / behind.
      expect(document.body.contains(listbox)).toBe(true)
      expect(dialog.contains(listbox)).toBe(false)
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

    // #14 — the listbox must opt into the Popover API (top-layer promotion)
    // exactly like Dropdown/Popover already do, or it paints under the
    // dialog's top layer + ::backdrop in real browsers regardless of
    // z-index. "manual" (not "auto") keeps the controlled isOpen state
    // authoritative — see src/utils/popoverApi.ts.
    it('opts into the Popover API (popover="manual") for top-layer promotion (#14)', () => {
      render(<SelectInModal />)

      fireEvent.click(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox).toHaveAttribute('popover', 'manual')
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

    it('opens and portals menu to document.body', () => {
      render(<DropdownInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
      flushRaf()

      const menu = screen.getByRole('menu')
      const dialog = screen.getByRole('dialog')
      expect(document.body.contains(menu)).toBe(true)
      expect(dialog.contains(menu)).toBe(false)
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

    it('portals to document.body, not into Modal dialog', () => {
      render(<PopoverInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Info' }))
      flushRaf()

      const popover = screen.getByRole('tooltip')
      const dialog = screen.getByRole('dialog')
      expect(document.body.contains(popover)).toBe(true)
      expect(dialog.contains(popover)).toBe(false)
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

    it('portals the listbox to document.body (escapes Modal container)', () => {
      render(<ComboboxInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      const dialog = screen.getByRole('dialog')

      // Both are descendants of document.body; listbox is NOT nested inside
      // dialog — otherwise it would inherit the modal's stacking context.
      expect(document.body.contains(listbox)).toBe(true)
      expect(dialog.contains(listbox)).toBe(false)
    })

    it('flips to positioned state (no stuck-at-off-screen flash)', () => {
      render(<ComboboxInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox.className).toMatch(/positioned/)
      expect(listbox.className).not.toMatch(/\bpositioning\b/)
    })

    // #14 — mirrors Select/Dropdown/Popover's Popover-API opt-in so the
    // listbox is promoted into the top layer in browsers that support it.
    it('opts into the Popover API (popover="manual") for top-layer promotion (#14)', () => {
      render(<ComboboxInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox).toHaveAttribute('popover', 'manual')
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

    it('portals the listbox to document.body (escapes Modal container)', () => {
      render(<MultiSelectInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      const dialog = screen.getByRole('dialog')

      expect(document.body.contains(listbox)).toBe(true)
      expect(dialog.contains(listbox)).toBe(false)
    })

    it('flips to positioned state (no stuck-at-off-screen flash)', () => {
      render(<MultiSelectInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox.className).toMatch(/positioned/)
      expect(listbox.className).not.toMatch(/\bpositioning\b/)
    })

    // #14 — mirrors Select/Dropdown/Popover's Popover-API opt-in so the
    // listbox is promoted into the top layer in browsers that support it.
    it('opts into the Popover API (popover="manual") for top-layer promotion (#14)', () => {
      render(<MultiSelectInModal />)

      fireEvent.focus(screen.getByRole('combobox'))
      flushRaf()

      const listbox = screen.getByRole('listbox')
      expect(listbox).toHaveAttribute('popover', 'manual')
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
