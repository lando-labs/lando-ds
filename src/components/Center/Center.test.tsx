/**
 * Center Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Center } from './Center'

describe('Center', () => {
  it('renders children', () => {
    render(
      <Center>
        <span>x</span>
      </Center>,
    )
    expect(screen.getByText('x')).toBeInTheDocument()
  })

  it('defaults to a <div>', () => {
    render(<Center data-testid="c">x</Center>)
    expect(screen.getByTestId('c').tagName).toBe('DIV')
  })

  it('renders as the provided element when `as` is set', () => {
    render(
      <Center as="section" data-testid="c">
        x
      </Center>,
    )
    expect(screen.getByTestId('c').tagName).toBe('SECTION')
  })

  it('applies a block-flex class by default and inline-flex class when inline', () => {
    const { rerender } = render(<Center data-testid="c">x</Center>)
    const el = screen.getByTestId('c')
    expect(el.className).toMatch(/block/)
    rerender(
      <Center inline data-testid="c">
        x
      </Center>,
    )
    expect(screen.getByTestId('c').className).toMatch(/inline/)
  })
})
