/**
 * Callout Component Tests
 *
 * Behavioral coverage for Callout:
 * - renders children
 * - applies accent class for each of the six variants
 * - renders label slot with uppercase styling class
 * - renders without label / without icon (no extra wrappers)
 * - renders icon slot when provided
 * - polymorphic `as` (default `div`, `blockquote`, `aside`)
 * - forwards ref to the rendered element
 * - axe a11y smoke check on each accent variant
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Callout, type CalloutAccent } from './Callout'

expect.extend(toHaveNoViolations)

const ACCENTS: CalloutAccent[] = [
  'primary',
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
]

describe('Callout', () => {
  it('renders children content', () => {
    render(<Callout>My take on this article</Callout>)
    expect(screen.getByText('My take on this article')).toBeInTheDocument()
  })

  it('renders with default accent (primary) when none specified', () => {
    const { container } = render(<Callout>Body</Callout>)
    expect((container.firstChild as HTMLElement).className).toMatch(
      /accent-primary/
    )
  })

  it.each(ACCENTS)('applies accent class for variant=%s', (accent) => {
    const { container } = render(<Callout accent={accent}>Body</Callout>)
    expect((container.firstChild as HTMLElement).className).toMatch(
      new RegExp(`accent-${accent}`)
    )
  })

  it('renders without a label when none provided', () => {
    const { container } = render(<Callout>Just the body</Callout>)
    // No label element should be rendered.
    expect(container.querySelector('[class*="label"]')).toBeNull()
  })

  it('renders without an icon when none provided', () => {
    const { container } = render(<Callout>Just the body</Callout>)
    // No icon slot wrapper should be present.
    expect(container.querySelector('[class*="iconSlot"]')).toBeNull()
    expect(container.querySelector('[class*="layout"]')).toBeNull()
  })

  it('renders the label and applies the uppercase label class', () => {
    const { container } = render(
      <Callout accent="primary" label="MY TAKE">
        body
      </Callout>
    )
    const label = container.querySelector('[class*="label"]') as HTMLElement
    expect(label).toBeTruthy()
    expect(label.textContent).toBe('MY TAKE')
    // CSS Modules hash, but the source name should still appear.
    expect(label.className).toMatch(/label/)
  })

  it('renders the icon slot when an icon is provided', () => {
    render(
      <Callout
        accent="info"
        label="HEADS UP"
        icon={<span data-testid="callout-icon">i</span>}
      >
        Body
      </Callout>
    )
    expect(screen.getByTestId('callout-icon')).toBeInTheDocument()
  })

  it('marks the icon slot as decorative (aria-hidden)', () => {
    const { container } = render(
      <Callout icon={<span data-testid="callout-icon">i</span>}>
        Body
      </Callout>
    )
    const iconSlot = container.querySelector('[class*="iconSlot"]')
    expect(iconSlot).toBeTruthy()
    expect(iconSlot?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders as a <div> by default', () => {
    const { container } = render(<Callout>Body</Callout>)
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV')
  })

  it('renders as a <blockquote> when as="blockquote"', () => {
    const { container } = render(
      <Callout as="blockquote" accent="neutral">
        "The ocean is enough for me."
      </Callout>
    )
    expect((container.firstChild as HTMLElement).tagName).toBe('BLOCKQUOTE')
  })

  it('renders as an <aside> when as="aside" (sanity check on polymorphism)', () => {
    const { container } = render(
      <Callout as="aside" accent="info">
        Sidebar annotation
      </Callout>
    )
    expect((container.firstChild as HTMLElement).tagName).toBe('ASIDE')
  })

  it('forwards a ref to the rendered element', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<Callout ref={ref}>Body</Callout>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('forwards a ref correctly when as="blockquote"', () => {
    const ref = React.createRef<HTMLQuoteElement>()
    render(
      <Callout as="blockquote" ref={ref}>
        Body
      </Callout>
    )
    expect(ref.current?.tagName).toBe('BLOCKQUOTE')
  })

  it('merges className onto the root element', () => {
    const { container } = render(
      <Callout className="extra-class">Body</Callout>
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toMatch(/extra-class/)
    // Built-in classes still present.
    expect(root.className).toMatch(/callout/)
    expect(root.className).toMatch(/accent-primary/)
  })

  it('merges inline style onto the root element', () => {
    const { container } = render(
      <Callout style={{ marginTop: '12px' }}>Body</Callout>
    )
    expect((container.firstChild as HTMLElement).style.marginTop).toBe('12px')
  })

  it.each(ACCENTS)(
    'has no a11y violations for accent=%s (axe smoke)',
    async (accent) => {
      const { container } = render(
        <Callout
          accent={accent}
          label="LABEL"
          icon={<span aria-hidden="true">i</span>}
        >
          Accessible body content for the {accent} accent.
        </Callout>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    }
  )
})
