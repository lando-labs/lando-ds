'use client'

/**
 * AlertDialog Component (#314)
 *
 * Role-aware destructive-confirm primitive. Mechanically a `<Modal>` cousin —
 * native `<dialog>` + `showModal()` + `@starting-style` for animation + the
 * `pointer-events:none on closed; auto on [open]` inert-when-closed pattern
 * (#387) — but with stricter semantics:
 *
 *   - `role="alertdialog"` (NOT `dialog`). Screen readers treat alertdialog
 *     as a higher-priority interruption and announce the title + description
 *     immediately, which is the right cue for "are you sure you want to
 *     delete this?" style confirmations.
 *   - Required `title` (alertdialog needs an accessible name).
 *   - Built-in Cancel + Confirm footer — consumers can't accidentally ship an
 *     alertdialog without an explicit cancel path.
 *   - Default focus on Cancel (NOT Confirm). The destructive variant especially
 *     should not autofocus the dangerous action — an Enter press right after
 *     open could delete data the user didn't mean to.
 *   - Escape → `onCancel` (not a no-op trap). WAI-ARIA practices allow either,
 *     but mapping Escape to Cancel matches what most users intuit and avoids
 *     a "this dialog won't go away" frustration. The user is making an
 *     explicit decision (cancel), not casually dismissing.
 *   - Backdrop click is INERT — clicking outside does nothing. Casual dismissal
 *     of a destructive confirm via a stray click is exactly the failure mode
 *     `role="alertdialog"` exists to prevent.
 *
 * The DOM mirrors Modal's: `<dialog>` host (container query + ::backdrop) wraps
 * an inner visible `.dialogBox` so the `@container alertdialog` query has a
 * descendant to target (the #270 self-rule no-op guard).
 *
 * @example
 * <AlertDialog
 *   open={confirmDelete}
 *   onOpenChange={setConfirmDelete}
 *   title="Delete project?"
 *   description="This will permanently delete the project and all of its data."
 *   confirmLabel="Delete"
 *   destructive
 *   onConfirm={() => deleteProject()}
 * />
 */

import React, { useRef, useEffect, useId } from 'react'
import { Button } from '../Button'
import styles from './AlertDialog.module.css'

/**
 * Pass-through props for the `<dialog>` root. Every native dialog attribute
 * (`data-*`, `id`, `style`, `className`, …) is accepted EXCEPT the few
 * AlertDialog owns with stricter semantics:
 *   - `onCancel`: the native `cancel` event is intercepted internally and
 *     routed to `onCancel` / `onOpenChange`, so the consumer's cancel
 *     contract is the typed `onCancel` prop below — not the raw DOM handler.
 *   - `title`: redefined below as a required accessible-name string.
 *   - `children`: redefined below as the dialog's body content.
 */
type AlertDialogRootAttributes = Omit<
  React.DialogHTMLAttributes<HTMLDialogElement>,
  'onCancel' | 'title' | 'children'
>

export interface AlertDialogProps extends AlertDialogRootAttributes {
  /**
   * Whether the alert dialog is open. AlertDialog is always controlled —
   * the explicit decision (confirm / cancel) belongs to the consumer's
   * state, not internal component state.
   */
  open: boolean
  /**
   * Callback when the dialog's open state should change. Fired after
   * Cancel, Confirm (post-`onConfirm`), or Escape. Use this to mirror the
   * dialog's open state in the consumer.
   *
   * If `onCancel` is provided, Cancel and Escape route through it and do
   * NOT automatically call `onOpenChange(false)` — your cancel handler
   * is expected to flip the controlled state itself. (This mirrors how
   * Radix's AlertDialog hands the close decision to the consumer for
   * destructive flows that need to e.g. clear pending state first.)
   */
  onOpenChange?: (open: boolean) => void
  /**
   * Required title. AlertDialog needs an accessible name, so unlike Modal
   * this prop is not optional. Wired to the dialog via `aria-labelledby`.
   */
  title: string
  /**
   * Optional description rendered below the title. Wired via
   * `aria-describedby`. For richer content (links, formatted markup),
   * pass `children` instead.
   */
  description?: string
  /**
   * Optional richer content rendered in place of `description`. If both
   * are provided, `children` wins and `description` is ignored.
   */
  children?: React.ReactNode
  /** Confirm button label. Defaults to `"Confirm"`. */
  confirmLabel?: string
  /** Cancel button label. Defaults to `"Cancel"`. */
  cancelLabel?: string
  /**
   * Mark the confirmation as destructive. Renders Confirm with the danger
   * variant. Default `false`.
   *
   * Destructive confirms keep focus on Cancel by default (no `initialFocus`
   * override) so an accidental Enter doesn't trigger the dangerous action.
   */
  destructive?: boolean
  /**
   * Required confirm handler. Called when the user activates Confirm.
   * The dialog does NOT close itself afterward — call `onOpenChange(false)`
   * in your handler once the confirmed action has been kicked off (or
   * awaited, if you want the dialog to remain open during an in-flight
   * mutation). This mirrors how Radix's AlertDialog hands the close to
   * the consumer so the dialog can act as a loading surface.
   */
  onConfirm: () => void
  /**
   * Optional cancel handler. Fired by the Cancel button and by Escape.
   * If omitted, Cancel / Escape will call `onOpenChange(false)` directly.
   */
  onCancel?: () => void
  /**
   * Which button to focus when the dialog opens.
   * - `"cancel"` (default): safer for destructive flows; an accidental
   *   Enter / Space activates Cancel, not the dangerous action.
   * - `"confirm"`: appropriate for benign confirmations (e.g. "Save
   *   changes before exiting?") where the affirmative path is the
   *   expected default.
   *
   * Note: explicitly passing `initialFocus="confirm"` on a `destructive`
   * dialog is honored but inadvisable. The component does not silently
   * override the consumer's choice.
   */
  initialFocus?: 'confirm' | 'cancel'
  /**
   * Additional CSS class on the `<dialog>` root (the visually styled element
   * that carries `role="alertdialog"`). Merged after the component's own
   * classes via the `[styles.dialog, className]` join.
   */
  className?: string
  /**
   * Inline styles merged onto the `<dialog>` root. The component sets no
   * inline style on the dialog itself today, so consumer keys apply directly.
   * (Inherited type from `DialogHTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

export const AlertDialog = React.forwardRef<HTMLDialogElement, AlertDialogProps>(
  function AlertDialog(
    {
      open,
      onOpenChange,
      title,
      description,
      children,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      destructive = false,
      onConfirm,
      onCancel,
      initialFocus = 'cancel',
      className = '',
      style,
      ...rest
    },
    forwardedRef
  ) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const cancelButtonRef = useRef<HTMLButtonElement>(null)
    const confirmButtonRef = useRef<HTMLButtonElement>(null)

    // Merge external ref with internal dialogRef. Mirrors Modal's ref-merge
    // pattern; consumers receive HTMLDialogElement.
    const setDialogRef = (node: HTMLDialogElement | null) => {
      dialogRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    // Stable, collision-free aria-labelledby / aria-describedby ids. The
    // `alertdialog-` prefix distinguishes these from Modal's `modal-title-`
    // ids so DOM dumps stay self-documenting and selector debugging is easier.
    const autoId = useId()
    const titleId = `alertdialog-title-${autoId}`
    const descriptionId = `alertdialog-desc-${autoId}`
    const hasDescription = Boolean(description ?? children)

    // Cancel-path resolver. If a cancel handler is provided, it owns the
    // close decision; otherwise we close ourselves via onOpenChange.
    const handleCancel = () => {
      if (onCancel) {
        onCancel()
      } else if (onOpenChange) {
        onOpenChange(false)
      }
    }

    // Confirm-path. We do NOT auto-close on confirm — the consumer's handler
    // owns the close (so the dialog can stay open during an in-flight
    // mutation if needed). Documented in the prop comment above.
    const handleConfirm = () => {
      onConfirm()
    }

    // Open / close the native dialog as `open` changes. Mirrors Modal —
    // `showModal()` is the top-layer-promoting variant; defensive try/catch
    // around InvalidStateError; jsdom polyfill via the `open` attribute.
    useEffect(() => {
      const dialog = dialogRef.current
      if (!dialog) return

      if (open && !dialog.open) {
        if (typeof dialog.showModal === 'function') {
          try {
            dialog.showModal()
          } catch {
            // Defensive — InvalidStateError if a previous render already opened.
          }
        } else {
          dialog.setAttribute('open', '')
        }
      } else if (!open && dialog.open) {
        if (typeof dialog.close === 'function') {
          dialog.close()
        } else {
          dialog.removeAttribute('open')
        }
      }
    }, [open])

    // Bridge the native `cancel` event (Escape press on a native dialog) to
    // our cancel-path. We always preventDefault() and route through
    // handleCancel because:
    //   1. The native cancel/close flow would call our onClose-equivalent
    //      via the close event, but the user's onCancel handler may want
    //      to do something different than a plain close (e.g. log analytics,
    //      revert pending UI state).
    //   2. The browser-generated `close` event also fires whenever we
    //      programmatically call `dialog.close()` from the open/close
    //      effect — we don't want a confirm-then-close cycle to re-trigger
    //      the cancel handler.
    useEffect(() => {
      const dialog = dialogRef.current
      if (!dialog) return

      const onNativeCancel = (e: Event) => {
        // Stop the browser from closing the dialog directly — we own the
        // close, via handleCancel → onCancel or onOpenChange(false).
        e.preventDefault()
        if (open) {
          handleCancel()
        }
      }

      dialog.addEventListener('cancel', onNativeCancel)
      return () => {
        dialog.removeEventListener('cancel', onNativeCancel)
      }
      // We intentionally do not include `handleCancel` in deps — it's
      // recreated on every render and the inner reads of onCancel /
      // onOpenChange / open are captured per-event via the latest closure.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, onCancel, onOpenChange])

    // Body scroll-lock. Same approach as Modal — the platform does not lock
    // document scroll for open dialogs. We restore original inline styles
    // on close so host pages with their own overflow handling are preserved.
    useEffect(() => {
      if (!open) return

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
    }, [open])

    // Initial focus. Default `cancel` to keep destructive Enter-after-open
    // from triggering the dangerous action. `confirm` is the explicit
    // override for benign confirmations.
    //
    // Why rAF: native `<dialog>` runs its own focus-first-descendant logic
    // when showModal() resolves; we have to land AFTER that so our focus
    // call wins. Mirrors Modal's pattern.
    useEffect(() => {
      if (!open) return
      const rafId = requestAnimationFrame(() => {
        const target =
          initialFocus === 'confirm'
            ? confirmButtonRef.current
            : cancelButtonRef.current
        if (target) target.focus()
      })
      return () => cancelAnimationFrame(rafId)
    }, [open, initialFocus])

    // Synthesize backdrop-click DISMISSAL — but for AlertDialog this is the
    // place where we DON'T close. WAI-ARIA explicitly says alertdialog
    // requires an explicit decision (the whole reason this primitive exists
    // separate from Modal). We still handle the click so the event doesn't
    // bubble into consumer code that might mis-fire on it; we just don't
    // route it to cancel.
    const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
      // Click on the dialog element itself (i.e. on the ::backdrop pseudo-
      // element — see Modal.tsx for the discrimination trick): swallow and
      // intentionally do nothing. The user must hit a button.
      if (e.target === e.currentTarget) {
        // No-op on purpose. AlertDialog is explicit-decision-only.
        return
      }
      // Clicks inside the dialog content bubble normally (button presses
      // call our handleCancel / handleConfirm via their own onClick handlers).
    }

    const dialogClasses = [styles.dialog, className].filter(Boolean).join(' ')

    // Always render the <dialog> element so React's tree is stable across
    // open/close transitions (matches Modal — the open/close effect drives
    // visibility via showModal/close; conditional rendering would invalidate
    // refs every cycle and break the @starting-style enter animation).
    return (
      <dialog
        ref={setDialogRef}
        // Consumer escape hatch — `data-*`, `id`, etc. Spread BEFORE the
        // component's own props so AlertDialog's identity-defining attributes
        // (role, aria-*, onClick) win on any conflict.
        {...rest}
        className={dialogClasses}
        style={style}
        onClick={handleDialogClick}
        // role="alertdialog" overrides the native dialog role. Critical —
        // this is THE reason AlertDialog exists separate from Modal. AT
        // implementations treat alertdialog as a higher-urgency interruption
        // and announce the description immediately on open.
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        // showModal() implicitly sets aria-modal in the AT computed tree,
        // but we set it explicitly so attribute-based assertions + AT
        // implementations that read raw attributes both see the same value.
        aria-modal="true"
      >
        <div className={styles.dialogBox}>
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {hasDescription && (
              <div id={descriptionId} className={styles.description}>
                {children ?? description}
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <Button
              ref={cancelButtonRef}
              variant="secondary"
              onClick={handleCancel}
            >
              {cancelLabel}
            </Button>
            <Button
              ref={confirmButtonRef}
              variant={destructive ? 'danger' : 'primary'}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    )
  }
)

AlertDialog.displayName = 'AlertDialog'
