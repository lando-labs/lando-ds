/**
 * FunnelChart Component Tests
 *
 * Sprint 18 (#90) — sequential drop-off visualization. Covers:
 *  - 3-stage / 5-stage / 7-stage rendering (polygon counts)
 *  - vertical vs horizontal orientation (data attribute on the SVG)
 *  - showPercentages / showAbsoluteCounts toggles
 *  - auto-computed percentages match expected values
 *  - empty data → Chart base empty state
 *  - malformed data → Chart base error state
 *  - jest-axe smoke tests
 *  - SSR data-table fallback contains all rows
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { FunnelChart, type FunnelStage } from './FunnelChart'

const threeStage: FunnelStage[] = [
  { stage: 'Visited', count: 1000, percentage: 100 },
  { stage: 'Signed up', count: 500, percentage: 50 },
  { stage: 'Paid', count: 100, percentage: 10 },
]

const fiveStage: FunnelStage[] = [
  { stage: 'Visited', count: 5000 },
  { stage: 'Engaged', count: 3500 },
  { stage: 'Signed up', count: 2000 },
  { stage: 'Activated', count: 900 },
  { stage: 'Paid', count: 200 },
]

const sevenStage: FunnelStage[] = [
  { stage: 'Step 1', count: 7000 },
  { stage: 'Step 2', count: 6000 },
  { stage: 'Step 3', count: 4500 },
  { stage: 'Step 4', count: 3000 },
  { stage: 'Step 5', count: 1800 },
  { stage: 'Step 6', count: 900 },
  { stage: 'Step 7', count: 250 },
]

describe('FunnelChart — basic rendering', () => {
  it('renders the wrapper with role="img" and a default aria-label', () => {
    render(<FunnelChart data={threeStage} />)
    expect(
      screen.getByRole('img', { name: /funnel chart with 3 stages/i }),
    ).toBeInTheDocument()
  })

  it('renders a polygon per stage for a 3-stage funnel', () => {
    const { container } = render(<FunnelChart data={threeStage} />)
    expect(container.querySelectorAll('polygon')).toHaveLength(3)
  })

  it('renders a polygon per stage for a 5-stage funnel', () => {
    const { container } = render(<FunnelChart data={fiveStage} />)
    expect(container.querySelectorAll('polygon')).toHaveLength(5)
  })

  it('renders a polygon per stage for a 7-stage funnel', () => {
    const { container } = render(<FunnelChart data={sevenStage} />)
    expect(container.querySelectorAll('polygon')).toHaveLength(7)
  })

  it('renders stage names in the SVG (in addition to the SSR fallback table)', () => {
    const { container } = render(<FunnelChart data={threeStage} />)
    const svg = container.querySelector('svg')!
    expect(within(svg as unknown as HTMLElement).getByText('Visited')).toBeInTheDocument()
    expect(within(svg as unknown as HTMLElement).getByText('Signed up')).toBeInTheDocument()
    expect(within(svg as unknown as HTMLElement).getByText('Paid')).toBeInTheDocument()
    // Each stage name appears twice overall — once in the SVG, once in the SSR table.
    expect(screen.getAllByText('Visited')).toHaveLength(2)
  })
})

describe('FunnelChart — orientation', () => {
  it('applies data-orientation="vertical" by default', () => {
    const { container } = render(<FunnelChart data={threeStage} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('data-orientation', 'vertical')
  })

  it('applies data-orientation="horizontal" when set', () => {
    const { container } = render(
      <FunnelChart data={threeStage} orientation="horizontal" />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('data-orientation', 'horizontal')
  })

  it('horizontal orientation still renders one polygon per stage', () => {
    const { container } = render(
      <FunnelChart data={fiveStage} orientation="horizontal" />,
    )
    expect(container.querySelectorAll('polygon')).toHaveLength(5)
  })
})

describe('FunnelChart — label toggles', () => {
  it('shows percentage and count labels by default', () => {
    render(<FunnelChart data={threeStage} />)
    expect(screen.getByTestId('funnel-count-0')).toHaveTextContent('1,000')
    expect(screen.getByTestId('funnel-percentage-0')).toHaveTextContent('100%')
  })

  it('hides percentage labels when showPercentages={false}', () => {
    render(<FunnelChart data={threeStage} showPercentages={false} />)
    expect(screen.queryByTestId('funnel-percentage-0')).toBeNull()
    expect(screen.queryByTestId('funnel-percentage-1')).toBeNull()
    // Counts still visible
    expect(screen.getByTestId('funnel-count-0')).toHaveTextContent('1,000')
  })

  it('hides count labels when showAbsoluteCounts={false}', () => {
    render(<FunnelChart data={threeStage} showAbsoluteCounts={false} />)
    expect(screen.queryByTestId('funnel-count-0')).toBeNull()
    expect(screen.queryByTestId('funnel-count-1')).toBeNull()
    // Percentages still visible
    expect(screen.getByTestId('funnel-percentage-0')).toHaveTextContent('100%')
  })

  it('hides BOTH meta labels when both toggles are false (no meta tspan element rendered)', () => {
    render(
      <FunnelChart
        data={threeStage}
        showPercentages={false}
        showAbsoluteCounts={false}
      />,
    )
    expect(screen.queryByTestId('funnel-meta-0')).toBeNull()
    expect(screen.queryByTestId('funnel-meta-1')).toBeNull()
    expect(screen.queryByTestId('funnel-meta-2')).toBeNull()
  })
})

describe('FunnelChart — percentage computation', () => {
  it('uses provided percentages verbatim when supplied', () => {
    render(<FunnelChart data={threeStage} />)
    expect(screen.getByTestId('funnel-percentage-0')).toHaveTextContent('100%')
    expect(screen.getByTestId('funnel-percentage-1')).toHaveTextContent('50%')
    expect(screen.getByTestId('funnel-percentage-2')).toHaveTextContent('10%')
  })

  it('auto-computes percentages from count when omitted', () => {
    // 5000 → 100%, 3500 → 70%, 2000 → 40%, 900 → 18%, 200 → 4%
    render(<FunnelChart data={fiveStage} />)
    expect(screen.getByTestId('funnel-percentage-0')).toHaveTextContent('100%')
    expect(screen.getByTestId('funnel-percentage-1')).toHaveTextContent('70%')
    expect(screen.getByTestId('funnel-percentage-2')).toHaveTextContent('40%')
    expect(screen.getByTestId('funnel-percentage-3')).toHaveTextContent('18%')
    expect(screen.getByTestId('funnel-percentage-4')).toHaveTextContent('4%')
  })

  it('manual and auto-computed percentages match for an equivalent dataset', () => {
    const auto = [
      { stage: 'A', count: 1000 },
      { stage: 'B', count: 500 },
    ]
    const manual = [
      { stage: 'A', count: 1000, percentage: 100 },
      { stage: 'B', count: 500, percentage: 50 },
    ]
    const { unmount } = render(<FunnelChart data={auto} />)
    expect(screen.getByTestId('funnel-percentage-0')).toHaveTextContent('100%')
    expect(screen.getByTestId('funnel-percentage-1')).toHaveTextContent('50%')
    unmount()
    render(<FunnelChart data={manual} />)
    expect(screen.getByTestId('funnel-percentage-0')).toHaveTextContent('100%')
    expect(screen.getByTestId('funnel-percentage-1')).toHaveTextContent('50%')
  })
})

describe('FunnelChart — empty + error states', () => {
  it('renders the empty state when data is an empty array', () => {
    render(<FunnelChart data={[]} />)
    expect(screen.getByText('No data to display')).toBeInTheDocument()
  })

  it('renders the empty state when all counts are zero', () => {
    render(
      <FunnelChart
        data={[
          { stage: 'A', count: 0 },
          { stage: 'B', count: 0 },
        ]}
      />,
    )
    expect(screen.getByText('No data to display')).toBeInTheDocument()
  })

  it('renders the empty state when `empty` prop is true', () => {
    render(<FunnelChart data={threeStage} empty />)
    expect(screen.getByText('No data to display')).toBeInTheDocument()
  })

  it('renders the error state when an `error` prop is supplied', () => {
    render(<FunnelChart data={threeStage} error="Failed to load funnel" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load funnel')
  })

  it('renders the error state when data has negative counts', () => {
    render(
      <FunnelChart
        data={[
          { stage: 'A', count: 100 },
          { stage: 'B', count: -50 },
        ]}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/non-negative/i)
  })

  it('renders the loading state when `loading` is true', () => {
    render(<FunnelChart data={threeStage} loading />)
    expect(screen.getByRole('status', { name: /loading chart/i })).toBeInTheDocument()
  })
})

describe('FunnelChart — SSR data-table fallback', () => {
  it('renders an off-screen <table> with one row per stage', () => {
    render(<FunnelChart data={threeStage} />)
    const table = screen.getByRole('table', { hidden: true })
    expect(table).toBeInTheDocument()
    const tbody = table.querySelector('tbody')!
    const rows = within(tbody).getAllByRole('row', { hidden: true })
    expect(rows).toHaveLength(3)
  })

  it('SSR fallback contains stage names, formatted counts, and percentages', () => {
    render(<FunnelChart data={threeStage} />)
    const table = screen.getByRole('table', { hidden: true })
    // Stage column
    expect(within(table).getByText('Visited')).toBeInTheDocument()
    expect(within(table).getByText('Signed up')).toBeInTheDocument()
    expect(within(table).getByText('Paid')).toBeInTheDocument()
    // Count column (formatted with thousands separators)
    expect(within(table).getByText('1,000')).toBeInTheDocument()
    expect(within(table).getByText('500')).toBeInTheDocument()
    expect(within(table).getByText('100')).toBeInTheDocument()
    // Percentage column
    expect(within(table).getByText('100%')).toBeInTheDocument()
    expect(within(table).getByText('50%')).toBeInTheDocument()
    expect(within(table).getByText('10%')).toBeInTheDocument()
  })

  it('SSR fallback caption falls back to a default when title is omitted', () => {
    render(<FunnelChart data={threeStage} />)
    const table = screen.getByRole('table', { hidden: true })
    expect(within(table).getByText('Funnel chart data')).toBeInTheDocument()
  })

  it('SSR fallback caption uses the title when supplied', () => {
    render(<FunnelChart data={threeStage} title="Q1 conversion" />)
    const table = screen.getByRole('table', { hidden: true })
    expect(within(table).getByText('Q1 conversion')).toBeInTheDocument()
  })
})

describe('FunnelChart — a11y (jest-axe)', () => {
  it('has no axe violations for a vertical 3-stage funnel', async () => {
    const { container } = render(<FunnelChart data={threeStage} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no axe violations for a horizontal 5-stage funnel', async () => {
    const { container } = render(
      <FunnelChart data={fiveStage} orientation="horizontal" />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no axe violations for the empty state', async () => {
    const { container } = render(<FunnelChart data={[]} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no axe violations for the error state', async () => {
    const { container } = render(
      <FunnelChart data={threeStage} error="Funnel failed" />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('FunnelChart — props pass-through', () => {
  it('forwards ref to the root container', () => {
    let captured: HTMLDivElement | null = null
    render(
      <FunnelChart
        data={threeStage}
        ref={(node) => {
          captured = node
        }}
      />,
    )
    expect(captured).toBeInstanceOf(HTMLDivElement)
  })

  it('uses an explicit aria-label when provided', () => {
    render(<FunnelChart data={threeStage} aria-label="Conversion funnel Q1" />)
    expect(
      screen.getByRole('img', { name: 'Conversion funnel Q1' }),
    ).toBeInTheDocument()
  })

  it('renders the optional title and description', () => {
    render(
      <FunnelChart
        data={threeStage}
        title="Q1 funnel"
        description="From visit to paid"
      />,
    )
    // Title appears twice — once in the visible header, once in the SSR
    // table caption — so we only assert presence, not uniqueness.
    expect(screen.getAllByText('Q1 funnel').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('From visit to paid')).toBeInTheDocument()
  })

  it('lets a consumer data-testid override the default "funnel-chart"', () => {
    render(<FunnelChart data={threeStage} data-testid="my-funnel" />)
    // Consumer-provided data-testid must win over the component's default.
    expect(screen.getByTestId('my-funnel')).toBeInTheDocument()
    expect(screen.queryByTestId('funnel-chart')).toBeNull()
  })
})
