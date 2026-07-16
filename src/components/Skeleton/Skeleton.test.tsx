/**
 * Skeleton Component Tests
 *
 * Covers:
 * - default rendering
 * - variant (text/circular/rectangular)
 * - width/height prop (numeric -> px, string -> pass-through)
 * - animation class (pulse/wave/none)
 * - aria-busy + aria-label for a11y
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders with default dimensions', () => {
    render(<Skeleton />)
    // aria-label="Loading" is always set, so this is addressable.
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('sets aria-busy="true" for a11y', () => {
    render(<Skeleton />)
    expect(screen.getByLabelText('Loading')).toHaveAttribute('aria-busy', 'true')
  })

  it('applies numeric width/height as pixel values', () => {
    render(<Skeleton width={120} height={40} />)
    const el = screen.getByLabelText('Loading')
    expect(el.style.width).toBe('120px')
    expect(el.style.height).toBe('40px')
  })

  it('passes string width/height through verbatim', () => {
    render(<Skeleton width="80%" height="2rem" />)
    const el = screen.getByLabelText('Loading')
    expect(el.style.width).toBe('80%')
    expect(el.style.height).toBe('2rem')
  })

  it('passes consumer style + data-* through to the root without clobbering (#427)', () => {
    render(<Skeleton style={{ margin: '4px', width: '500px' }} data-testid="sk" className="mine" />)
    const el = screen.getByTestId('sk')
    // With no width/height PROP, the consumer's style.width must survive (regression:
    // an always-present dimensionStyle.width:undefined used to clobber it).
    expect(el.style.width).toBe('500px')
    expect(el.style.margin).toBe('4px')
    expect(el.className).toMatch(/mine/) // className merges, not replaced
  })

  it('width/height props win over a conflicting consumer style.width', () => {
    render(<Skeleton width={120} style={{ width: '500px' }} />)
    expect(screen.getByLabelText('Loading').style.width).toBe('120px')
  })

  it('applies variant class for each variant', () => {
    const variants: Array<'text' | 'circular' | 'rectangular'> = [
      'text',
      'circular',
      'rectangular',
    ]
    variants.forEach((variant) => {
      const { unmount } = render(<Skeleton variant={variant} />)
      const el = screen.getByLabelText('Loading')
      expect(el.className).toMatch(new RegExp(variant))
      unmount()
    })
  })

  it('applies wave animation class by default and renders wave overlay', () => {
    const { container } = render(<Skeleton />)
    const el = screen.getByLabelText('Loading')
    expect(el.className).toMatch(/wave/)
    // Wave overlay is a child span
    expect(container.querySelectorAll('span').length).toBeGreaterThan(1)
  })

  it('applies pulse animation class when animation="pulse"', () => {
    render(<Skeleton animation="pulse" />)
    const el = screen.getByLabelText('Loading')
    expect(el.className).toMatch(/pulse/)
  })

  it('does not render wave overlay when animation="none"', () => {
    const { container } = render(<Skeleton animation="none" />)
    // Only the outer skeleton span, no overlay
    expect(container.querySelectorAll('span').length).toBe(1)
  })
})
