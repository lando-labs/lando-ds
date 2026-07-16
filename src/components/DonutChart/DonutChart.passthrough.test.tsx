/**
 * DonutChart — Layer-3 passthrough + wrong-root tests (issues #422 / #334)
 *
 * DonutChart renders through the base `Chart` wrapper. Historically it
 * REPLACED the consumer `className` with its computed `donutChartWrapper`
 * class when `centerContent` was set (#422 sub-bucket D). These tests pin the
 * fix: the consumer `className` is now MERGED with the internal wrapper class,
 * and `style` / arbitrary DOM attributes pass through to the chart visual root.
 *
 * A `ResizeObserver` shim is installed for Recharts' `ResponsiveContainer`; the
 * chart is given an explicit `height`.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DonutChart } from './DonutChart'
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
  { name: 'A', value: 60 },
  { name: 'B', value: 40 },
]

describe('DonutChart — passthrough', () => {
  it('lands consumer data-testid on the chart visual root', () => {
    render(
      <DonutChart
        data={data}
        dataKey="value"
        nameKey="name"
        height={200}
        data-testid="donut-root"
      />,
    )
    const root = screen.getByTestId('donut-root')
    expect(root).toHaveAttribute('role', 'img')
  })

  it('applies a consumer inline style to the chart visual root', () => {
    render(
      <DonutChart
        data={data}
        dataKey="value"
        nameKey="name"
        height={200}
        style={{ color: 'rgb(1, 2, 3)' }}
        data-testid="donut-root"
      />,
    )
    const root = screen.getByTestId('donut-root')
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('applies a consumer className when there is NO centerContent', () => {
    render(
      <DonutChart
        data={data}
        dataKey="value"
        nameKey="name"
        height={200}
        className="consumer-class"
        data-testid="donut-root"
      />,
    )
    const root = screen.getByTestId('donut-root')
    expect(root).toHaveClass('consumer-class')
    expect(root.className).toMatch(/chartContainer/)
  })

  it('MERGES the consumer className with the internal wrapper class when centerContent is set (#422 wrong-root fix)', () => {
    render(
      <DonutChart
        data={data}
        dataKey="value"
        nameKey="name"
        height={200}
        className="consumer-class"
        centerContent={<span>900</span>}
        data-testid="donut-root"
      />,
    )
    const root = screen.getByTestId('donut-root')
    // The consumer class must NOT be dropped...
    expect(root).toHaveClass('consumer-class')
    // ...and the internal donut wrapper class is still present.
    expect(root.className).toMatch(/donutChartWrapper/)
    // ...and the base chart container class is still present.
    expect(root.className).toMatch(/chartContainer/)
  })
})
