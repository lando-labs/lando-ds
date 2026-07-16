/**
 * Stack Component Tests
 *
 * Covers the vertical flex layout primitive:
 * - child rendering
 * - gap/align/justify/wrap/fullWidth props emit CSS Module classes
 * - polymorphic `as` prop swaps the DOM element
 * - forwardRef targets the rendered root
 * - className is merged (not replaced)
 *
 * CSS Modules hash class names at build time, so we assert on the
 * unhashed substring suffix the CSS Modules plugin preserves (e.g.
 * `gap-md` → `_stack-module_gap-md_<hash>`).
 */

import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Stack } from './Stack'

function classAttr(el: ChildNode | null): string {
  if (!el || !(el instanceof HTMLElement)) return ''
  return el.getAttribute('class') ?? ''
}

describe('Stack', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Stack>
        <span>item a</span>
        <span>item b</span>
      </Stack>
    )
    expect(getByText('item a')).toBeInTheDocument()
    expect(getByText('item b')).toBeInTheDocument()
  })

  it('applies default gap=md, align=stretch, justify=start classes', () => {
    const { container } = render(<Stack>content</Stack>)
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/gap-md/)
    expect(cls).toMatch(/align-stretch/)
    expect(cls).toMatch(/justify-start/)
  })

  it('applies gap class for each supported size', () => {
    const gaps = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
    for (const gap of gaps) {
      const { container } = render(<Stack gap={gap}>content</Stack>)
      expect(classAttr(container.firstChild)).toMatch(new RegExp(`gap-${gap}`))
    }
  })

  it('applies align and justify classes', () => {
    const { container } = render(
      <Stack align="center" justify="between">
        content
      </Stack>
    )
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/align-center/)
    expect(cls).toMatch(/justify-between/)
  })

  it('applies wrap and fullWidth classes when enabled', () => {
    const { container } = render(
      <Stack wrap fullWidth>
        content
      </Stack>
    )
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/wrap/)
    expect(cls).toMatch(/fullWidth/)
  })

  it('renders as div by default and swaps to other elements via as prop', () => {
    const { container: divContainer } = render(<Stack>c</Stack>)
    expect((divContainer.firstChild as HTMLElement).tagName).toBe('DIV')

    const { container: sectionContainer } = render(<Stack as="section">c</Stack>)
    expect((sectionContainer.firstChild as HTMLElement).tagName).toBe('SECTION')

    const { container: navContainer } = render(<Stack as="nav">c</Stack>)
    expect((navContainer.firstChild as HTMLElement).tagName).toBe('NAV')
  })

  it('forwards ref to the outer element', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Stack ref={ref}>content</Stack>)
    expect(ref.current).not.toBeNull()
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('merges className with internal classes (does not replace)', () => {
    const { container } = render(<Stack className="custom-class">c</Stack>)
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/custom-class/)
    // internal stack class still present
    expect(cls).toMatch(/stack/)
  })

  it('applies inline style prop', () => {
    const { container } = render(
      <Stack style={{ padding: '12px' }}>content</Stack>
    )
    expect((container.firstChild as HTMLElement).style.padding).toBe('12px')
  })

  // #326 — Stack extends HTMLAttributes<HTMLElement> and spreads `...rest`
  // so consumers can attach aria-*, data-*, id, role, and event handlers.
  describe('rest props pass-through (#326)', () => {
    it('forwards data-testid, aria-label, id, role to the root', () => {
      render(
        <Stack
          data-testid="probe"
          aria-label="my-label"
          id="my-id"
          role="group"
        >
          content
        </Stack>
      )
      const el = screen.getByTestId('probe')
      expect(el).toHaveAttribute('aria-label', 'my-label')
      expect(el).toHaveAttribute('id', 'my-id')
      expect(el).toHaveAttribute('role', 'group')
    })

    it('forwards onClick to the root', () => {
      const handleClick = vi.fn()
      render(
        <Stack data-testid="probe" onClick={handleClick}>
          content
        </Stack>
      )
      fireEvent.click(screen.getByTestId('probe'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  // #374 — `gap` accepts raw CSS-length values alongside the keyword shortcuts.
  describe('gap escape hatch (#374)', () => {
    it('emits gap as `<n>px` inline style when a number is passed', () => {
      const { container } = render(<Stack gap={8}>content</Stack>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gap).toBe('8px')
      // Keyword class should NOT be applied alongside the inline gap.
      expect(classAttr(el)).not.toMatch(/gap-(none|xs|sm|md|lg|xl|2xl)/)
    })

    it('emits gap verbatim when a string value is passed', () => {
      const { container } = render(<Stack gap="0.5rem">content</Stack>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gap).toBe('0.5rem')
    })

    it('forwards CSS variable references unchanged', () => {
      const { container } = render(
        <Stack gap="var(--spacing-3)">content</Stack>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gap).toBe('var(--spacing-3)')
    })

    it('still uses the keyword path (no inline style) for token values', () => {
      const { container } = render(<Stack gap="md">content</Stack>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gap).toBe('')
      expect(classAttr(el)).toMatch(/gap-md/)
    })
  })

  // #374 — `grow` resolves to a `flex` shorthand so a Stack can fill space
  // when it's itself a child of a flex parent.
  describe('grow prop (#374)', () => {
    it('emits flex: 1 1 auto when grow={true}', () => {
      const { container } = render(<Stack grow>content</Stack>)
      const el = container.firstChild as HTMLElement
      expect(el.style.flex).toBe('1 1 auto')
    })

    it('emits flex: <n> 1 auto when grow is a number', () => {
      const { container } = render(<Stack grow={2}>content</Stack>)
      const el = container.firstChild as HTMLElement
      expect(el.style.flex).toBe('2 1 auto')
    })

    it('does not emit flex when grow is omitted or zero', () => {
      const { container: c1 } = render(<Stack>content</Stack>)
      expect((c1.firstChild as HTMLElement).style.flex).toBe('')

      const { container: c2 } = render(<Stack grow={0}>c</Stack>)
      expect((c2.firstChild as HTMLElement).style.flex).toBe('')
    })
  })
})
