/**
 * Modal Component Tests
 *
 * A11y regression coverage for issue #13:
 *  - aria-labelledby uses a unique id per Modal instance (useId)
 *    so multiple modals on a page don't collide.
 *  - Initial focus lands inside the dialog (body container) rather than
 *    on the close "X" button, preventing accidental dismissals from
 *    Enter/Space keypresses immediately after open.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Modal } from './Modal'

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

describe('Modal — a11y (#13)', () => {
  it('renders a dialog with aria-modal="true"', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Hello">
        <p>Body</p>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('wires aria-labelledby to an id that matches the heading', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Confirm Action">
        <p>Body</p>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    // The id should start with our stable prefix
    expect(labelledBy).toMatch(/^modal-title-/)
    const heading = document.getElementById(labelledBy!)
    expect(heading).not.toBeNull()
    expect(heading).toHaveTextContent('Confirm Action')
  })

  it('generates unique ids for multiple modals (no collision)', () => {
    render(
      <>
        <Modal isOpen onClose={() => {}} title="First">
          <p>First body</p>
        </Modal>
        <Modal isOpen onClose={() => {}} title="Second">
          <p>Second body</p>
        </Modal>
      </>
    )

    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs).toHaveLength(2)
    // safe: length asserted 2 above → indices 0,1 present
    const id1 = dialogs[0]!.getAttribute('aria-labelledby')
    const id2 = dialogs[1]!.getAttribute('aria-labelledby')
    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id1).not.toBe(id2)
  })

  it('does not set aria-labelledby when no title is provided', () => {
    render(
      <Modal isOpen onClose={() => {}}>
        <p>Body</p>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false)
  })

  it('initial focus goes to the dialog body, not the close X button', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Hello" showCloseButton>
        <button>In-body button</button>
      </Modal>
    )

    // Allow the focus-override rAF to run.
    flushRaf()

    const closeBtn = screen.getByRole('button', { name: /close modal/i })
    expect(document.activeElement).not.toBe(closeBtn)
    // The dialog body is tabindex=-1 and receives focus; it's a div, not a
    // button, so its role is not 'button'. Assert via contentRef markup.
    // Active element should be a div with our body class or the dialog itself.
    const active = document.activeElement as HTMLElement | null
    expect(active).not.toBeNull()
    expect(active!.tagName.toLowerCase()).toBe('div')
  })
})

/* -------------------------------------------------------------------- *
 *  Sprint 10 (#59) — Top-accent line by default
 *
 *  Modal renders a 3px ocean-medium bar at the top by default. Opt out
 *  with `accent={false}`.
 * -------------------------------------------------------------------- */
describe('Modal — brand defaults (#59)', () => {
  it('applies the accent class by default', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Hi">
        <p>Body</p>
      </Modal>
    )
    flushRaf()
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toMatch(/accent/)
  })

  it('opts out of the accent with accent={false}', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Hi" accent={false}>
        <p>Body</p>
      </Modal>
    )
    flushRaf()
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).not.toMatch(/accent/)
  })
})

/* -------------------------------------------------------------------- *
 *  #423 — Full customizability: style + ...rest passthrough
 *
 *  Consumer `data-testid` and `style` land on the visual root (the
 *  <dialog>), and a consumer-supplied a11y attribute (aria-modal) can NOT
 *  clobber the internal dialog contract (rest is spread before it).
 * -------------------------------------------------------------------- */
describe('Modal — passthrough (#423)', () => {
  it('forwards data-testid and style to the dialog root', () => {
    render(
      <Modal
        isOpen
        onClose={() => {}}
        title="Hi"
        data-testid="my-modal"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <p>Body</p>
      </Modal>
    )
    flushRaf()
    const dialog = screen.getByTestId('my-modal')
    expect(dialog.tagName.toLowerCase()).toBe('dialog')
    expect(dialog).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('does not let a consumer aria-modal override the internal contract', () => {
    render(
      <Modal
        isOpen
        onClose={() => {}}
        title="Hi"
        // A consumer attempt to weaken the dialog contract — the internal
        // aria-modal="true" must still win (rest spreads before it).
        aria-modal="false"
      >
        <p>Body</p>
      </Modal>
    )
    flushRaf()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
