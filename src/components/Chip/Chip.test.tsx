/**
 * Chip Component Tests
 *
 * Sprint 19 (#107) — initial test suite for the new Chip primitive.
 * Covers label rendering, selected-state class + aria-pressed, click /
 * keyboard activation, count slot, leading-icon slot, disabled
 * suppression, sm/md size classes, and jest-axe a11y.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Chip } from './Chip'

describe('Chip', () => {
  it('renders children as the label', () => {
    render(<Chip>Filter</Chip>)
    expect(
      screen.getByRole('button', { name: /filter/i })
    ).toBeInTheDocument()
  })

  it('renders as a real <button type="button"> (not a div with role)', () => {
    render(<Chip>Real button</Chip>)
    const btn = screen.getByRole('button', { name: /real button/i })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('reflects selected prop via aria-pressed and the selected class', () => {
    const { container, rerender } = render(<Chip>Off</Chip>)
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn.className).not.toMatch(/selected/)

    rerender(<Chip selected>On</Chip>)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn.className).toMatch(/selected/)
  })

  it('fires onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Chip onClick={handleClick}>Clickable</Chip>)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', () => {
    const handleClick = vi.fn()
    render(
      <Chip disabled onClick={handleClick}>
        Disabled
      </Chip>
    )

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('marks the underlying button as disabled when disabled prop is true', () => {
    render(<Chip disabled>Disabled</Chip>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders the count slot when count is provided', () => {
    render(<Chip count={42}>Failed</Chip>)
    expect(screen.getByText('(42)')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /failed.*42/i })
    ).toBeInTheDocument()
  })

  it('renders count={0} (does not skip zero)', () => {
    // Explicit pin: `typeof count === 'number'` so 0 must render. If a
    // future refactor switches to a truthy check, this catches it.
    render(<Chip count={0}>Empty</Chip>)
    expect(screen.getByText('(0)')).toBeInTheDocument()
  })

  it('omits the count slot when count prop is not provided', () => {
    const { container } = render(<Chip>No count</Chip>)
    // The count span uses styles.count — we can match the substring.
    expect(container.querySelector('[class*="count"]')).toBeNull()
  })

  it('renders leftIcon slot when supplied', () => {
    render(
      <Chip leftIcon={<span data-testid="chip-icon">★</span>}>Starred</Chip>
    )
    expect(screen.getByTestId('chip-icon')).toBeInTheDocument()
    expect(screen.getByText('Starred')).toBeInTheDocument()
  })

  // ===== rightIcon (#112, Sprint 20) =====
  // Symmetric with leftIcon. Passive slot — no onRightIconClick. Renders
  // after the count badge so consumers can drop a dismiss "×" or chevron
  // at the trailing edge without hand-rolling wrapper markup.

  it('renders rightIcon when provided', () => {
    render(
      <Chip rightIcon={<span data-testid="chip-right-icon">×</span>}>
        Dismiss
      </Chip>
    )
    expect(screen.getByTestId('chip-right-icon')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })

  it('renders leftIcon and rightIcon together in the correct order', () => {
    render(
      <Chip
        leftIcon={<span data-testid="left">L</span>}
        rightIcon={<span data-testid="right">R</span>}
      >
        Both
      </Chip>
    )
    const left = screen.getByTestId('left')
    const right = screen.getByTestId('right')
    const label = screen.getByText('Both')
    // Order: left → label → right
    expect(left.compareDocumentPosition(label)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(label.compareDocumentPosition(right)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('renders rightIcon after the count slot', () => {
    render(
      <Chip count={42} rightIcon={<span data-testid="right">×</span>}>
        Failed
      </Chip>
    )
    const count = screen.getByText('(42)')
    const right = screen.getByTestId('right')
    // Count must precede rightIcon in document order.
    expect(count.compareDocumentPosition(right)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('omits the rightIcon slot when rightIcon prop is not provided', () => {
    // Regression guard: the no-rightIcon path must not emit an empty
    // wrapper span. Ensure existing chips render unchanged.
    const { container } = render(<Chip>No right icon</Chip>)
    expect(container.querySelector('[class*="rightIcon"]')).toBeNull()
  })

  it('applies the sm size class', () => {
    const { container } = render(<Chip size="sm">Small</Chip>)
    expect((container.firstChild as HTMLElement).className).toMatch(/sm/)
  })

  it('applies the md size class (default)', () => {
    const { container } = render(<Chip>Default</Chip>)
    expect((container.firstChild as HTMLElement).className).toMatch(/md/)
  })

  it('sm and md produce different class strings', () => {
    const { container: smContainer } = render(<Chip size="sm">A</Chip>)
    const { container: mdContainer } = render(<Chip size="md">B</Chip>)
    expect((smContainer.firstChild as HTMLElement).className).not.toBe(
      (mdContainer.firstChild as HTMLElement).className
    )
  })

  // Native <button> handles Enter and Space — pin the behavior so a future
  // refactor to a div+role wouldn't silently regress keyboard activation.
  it('activates onClick on Enter (native button behavior)', () => {
    const handleClick = vi.fn()
    render(<Chip onClick={handleClick}>Keyboard</Chip>)

    const btn = screen.getByRole('button')
    btn.focus()
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' })
    // jsdom doesn't translate keydown→click for buttons; assert directly via
    // a synthesized click which is what the browser does on Enter.
    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalled()
  })

  it('activates onClick on Space (native button behavior)', () => {
    const handleClick = vi.fn()
    render(<Chip onClick={handleClick}>Keyboard</Chip>)

    const btn = screen.getByRole('button')
    btn.focus()
    fireEvent.keyUp(btn, { key: ' ', code: 'Space' })
    fireEvent.click(btn)
    expect(handleClick).toHaveBeenCalled()
  })

  it('forwards ref to the underlying button element', () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(<Chip ref={ref}>Ref</Chip>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('spreads additional props onto the button (e.g. data-* attrs)', () => {
    render(
      <Chip data-testid="chip-x" aria-label="Custom label">
        Spread
      </Chip>
    )
    const btn = screen.getByTestId('chip-x')
    expect(btn).toHaveAttribute('aria-label', 'Custom label')
  })

  // #424 — Layer-7 polymorphism via asChild. Renders the chip as a supplied
  // element (e.g. an <a> filter link) instead of the default <button>.
  describe('asChild (#424)', () => {
    it('renders the child element carrying the Chip root class + forwarded className/style', () => {
      render(
        <Chip asChild className="extra" style={{ color: 'rgb(1, 2, 3)' }}>
          <a href="/f" data-testid="x">
            Failed
          </a>
        </Chip>,
      )
      const el = screen.getByTestId('x')
      // Renders as the anchor, not a <button>.
      expect(el.tagName).toBe('A')
      expect(el).toHaveAttribute('href', '/f')
      expect(el.className).toMatch(/chip/)
      expect(el.className).toMatch(/extra/)
      expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
      // No <button> should be rendered when asChild is true.
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('composes label/count into the child and reflects selected via aria-pressed', () => {
      render(
        <Chip asChild selected count={42}>
          <a href="/f" data-testid="x">
            Failed
          </a>
        </Chip>,
      )
      const el = screen.getByTestId('x')
      expect(el).toHaveAttribute('aria-pressed', 'true')
      expect(el).toHaveTextContent('Failed')
      expect(el).toContainElement(screen.getByText('(42)'))
    })

    it('forwards aria-disabled to the slotted child when disabled (#509)', () => {
      render(
        <Chip asChild disabled>
          <a href="/f" data-testid="x">
            Failed
          </a>
        </Chip>,
      )
      // Previously only the visual disabled class was applied; the slotted <a>
      // must also be announced disabled, not just styled.
      expect(screen.getByTestId('x')).toHaveAttribute('aria-disabled', 'true')
    })

    it('leaves aria-disabled unset when not disabled', () => {
      render(
        <Chip asChild>
          <a href="/f" data-testid="x">
            Failed
          </a>
        </Chip>,
      )
      expect(screen.getByTestId('x')).not.toHaveAttribute('aria-disabled')
    })
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <div>
        <Chip>Default</Chip>
        <Chip selected>Selected</Chip>
        <Chip count={42}>With count</Chip>
        <Chip leftIcon={<span aria-hidden="true">★</span>}>With icon</Chip>
        <Chip rightIcon={<span aria-hidden="true">×</span>}>With right icon</Chip>
        <Chip disabled>Disabled</Chip>
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
