/**
 * Container Component Tests
 *
 * Covers the polymorphic responsive container:
 * - child rendering
 * - size/padding/centered props emit CSS Module classes
 * - polymorphic `as` prop swaps element (div default, section/article/main supported)
 * - forwardRef forwards through polymorphic type
 * - passes through HTML attributes (spread via ...rest)
 * - className is merged with internal classes
 */

import { createRef } from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Container } from './Container'

function classAttr(el: ChildNode | null): string {
  if (!el || !(el instanceof HTMLElement)) return ''
  return el.getAttribute('class') ?? ''
}

describe('Container', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Container>
        <span>content</span>
      </Container>
    )
    expect(getByText('content')).toBeInTheDocument()
  })

  it('applies default size=lg, padding, and centered classes', () => {
    const { container } = render(<Container>content</Container>)
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/lg/)
    expect(cls).toMatch(/padding/)
    expect(cls).toMatch(/centered/)
  })

  it('applies each size variant', () => {
    const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const
    for (const size of sizes) {
      const { container } = render(
        <Container size={size}>content</Container>
      )
      expect(classAttr(container.firstChild)).toMatch(new RegExp(size))
    }
  })

  it('omits padding class when padding={false}', () => {
    const { container } = render(
      <Container padding={false}>content</Container>
    )
    expect(classAttr(container.firstChild)).not.toMatch(/padding/)
  })

  it('omits centered class when centered={false}', () => {
    const { container } = render(
      <Container centered={false}>content</Container>
    )
    expect(classAttr(container.firstChild)).not.toMatch(/centered/)
  })

  it('renders as div by default', () => {
    const { container } = render(<Container>c</Container>)
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV')
  })

  it('renders as polymorphic element via as prop (section/article/main)', () => {
    const { container: sectionContainer } = render(
      <Container as="section">c</Container>
    )
    expect((sectionContainer.firstChild as HTMLElement).tagName).toBe('SECTION')

    const { container: articleContainer } = render(
      <Container as="article">c</Container>
    )
    expect((articleContainer.firstChild as HTMLElement).tagName).toBe('ARTICLE')

    const { container: mainContainer } = render(
      <Container as="main">c</Container>
    )
    expect((mainContainer.firstChild as HTMLElement).tagName).toBe('MAIN')
  })

  it('forwards ref to the rendered element', () => {
    const ref = createRef<HTMLDivElement>()
    render(<Container ref={ref}>content</Container>)
    expect(ref.current).not.toBeNull()
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('passes through HTML attributes (data-*, aria-*, id)', () => {
    const { container } = render(
      <Container
        id="page-wrap"
        data-testid="container-root"
        aria-label="Main page container"
      >
        content
      </Container>
    )
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('id')).toBe('page-wrap')
    expect(el.getAttribute('data-testid')).toBe('container-root')
    expect(el.getAttribute('aria-label')).toBe('Main page container')
  })

  it('merges className with internal classes', () => {
    const { container } = render(
      <Container className="my-wrapper">c</Container>
    )
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/my-wrapper/)
    expect(cls).toMatch(/container/)
  })
})
