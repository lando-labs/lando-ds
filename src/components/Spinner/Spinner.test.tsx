/**
 * Spinner Component Tests
 *
 * Covers:
 * - renders with default size
 * - role="status" with aria-label (defaults + custom)
 * - size variant class
 * - color variant class
 * - label rendering as text when provided
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from './Spinner'

describe('Spinner', () => {
  it('renders with role="status"', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('defaults aria-label to "Loading" when no label provided', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading')
  })

  it('uses the provided label as aria-label', () => {
    render(<Spinner label="Saving..." />)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Saving...'
    )
  })

  it('renders visible label text when label is provided', () => {
    render(<Spinner label="Loading data" />)
    expect(screen.getByText('Loading data')).toBeInTheDocument()
  })

  it.each(['xs', 'sm', 'md', 'lg', 'xl'] as const)(
    'applies size class for %s',
    (size) => {
      const { container } = render(<Spinner size={size} />)
      const svg = container.querySelector('svg')
      expect(svg?.className.baseVal || svg?.getAttribute('class') || '').toMatch(
        new RegExp(size)
      )
    }
  )

  it.each(['primary', 'secondary', 'success', 'warning', 'error'] as const)(
    'applies color class for %s',
    (color) => {
      const { container } = render(<Spinner color={color} />)
      const svg = container.querySelector('svg')
      expect(svg?.className.baseVal || svg?.getAttribute('class') || '').toMatch(
        new RegExp(color)
      )
    }
  )

  it('renders an SVG indicator', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  // #422 — consumer className / style / testid land on the VISUAL ROOT (the
  // outer `.spinnerContainer` div carrying role="status"), NOT the inner <svg>.
  it('routes data-testid to the visual root (the status container, not the svg)', () => {
    render(<Spinner data-testid="spin" />)
    const root = screen.getByTestId('spin')
    expect(root).toBe(screen.getByRole('status'))
    expect(root.tagName).toBe('DIV')
    // The svg is a child of the root, not the testid target.
    expect(root.querySelector('svg')).toBeInTheDocument()
  })

  it('applies consumer className to the visual root, not the svg', () => {
    const { container } = render(<Spinner className="custom-cls" />)
    expect(screen.getByRole('status')).toHaveClass('custom-cls')
    expect(container.querySelector('svg')).not.toHaveClass('custom-cls')
  })

  it('consumer inline style wins on the visual root', () => {
    render(<Spinner style={{ color: 'rgb(1, 2, 3)' }} data-testid="spin" />)
    expect(screen.getByTestId('spin')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('svgClassName escape hatch still targets the inner svg', () => {
    const { container } = render(<Spinner svgClassName="svg-cls" />)
    expect(container.querySelector('svg')).toHaveClass('svg-cls')
    // Main className path stays on the root, so the svg only has svgClassName.
    expect(screen.getByRole('status')).not.toHaveClass('svg-cls')
  })

  it('keeps role="status" even if a consumer passes their own role', () => {
    render(<Spinner role="presentation" data-testid="spin-root" />)
    // The status live-region role is a contract — it must survive consumer rest.
    expect(screen.getByTestId('spin-root')).toHaveAttribute('role', 'status')
  })
})
