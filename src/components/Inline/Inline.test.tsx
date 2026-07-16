/**
 * Inline Component Tests
 *
 * Covers the horizontal flex layout primitive:
 * - child rendering
 * - gap/align/justify/wrap props emit CSS Module classes
 * - polymorphic `as` prop swaps the DOM element
 * - forwardRef targets the rendered root
 * - className is merged
 */

import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Inline } from './Inline'

function classAttr(el: ChildNode | null): string {
  if (!el || !(el instanceof HTMLElement)) return ''
  return el.getAttribute('class') ?? ''
}

describe('Inline', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Inline>
        <span>left</span>
        <span>right</span>
      </Inline>
    )
    expect(getByText('left')).toBeInTheDocument()
    expect(getByText('right')).toBeInTheDocument()
  })

  it('applies default gap=md, align=center, justify=start classes', () => {
    const { container } = render(<Inline>content</Inline>)
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/gap-md/)
    expect(cls).toMatch(/align-center/)
    expect(cls).toMatch(/justify-start/)
  })

  it('applies align variants including baseline', () => {
    const { container } = render(
      <Inline align="baseline">content</Inline>
    )
    expect(classAttr(container.firstChild)).toMatch(/align-baseline/)
  })

  it('applies justify variants', () => {
    const { container } = render(
      <Inline justify="between">content</Inline>
    )
    expect(classAttr(container.firstChild)).toMatch(/justify-between/)
  })

  it('applies wrap class when enabled', () => {
    const { container } = render(<Inline wrap>content</Inline>)
    expect(classAttr(container.firstChild)).toMatch(/wrap/)
  })

  it('renders as div by default and swaps to span/nav via as prop', () => {
    const { container: divContainer } = render(<Inline>c</Inline>)
    expect((divContainer.firstChild as HTMLElement).tagName).toBe('DIV')

    const { container: spanContainer } = render(<Inline as="span">c</Inline>)
    expect((spanContainer.firstChild as HTMLElement).tagName).toBe('SPAN')

    const { container: navContainer } = render(<Inline as="nav">c</Inline>)
    expect((navContainer.firstChild as HTMLElement).tagName).toBe('NAV')
  })

  it('forwards ref to the outer element', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Inline ref={ref}>content</Inline>)
    expect(ref.current).not.toBeNull()
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('merges className with internal classes', () => {
    const { container } = render(<Inline className="my-class">c</Inline>)
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/my-class/)
    expect(cls).toMatch(/inline/)
  })

  it('applies inline style prop', () => {
    const { container } = render(
      <Inline style={{ marginTop: '8px' }}>content</Inline>
    )
    expect((container.firstChild as HTMLElement).style.marginTop).toBe('8px')
  })

  // #326 — Inline extends HTMLAttributes<HTMLElement> and spreads `...rest`
  // so consumers can attach aria-*, data-*, id, role, and event handlers.
  describe('rest props pass-through (#326)', () => {
    it('forwards data-testid, aria-label, id, role to the root', () => {
      render(
        <Inline
          data-testid="probe"
          aria-label="my-label"
          id="my-id"
          role="toolbar"
        >
          content
        </Inline>
      )
      const el = screen.getByTestId('probe')
      expect(el).toHaveAttribute('aria-label', 'my-label')
      expect(el).toHaveAttribute('id', 'my-id')
      expect(el).toHaveAttribute('role', 'toolbar')
    })

    it('forwards onClick to the root', () => {
      const handleClick = vi.fn()
      render(
        <Inline data-testid="probe" onClick={handleClick}>
          content
        </Inline>
      )
      fireEvent.click(screen.getByTestId('probe'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  // #374 — `gap` accepts raw CSS-length values alongside the keyword shortcuts.
  describe('gap escape hatch (#374)', () => {
    it('emits gap as `<n>px` inline style when a number is passed', () => {
      const { container } = render(<Inline gap={6}>content</Inline>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gap).toBe('6px')
      expect(classAttr(el)).not.toMatch(/gap-(none|xs|sm|md|lg|xl|2xl)/)
    })

    it('emits gap verbatim when a string value is passed', () => {
      const { container } = render(<Inline gap="1.25rem">content</Inline>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gap).toBe('1.25rem')
    })

    it('still uses the keyword path for token values', () => {
      const { container } = render(<Inline gap="lg">content</Inline>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gap).toBe('')
      expect(classAttr(el)).toMatch(/gap-lg/)
    })
  })

  // #374 — `grow` resolves to a `flex` shorthand.
  describe('grow prop (#374)', () => {
    it('emits flex: 1 1 auto when grow={true}', () => {
      const { container } = render(<Inline grow>content</Inline>)
      const el = container.firstChild as HTMLElement
      expect(el.style.flex).toBe('1 1 auto')
    })

    it('emits flex: <n> 1 auto when grow is a number', () => {
      const { container } = render(<Inline grow={4}>content</Inline>)
      const el = container.firstChild as HTMLElement
      expect(el.style.flex).toBe('4 1 auto')
    })

    it('does not emit flex when grow is omitted', () => {
      const { container } = render(<Inline>content</Inline>)
      expect((container.firstChild as HTMLElement).style.flex).toBe('')
    })
  })
})
