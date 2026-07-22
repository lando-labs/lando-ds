'use client'

/**
 * E2E fixture — Select/Combobox/MultiSelect/Dropdown/Popover inside a Modal
 * (#14 v2, tests/e2e/overlays-in-modal.spec.ts).
 *
 * This is committed, permanent test infrastructure — NOT a demo/showcase
 * page (the library intentionally ships no in-repo showcase; see the root
 * CLAUDE.md). Playwright drives this page against the built package (this
 * example app consumes `@lando-labs/lando-ds` via a `file:` symlink) to prove
 * real-browser hit-testing / pointer-event behavior that jsdom cannot: a
 * `<dialog>` opened via `showModal()` marks everything outside its own
 * subtree `inert`, which blocks pointer events regardless of paint order —
 * a class of bug jsdom doesn't model at all. See the long comment at the top
 * of `src/components/Modal/Modal.tsx` for the full diagnosis.
 *
 * Keep this fixture's DOM stable (ids, labels, option text) — the spec
 * queries it by role/text, and unrelated page-content changes will break the
 * e2e suite for no reason.
 */

import { useState } from 'react'
import {
  Button,
  Modal,
  Select,
  Combobox,
  MultiSelect,
  Dropdown,
  DropdownItem,
  Popover,
  Stack,
} from '@lando-labs/lando-ds'

const fruits = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

export default function OverlaysInModalFixture() {
  const [open, setOpen] = useState(false)
  const [selectValue, setSelectValue] = useState<string | undefined>(undefined)
  const [comboboxValue, setComboboxValue] = useState<string | undefined>(undefined)
  const [multiSelectValue, setMultiSelectValue] = useState<string[]>([])
  const [lastAction, setLastAction] = useState('')

  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <Stack gap="lg">
        {/* Standalone controls (outside the Modal) — regression guard that
            the fix doesn't touch the non-nested path. Also exercised by the
            click-trigger toggle coverage (#14 v3, tests/e2e/overlays-in-modal.spec.ts) —
            keep these two alongside the Modal-nested ones below. */}
        <Dropdown trigger={<Button variant="outline">Standalone Dropdown</Button>}>
          <DropdownItem onClick={() => setLastAction('standalone-dropdown-item')}>
            Standalone Item
          </DropdownItem>
        </Dropdown>

        <Popover
          triggerOn="click"
          placement="bottom"
          content={
            <button onClick={() => setLastAction('standalone-popover-item')}>
              Standalone popover action
            </button>
          }
          trigger={<Button variant="outline">Standalone Popover</Button>}
        />

        <Button variant="primary" onClick={() => setOpen(true)}>
          Open Modal
        </Button>

        <div data-testid="last-action">{lastAction}</div>

        <Modal isOpen={open} onClose={() => setOpen(false)} title="Overlays in Modal">
          <Stack gap="md">
            <Select
              options={fruits}
              value={selectValue}
              onChange={(v) => setSelectValue(v as string | undefined)}
              placeholder="Select a fruit"
            />
            <Combobox
              options={fruits}
              value={comboboxValue}
              onChange={setComboboxValue}
              placeholder="Combobox — type to filter"
              label="Combobox"
            />
            <MultiSelect
              options={fruits}
              value={multiSelectValue}
              onChange={setMultiSelectValue}
              placeholder="MultiSelect — pick several"
              label="MultiSelect"
            />
            <Dropdown trigger={<Button variant="outline">Actions</Button>}>
              <DropdownItem onClick={() => setLastAction('modal-dropdown-item')}>
                Edit
              </DropdownItem>
            </Dropdown>
            <Popover
              triggerOn="click"
              content={
                <button onClick={() => setLastAction('modal-popover-button')}>
                  Popover action
                </button>
              }
              trigger={<Button variant="outline">Info</Button>}
            />
          </Stack>
        </Modal>
      </Stack>
    </main>
  )
}
