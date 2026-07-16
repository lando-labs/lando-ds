/**
 * AspectRatio Component Tests
 * Smoke + ratio prop handling.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AspectRatio } from './AspectRatio'

describe('AspectRatio', () => {
  it('renders children', () => {
    render(
      <AspectRatio>
        <img src="/x.jpg" alt="X" />
      </AspectRatio>,
    )
    expect(screen.getByAltText('X')).toBeInTheDocument()
  })

  it('applies the default 16/9 ratio when none is supplied', () => {
    render(<AspectRatio data-testid="ar" />)
    const el = screen.getByTestId('ar')
    // Number coerced via String() — 16/9 ≈ "1.7777..."
    expect(el.style.aspectRatio).toMatch(/1\.7/)
  })

  it('passes through a string ratio verbatim', () => {
    render(<AspectRatio ratio="4 / 3" data-testid="ar" />)
    expect(screen.getByTestId('ar').style.aspectRatio).toBe('4 / 3')
  })

  it('passes through a numeric ratio', () => {
    render(<AspectRatio ratio={1} data-testid="ar" />)
    expect(screen.getByTestId('ar').style.aspectRatio).toBe('1')
  })
})
