/**
 * Mark Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Mark } from './Mark'

describe('Mark', () => {
  it('renders its children', () => {
    render(<Mark>highlight</Mark>)
    expect(screen.getByText('highlight')).toBeInTheDocument()
  })

  it('renders a semantic <mark> element', () => {
    const { container } = render(<Mark>x</Mark>)
    expect(container.querySelector('mark')).not.toBeNull()
  })

  it('forwards additional className', () => {
    render(
      <Mark className="extra" data-testid="m">
        x
      </Mark>,
    )
    expect(screen.getByTestId('m').className).toMatch(/extra/)
  })

  // #424 — Layer-7 polymorphism via asChild.
  it('asChild renders the child element carrying the Mark root class + forwarded className/style', () => {
    render(
      <Mark asChild className="extra" style={{ color: 'rgb(1, 2, 3)' }}>
        <span data-testid="x">flagged</span>
      </Mark>,
    )
    const el = screen.getByTestId('x')
    expect(el.tagName).toBe('SPAN')
    expect(el.className).toMatch(/mark/)
    expect(el.className).toMatch(/extra/)
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    // No standalone <mark> element should be emitted.
    expect(document.querySelector('mark')).toBeNull()
  })
})
