/**
 * Progress Component Tests
 *
 * Covers:
 * - bar variant role="progressbar" + aria-valuenow/min/max
 * - value clamping (negative, >100)
 * - indeterminate state
 * - label + showValue text
 * - circle variant (renders SVG)
 * - dots variant (role="progressbar" + aria-label fallback)
 * - axe a11y smoke
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Progress } from './Progress'

expect.extend(toHaveNoViolations)

describe('Progress', () => {
  it('renders bar variant with role="progressbar"', () => {
    render(<Progress value={50} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('sets aria-valuenow/valuemin/valuemax correctly', () => {
    render(<Progress value={42} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('clamps values below 0 to 0', () => {
    render(<Progress value={-25} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('clamps values above 100 to 100', () => {
    render(<Progress value={250} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    )
  })

  it('applies width style corresponding to value', () => {
    const { container } = render(<Progress value={33} />)
    const fill = container.querySelector('[style*="width"]') as HTMLElement | null
    expect(fill).not.toBeNull()
    expect(fill!.style.width).toBe('33%')
  })

  it('applies indeterminate class and 100% width when indeterminate', () => {
    const { container } = render(<Progress indeterminate />)
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toMatch(/indeterminate/)
    const fill = container.querySelector('[style*="width"]') as HTMLElement | null
    expect(fill!.style.width).toBe('100%')
  })

  it('renders label and value when showValue is true', () => {
    render(<Progress value={75} label="Uploading" showValue />)
    expect(screen.getByText('Uploading')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('does not render value text when indeterminate', () => {
    render(<Progress indeterminate showValue label="Working" />)
    expect(screen.queryByText(/%/)).toBeNull()
  })

  it('applies size and color classes', () => {
    const { container } = render(
      <Progress value={50} size="lg" color="success" />
    )
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.className).toMatch(/lg/)
    expect(bar?.className).toMatch(/success/)
  })

  it('renders circle variant as an SVG', () => {
    const { container } = render(<Progress value={50} variant="circle" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('dots variant uses role="progressbar" with aria-label', () => {
    render(<Progress variant="dots" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-label', 'Loading')
  })

  // #74 — label is now linked to the progressbar element via
  // aria-labelledby (bar/dots variants) or aria-label (circle variant),
  // clearing axe's `aria-progressbar-name` rule. All three variants axe-clean.
  it('has no a11y violations — bar variant with label (axe)', async () => {
    const { container } = render(
      <Progress variant="bar" value={50} label="Upload progress" />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no a11y violations — circle variant with label (axe)', async () => {
    const { container } = render(
      <Progress variant="circle" value={50} label="Upload progress" />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no a11y violations — dots variant (axe smoke)', async () => {
    const { container } = render(<Progress variant="dots" />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('links label to progressbar via aria-labelledby on bar variant', () => {
    render(<Progress variant="bar" value={50} label="Upload progress" />)
    const bar = screen.getByRole('progressbar')
    const labelId = bar.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    // Ensure the referenced element exists and contains the label text.
    const labelEl = document.getElementById(labelId!)
    expect(labelEl).not.toBeNull()
    expect(labelEl).toHaveTextContent('Upload progress')
  })

  it('uses aria-label on circle variant when label is a string', () => {
    render(<Progress variant="circle" value={50} label="Upload progress" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-label', 'Upload progress')
    // Circle doesn't render a visible label slot, so aria-labelledby is absent.
    expect(bar).not.toHaveAttribute('aria-labelledby')
  })

  it('generates unique label ids for multiple instances on the same page', () => {
    render(
      <>
        <Progress variant="bar" value={25} label="First" />
        <Progress variant="bar" value={50} label="Second" />
      </>
    )
    const bars = screen.getAllByRole('progressbar')
    // safe: getAllByRole throws on zero; two <Progress> rendered above → indices 0,1 present
    const firstId = bars[0]!.getAttribute('aria-labelledby')
    const secondId = bars[1]!.getAttribute('aria-labelledby')
    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()
    expect(firstId).not.toBe(secondId)
  })

  // #423 — full-customizability contract: consumer `style` + rest props land
  // on the visual-root container, and the inner progressbar role survives.
  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the visual root', () => {
      render(
        <Progress
          value={50}
          data-testid="my-progress"
          style={{ color: 'rgb(11, 22, 33)' }}
        />
      )
      const root = screen.getByTestId('my-progress')
      expect(root.style.color).toBe('rgb(11, 22, 33)')
      // The progressbar element lives INSIDE the styled container root.
      expect(root).toContainElement(screen.getByRole('progressbar'))
    })
  })
})
