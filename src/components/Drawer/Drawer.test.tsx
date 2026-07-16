/**
 * Drawer Component Tests
 *
 * Behavioural coverage for the Drawer / SlideOver primitive (issue #81):
 *  - Renders all three placements with the right CSS hook class
 *  - Honors named sizes (sm/md/lg) and numeric size override
 *  - Renders nothing when `isOpen={false}`
 *  - Backdrop click triggers `onClose` (and is suppressible)
 *  - Escape key triggers `onClose` (and is suppressible)
 *  - Focus trap cycles within the drawer (Tab + Shift+Tab)
 *  - Close button renders + click fires `onClose`
 *  - Body has `overflow: hidden` while open, restored on unmount
 *  - jest-axe smoke test on each placement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Drawer } from './Drawer'

expect.extend(toHaveNoViolations)

// useClickOutside attaches its listeners inside a `setTimeout(..., 0)` to
// avoid same-tick re-firing of the trigger that opened the overlay. Tests
// that exercise click-outside therefore need to run real timers (or
// advance fake ones). We use real timers here — the suite is small and
// not animation-sensitive.

describe('Drawer — rendering', () => {
  it('does not render when isOpen={false}', () => {
    render(
      <Drawer isOpen={false} onClose={() => {}}>
        <p>Hidden content</p>
      </Drawer>
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Hidden content')).toBeNull()
  })

  it('renders a dialog with aria-modal="true" when open', () => {
    render(
      <Drawer isOpen onClose={() => {}} title="Hello">
        <p>Body</p>
      </Drawer>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('wires aria-labelledby to a unique id matching the heading', () => {
    render(
      <Drawer isOpen onClose={() => {}} title="Version History">
        <p>Body</p>
      </Drawer>
    )
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(labelledBy).toMatch(/^drawer-title-/)
    const heading = document.getElementById(labelledBy!)
    expect(heading).not.toBeNull()
    expect(heading).toHaveTextContent('Version History')
  })

  it('omits aria-labelledby when no title is provided', () => {
    render(
      <Drawer isOpen onClose={() => {}}>
        <p>Body</p>
      </Drawer>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false)
  })
})

describe('Drawer — placements', () => {
  it.each(['right', 'left', 'bottom'] as const)(
    'applies the %s placement class and data-placement attribute',
    (placement) => {
      render(
        <Drawer isOpen onClose={() => {}} placement={placement}>
          <p>Body</p>
        </Drawer>
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toMatch(new RegExp(placement))
      expect(dialog).toHaveAttribute('data-placement', placement)
    }
  )

  it('defaults to right placement when not specified', () => {
    render(
      <Drawer isOpen onClose={() => {}}>
        <p>Body</p>
      </Drawer>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-placement', 'right')
    expect(dialog.className).toMatch(/right/)
  })
})

describe('Drawer — sizes', () => {
  it.each(['sm', 'md', 'lg'] as const)(
    'applies the %s size class',
    (size) => {
      render(
        <Drawer isOpen onClose={() => {}} size={size}>
          <p>Body</p>
        </Drawer>
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog.className).toMatch(new RegExp(size))
    }
  )

  it('honors a numeric size by setting --drawer-size inline', () => {
    render(
      <Drawer isOpen onClose={() => {}} size={720}>
        <p>Body</p>
      </Drawer>
    )
    const dialog = screen.getByRole('dialog') as HTMLElement
    // jsdom mirrors inline style custom properties via getPropertyValue.
    expect(dialog.style.getPropertyValue('--drawer-size')).toBe('720px')
    // None of the named-size classes should be applied when size is numeric.
    expect(dialog.className).not.toMatch(/(?:^| )sm(?: |$)/)
    expect(dialog.className).not.toMatch(/(?:^| )md(?: |$)/)
    expect(dialog.className).not.toMatch(/(?:^| )lg(?: |$)/)
  })
})

describe('Drawer — dismissal', () => {
  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Drawer isOpen onClose={onClose} title="Hi" showCloseButton>
        <p>Body</p>
      </Drawer>
    )
    const closeBtn = screen.getByRole('button', { name: /close drawer/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not render close button when showCloseButton={false}', () => {
    render(
      <Drawer isOpen onClose={() => {}} title="Hi" showCloseButton={false}>
        <p>Body</p>
      </Drawer>
    )
    expect(screen.queryByRole('button', { name: /close drawer/i })).toBeNull()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Drawer isOpen onClose={onClose}>
        <p>Body</p>
      </Drawer>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose on Escape when closeOnEscape={false}', () => {
    const onClose = vi.fn()
    render(
      <Drawer isOpen onClose={onClose} closeOnEscape={false}>
        <p>Body</p>
      </Drawer>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on backdrop click (default)', async () => {
    const onClose = vi.fn()
    render(
      <Drawer isOpen onClose={onClose}>
        <p>Body</p>
      </Drawer>
    )
    // useClickOutside attaches listeners on the next tick — wait for it.
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Simulate a click on the body (anywhere outside the panel). The hook
    // walks up from the event target so a `document.body` click is treated
    // as outside.
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose on backdrop click when closeOnBackdropClick={false}', async () => {
    const onClose = vi.fn()
    render(
      <Drawer isOpen onClose={onClose} closeOnBackdropClick={false}>
        <p>Body</p>
      </Drawer>
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.mouseDown(document.body)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does NOT call onClose when clicking inside the panel', async () => {
    const onClose = vi.fn()
    render(
      <Drawer isOpen onClose={onClose}>
        <button>Inside</button>
      </Drawer>
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.mouseDown(screen.getByRole('button', { name: /inside/i }))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Drawer — focus trap', () => {
  it('focuses the first focusable element on open', () => {
    render(
      <Drawer isOpen onClose={() => {}} showCloseButton={false}>
        <button>First</button>
        <button>Second</button>
      </Drawer>
    )
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /first/i })
    )
  })

  it('Tab cycles forward from last → first within the drawer', () => {
    render(
      <Drawer isOpen onClose={() => {}} showCloseButton={false}>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </Drawer>
    )
    const first = screen.getByRole('button', { name: /first/i })
    const third = screen.getByRole('button', { name: /third/i })

    // Move focus to the last element, then Tab — should wrap to first.
    third.focus()
    expect(document.activeElement).toBe(third)

    // The trap listens on the panel container, so dispatch from within.
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('Shift+Tab cycles backward from first → last within the drawer', () => {
    render(
      <Drawer isOpen onClose={() => {}} showCloseButton={false}>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </Drawer>
    )
    const first = screen.getByRole('button', { name: /first/i })
    const third = screen.getByRole('button', { name: /third/i })

    first.focus()
    expect(document.activeElement).toBe(first)

    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(third)
  })
})

describe('Drawer — body scroll lock', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

  it('sets body overflow: hidden while open', () => {
    const { unmount } = render(
      <Drawer isOpen onClose={() => {}}>
        <p>Body</p>
      </Drawer>
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
  })

  it('restores body overflow on close (unmount)', () => {
    const { unmount } = render(
      <Drawer isOpen onClose={() => {}}>
        <p>Body</p>
      </Drawer>
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('does not lock body scroll when closed', () => {
    render(
      <Drawer isOpen={false} onClose={() => {}}>
        <p>Body</p>
      </Drawer>
    )
    expect(document.body.style.overflow).toBe('')
  })
})

describe('Drawer — a11y (jest-axe)', () => {
  it.each(['right', 'left', 'bottom'] as const)(
    'has no a11y violations in %s placement',
    async (placement) => {
      const { container } = render(
        <Drawer
          isOpen
          onClose={() => {}}
          title="Settings"
          placement={placement}
        >
          <p>Some content</p>
        </Drawer>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    }
  )
})

describe('Drawer — ref forwarding', () => {
  it('forwards a ref to the dialog root', () => {
    const ref = { current: null as HTMLDivElement | null }
    render(
      <Drawer isOpen onClose={() => {}} ref={ref}>
        <p>Body</p>
      </Drawer>
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.getAttribute('role')).toBe('dialog')
  })
})

describe('Drawer — passthrough (#423)', () => {
  it('forwards data-testid and style to the panel (visual root)', () => {
    render(
      <Drawer
        isOpen
        onClose={() => {}}
        data-testid="my-drawer"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <p>Body</p>
      </Drawer>
    )
    const panel = screen.getByTestId('my-drawer')
    expect(panel).toBe(screen.getByRole('dialog'))
    expect(panel).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('merges consumer style with the numeric-size custom property', () => {
    render(
      <Drawer
        isOpen
        onClose={() => {}}
        size={420}
        data-testid="sized-drawer"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <p>Body</p>
      </Drawer>
    )
    const panel = screen.getByTestId('sized-drawer')
    // Consumer color survives...
    expect(panel).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    // ...and the internal size var is preserved.
    expect(panel.style.getPropertyValue('--drawer-size')).toBe('420px')
  })

  it('does not let a consumer role override the internal dialog role', () => {
    render(
      <Drawer
        isOpen
        onClose={() => {}}
        data-testid="role-drawer"
        role="tooltip"
      >
        <p>Body</p>
      </Drawer>
    )
    const panel = screen.getByTestId('role-drawer')
    expect(panel).toHaveAttribute('role', 'dialog')
  })
})
