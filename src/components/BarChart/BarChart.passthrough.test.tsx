/**
 * BarChart — Layer-3 passthrough tests (issues #422 / #334)
 *
 * BarChart renders through the base `Chart` wrapper (spreads `...chartProps`).
 * These tests confirm consumer `className`, `style`, and arbitrary DOM
 * attributes land on the chart's visually styled root (the element carrying
 * the consumer `data-testid`, which renders regardless of Recharts measurement
 * under jsdom). A `ResizeObserver` shim is installed; an explicit `height` is
 * supplied.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BarChart } from './BarChart'
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
  { product: 'Widget', sales: 120 },
  { product: 'Gadget', sales: 80 },
]

describe('BarChart — passthrough', () => {
  it('lands consumer data-testid on the chart visual root', () => {
    render(
      <BarChart
        data={data}
        dataKeys={['sales']}
        xAxisKey="product"
        height={200}
        data-testid="bar-root"
      />,
    )
    const root = screen.getByTestId('bar-root')
    expect(root).toHaveAttribute('role', 'img')
  })

  it('applies a consumer className alongside the internal container class', () => {
    render(
      <BarChart
        data={data}
        dataKeys={['sales']}
        xAxisKey="product"
        height={200}
        className="consumer-class"
        data-testid="bar-root"
      />,
    )
    const root = screen.getByTestId('bar-root')
    expect(root).toHaveClass('consumer-class')
    expect(root.className).toMatch(/chartContainer/)
  })

  it('applies a consumer inline style to the chart visual root', () => {
    render(
      <BarChart
        data={data}
        dataKeys={['sales']}
        xAxisKey="product"
        height={200}
        style={{ color: 'rgb(1, 2, 3)' }}
        data-testid="bar-root"
      />,
    )
    const root = screen.getByTestId('bar-root')
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })
})
