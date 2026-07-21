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
 * here — `<dialog>` is Baseline since 2022 and supersedes all four. The
 * `NestedOverlays.test.tsx` regression coverage continues to verify nested
 * overlay stacking; portaled overlays (Dropdown / Popover / Select / Combobox /
 * MultiSelect) inside the dialog still escape to `document.body` and paint
 * above this dialog's top-layer — but ONLY because those overlays ALSO opt
 * into the Popover API (`popover="manual"` + `showPopover()`, see
 * `src/utils/popoverApi.ts`) and are therefore themselves promoted into the
 * top layer. Top-layer stacking cannot be beaten by `z-index` alone — a
 * `position:fixed` + `z-index` overlay with no top-layer promotion of its
 * own paints UNDER this dialog + its `::backdrop` regardless of how high the
 * z-index is. (#14 — Select/Combobox/MultiSelect did not opt into the
 * Popover API prior to v0.58.0 and were unusable inside a Modal until they
 * did.)
 *
 * @example
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Confirm Action">
 *   <p>Are you sure you want to continue?</p>
 * </Modal>
 */

import React, { useRef, useEffect, useId } from 'react'
import styles from './Modal.module.css'

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
    </dialog>
  )
})

Modal.displayName = 'Modal'
