// @vitest-environment node

/**
 * RSC Smoke Test — server-safe leaf render guard (issue #265 / #276).
 *
 * Imports the server-safe leaf set and asserts each renders via
 * `renderToStaticMarkup` from `react-dom/server` without throwing.
 *
 * Environment: Node (no DOM). This proves none of these components
 * reference browser-only globals at render time, satisfying the
 * "zero client-only API at render" requirement for RSC leaves.
 *
 * The leaf set mirrors the components imported in:
 *   examples/next-app-router/app/page.tsx
 *
 * If a component is added here and blows up with a missing browser API,
 * that component is NOT server-safe and should be added to
 * src/test/use-client-boundary.test.ts instead.
 */

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Server-safe leaf set — these must render in Node with zero client APIs.
import { Badge } from '../components/Badge'
import { Card, CardHeader, CardBody, CardTitle } from '../components/Card'
import { StatusDot } from '../components/StatusDot'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { StepProgress } from '../components/StepProgress'
import { IconButton } from '../components/IconButton'
import { ArticleCard, Byline, Lede, PullQuote } from '../components/ArticleCard'

describe('RSC smoke — server-safe leaves render in Node env without throwing', () => {
  it('Badge renders', () => {
    const html = renderToStaticMarkup(createElement(Badge, { variant: 'success' }, 'Live'))
    expect(html).toBeTruthy()
    expect(html).toContain('Live')
  })

  it('Card + CardHeader + CardBody + CardTitle render', () => {
    const html = renderToStaticMarkup(
      createElement(
        Card,
        null,
        createElement(CardHeader, null, createElement(CardTitle, null, 'Server Card')),
        createElement(CardBody, null, 'Card content'),
      ),
    )
    expect(html).toBeTruthy()
    expect(html).toContain('Server Card')
    expect(html).toContain('Card content')
  })

  it('StatusDot renders', () => {
    const html = renderToStaticMarkup(
      createElement(StatusDot, { variant: 'success', 'aria-label': 'Online' }),
    )
    expect(html).toBeTruthy()
  })

  it('Chip renders', () => {
    const html = renderToStaticMarkup(createElement(Chip, null, 'TypeScript'))
    expect(html).toBeTruthy()
    expect(html).toContain('TypeScript')
  })

  it('EmptyState renders', () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        variant: 'no-data',
        title: 'No results found',
        description: 'Try adjusting your search.',
      }),
    )
    expect(html).toBeTruthy()
    expect(html).toContain('No results found')
  })

  it('PageHeader renders', () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, { title: 'Dashboard Overview', subtitle: 'Server rendered' }),
    )
    expect(html).toBeTruthy()
    expect(html).toContain('Dashboard Overview')
  })

  it('StepProgress renders', () => {
    const html = renderToStaticMarkup(
      createElement(StepProgress, {
        steps: [
          { label: 'Plan', status: 'completed' },
          { label: 'Build', status: 'active' },
          { label: 'Ship', status: 'upcoming' },
        ],
        variant: 'numbered',
      }),
    )
    expect(html).toBeTruthy()
    expect(html).toContain('Plan')
  })

  it('IconButton renders', () => {
    const svgIcon = createElement(
      'svg',
      { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' },
      createElement('path', { d: 'M5 12h14' }),
    )
    const html = renderToStaticMarkup(
      createElement(IconButton, { 'aria-label': 'Edit', variant: 'ghost', children: svgIcon }),
    )
    expect(html).toBeTruthy()
  })

  it('ArticleCard renders', () => {
    const html = renderToStaticMarkup(
      createElement(ArticleCard, {
        headline: 'RSC Support Lands',
        scale: 'supporting',
        headlineAs: 'h3',
        byline: 'Test Author',
        date: '2026-06-20',
        lede: 'A test lede paragraph.',
      }),
    )
    expect(html).toBeTruthy()
    expect(html).toContain('RSC Support Lands')
  })

  it('Byline renders', () => {
    const html = renderToStaticMarkup(createElement(Byline, { name: 'Landon Owens', date: '2026-06-20' }))
    expect(html).toBeTruthy()
    expect(html).toContain('Landon Owens')
  })

  it('Lede renders', () => {
    const html = renderToStaticMarkup(createElement(Lede, null, 'A standalone lede paragraph.'))
    expect(html).toBeTruthy()
    expect(html).toContain('A standalone lede paragraph.')
  })

  it('PullQuote renders', () => {
    const html = renderToStaticMarkup(
      createElement(PullQuote, null, 'Server components are the future.'),
    )
    expect(html).toBeTruthy()
    expect(html).toContain('Server components are the future.')
  })
})
