/**
 * Chart Component Tests
 *
 * Focused on the SSR hydration-safety fix for the hidden accessibility
 * data-table (see issue #42).
 *
 * Why these tests are source-level rather than render-level:
 *
 * 1. React strips `suppressHydrationWarning` from the DOM — it is a
 *    build-time directive, not a rendered attribute. A render-based test
 *    cannot observe it.
 * 2. The Chart base component always renders through Recharts'
 *    `ResponsiveContainer`, which depends on `ResizeObserver` (not present
 *    in jsdom by default). We avoid pulling that into the test setup just
 *    for this component.
 *
 * Instead we guard the source intent: the off-screen a11y wrapper must
 * keep `suppressHydrationWarning`. Lab verification on the `/charts` route
 * closes the loop on actual runtime behaviour.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const chartSource = readFileSync(
  resolve(__dirname, 'Chart.tsx'),
  'utf8'
)

describe('Chart (a11y data-table SSR hydration safety)', () => {
  it('source applies suppressHydrationWarning to the off-screen a11y wrapper', () => {
    expect(chartSource).toContain('suppressHydrationWarning')

    // Must be applied to the same element that carries the off-screen
    // positioning — i.e. the accessibility data-table wrapper, not some
    // unrelated future element.
    const offScreenBlockRegex =
      /position:\s*'absolute',\s*left:\s*'-10000px'[\s\S]{0,400}?suppressHydrationWarning/
    expect(offScreenBlockRegex.test(chartSource)).toBe(true)
  })

  it('documents the hydration constraint in the component JSDoc', () => {
    // Consumer-facing guidance: if data is derived from random/dynamic
    // sources, memoize it to keep SSR/client stable. This keeps future
    // maintainers from dropping the docblock during refactors.
    expect(chartSource).toMatch(/SSR\s*\/\s*Hydration/i)
    expect(chartSource).toMatch(/memoize/i)
  })
})
