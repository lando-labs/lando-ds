/**
 * Alert Component Tests
 *
 * Behavioral coverage for Alert:
 * - content rendering
 * - variant class application (info/success/warning/error)
 * - icon slot (default + custom + suppressed)
 * - closable flow + onClose callback (with 300ms exit animation)
 * - role="alert" + aria-live
 * - inline shape (composes with variants + closable, renders icon/title/body)
 * - axe a11y smoke check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Alert } from './Alert'

expect.extend(toHaveNoViolations)

describe('Alert', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders children content', () => {
    render(<Alert>Hello world</Alert>)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<Alert title="Heads up">Body copy</Alert>)
    expect(screen.getByText('Heads up')).toBeInTheDocument()
    expect(screen.getByText('Body copy')).toBeInTheDocument()
  })

  it('applies role="alert" and aria-live="polite"', () => {
    render(<Alert variant="info">Info message</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  it('applies variant class for each semantic variant', () => {
    const variants: Array<'info' | 'success' | 'warning' | 'error'> = [
      'info',
      'success',
      'warning',
      'error',
    ]
    variants.forEach((variant) => {
      const { unmount } = render(<Alert variant={variant}>msg</Alert>)
      const alert = screen.getByRole('alert')
      // Each variant should produce a className token; CSS Modules will hash
      // but the variant key will still appear somewhere in the className.
      expect(alert.className).toMatch(new RegExp(variant))
      unmount()
    })
  })

  it('renders default icon for variant when no custom icon given', () => {
    const { container } = render(<Alert variant="error">Oops</Alert>)
    // Default icons are SVGs rendered inside the icon wrapper.
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders custom icon when provided', () => {
    render(
      <Alert icon={<span data-testid="custom-icon">CUSTOM</span>}>With icon</Alert>
    )
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('does not render close button when not closable', () => {
    render(<Alert>Persistent</Alert>)
    expect(screen.queryByRole('button', { name: /close alert/i })).toBeNull()
  })

  it('renders close button and fires onClose after exit animation', () => {
    const onClose = vi.fn()
    render(
      <Alert closable onClose={onClose}>
        Dismissible
      </Alert>
    )
    const closeBtn = screen.getByRole('button', { name: /close alert/i })
    fireEvent.click(closeBtn)
    // onClose fires after the 300ms exit animation
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('unmounts content after close animation completes', () => {
    render(
      <Alert closable onClose={() => {}}>
        Goodbye
      </Alert>
    )
    const closeBtn = screen.getByRole('button', { name: /close alert/i })
    fireEvent.click(closeBtn)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.queryByText('Goodbye')).toBeNull()
  })

  it('has no a11y violations (axe smoke)', async () => {
    vi.useRealTimers() // axe uses async timers internally
    const { container } = render(
      <Alert variant="info" title="Info" closable onClose={() => {}}>
        Accessible content
      </Alert>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  // Inline is a slim, no-card visual treatment for in-page guidance /
  // teaching banners (from a design-system recomposition audit). It must
  // compose with every semantic variant and continue to support closable +
  // icon + title + body slots.

  describe('inline variant', () => {
    it('does not apply inline class by default', () => {
      render(<Alert>Block alert</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).not.toMatch(/inline/)
    })

    it('applies inline class when inline prop is true', () => {
      render(<Alert inline>Inline alert</Alert>)
      const alert = screen.getByRole('alert')
      expect(alert.className).toMatch(/inline/)
    })

    it('inline composes with each semantic variant', () => {
      const variants: Array<'info' | 'success' | 'warning' | 'error'> = [
        'info',
        'success',
        'warning',
        'error',
      ]
      variants.forEach((variant) => {
        const { unmount } = render(
          <Alert variant={variant} inline>
            inline {variant}
          </Alert>
        )
        const alert = screen.getByRole('alert')
        // Both the variant class and the inline class must be on the element
        expect(alert.className).toMatch(new RegExp(variant))
        expect(alert.className).toMatch(/inline/)
        unmount()
      })
    })

    it('inline + closable still fires onClose after exit animation', () => {
      const onClose = vi.fn()
      render(
        <Alert inline closable onClose={onClose}>
          Dismissible inline
        </Alert>
      )
      const closeBtn = screen.getByRole('button', { name: /close alert/i })
      fireEvent.click(closeBtn)
      expect(onClose).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('inline still renders default icon, title, and body slots', () => {
      const { container } = render(
        <Alert inline variant="warning" title="Heads up">
          Drag cards to reorder
        </Alert>
      )
      // default variant icon (svg) is rendered
      expect(container.querySelector('svg')).toBeInTheDocument()
      // title + body slots are present
      expect(screen.getByText('Heads up')).toBeInTheDocument()
      expect(screen.getByText('Drag cards to reorder')).toBeInTheDocument()
    })

    it('inline still renders custom icon when provided', () => {
      render(
        <Alert inline icon={<span data-testid="inline-custom-icon">!</span>}>
          custom inline
        </Alert>
      )
      expect(screen.getByTestId('inline-custom-icon')).toBeInTheDocument()
    })

    it('inline preserves role="alert" and aria-live="polite"', () => {
      render(
        <Alert inline variant="info">
          Inline message
        </Alert>
      )
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'polite')
    })

    // ===== Narrow container layout (#115) =====
    // On narrow containers (~280px), an inline + dismissible Alert must keep
    // the close button from overlapping wrapped message text. The fix is a
    // flex-based internal layout: flex-shrink: 0 on the close button +
    // min-width: 0 on the content slot so the message can shrink (wrap
    // vertically) without ever pushing the close button off-axis.
    //
    // jsdom can't reliably measure layout overlap, so these tests assert
    // the underlying CSS contract via class presence + computed style.

    it('inline + closable on narrow container reserves close-button space (flex-shrink: 0)', () => {
      const { container } = render(
        <div style={{ width: 280 }}>
          <Alert inline variant="info" closable onClose={() => {}}>
            Long enough message that wraps to two lines on narrow widths
          </Alert>
        </div>
      )
      const closeBtn = container.querySelector(
        'button[aria-label="Close alert"]'
      ) as HTMLButtonElement
      expect(closeBtn).toBeInTheDocument()
      // CSS Module class is hashed but starts with "closeButton"
      expect(closeBtn.className).toMatch(/closeButton/)
      // The close button must declare flex-shrink: 0 so it always reserves
      // its slot — even when the message wraps to multiple lines.
      const closeStyle = window.getComputedStyle(closeBtn)
      expect(closeStyle.flexShrink).toBe('0')
    })

    it('inline + closable: content slot allows shrinking (min-width: 0)', () => {
      const { container } = render(
        <div style={{ width: 280 }}>
          <Alert inline variant="info" closable onClose={() => {}}>
            Long enough message that wraps to two lines on narrow widths
          </Alert>
        </div>
      )
      // The content wrapper sits between the icon and the close button.
      // Find it by walking down from the alert role.
      const alert = container.querySelector('[role="alert"]') as HTMLElement
      expect(alert).toBeInTheDocument()
      // The content div is the flex child that holds title + message.
      const contentEl = alert.querySelector(
        ':scope > div:not([aria-hidden="true"]):not([aria-label])'
      ) as HTMLElement
      // Fallback: locate content via class name pattern if the structural
      // selector above misses it. CSS Module class starts with "content".
      const content =
        contentEl ??
        (Array.from(alert.children).find((c) =>
          (c as HTMLElement).className.match(/(?:^|\s)[A-Za-z0-9_-]*content/)
        ) as HTMLElement)
      expect(content).toBeTruthy()
      expect(content.className).toMatch(/content/)
      // min-width: 0 is what allows the message to wrap inside the flex
      // container instead of pushing the close button off-axis. jsdom may
      // serialize the value as '0' or '0px' depending on the CSS source —
      // both are equivalent.
      const contentStyle = window.getComputedStyle(content)
      expect(contentStyle.minWidth).toMatch(/^0(?:px)?$/)
    })

    it('block + closable: same flex contract (flex-shrink: 0 on close button)', () => {
      // Block variant should benefit from the same robust layout, so the
      // contract is uniform and future regressions are easier to catch.
      const { container } = render(
        <div style={{ width: 320 }}>
          <Alert variant="warning" closable onClose={() => {}}>
            Block alert with a long enough message to wrap on narrow widths
          </Alert>
        </div>
      )
      const closeBtn = container.querySelector(
        'button[aria-label="Close alert"]'
      ) as HTMLButtonElement
      expect(closeBtn).toBeInTheDocument()
      const closeStyle = window.getComputedStyle(closeBtn)
      expect(closeStyle.flexShrink).toBe('0')
    })
  })
})

// ===== Consumer passthrough contract (#423) =====
// AlertProps extends React.HTMLAttributes<HTMLDivElement>: a consumer
// `data-testid` and `style` land on the visual root (the `role="alert"`
// div), while the internal `role`/`aria-live` are applied AFTER `{...rest}`
// so the a11y contract always wins over a conflicting consumer prop.
describe('Alert — consumer passthrough (#423)', () => {
  it('lands consumer data-testid on the visual root', () => {
    render(<Alert data-testid="my-alert">Body</Alert>)
    const el = screen.getByTestId('my-alert')
    expect(el.tagName).toBe('DIV')
    expect(el).toContainElement(screen.getByText('Body'))
  })

  it('applies consumer style to the visual root', () => {
    render(
      <Alert data-testid="my-alert" style={{ color: 'rgb(1, 2, 3)' }}>
        Body
      </Alert>
    )
    expect(screen.getByTestId('my-alert')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('keeps internal role="alert" even when consumer passes a conflicting role', () => {
    render(
      <Alert data-testid="my-alert" role="status">
        Body
      </Alert>
    )
    // role is applied AFTER {...rest}, so the internal ARIA role survives.
    expect(screen.getByTestId('my-alert')).toHaveAttribute('role', 'alert')
  })
})
