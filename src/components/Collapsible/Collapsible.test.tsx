/**
 * Collapsible Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Collapsible } from './Collapsible'

describe('Collapsible', () => {
  it('renders its children into the DOM (open or closed)', () => {
    render(<Collapsible defaultOpen>visible</Collapsible>)
    expect(screen.getByText('visible')).toBeInTheDocument()
  })

  it('closed state marks the content region aria-hidden', () => {
    render(<Collapsible>hidden body</Collapsible>)
    expect(screen.getByText('hidden body').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('open state exposes data-state="open"', () => {
    render(<Collapsible defaultOpen>x</Collapsible>)
    expect(screen.getByText('x').parentElement).toHaveAttribute(
      'data-state',
      'open',
    )
  })

  it('respects the controlled `open` prop', () => {
    const { rerender } = render(
      <Collapsible open={false}>controlled body</Collapsible>,
    )
    expect(
      screen.getByText('controlled body').parentElement,
    ).toHaveAttribute('data-state', 'closed')

    rerender(<Collapsible open>controlled body</Collapsible>)
    expect(
      screen.getByText('controlled body').parentElement,
    ).toHaveAttribute('data-state', 'open')
  })
})

describe('Collapsible — consumer passthrough (#422)', () => {
  it('lands consumer data-testid on the container visual root', () => {
    render(
      <Collapsible data-testid="collapsible-root" defaultOpen>
        body
      </Collapsible>,
    )
    const el = screen.getByTestId('collapsible-root')
    expect(el.tagName).toBe('DIV')
    // root is the OUTERMOST element — the body text lives inside it
    expect(el).toContainElement(screen.getByText('body'))
  })

  it('applies consumer style to the container visual root', () => {
    render(
      <Collapsible data-testid="collapsible-root" style={{ color: 'rgb(1, 2, 3)' }}>
        body
      </Collapsible>,
    )
    expect(screen.getByTestId('collapsible-root')).toHaveStyle({
      color: 'rgb(1, 2, 3)',
    })
  })
})
