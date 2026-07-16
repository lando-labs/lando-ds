/**
 * Spacer Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spacer } from './Spacer'

describe('Spacer', () => {
  it('renders a <span> root', () => {
    render(<Spacer data-testid="s" />)
    expect(screen.getByTestId('s').tagName).toBe('SPAN')
  })

  it('is aria-hidden so AT skips the empty element', () => {
    render(<Spacer data-testid="s" />)
    expect(screen.getByTestId('s')).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies horizontal class by default and vertical class on opt-in', () => {
    const { rerender } = render(<Spacer data-testid="s" />)
    expect(screen.getByTestId('s').className).toMatch(/horizontal/)
    rerender(<Spacer axis="vertical" data-testid="s" />)
    expect(screen.getByTestId('s').className).toMatch(/vertical/)
  })

  // #424 — Layer-7 polymorphism via asChild.
  it('asChild renders the child element carrying the Spacer root class + forwarded className/style', () => {
    render(
      <Spacer asChild className="extra" style={{ flex: '2 2 auto' }}>
        <div data-testid="x" />
      </Spacer>,
    )
    const el = screen.getByTestId('x')
    expect(el.tagName).toBe('DIV')
    expect(el.className).toMatch(/spacer/)
    expect(el.className).toMatch(/extra/)
    expect(el).toHaveStyle({ flex: '2 2 auto' })
    // aria-hidden still lands on the child so AT skips the spacer.
    expect(el).toHaveAttribute('aria-hidden', 'true')
    // No standalone <span> spacer should be emitted.
    expect(document.querySelector('span')).toBeNull()
  })
})
