/**
 * Sparkline Component Tests
 *
 * Sprint 13 (#20) — inline 80×20 data-viz primitive. These assertions
 * cover rendering in both bars and line variants, normalization math,
 * zero-bucket handling, empty-state fallback (empty array AND all-zero
 * values), aria labelling, and jest-axe.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Sparkline } from './Sparkline'

const sampleData = [
  { t: '10:00', count: 2 },
  { t: '10:05', count: 8 },
  { t: '10:10', count: 3 },
  { t: '10:15', count: 5 },
]

describe('Sparkline', () => {
  it('renders an SVG with role="img" when data is present', () => {
    const { container } = render(<Sparkline data={sampleData} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('role', 'img')
  })

  it('bars variant renders a <rect> per non-zero bucket', () => {
    const { container } = render(
      <Sparkline data={sampleData} variant="bars" />
    )
    const rects = container.querySelectorAll('rect')
    expect(rects).toHaveLength(4) // all non-zero
  })

  it('skips zero-count buckets in bars variant', () => {
    const data = [
      { t: 'a', count: 5 },
      { t: 'b', count: 0 },
      { t: 'c', count: 3 },
    ]
    const { container } = render(<Sparkline data={data} variant="bars" />)
    expect(container.querySelectorAll('rect')).toHaveLength(2)
  })

  it('line variant renders a <polyline>', () => {
    const { container } = render(
      <Sparkline data={sampleData} variant="line" />
    )
    expect(container.querySelector('polyline')).not.toBeNull()
  })

  it('normalizes bar heights proportionally to max count', () => {
    const data = [
      { t: 'a', count: 10 },
      { t: 'b', count: 5 },
    ]
    const { container } = render(
      <Sparkline data={data} size={{ w: 80, h: 20 }} />
    )
    const rects = container.querySelectorAll('rect')
    // Max is 10 → first bar should be 20 tall, second 10 tall.
    // safe: 2 data points render 2 <rect>s (a 0-length regression throws here, not silently passes)
    expect(Number(rects[0]!.getAttribute('height'))).toBe(20)
    expect(Number(rects[1]!.getAttribute('height'))).toBe(10)
  })

  it('renders emptyFallback when data is empty', () => {
    render(
      <Sparkline
        data={[]}
        emptyFallback={<span data-testid="empty">·</span>}
      />
    )
    expect(screen.getByTestId('empty')).toBeInTheDocument()
  })

  it('renders emptyFallback when all counts are zero', () => {
    render(
      <Sparkline
        data={[
          { t: 'a', count: 0 },
          { t: 'b', count: 0 },
        ]}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('applies custom aria-label', () => {
    render(<Sparkline data={sampleData} aria-label="Daily visits" />)
    expect(
      screen.getByRole('img', { name: 'Daily visits' })
    ).toBeInTheDocument()
  })

  it('has no a11y violations', async () => {
    const { container } = render(
      <Sparkline data={sampleData} aria-label="Test sparkline" />
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  // ---------------------------------------------------------------------
  // Sprint 15 (#91) — simpler-API overload + new style props
  // ---------------------------------------------------------------------

  describe('simple-API (number[] data overload)', () => {
    it('accepts data: number[] directly and renders a line', () => {
      const { container } = render(
        <Sparkline data={[12, 19, 15, 25, 32, 28, 45]} variant="line" />
      )
      expect(container.querySelector('polyline')).not.toBeNull()
    })

    it('accepts data: number[] for bars variant too', () => {
      const { container } = render(
        <Sparkline data={[1, 2, 3, 4]} variant="bars" />
      )
      expect(container.querySelectorAll('rect')).toHaveLength(4)
    })

    it('renders empty fallback for an empty number[]', () => {
      render(<Sparkline data={[] as number[]} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('color prop — semantic variants', () => {
    it('resolves "success" to the success token', () => {
      const { container } = render(
        <Sparkline data={sampleData} color="success" />
      )
      const span = container.querySelector('span')
      expect(span).toHaveStyle({ color: 'var(--color-success-base)' })
    })

    it('resolves "danger" to the error token (frontend → token alias)', () => {
      const { container } = render(
        <Sparkline data={sampleData} color="danger" />
      )
      const span = container.querySelector('span')
      expect(span).toHaveStyle({ color: 'var(--color-error-base)' })
    })

    it('passes raw CSS color strings through unchanged (back-compat)', () => {
      const { container } = render(
        <Sparkline data={sampleData} color="var(--color-teal-base)" />
      )
      const span = container.querySelector('span')
      expect(span).toHaveStyle({ color: 'var(--color-teal-base)' })
    })
  })

  describe('fill prop', () => {
    it('renders a <linearGradient> when fill + variant="line"', () => {
      const { container } = render(
        <Sparkline data={[1, 2, 3, 4, 5]} variant="line" fill />
      )
      expect(
        container.querySelector('linearGradient')
      ).not.toBeNull()
      expect(container.querySelector('path')).not.toBeNull()
    })

    it('does NOT render a gradient for the bars variant (fill is line-only)', () => {
      const { container } = render(
        <Sparkline data={[1, 2, 3, 4]} variant="bars" fill />
      )
      expect(container.querySelector('linearGradient')).toBeNull()
    })

    it('does NOT render a gradient when fill is omitted', () => {
      const { container } = render(
        <Sparkline data={[1, 2, 3]} variant="line" />
      )
      expect(container.querySelector('linearGradient')).toBeNull()
    })
  })

  describe('showDot prop', () => {
    it('renders a <circle> at the last data point when showDot is true', () => {
      const { container } = render(
        <Sparkline
          data={[1, 2, 3, 4, 5]}
          variant="line"
          showDot
          size={{ w: 80, h: 40 }}
        />
      )
      const circle = container.querySelector('circle')
      expect(circle).not.toBeNull()
      // Last point is at x = w (80) for a 5-point line, y = 0 (max).
      expect(Number(circle!.getAttribute('cx'))).toBeCloseTo(80, 0)
      expect(Number(circle!.getAttribute('cy'))).toBeCloseTo(0, 0)
    })

    it('does NOT render a circle when showDot is omitted', () => {
      const { container } = render(
        <Sparkline data={[1, 2, 3]} variant="line" />
      )
      expect(container.querySelector('circle')).toBeNull()
    })
  })

  describe('a11y trend label', () => {
    it('auto-generates an ascending trend label', () => {
      render(<Sparkline data={[1, 2, 3, 4, 5]} variant="line" />)
      expect(
        screen.getByRole('img', {
          name: /Trend: ascending, min 1, max 5/,
        })
      ).toBeInTheDocument()
    })

    it('auto-generates a descending trend label', () => {
      render(<Sparkline data={[10, 8, 6, 4, 2]} variant="line" />)
      expect(
        screen.getByRole('img', {
          name: /Trend: descending, min 2, max 10/,
        })
      ).toBeInTheDocument()
    })

    it('explicit aria-label overrides the auto-generated trend summary', () => {
      render(
        <Sparkline
          data={[1, 2, 3]}
          variant="line"
          aria-label="Custom label"
        />
      )
      expect(
        screen.getByRole('img', { name: 'Custom label' })
      ).toBeInTheDocument()
    })
  })

  it('lets a consumer style.color override the themed color', () => {
    render(
      <Sparkline
        data={sampleData}
        style={{ color: 'rgb(1, 2, 3)' }}
        data-testid="spark-root"
      />
    )
    // The `color` prop is a themed default; an explicit inline style is the
    // more specific override and must win (Layer-3 contract — no silent drop).
    expect(screen.getByTestId('spark-root')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  // #424 — Layer-7 polymorphism via asChild. Renders the wrapper as a
  // supplied element (e.g. an <a>) with the SVG composed inside.
  describe('asChild (#424)', () => {
    it('renders the child element carrying the Sparkline root class + forwarded className/style (data path)', () => {
      render(
        <Sparkline asChild data={sampleData} className="extra">
          <a href="/trend" data-testid="x" />
        </Sparkline>,
      )
      const el = screen.getByTestId('x')
      // Renders as the anchor, not a <span>-wrapped anchor.
      expect(el.tagName).toBe('A')
      expect(el).toHaveAttribute('href', '/trend')
      expect(el.className).toMatch(/sparkline/)
      expect(el.className).toMatch(/extra/)
      // The SVG is composed inside the child.
      expect(el.querySelector('svg')).not.toBeNull()
    })

    it('renders the child element carrying the empty class + fallback (empty path)', () => {
      render(
        <Sparkline asChild data={[]} emptyFallback="none" className="extra">
          <a href="/trend" data-testid="x" />
        </Sparkline>,
      )
      const el = screen.getByTestId('x')
      expect(el.tagName).toBe('A')
      expect(el.className).toMatch(/sparkline/)
      expect(el.className).toMatch(/empty/)
      expect(el).toHaveTextContent('none')
    })
  })
})
