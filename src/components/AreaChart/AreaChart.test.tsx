/**
 * AreaChart — smoke tests (Sprint 59 / trust: "every component has a test")
 *
 * AreaChart renders through the base `Chart` wrapper (it spreads
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
import { AreaChart } from './AreaChart'
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
  { month: 'Jan', desktop: 120 },
  { month: 'Feb', desktop: 160 },
]

describe('AreaChart — smoke', () => {
  it('renders the chart visual root', () => {
    render(
      <AreaChart
        data={data}
        dataKeys={['desktop']}
        xAxisKey="month"
        height={200}
        data-testid="area-root"
      />,
    )
    const root = screen.getByTestId('area-root')
    expect(root).toBeInTheDocument()
    expect(root).toHaveAttribute('role', 'img')
  })

  it('consumes data + dataKeys (rendered in the a11y data table)', () => {
    render(
      <AreaChart
        data={data}
        dataKeys={['desktop']}
        xAxisKey="month"
        height={200}
        data-testid="area-root"
      />,
    )
    // The base Chart renders a screen-reader data table whose headers are the
    // data-row keys — proof the `data`/`xAxisKey`/`dataKeys` props flowed
    // through and were consumed rather than dropped.
    expect(screen.getByRole('columnheader', { name: 'month' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'desktop' })).toBeInTheDocument()
  })

  it('applies the height prop to the responsive container', () => {
    const { container } = render(
      <AreaChart
        data={data}
        dataKeys={['desktop']}
        xAxisKey="month"
        height={250}
        data-testid="area-root"
      />,
    )
    const responsive = container.querySelector('.recharts-responsive-container')
    expect(responsive).not.toBeNull()
    expect(responsive as HTMLElement).toHaveStyle({ height: '250px' })
  })

  it('lands consumer className alongside the internal container class (v0.37.0 passthrough)', () => {
    render(
      <AreaChart
        data={data}
        dataKeys={['desktop']}
        xAxisKey="month"
        height={200}
        className="consumer-class"
        data-testid="area-root"
      />,
    )
    const root = screen.getByTestId('area-root')
    expect(root).toHaveClass('consumer-class')
    expect(root.className).toMatch(/chartContainer/)
  })
})
