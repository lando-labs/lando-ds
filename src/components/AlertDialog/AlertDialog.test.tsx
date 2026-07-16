/**
 * AlertDialog Component Tests (#314)
 *
 * Coverage targets:
 *   - role="alertdialog" present (distinguishes from Modal's "dialog")
 *   - Accessible name (aria-labelledby → title) and description
 *     (aria-describedby → description) wired correctly
 *   - aria-modal="true" present
 *   - Confirm / Cancel button activations route to the right handlers
 *   - Escape key fires onCancel (humane-default Escape→Cancel behavior)
 *   - Backdrop click does NOT dismiss (alertdialog explicit-decision contract)
 *   - Initial focus lands on Cancel by default; on Confirm with override
 *   - Destructive variant renders Confirm with the danger styling
 *   - children render in place of description when both provided
 *   - Closed state is INERT (regression pin for the #387 clickjacking class)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { AlertDialog } from './AlertDialog'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => {
    vi.runOnlyPendingTimers()
  })
  vi.useRealTimers()
})

function flushRaf(times = 3) {
  for (let i = 0; i < times; i++) {
    act(() => {
      vi.advanceTimersByTime(16)
    })
  }
}

describe('AlertDialog — a11y', () => {
  it('renders with role="alertdialog" (not "dialog")', () => {
    render(
      <AlertDialog
        open
        title="Delete project?"
        onConfirm={() => {}}
      />
    )
    // role="alertdialog" — THE reason this primitive exists separate from Modal.
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    // And there should NOT be a plain "dialog" role match — the explicit
    // role attribute overrides the implicit role of <dialog>.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sets aria-modal="true"', () => {
    render(
      <AlertDialog open title="Confirm" onConfirm={() => {}} />
    )
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('wires aria-labelledby to the title element', () => {
    render(
      <AlertDialog
        open
        title="Delete project?"
        onConfirm={() => {}}
      />
    )
    const dialog = screen.getByRole('alertdialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(labelledBy).toMatch(/^alertdialog-title-/)
    const heading = document.getElementById(labelledBy!)
    expect(heading).not.toBeNull()
    expect(heading).toHaveTextContent('Delete project?')
  })

  it('wires aria-describedby to the description element when present', () => {
    render(
      <AlertDialog
        open
        title="Delete project?"
        description="This will permanently delete the project."
        onConfirm={() => {}}
      />
    )
    const dialog = screen.getByRole('alertdialog')
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(describedBy).toMatch(/^alertdialog-desc-/)
    const desc = document.getElementById(describedBy!)
    expect(desc).not.toBeNull()
    expect(desc).toHaveTextContent('This will permanently delete the project.')
  })

  it('does not set aria-describedby when no description / children', () => {
    render(<AlertDialog open title="Confirm" onConfirm={() => {}} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.hasAttribute('aria-describedby')).toBe(false)
  })

  it('renders children in place of description when both are provided', () => {
    render(
      <AlertDialog
        open
        title="Confirm"
        description="This text should be ignored."
        onConfirm={() => {}}
      >
        <span data-testid="rich-desc">Rich description content</span>
      </AlertDialog>
    )
    expect(screen.getByTestId('rich-desc')).toBeInTheDocument()
    expect(
      screen.queryByText('This text should be ignored.')
    ).not.toBeInTheDocument()
  })
})

describe('AlertDialog — focus management', () => {
  it('focuses the Cancel button by default', () => {
    render(
      <AlertDialog
        open
        title="Delete project?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={() => {}}
      />
    )
    flushRaf()
    const cancelBtn = screen.getByRole('button', { name: 'Keep' })
    expect(document.activeElement).toBe(cancelBtn)
  })

  it('focuses the Confirm button when initialFocus="confirm"', () => {
    render(
      <AlertDialog
        open
        title="Save changes?"
        confirmLabel="Save"
        cancelLabel="Discard"
        initialFocus="confirm"
        onConfirm={() => {}}
      />
    )
    flushRaf()
    const confirmBtn = screen.getByRole('button', { name: 'Save' })
    expect(document.activeElement).toBe(confirmBtn)
  })
})

describe('AlertDialog — interactions', () => {
  it('calls onConfirm when the Confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <AlertDialog
        open
        title="Confirm"
        confirmLabel="Yes"
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the Cancel button is clicked', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <AlertDialog
        open
        title="Confirm"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('falls back to onOpenChange(false) when Cancel is clicked without onCancel', () => {
    const onOpenChange = vi.fn()
    render(
      <AlertDialog
        open
        title="Confirm"
        cancelLabel="No"
        onConfirm={() => {}}
        onOpenChange={onOpenChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Escape press routes through onCancel (humane Escape→Cancel)', () => {
    // Judgment call: WAI-ARIA practices permit either trap-or-cancel for
    // Escape; we picked cancel because "this dialog won't go away" is a
    // worse UX than "Escape cancels", and the user is still making an
    // explicit cancel decision (not a casual dismissal).
    const onCancel = vi.fn()
    render(
      <AlertDialog
        open
        title="Confirm"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )
    const dialog = screen.getByRole('alertdialog')
    // Dispatch a native `cancel` event the way the browser does on Escape;
    // jsdom doesn't synthesize this from a keydown so we fire it directly.
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('backdrop click does NOT dismiss the dialog (explicit-decision contract)', () => {
    // Clicking the dialog element itself simulates a ::backdrop click (see
    // Modal.tsx for the discrimination trick: backdrop clicks deliver
    // event.target === dialog because pseudo-elements bubble through their
    // generating element). AlertDialog must swallow this — alertdialog is
    // explicit-decision only.
    const onCancel = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <AlertDialog
        open
        title="Confirm"
        onConfirm={() => {}}
        onCancel={onCancel}
        onOpenChange={onOpenChange}
      />
    )
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(dialog)
    expect(onCancel).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('AlertDialog — destructive variant', () => {
  it('renders Confirm with the danger variant when destructive', () => {
    render(
      <AlertDialog
        open
        title="Delete project?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => {}}
      />
    )
    const confirmBtn = screen.getByRole('button', { name: 'Delete' })
    // Button forwards `variant` to the rendered <button>'s class list via
    // CSS Modules — class name will contain "danger" (hashed prefix tolerated).
    expect(confirmBtn.className).toMatch(/danger/)
  })

  it('renders Confirm with the primary variant by default (non-destructive)', () => {
    render(
      <AlertDialog
        open
        title="Save changes?"
        confirmLabel="Save"
        onConfirm={() => {}}
      />
    )
    const confirmBtn = screen.getByRole('button', { name: 'Save' })
    expect(confirmBtn.className).toMatch(/primary/)
    expect(confirmBtn.className).not.toMatch(/danger/)
  })
})

describe('AlertDialog — controlled open / close', () => {
  it('renders the dialog element even when closed (stable tree for animation)', () => {
    // Closed state must still produce a <dialog> in the DOM so the
    // @starting-style enter animation has a from-value. The visibility +
    // pointer-events:none CSS keeps it inert.
    const { container } = render(
      <AlertDialog open={false} title="Confirm" onConfirm={() => {}} />
    )
    const dialog = container.querySelector('dialog')
    expect(dialog).not.toBeNull()
    // role="alertdialog" is still there; the inert CSS keeps it out of the
    // way without us having to unmount.
    expect(dialog).toHaveAttribute('role', 'alertdialog')
  })

  it('closed state CSS keeps the dialog inert (regression pin for #387)', () => {
    // We can't measure live pointer-events in jsdom (no layout engine), but
    // we CAN assert the contract that drives the no-clickjacking guard:
    //   1. The closed dialog does NOT have the [open] attribute set.
    //   2. The .module.css ships the `pointer-events:none` / `visibility:
    //      hidden` declarations on the base `.dialog` rule, which apply
    //      whenever [open] is absent.
    // (1) is verified here; (2) is verified by
    //     src/test/no-clickjacking-closed-dialog.test.ts which scans the CSS.
    const { container } = render(
      <AlertDialog open={false} title="Confirm" onConfirm={() => {}} />
    )
    const dialog = container.querySelector('dialog')!
    expect(dialog.hasAttribute('open')).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 *  #422 — className / style / ...rest pass-through to the <dialog> root
 *
 *  The visually styled root is the `<dialog role="alertdialog">` element
 *  (NOT the inner `.dialogBox`). Consumer overrides must land there.
 * ------------------------------------------------------------------ */
describe('AlertDialog — root pass-through (#422)', () => {
  it('forwards a consumer data-testid onto the <dialog> root', () => {
    render(
      <AlertDialog
        open
        title="Confirm"
        onConfirm={() => {}}
        data-testid="my-alert"
      />
    )
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.tagName).toBe('DIALOG')
    expect(dialog).toHaveAttribute('data-testid', 'my-alert')
  })

  it('lets a consumer style win on the <dialog> root', () => {
    render(
      <AlertDialog
        open
        title="Confirm"
        onConfirm={() => {}}
        style={{ color: 'rgb(1, 2, 3)' }}
      />
    )
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.style.color).toBe('rgb(1, 2, 3)')
  })

  it('merges a consumer className onto the <dialog> root (component class retained)', () => {
    render(
      <AlertDialog
        open
        title="Confirm"
        onConfirm={() => {}}
        className="consumer-cls"
      />
    )
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.className).toContain('consumer-cls')
    // The component's own class survives the merge.
    expect(dialog.className.split(' ').length).toBeGreaterThan(1)
  })
})
