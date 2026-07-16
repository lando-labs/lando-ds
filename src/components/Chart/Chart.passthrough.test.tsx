/**
 * Chart — Layer-3 passthrough tests (issues #422 / #334)
 *
 * Verifies the base `Chart` wrapper forwards consumer `className`, `style`, and
 * arbitrary DOM attributes (`...rest`) onto the **visually styled root**
 * (`.chartContainer`, the element that carries `role`) — NOT the inert `.sizer`
 * wrapper and NOT the inner Recharts `ResponsiveContainer`.
 *
 * `ResponsiveContainer` depends on `ResizeObserver` (absent in jsdom), so we
 * install a no-op shim. The container measures to 0×0 under jsdom and Recharts
 * skips drawing the SVG — but the OUTER element we attach passthrough to (the
 * one carrying the consumer `data-testid`) renders regardless, which is exactly
 * what these assertions target. Charts are given an explicit `height`.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chart } from './Chart'
import type { ChartDataPoint } from './types'

beforeAll(() => {
  // Minimal ResizeObserver shim so Recharts' ResponsiveContainer mounts.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = global.ResizeObserver || ResizeObserverStub
})

const data: ChartDataPoint[] = [
  { x: 'a', y: 1 },
  { x: 'b', y: 2 },
]

// A trivial Recharts-free child keeps these tests focused on the wrapper's DOM
// contract. `ResponsiveContainer` accepts a single element child; a <g/> is a
// valid SVG element placeholder and avoids pulling a full chart into the test.
const child = <g data-testid="chart-child" />

describe('Chart — className passthrough', () => {
  it('applies a consumer className to the styled root alongside the internal class', () => {
    render(
      <Chart data={data} height={200} className="consumer-class" data-testid="chart-root">
        {child}
      </Chart>,
    )
    const root = screen.getByTestId('chart-root')
    expect(root).toHaveClass('consumer-class')
    // Internal container class is preserved (CSS-module hashed → matched by prefix).
    expect(root.className).toMatch(/chartContainer/)
  })
})

describe('Chart — style passthrough', () => {
  it('applies a consumer inline style to the styled root', () => {
    render(
      <Chart
        data={data}
        height={200}
        style={{ color: 'rgb(1, 2, 3)' }}
        data-testid="chart-root"
      >
        {child}
      </Chart>,
    )
    const root = screen.getByTestId('chart-root')
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })
})

describe('Chart — arbitrary DOM attribute (...rest) passthrough', () => {
  it('lands consumer data-testid on the styled root (the role="img" element)', () => {
    render(
      <Chart data={data} height={200} data-testid="chart-root">
        {child}
      </Chart>,
    )
    const root = screen.getByTestId('chart-root')
    // The styled root is the element carrying the semantic role.
    expect(root).toHaveAttribute('role', 'img')
  })

  it('forwards id and aria-describedby through ...rest', () => {
    render(
      <Chart
        data={data}
        height={200}
        id="my-chart"
        aria-describedby="desc-1"
        data-testid="chart-root"
      >
        {child}
      </Chart>,
    )
    const root = screen.getByTestId('chart-root')
    expect(root).toHaveAttribute('id', 'my-chart')
    expect(root).toHaveAttribute('aria-describedby', 'desc-1')
  })
})

describe('Chart — passthrough across non-success states', () => {
  it('forwards className/style/data-testid in the loading state', () => {
    render(
      <Chart
        data={data}
        height={200}
        loading
        className="consumer-class"
        style={{ color: 'rgb(1, 2, 3)' }}
        data-testid="chart-root"
      >
        {child}
      </Chart>,
    )
    const root = screen.getByTestId('chart-root')
    expect(root).toHaveClass('consumer-class')
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    expect(root).toHaveAttribute('role', 'status')
  })

  it('forwards className/style/data-testid in the empty state', () => {
    render(
      <Chart
        data={[]}
        height={200}
        className="consumer-class"
        style={{ color: 'rgb(1, 2, 3)' }}
        data-testid="chart-root"
      >
        {child}
      </Chart>,
    )
    const root = screen.getByTestId('chart-root')
    expect(root).toHaveClass('consumer-class')
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('forwards className/style/data-testid in the error state', () => {
    render(
      <Chart
        data={data}
        height={200}
        error="boom"
        className="consumer-class"
        style={{ color: 'rgb(1, 2, 3)' }}
        data-testid="chart-root"
      >
        {child}
      </Chart>,
    )
    const root = screen.getByTestId('chart-root')
    expect(root).toHaveClass('consumer-class')
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    expect(root).toHaveAttribute('role', 'alert')
  })
})
