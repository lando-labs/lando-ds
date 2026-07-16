/**
 * Heading Component Tests
 *
 * Covers semantic Heading with independent visual sizing:
 * - default renders h2 (level default is 2)
 * - level={1..6} prop renders matching semantic tag
 * - size prop is independent of level
 * - weight prop applies weight class
 * - color prop applies inline CSS color
 * - variant="section" applies the section-header treatment
 * - section variant stays independent of semantic level
 * - forwardRef targets the heading element
 * - HTML attributes pass through
 */

import { createRef } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Heading } from './Heading'

function classAttr(el: ChildNode | null): string {
  if (!el || !(el instanceof HTMLElement)) return ''
  return el.getAttribute('class') ?? ''
}

describe('Heading', () => {
  it('renders with semantic h2 by default', () => {
    const { container } = render(<Heading>Section Title</Heading>)
    const el = container.firstChild as HTMLElement
    expect(el.tagName).toBe('H2')
    expect(el.textContent).toBe('Section Title')
  })

  it('renders h1 through h6 via level prop', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const { container } = render(
        <Heading level={level}>Title {level}</Heading>
      )
      const el = container.firstChild as HTMLElement
      expect(el.tagName).toBe(`H${level}`)
    }
  })

  it('applies size prop independently of semantic level', () => {
    // h2 semantic with xs visual size
    const { container } = render(
      <Heading level={2} size="xs">
        Small Heading
      </Heading>
    )
    const el = container.firstChild as HTMLElement
    expect(el.tagName).toBe('H2')
    expect(classAttr(el)).toMatch(/size-xs/)
  })

  it('falls back to level-derived default size when size prop omitted', () => {
    const { container } = render(<Heading level={3}>Hello</Heading>)
    // level=3 default size is "lg"
    expect(classAttr(container.firstChild)).toMatch(/size-lg/)
  })

  it('applies weight class', () => {
    const weights = ['normal', 'medium', 'semibold', 'bold'] as const
    for (const weight of weights) {
      const { container } = render(
        <Heading weight={weight}>Title</Heading>
      )
      expect(classAttr(container.firstChild)).toMatch(
        new RegExp(`weight-${weight}`)
      )
    }
  })

  it('applies color via inline style', () => {
    const { container } = render(
      <Heading color="rgb(10, 20, 30)">Colored</Heading>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.color).toBe('rgb(10, 20, 30)')
  })

  it('defaults to the standard variant (no section class)', () => {
    const { container } = render(<Heading>Default</Heading>)
    expect(classAttr(container.firstChild)).not.toMatch(/variant-section/)
    expect(classAttr(container.firstChild)).toMatch(/size-/)
  })

  it('applies the section variant class when variant="section"', () => {
    const { container } = render(
      <Heading variant="section">Account</Heading>
    )
    expect(classAttr(container.firstChild)).toMatch(/variant-section/)
  })

  it('omits the size-* class for the section variant', () => {
    // The section variant carries its own fixed sizing, so it must not
    // also emit a size-* class that would compete with the variant.
    const { container } = render(
      <Heading variant="section" size="2xl">
        Section
      </Heading>
    )
    expect(classAttr(container.firstChild)).not.toMatch(/size-/)
  })

  it('keeps semantic level independent of the section variant', () => {
    // A section-styled label can still be any heading level for a
    // correct document outline.
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const { container } = render(
        <Heading level={level} variant="section">
          Label {level}
        </Heading>
      )
      const el = container.firstChild as HTMLElement
      expect(el.tagName).toBe(`H${level}`)
      expect(classAttr(el)).toMatch(/variant-section/)
    }
  })

  it('still applies an explicit weight on the section variant', () => {
    const { container } = render(
      <Heading variant="section" weight="bold">
        Bold Section
      </Heading>
    )
    expect(classAttr(container.firstChild)).toMatch(/weight-bold/)
  })

  it('forwards ref to the heading element', () => {
    const ref = createRef<HTMLHeadingElement>()
    render(
      <Heading level={1} ref={ref}>
        Title
      </Heading>
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('H1')
  })

  it('passes through HTML attributes (id, data-*, aria-*)', () => {
    render(
      <Heading
        level={1}
        id="page-title"
        data-testid="heading-root"
        aria-label="Welcome headline"
      >
        Welcome
      </Heading>
    )
    const el = screen.getByTestId('heading-root')
    expect(el.getAttribute('id')).toBe('page-title')
    expect(el.getAttribute('aria-label')).toBe('Welcome headline')
  })

  // #424 — Layer-7 polymorphism via asChild. Independent of `level`: the
  // child element replaces the h{level} tag while keeping visual styling.
  it('asChild renders the child element carrying the Heading root class + forwarded className/style', () => {
    render(
      <Heading asChild size="lg" className="extra" style={{ color: 'rgb(1, 2, 3)' }}>
        <a href="/foo" data-testid="x">
          Linked Heading
        </a>
      </Heading>,
    )
    const el = screen.getByTestId('x')
    // Renders as the anchor, not an h-tag wrapping an anchor.
    expect(el.tagName).toBe('A')
    expect(el).toHaveAttribute('href', '/foo')
    expect(el.className).toMatch(/heading/)
    expect(el.className).toMatch(/size-lg/)
    expect(el.className).toMatch(/extra/)
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    // No heading element should be emitted under asChild.
    expect(
      document.querySelector('h1, h2, h3, h4, h5, h6'),
    ).toBeNull()
  })
})
