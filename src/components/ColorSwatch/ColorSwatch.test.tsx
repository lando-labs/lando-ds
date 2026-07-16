/**
 * ColorSwatch tests (#379) — accessible color preview primitive.
 *
 * Covers:
 *   - renders a chip with the supplied color as background-color
 *   - default size (md → 24px) + named/numeric size sizing
 *   - shape: square (default) vs circle (border-radius applied)
 *   - label renders as a caption next to the chip
 *   - aria-label default + opt-out via empty string
 *   - className / style / data-* / ref forwarding
 *   - axe a11y smoke
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { createRef } from 'react'
import { ColorSwatch } from './ColorSwatch'

describe('ColorSwatch — rendering', () => {
  it('renders a chip with the supplied color', () => {
    const { container } = render(<ColorSwatch color="#1B7FA8" />)
    const chip = container.querySelector('[data-color]') as HTMLElement
    expect(chip).not.toBeNull()
    expect(chip.style.backgroundColor).toBe('rgb(27, 127, 168)')
    expect(chip.getAttribute('data-color')).toBe('#1B7FA8')
  })

  it('accepts CSS variable colors verbatim', () => {
    const { container } = render(
      <ColorSwatch color="var(--color-primary)" />,
    )
    const chip = container.querySelector('[data-color]') as HTMLElement
    expect(chip.getAttribute('data-color')).toBe('var(--color-primary)')
  })

  it('forwards a ref to the root element', () => {
    const ref = createRef<HTMLDivElement>()
    render(<ColorSwatch ref={ref} color="#000" />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('DIV')
  })

  it('forwards className, style, and data-* attributes', () => {
    render(
      <ColorSwatch
        color="#fff"
        className="my-class"
        style={{ marginTop: 8 }}
        data-testid="swatch"
      />,
    )
    const root = screen.getByTestId('swatch')
    expect(root.className).toMatch(/my-class/)
    expect(root.style.marginTop).toBe('8px')
  })
})

describe('ColorSwatch — size', () => {
  it('defaults to md (24px)', () => {
    const { container } = render(<ColorSwatch color="#000" />)
    const chip = container.querySelector('[data-color]') as HTMLElement
    expect(chip.style.width).toBe('24px')
    expect(chip.style.height).toBe('24px')
  })

  it('applies sm (16px)', () => {
    const { container } = render(<ColorSwatch color="#000" size="sm" />)
    const chip = container.querySelector('[data-color]') as HTMLElement
    expect(chip.style.width).toBe('16px')
  })

  it('applies lg (40px)', () => {
    const { container } = render(<ColorSwatch color="#000" size="lg" />)
    const chip = container.querySelector('[data-color]') as HTMLElement
    expect(chip.style.width).toBe('40px')
  })

  it('accepts a numeric size as a literal pixel value', () => {
    const { container } = render(<ColorSwatch color="#000" size={64} />)
    const chip = container.querySelector('[data-color]') as HTMLElement
    expect(chip.style.width).toBe('64px')
    expect(chip.style.height).toBe('64px')
  })
})

describe('ColorSwatch — shape', () => {
  it('applies the square shape class by default', () => {
    const { container } = render(<ColorSwatch color="#000" />)
    const chip = container.querySelector('[data-color]') as HTMLElement
    expect(chip.className).toMatch(/shape-square/)
  })

  it('applies the circle shape class', () => {
    const { container } = render(
      <ColorSwatch color="#000" shape="circle" />,
    )
    const chip = container.querySelector('[data-color]') as HTMLElement
    expect(chip.className).toMatch(/shape-circle/)
  })
})

describe('ColorSwatch — label', () => {
  it('renders no caption by default', () => {
    const { container } = render(<ColorSwatch color="#000" />)
    // Only the chip is rendered; no label span.
    const spans = container.querySelectorAll('span')
    expect(spans).toHaveLength(1)
  })

  it('renders the caption when label is supplied', () => {
    render(<ColorSwatch color="#000" label="Primary" />)
    expect(screen.getByText('Primary')).toBeInTheDocument()
  })

  it('renders a node label (not just strings)', () => {
    render(
      <ColorSwatch
        color="#000"
        label={<span data-testid="caption-node">Custom</span>}
      />,
    )
    expect(screen.getByTestId('caption-node')).toBeInTheDocument()
  })
})

describe('ColorSwatch — accessibility', () => {
  it('sets a default aria-label that includes the color value', () => {
    const { container } = render(<ColorSwatch color="#1B7FA8" />)
    const chip = container.querySelector('[role="img"]') as HTMLElement
    expect(chip).not.toBeNull()
    expect(chip.getAttribute('aria-label')).toBe('Color preview: #1B7FA8')
  })

  it('uses the consumer-supplied aria-label when provided', () => {
    const { container } = render(
      <ColorSwatch color="#1B7FA8" aria-label="Brand primary" />,
    )
    const chip = container.querySelector('[role="img"]') as HTMLElement
    expect(chip.getAttribute('aria-label')).toBe('Brand primary')
  })

  it('suppresses the chip role when aria-label is explicitly empty', () => {
    // Useful when the surrounding label is sufficient and the chip
    // should be purely decorative.
    const { container } = render(
      <ColorSwatch color="#fff" aria-label="" label="White" />,
    )
    expect(container.querySelector('[role="img"]')).toBeNull()
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <div>
        <ColorSwatch color="#1B7FA8" label="Primary" />
        <ColorSwatch color="#2DBFBF" label="Success" shape="circle" />
        <ColorSwatch color="#EF4444" />
      </div>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
