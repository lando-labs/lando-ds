/**
 * LineChart — Layer-3 passthrough tests (issues #422 / #334)
 *
 * LineChart renders through the base `Chart` wrapper (it spreads
 * `...chartProps`). These tests confirm consumer `className`, `style`, and
 * arbitrary DOM attributes survive that hop and land on the chart's visually
 * styled root (the element carrying the consumer `data-testid`, which renders
 * regardless of Recharts measurement under jsdom).
 *
 * A `ResizeObserver` shim is installed because the wrapper mounts Recharts'
 * `ResponsiveContainer`. The chart is given an explicit `height`.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LineChart } from './LineChart'
import type { ChartDataPoint } from '../Chart/types'

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = global.ResizeObserver || ResizeObserverStub
})

const data: ChartDataPoint[] = [
  { month: 'Jan', revenue: 100 },
  { month: 'Feb', revenue: 140 },
]

describe('LineChart — passthrough', () => {
  it('lands consumer data-testid on the chart visual root', () => {
    render(
      <LineChart
        data={data}
        dataKeys={['revenue']}
        xAxisKey="month"
        height={200}
        data-testid="line-root"
      />,
    )
    const root = screen.getByTestId('line-root')
    expect(root).toHaveAttribute('role', 'img')
  })

  it('applies a consumer className alongside the internal container class', () => {
    render(
      <LineChart
        data={data}
        dataKeys={['revenue']}
        xAxisKey="month"
        height={200}
        className="consumer-class"
        data-testid="line-root"
      />,
    )
    const root = screen.getByTestId('line-root')
    expect(root).toHaveClass('consumer-class')
    expect(root.className).toMatch(/chartContainer/)
  })

  it('applies a consumer inline style to the chart visual root', () => {
    render(
      <LineChart
        data={data}
        dataKeys={['revenue']}
        xAxisKey="month"
        height={200}
        style={{ color: 'rgb(1, 2, 3)' }}
        data-testid="line-root"
      />,
    )
    const root = screen.getByTestId('line-root')
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('does NOT leak config props (colorScheme/showGrid) onto the DOM root', () => {
    render(
      <LineChart
        data={data}
        dataKeys={['revenue']}
        xAxisKey="month"
        height={200}
        colorScheme="teal"
        showGrid={false}
        data-testid="line-root"
      />,
    )
    const root = screen.getByTestId('line-root')
    // These are React-component config, not DOM attributes — they must be
    // consumed locally, never forwarded as attributes on the root div.
    expect(root).not.toHaveAttribute('colorScheme')
    expect(root).not.toHaveAttribute('colorscheme')
    expect(root).not.toHaveAttribute('showGrid')
    expect(root).not.toHaveAttribute('showgrid')
  })
})
