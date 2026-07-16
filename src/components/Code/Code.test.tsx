/**
 * Code Component Tests — inline variant.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Code } from './Code'

describe('Code (inline)', () => {
  it('renders its children', () => {
    render(<Code>npm install</Code>)
    expect(screen.getByText('npm install')).toBeInTheDocument()
  })

  it('uses a semantic <code> element', () => {
    const { container } = render(<Code>x</Code>)
    expect(container.querySelector('code')).not.toBeNull()
  })

  it('forwards extra props (e.g. className) to the <code> root', () => {
    render(<Code className="extra" data-testid="c">x</Code>)
    expect(screen.getByTestId('c').className).toMatch(/extra/)
  })

  // #424 — Layer-7 polymorphism via asChild.
  it('asChild renders the child element carrying the Code root class + forwarded className/style', () => {
    render(
      <Code asChild className="extra" style={{ color: 'rgb(1, 2, 3)' }}>
        <a href="/api" data-testid="x">
          GET /api
        </a>
      </Code>,
    )
    const el = screen.getByTestId('x')
    // Renders as the anchor, not a <code>-wrapped anchor.
    expect(el.tagName).toBe('A')
    expect(el).toHaveAttribute('href', '/api')
    expect(el.className).toMatch(/code/)
    expect(el.className).toMatch(/extra/)
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    // No standalone <code> element should be emitted.
    expect(document.querySelector('code')).toBeNull()
  })
})
