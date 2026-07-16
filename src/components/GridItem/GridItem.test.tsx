/**
 * GridItem Component Tests (#374)
 *
 * Covers:
 *  - `span` (numeric and 'full') → grid-column inline style
 *  - `rowSpan` (numeric and 'full') → grid-row inline style
 *  - Explicit start/end placement wins over span
 *  - Defensive handling for invalid span values (0 / negative / NaN)
 *  - `as` polymorphism
 *  - forwardRef + style merging
 */

import { createRef } from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GridItem } from './GridItem'

describe('GridItem', () => {
  it('renders children and is a `<div>` by default', () => {
    const { container, getByText } = render(
      <GridItem>
        <span>cell</span>
      </GridItem>,
    )
    expect(getByText('cell')).toBeInTheDocument()
    expect((container.firstChild as HTMLElement).tagName).toBe('DIV')
  })

  it('renders no grid-placement style when span/start/end are all omitted', () => {
    const { container } = render(<GridItem>c</GridItem>)
    const el = container.firstChild as HTMLElement
    expect(el.style.gridColumn).toBe('')
    expect(el.style.gridRow).toBe('')
  })

  // span (column) — the headline #374 ask.
  describe('span (columns)', () => {
    it('emits `grid-column: span <n>` for a numeric span', () => {
      const { container } = render(<GridItem span={2}>c</GridItem>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gridColumn).toBe('span 2')
    })

    it('floors fractional spans', () => {
      const { container } = render(<GridItem span={2.7}>c</GridItem>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gridColumn).toBe('span 2')
    })

    it('emits `grid-column: 1 / -1` for span="full"', () => {
      const { container } = render(<GridItem span="full">c</GridItem>)
      const el = container.firstChild as HTMLElement
      // jsdom may normalize the shorthand to `1 / -1` (no change) or
      // collapse spaces. Accept both forms.
      expect(el.style.gridColumn.replace(/\s+/g, ' ')).toBe('1 / -1')
    })

    it('falls back to `auto` for invalid spans (0, negative, non-finite)', () => {
      for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const { container } = render(<GridItem span={bad}>c</GridItem>)
        const el = container.firstChild as HTMLElement
        expect(el.style.gridColumn).toBe('auto')
      }
    })
  })

  // rowSpan — symmetric with span.
  describe('rowSpan', () => {
    it('emits `grid-row: span <n>` for a numeric rowSpan', () => {
      const { container } = render(<GridItem rowSpan={3}>c</GridItem>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gridRow).toBe('span 3')
    })

    it('emits `grid-row: 1 / -1` for rowSpan="full"', () => {
      const { container } = render(<GridItem rowSpan="full">c</GridItem>)
      const el = container.firstChild as HTMLElement
      expect(el.style.gridRow.replace(/\s+/g, ' ')).toBe('1 / -1')
    })

    it('combines independently with `span`', () => {
      const { container } = render(
        <GridItem span={2} rowSpan="full">
          c
        </GridItem>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridColumn).toBe('span 2')
      expect(el.style.gridRow.replace(/\s+/g, ' ')).toBe('1 / -1')
    })
  })

  // Explicit placement.
  describe('explicit start/end placement', () => {
    it('emits gridColumnStart / gridColumnEnd when both are passed', () => {
      const { container } = render(
        <GridItem columnStart={2} columnEnd={4}>
          c
        </GridItem>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridColumnStart).toBe('2')
      expect(el.style.gridColumnEnd).toBe('4')
    })

    it('emits gridRowStart / gridRowEnd when both are passed', () => {
      const { container } = render(
        <GridItem rowStart={1} rowEnd={3}>
          c
        </GridItem>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridRowStart).toBe('1')
      expect(el.style.gridRowEnd).toBe('3')
    })

    it('explicit columnStart wins over span (shorthand grid-column NOT set)', () => {
      const { container } = render(
        <GridItem span={2} columnStart={3}>
          c
        </GridItem>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridColumnStart).toBe('3')
      expect(el.style.gridColumn).toBe('')
    })

    it('accepts a negative columnEnd (e.g. -1 = last gridline)', () => {
      const { container } = render(
        <GridItem columnStart={2} columnEnd={-1}>
          c
        </GridItem>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridColumnStart).toBe('2')
      expect(el.style.gridColumnEnd).toBe('-1')
    })
  })

  // Polymorphism + ref + style merging.
  it('swaps the root element via the `as` prop', () => {
    const { container } = render(<GridItem as="article">c</GridItem>)
    expect((container.firstChild as HTMLElement).tagName).toBe('ARTICLE')
  })

  it('forwards ref to the rendered root', () => {
    const ref = createRef<HTMLDivElement>()
    render(<GridItem ref={ref}>c</GridItem>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('merges user `style` with computed placement (computed wins on conflict)', () => {
    const { container } = render(
      <GridItem span={2} style={{ color: 'red', gridColumn: '99' }}>
        c
      </GridItem>,
    )
    const el = container.firstChild as HTMLElement
    // Non-conflicting user style survives.
    expect(el.style.color).toBe('red')
    // GridItem's computed span wins.
    expect(el.style.gridColumn).toBe('span 2')
  })

  it('merges custom className', () => {
    const { container } = render(<GridItem className="user-cell">c</GridItem>)
    const el = container.firstChild as HTMLElement
    expect(el.className).toBe('user-cell')
  })

  /* ------------------------------------------------------------------ *
   *  #423 — consumer ...rest pass-through to the rendered element
   *  (style was already supported; this locks the rest-spread in.)
   * ------------------------------------------------------------------ */
  describe('consumer passthrough (#423)', () => {
    it('lands consumer data-testid on the <div> visual root', () => {
      const { container } = render(
        <GridItem data-testid="cell-root">c</GridItem>,
      )
      const el = container.firstChild as HTMLElement
      expect(el).toHaveAttribute('data-testid', 'cell-root')
    })

    it('applies consumer style.color to the visual root', () => {
      const { container } = render(
        <GridItem style={{ color: 'rgb(1, 2, 3)' }}>c</GridItem>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.color).toBe('rgb(1, 2, 3)')
    })

    it('forwards rest props onto the polymorphic `as` element', () => {
      const { container } = render(
        <GridItem as="section" id="cell-1" role="listitem" span={2}>
          c
        </GridItem>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.tagName).toBe('SECTION')
      expect(el).toHaveAttribute('id', 'cell-1')
      expect(el).toHaveAttribute('role', 'listitem')
      // Prop-driven placement still wins.
      expect(el.style.gridColumn).toBe('span 2')
    })
  })
})
