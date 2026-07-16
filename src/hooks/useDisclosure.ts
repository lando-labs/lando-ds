'use client'

/**
 * Disclosure Hook
 *
 * The canonical open/close/toggle primitive behind every disclosure surface in
 * the library — Modal, Drawer, Dropdown, Popover, Accordion, Collapsible. Owns a
 * single boolean and hands back the four operations that act on it, so a
 * consumer never has to hand-roll `const [isOpen, setIsOpen] = useState(false)`
 * plus three inline arrow functions.
 *
 * Every handler is referentially STABLE — `open`, `close`, `toggle` and `set`
 * keep the same identity for the lifetime of the component, as does the object
 * holding them. They can be passed straight to a memoized child or an effect's
 * dependency array without re-triggering it. `toggle` flips the value with a
 * functional updater rather than closing over the current one, which is what
 * makes that stability possible.
 *
 * @category state
 *
 * @example Modal
 * const [isOpen, { open, close }] = useDisclosure()
 * <Button onClick={open}>Edit</Button>
 * <Modal isOpen={isOpen} onClose={close}>...</Modal>
 *
 * @example Seeded open, set explicitly
 * const [expanded, { toggle, set }] = useDisclosure(true)
 * <Button onClick={toggle}>Toggle</Button>
 * <Button onClick={() => set(false)}>Collapse</Button>
 */

import { useCallback, useMemo, useState } from 'react'

/**
 * The stable operations returned as the second tuple member.
 *
 * Named rather than inlined so the emitted `dist/hooks/useDisclosure.d.ts`
 * declaration — and therefore the `meta.hooks` signature an AI agent grounds
 * itself on — stays a clean single line. (The meta extractor reads the emitted
 * declaration up to the first `;`, and an inline object type is full of them.)
 */
export interface UseDisclosureHandlers {
  /** Set the value to `true`. */
  open: () => void
  /** Set the value to `false`. */
  close: () => void
  /** Flip the value. Uses a functional updater, so it never reads stale state. */
  toggle: () => void
  /** Set the value explicitly — useful for driving from an external signal. */
  set: (value: boolean) => void
}

export function useDisclosure(
  initial: boolean = false
): [boolean, UseDisclosureHandlers] {
  const [isOpen, setIsOpen] = useState(initial)

  // Empty deps on every handler: each one either sets a constant or uses a
  // functional updater, so none of them need to close over `isOpen`. This is the
  // whole reason the returned handlers are safe to pass to `React.memo` children.
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const set = useCallback((value: boolean) => setIsOpen(value), [])

  // Stabilize the container too — otherwise a consumer passing the whole
  // handlers object down would hand a fresh identity to a memoized child on
  // every render, defeating the point of the stable handlers inside it.
  const handlers = useMemo<UseDisclosureHandlers>(
    () => ({ open, close, toggle, set }),
    [open, close, toggle, set]
  )

  return [isOpen, handlers]
}
