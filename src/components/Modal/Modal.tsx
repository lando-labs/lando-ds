'use client'

/**
 * Modal/Dialog Component
 *
 * A flexible modal dialog backed by the native `<dialog>` element with
 * `showModal()` — the browser owns top-layer promotion, the `::backdrop`
 * pseudo-element, the focus trap, the `inert` background, and the Escape
 * dismissal. Our remaining responsibilities are:
 *   - bridging the controlled `isOpen` prop ↔ native `close` / `cancel` events
 *   - manual body scroll-lock (the platform doesn't lock page scroll on its own)
 *   - manual backdrop-click detection (the platform does NOT auto-dismiss on
 *     backdrop click; we use the trick that a click whose target IS the dialog
 *     element fell on the `::backdrop` since real content children would be the
 *     actual click target)
 *   - the initial-focus override so Enter/Space right after open doesn't
 *     activate the close "X" (WAI-ARIA dialog guidance)
 *
 * Migration note (#273): the previous JS-shimmed implementation used Portal +
 * `useFocusTrap` + `useClickOutside` + `useKeyPress`. None of those are needed
 * here — `<dialog>` is Baseline since 2022 and supersedes all four.
 *
 * #14 follow-up (v0.58.0 close-out) — top-layer PAINT is not the whole story.
 * The original #14 fix promoted Dropdown/Popover/Select/Combobox/MultiSelect
 * into the top layer via the Popover API (`popover="manual"` + `showPopover()`,
 * see `src/utils/popoverApi.ts`) so they'd paint above this dialog + its
 * `::backdrop`. That's necessary but not sufficient: per the HTML spec's
 * "modal dialogs and inert subtrees" algorithm
 * (https://html.spec.whatwg.org/multipage/interactive-elements.html#modal-dialogs-and-inert-subtrees),
 * `showModal()` marks every node NOT in the dialog's own flat-tree subtree as
 * `inert` — and inert nodes don't receive pointer events, REGARDLESS of paint
 * order. A `popover="manual"` element portaled to `document.body` (a SIBLING
 * of this dialog, not a descendant) still gets marked inert once this dialog
 * goes modal. It paints on top (top-layer promotion is real) but is
 * click-through and hover-through — verified live in Chromium: `showPopover()`
 * flips `:popover-open` and the element paints correctly, but
 * `document.elementsFromPoint()` at the element's own coordinates skips over
 * it entirely, landing on whatever's underneath in the dialog's subtree.
 *
 * The fix: `ModalPortalContext` below exposes a DOM node that IS a descendant
 * of this `<dialog>` (a dedicated host div rendered as the dialog's last
 * child, sibling to `.modal`) while this Modal is open. Overlay components
 * that consume `useModalPortalContainer()` render their portaled content
 * there instead of `document.body` when they find a live container — which
 * exempts them from the inert subtree by DOM ancestry, no Popover API
 * required. They fall back to Popover API + `document.body` when not nested
 * in an open Modal (unchanged standalone behavior). See the per-component
 * comments in Select/Combobox/MultiSelect/Dropdown/Popover for the consumer
 * side of this contract, and `NestedOverlays.test.tsx` for the regression
 * coverage (plus `tests/e2e/overlays-in-modal.spec.ts` for the real-browser
 * hit-testing proof jsdom can't provide).
 *
 * Why the host div's `position:fixed` math still lines up with the viewport:
 * `.dialog` is `position:fixed; inset:0` — its border box is pinned exactly
 * to the viewport (verified empirically: `getBoundingClientRect()` reports
 * `{x:0, y:0, width:innerWidth, height:innerHeight}`). `.dialog[open]` also
 * carries a (non-`none`, even at rest: `scale(1) translateY(0)`) `transform`
 * for its enter/exit animation, which per CSS spec makes it the containing
 * block for `position:fixed` descendants — but because that containing block
 * IS the viewport rect, `usePortalPosition`'s existing viewport-relative
 * `getBoundingClientRect()` math needs no adjustment for the in-dialog path.
 * The host div itself is `display: contents` (see Modal.module.css) so it
 * contributes no box of its own and doesn't disturb this chain.
 *
 * @example
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Confirm Action">
 *   <p>Are you sure you want to continue?</p>
 * </Modal>
 */

import React, { useRef, useState, useEffect, useId } from 'react'
import styles from './Modal.module.css'
import { ModalPortalContext, useModalPortalContainer } from './ModalPortalContext'

// Re-exported so `Modal/index.ts` keeps a single public surface (`Modal`,
// `ModalProps`, `useModalPortalContainer`). Not part of the `src/hooks`
// public/hooks-contract surface — mirrors `useFormContext` (`Form/Form.tsx`),
// a component-local context consumed via deep import by other component
// families (`Field.tsx` imports it the same way). Select/Combobox/
// MultiSelect/Dropdown/Popover import the hook from `./ModalPortalContext`
// directly (not from this file) to avoid pulling Modal's CSS Module and
// `forwardRef` component body into their own bundle chunk — see the doc
// comment in `ModalPortalContext.ts`.
export { useModalPortalContainer }

export interface ModalProps
  extends Omit<React.HTMLAttributes<HTMLDialogElement>, 'title'> {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Size of the modal */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'
  /** Modal title */
  title?: string
  /**
   * Close the modal when clicking the overlay. Default `true`.
   *
   * Trust boundary (#325): fine for dismissible / confirmation modals, but for a
   * DESTRUCTIVE-confirm dialog set this `false` (and consider `closeOnEscape={false}`)
   * so a mis-aimed or clickjacked overlay click can't dismiss the dialog into its
   * default (often destructive) path.
   */
  closeOnOverlayClick?: boolean
  /** Close modal when pressing Escape */
  closeOnEscape?: boolean
  /** Show close button in header */
  showCloseButton?: boolean
  /** Modal content */
  children: React.ReactNode
  /** Footer content (e.g., action buttons) */
  footer?: React.ReactNode
  /**
   * Render the 3px brand-medium top-accent line at the top of the modal
   * (Sprint 10 #59). Default: `true`. A visible-but-not-dominant brand
   * signature that caps the modal's rounded top edge. Pass
   * `accent={false}` to suppress it — useful inside branded app shells
   * where the accent would read as visual clutter. Ignored for
   * `size="fullscreen"` (the accent line is hidden there by CSS).
   */
  accent?: boolean
  /** Additional CSS class */
  className?: string
}

export const Modal = React.forwardRef<HTMLDialogElement, ModalProps>(function Modal(
  {
    isOpen,
    onClose,
    size = 'md',
    title,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    showCloseButton = true,
    children,
    footer,
    accent = true,
    className = '',
    style,
    ...rest
  },
  forwardedRef
) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // In-dialog portal host (#14 follow-up — see the file-top comment). A
  // dedicated, styling-inert (`display: contents`) div rendered as the
  // dialog's own last child. `useState` (not a plain ref) because nested
  // overlay components need to RE-RENDER once this node exists — a ref alone
  // wouldn't notify `ModalPortalContext` consumers that a container just
  // became available.
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null)

  // Merge external ref with internal dialogRef. Consumers ref the dialog root
  // (typed HTMLDialogElement to reflect the native element they now receive —
  // a TS-visible breaking change from the previous HTMLDivElement, but the
  // surface is the same dialog box they could already inspect).
  const setDialogRef = (node: HTMLDialogElement | null) => {
    dialogRef.current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      forwardedRef.current = node
    }
  }

  // Stable, collision-free aria-labelledby id (useId() — fixes the
  // pre-#13 hardcoded "modal-title" id that broke a11y for nested dialogs).
  const autoId = useId()
  const titleId = `modal-title-${autoId}`

  // Open / close the native dialog as `isOpen` changes. `showModal()` is the
  // top-layer-promoting variant; `show()` would not promote and would not
  // render the `::backdrop`. Wrap in a try/catch only to defend against the
  // (rare) "InvalidStateError" you get from calling `showModal()` on an already-
  // open dialog; we mirror state in React so this is a defensive belt.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      // Some test environments (jsdom) ship without showModal — guard so the
      // component still renders structurally even when the API is absent.
      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal()
        } catch {
          // No-op — defensive against InvalidStateError if a previous render
          // raced ahead and the dialog is already open.
        }
      } else {
        // jsdom polyfill — flip the `open` reflected attribute manually so
        // tests that query `dialog[open]` succeed.
        dialog.setAttribute('open', '')
      }
    } else if (!isOpen && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [isOpen])

  // Bridge native dismissals (Escape → `cancel` event; programmatic close →
  // `close` event) back to the controlled `onClose`. We listen on `cancel` so
  // we can `preventDefault()` when `closeOnEscape={false}`; the `close` event
  // covers everything else (form method=dialog submit, ::backdrop click that
  // we synthesize below, etc).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      if (!closeOnEscape) {
        e.preventDefault()
        return
      }
      // Fall through to handleClose via the subsequent `close` event.
    }

    const handleClose = () => {
      // Only fire onClose if we are still "open" in React state — otherwise
      // we're a step ahead of the consumer (they already flipped isOpen to
      // false, which triggered our open/close effect above), and re-firing
      // would either loop or surprise them.
      if (isOpen) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      dialog.removeEventListener('close', handleClose)
    }
  }, [isOpen, onClose, closeOnEscape])

  // Body scroll-lock (manual — the platform does not lock document scroll for
  // open dialogs). Restoring exact prior values preserves any host page styles
  // that already set overflow / padding-right.
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [isOpen])

  // Initial focus override (issue #13). The native `<dialog>` element focuses
  // the first focusable descendant on open by default — usually the close "X"
  // button in the header. Place focus on the dialog body instead, matching
  // WAI-ARIA dialog guidance ("focus should be placed on or within the dialog").
  useEffect(() => {
    if (!isOpen) return
    const rafId = requestAnimationFrame(() => {
      const target = bodyRef.current ?? dialogRef.current
      if (target) target.focus()
    })
    return () => cancelAnimationFrame(rafId)
  }, [isOpen])

  // Synthesize backdrop-click dismissal. The native ::backdrop pseudo-element
  // is NOT a real element — click events on it deliver `event.target === dialog`
  // (because pseudo-elements bubble through their generating element). When the
  // user clicks actual dialog content, `event.target` is some descendant of
  // the dialog (the header, body, button, etc), so target !== dialog. This
  // discriminates the two cases without an explicit DOM-tree check.
  //
  // Defensive: if `closeOnOverlayClick` is false (destructive-confirm dialogs),
  // we skip the dismissal entirely.
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (!closeOnOverlayClick) return
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Dialog (host, transparent shell + container) classes. Animations + the
  // ::backdrop pseudo-element are scoped to `.dialog`. The `size` and `accent`
  // modifiers are mirrored onto the dialog too — they don't fire CSS rules on
  // the dialog itself (the visible-box rules live on the inner `.modal`), but
  // mirroring them keeps the dialog's `className` introspectable by consumers
  // (e.g. tests asserting `dialog.className.match(/accent/)` per Sprint 10
  // brand-default coverage). Consumer `className` lands on the dialog so it
  // composes with any consumer styling targeting the outer overlay box.
  const dialogClasses = [
    styles.dialog,
    styles[size],
    accent ? styles.accent : '',
    className,
  ].filter(Boolean).join(' ')
  // Inner modal box (visible frame) classes. The size + accent variants land
  // here too because that's where the visual rules fire — the box-model
  // adjustments must target a DESCENDANT of the container host (the #270
  // self-rule no-op guard requires this — the dialog host can't style itself
  // from `@container modal`).
  const modalClasses = [
    styles.modal,
    styles[size],
    accent ? styles.accent : '',
  ].filter(Boolean).join(' ')

  // Always render the <dialog> element so React's tree is stable across
  // open/close transitions (the open/close effect above drives visibility via
  // showModal/close). Conditional rendering would invalidate refs every cycle
  // and prevent the `::backdrop` enter animation from working with
  // @starting-style (#274).
  //
  // Inner `.modal` div: required for the compact `@container modal` rule to
  // have a descendant to target. The dialog is the container host so it can't
  // style itself from `@container` (silent no-op per CSS spec). See the long
  // comment in Modal.module.css.
  return (
    <dialog
      ref={setDialogRef}
      className={dialogClasses}
      // Consumer passthrough (#423). `style` merges over none (the dialog has
      // no internal inline style). `{...rest}` spreads BEFORE the behavioral
      // `onClick` and the a11y attributes below so a consumer can't clobber the
      // backdrop-dismissal handler or the dialog role contract.
      style={style}
      {...rest}
      onClick={handleDialogClick}
      aria-labelledby={title ? titleId : undefined}
      // Native showModal() implicitly applies `aria-modal=true` to the AT tree,
      // but we set it explicitly so (a) tests can assert against the attribute,
      // and (b) AT implementations that read raw attributes (rather than the
      // implicit-aria computed tree) see the same value real browsers compute.
      aria-modal="true"
    >
      {/*
       * #14 follow-up — wraps header/body/footer so any nested overlay
       * (Select/Combobox/MultiSelect/Dropdown/Popover, directly used or
       * composed inside consumer content) can find this Modal's in-dialog
       * portal host via `useModalPortalContainer()`. `portalHost` is `null`
       * until the host div below has mounted, which correctly reports "no
       * container yet" for the first render or two — those components fall
       * back to the standalone document.body + Popover API path until it
       * flips non-null, matching how `usePortalPosition`'s own isReady gate
       * already handles first-paint races.
       */}
      <ModalPortalContext.Provider value={isOpen ? portalHost : null}>
      <div className={modalClasses}>
        {(title || showCloseButton) && (
          <div className={styles.header}>
            {title && (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close modal"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 5L5 15M5 5L15 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        <div
          className={styles.body}
          ref={bodyRef}
          tabIndex={-1}
        >
          {children}
        </div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
      </ModalPortalContext.Provider>

      {/*
       * In-dialog portal host (#14 follow-up) — a dedicated last child of
       * `<dialog>`, sibling to `.modal` (NOT a descendant of it, so `.modal`'s
       * `overflow: hidden` never clips anything rendered here). `display:
       * contents` (Modal.module.css) means it contributes no box of its own;
       * position:fixed descendants resolve their containing block against
       * `<dialog>` itself (see the file-top comment for why that's still
       * viewport-correct). Always rendered (not gated on `isOpen`) so the ref
       * callback fires and `portalHost` state is populated before the first
       * open — `ModalPortalContext.Provider` above is what actually gates
       * exposure to `null` while closed.
       */}
      <div ref={setPortalHost} className={styles.portalHost} data-modal-portal-host />
    </dialog>
  )
})

Modal.displayName = 'Modal'
