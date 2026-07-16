/**
 * PieChart — smoke tests (Sprint 59 / trust: "every component has a test")
 *
 * PieChart renders through the base `Chart` wrapper (it spreads
 * `...chartProps`). The base wrapper renders its visually styled root
 * (`.chartContainer`, carrying `role="img"`) regardless of Recharts
 * measurement under jsdom, so a consumer `data-testid` is a reliable handle.
 *
 * A `ResizeObserver` shim is installed because the wrapper mounts Recharts'
 * `ResponsiveContainer`; the chart is given an explicit `height`.
 *
 * These are intentionally minimal but meaningful: they prove the chart
 * renders, respects a basic prop (`height`), and that the HTMLAttributes
 * passthrough added in v0.37.0 (`data-testid` / `className`) lands on the
 * visual root.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PieChart } from './PieChart'
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

describe('PieChart — smoke', () => {
  it('renders the chart visual root', () => {
    render(
      <PieChart
        data={data}
        dataKey="value"
        nameKey="name"
        height={200}
        data-testid="pie-root"
      />,
    )
    const root = screen.getByTestId('pie-root')
    expect(root).toBeInTheDocument()
    expect(root).toHaveAttribute('role', 'img')
  })

  it('consumes data + keys (rendered in the a11y data table)', () => {
    render(
      <PieChart
        data={data}
        dataKey="value"
        nameKey="name"
        height={200}
        data-testid="pie-root"
      />,
    )
    // The base Chart renders a screen-reader data table whose headers are the
    // data-row keys — proof the `data`/`dataKey`/`nameKey` props flowed
    // through and were consumed rather than dropped.
    expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'value' })).toBeInTheDocument()
  })

  it('applies the height prop to the responsive container', () => {
    const { container } = render(
      <PieChart
        data={data}
        dataKey="value"
        nameKey="name"
        height={260}
        data-testid="pie-root"
      />,
    )
    const responsive = container.querySelector('.recharts-responsive-container')
    expect(responsive).not.toBeNull()
    expect(responsive as HTMLElement).toHaveStyle({ height: '260px' })
  })

  it('lands consumer className alongside the internal container class (v0.37.0 passthrough)', () => {
    render(
      <PieChart
        data={data}
        dataKey="value"
        nameKey="name"
        height={200}
        className="consumer-class"
        data-testid="pie-root"
      />,
    )
    const root = screen.getByTestId('pie-root')
    expect(root).toHaveClass('consumer-class')
    expect(root.className).toMatch(/chartContainer/)
  })
})
