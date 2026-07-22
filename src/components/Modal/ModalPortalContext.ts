'use client'

/**
 * ModalPortalContext (#14 follow-up)
 *
 * Exposes the nearest enclosing OPEN Modal's in-dialog portal host to
 * descendant overlay components (Select, Combobox, MultiSelect, Dropdown,
 * Popover) so they can render their portaled content as a DOM descendant of
 * that Modal's `<dialog>` instead of `document.body` — which exempts them
 * from the native `inert` subtree `showModal()` applies to everything
 * outside the dialog. See the long comment at the top of `Modal.tsx` for the
 * full diagnosis and rationale.
 *
 * Deliberately split out of `Modal.tsx` into this leaf module (no CSS import,
 * no component JSX) so the five consumer components can deep-import just the
 * context/hook without dragging Modal's CSS Module and `forwardRef` component
 * body into their own bundle chunk under `preserveModules`. `Modal.tsx`
 * re-exports `useModalPortalContainer` for the public `Modal/index.ts`
 * surface; import from THIS file (not `../Modal/Modal`) from any other
 * component family that only needs the hook.
 */
import { createContext, useContext } from 'react'

export const ModalPortalContext = createContext<HTMLElement | null>(null)

/**
 * Returns the nearest enclosing open Modal's in-dialog portal container, or
 * `null` when there isn't one (not inside a Modal, or the nearest Modal is
 * closed). `null` means "use the standalone document.body + Popover API
 * path"; a non-null node means "render here instead — you're inside an open
 * Modal's dialog subtree."
 */
export function useModalPortalContainer(): HTMLElement | null {
  return useContext(ModalPortalContext)
}
