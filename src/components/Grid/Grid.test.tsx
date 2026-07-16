/**
 * Grid Component Tests
 *
 * Smoke coverage for the autoFill / minColumnWidth props added in
 * Sprint 10 (issue #60). Keeps the existing `columns` behavior covered
 * alongside so we catch regressions when autoFill is off.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Grid } from './Grid'

describe('Grid', () => {
  it('renders with default single column when no props given', () => {
    const { container } = render(
      <Grid>
        <div>a</div>
      </Grid>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.gridTemplateColumns).toBe('repeat(1, 1fr)')
  })

  it('uses auto-fill grid-template-columns when autoFill is true', () => {
    const { container } = render(
      <Grid autoFill minColumnWidth="340px">
        <div>a</div>
      </Grid>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.gridTemplateColumns).toBe(
      'repeat(auto-fill, minmax(340px, 1fr))'
    )
  })

  it('falls back to 280px minColumnWidth when autoFill is true but no width given', () => {
    const { container } = render(
      <Grid autoFill>
        <div>a</div>
      </Grid>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.gridTemplateColumns).toBe(
      'repeat(auto-fill, minmax(280px, 1fr))'
    )
  })

  it('ignores numeric columns prop when autoFill is true', () => {
    const { container } = render(
      <Grid autoFill minColumnWidth="300px" columns={3}>
        <div>a</div>
      </Grid>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.gridTemplateColumns).toBe(
      'repeat(auto-fill, minmax(300px, 1fr))'
    )
  })

  it('ignores responsive columns object when autoFill is true', () => {
    const { container } = render(
      <Grid autoFill minColumnWidth="320px" columns={{ sm: 1, md: 2, lg: 3 }}>
        <div>a</div>
      </Grid>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.gridTemplateColumns).toBe(
      'repeat(auto-fill, minmax(320px, 1fr))'
    )
    // None of the responsive column helper classes should be applied.
    expect(el.className).not.toMatch(/cols-(sm|md|lg)-/)
    expect(el.className).not.toMatch(/responsive/)
  })

  it('still applies responsive column classes when autoFill is false', () => {
    const { container } = render(
      <Grid columns={{ sm: 1, md: 2, lg: 3 }}>
        <div>a</div>
      </Grid>
    )
    const el = container.firstChild as HTMLElement
    // At least one of the responsive helpers should land.
    expect(el.className).toMatch(/cols-sm-1/)
    expect(el.className).toMatch(/cols-md-2/)
    expect(el.className).toMatch(/cols-lg-3/)
  })

  // #136 — CSS subgrid support
  describe('subgrid', () => {
    it('emits gridTemplateColumns: subgrid when subgrid="columns"', () => {
      const { container } = render(
        <Grid subgrid="columns">
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridTemplateColumns).toBe('subgrid')
      expect(el.style.gridTemplateRows).toBe('')
    })

    it('emits gridTemplateRows: subgrid when subgrid="rows"', () => {
      const { container } = render(
        <Grid subgrid="rows">
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridTemplateRows).toBe('subgrid')
      // The columns axis falls back to the default `columns = 1` track.
      expect(el.style.gridTemplateColumns).toBe('repeat(1, 1fr)')
    })

    it('emits both axes when subgrid="both"', () => {
      const { container } = render(
        <Grid subgrid="both">
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridTemplateColumns).toBe('subgrid')
      expect(el.style.gridTemplateRows).toBe('subgrid')
    })

    it('subgrid="columns" overrides autoFill on the columns axis', () => {
      const { container } = render(
        <Grid subgrid="columns" autoFill minColumnWidth="340px">
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridTemplateColumns).toBe('subgrid')
    })

    it('subgrid="columns" overrides a numeric columns prop', () => {
      const { container } = render(
        <Grid subgrid="columns" columns={3}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridTemplateColumns).toBe('subgrid')
    })

    it('subgrid="columns" skips the responsive helper classes', () => {
      const { container } = render(
        <Grid subgrid="columns" columns={{ sm: 1, md: 2, lg: 3 }}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.className).not.toMatch(/cols-(sm|md|lg)-/)
      expect(el.className).not.toMatch(/responsive/)
    })

    it('subgrid="rows" overrides autoRows', () => {
      const { container } = render(
        <Grid subgrid="rows" autoRows="minmax(200px, auto)">
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridTemplateRows).toBe('subgrid')
      // gridAutoRows should not be applied when subgrid covers the rows axis.
      expect(el.style.gridAutoRows).toBe('')
    })
  })

  // #374 — `gap` as `{ row, column }` so authors don't have to remember
  // tuple position.
  describe('gap as { row, column } object (#374)', () => {
    it('splits an object gap into rowGap + columnGap (numbers → px)', () => {
      const { container } = render(
        <Grid gap={{ row: 8, column: 24 }}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.rowGap).toBe('8px')
      expect(el.style.columnGap).toBe('24px')
      // Shorthand `gap` should NOT be set — that'd mask the split values.
      expect(el.style.gap).toBe('')
    })

    it('accepts strings for either axis (passed verbatim)', () => {
      const { container } = render(
        <Grid gap={{ row: '0.5rem', column: 'var(--spacing-lg)' }}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.rowGap).toBe('0.5rem')
      expect(el.style.columnGap).toBe('var(--spacing-lg)')
    })

    it('lets one axis be omitted (only the supplied side is set)', () => {
      const { container } = render(
        <Grid gap={{ row: 16 }}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.rowGap).toBe('16px')
      expect(el.style.columnGap).toBe('')
    })

    it('object gap ignores the legacy rowGap / columnGap props', () => {
      // Object form is the new authoritative API. We don't merge — passing
      // an object cleanly supersedes any legacy positional props.
      const { container } = render(
        <Grid gap={{ row: 4 }} rowGap={99} columnGap={99}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      // Object's row wins; column stays unset (NOT 99px).
      expect(el.style.rowGap).toBe('4px')
      expect(el.style.columnGap).toBe('')
    })

    it('still falls through to rowGap / columnGap when `gap` is omitted', () => {
      const { container } = render(
        <Grid rowGap={8} columnGap={24}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.rowGap).toBe('8px')
      expect(el.style.columnGap).toBe('24px')
    })

    it('still accepts the existing scalar `gap` form', () => {
      const { container } = render(
        <Grid gap={16}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      // jsdom may serialize the gap shorthand to longhands in some versions —
      // assert against either path so we don't pin to a jsdom version.
      expect([el.style.gap, el.style.rowGap, el.style.columnGap].some(v =>
        /16px/.test(v),
      )).toBe(true)
    })
  })

  // style prop — added so consumers can position Grid in a parent grid
  // (e.g. `gridRow: 'span 3'` on a subgridded child).
  describe('style prop', () => {
    it('forwards arbitrary inline styles to the rendered element', () => {
      const { container } = render(
        <Grid style={{ gridRow: 'span 3', transform: 'translateY(4px)' }}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.gridRow).toBe('span 3')
      expect(el.style.transform).toBe('translateY(4px)')
    })

    it('lets Grid-computed track/gap styles win over user style on conflict', () => {
      const { container } = render(
        <Grid
          columns={2}
          gap={16}
          style={{ gridTemplateColumns: 'repeat(99, 1fr)', gap: '999px' }}
        >
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      // Grid's computed values override the user attempt to set tracks/gap inline.
      expect(el.style.gridTemplateColumns).toBe('repeat(2, 1fr)')
      expect(el.style.gap).toBe('16px')
    })
  })

  /* ------------------------------------------------------------------ *
   *  #423 — consumer ...rest pass-through to the <div> root
   *  (style was already supported; this locks the rest-spread in.)
   * ------------------------------------------------------------------ */
  describe('consumer passthrough (#423)', () => {
    it('lands consumer data-testid on the <div> visual root', () => {
      const { container } = render(
        <Grid data-testid="grid-root">
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el).toHaveAttribute('data-testid', 'grid-root')
    })

    it('applies consumer style.color to the <div> visual root', () => {
      const { container } = render(
        <Grid style={{ color: 'rgb(1, 2, 3)' }}>
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.color).toBe('rgb(1, 2, 3)')
    })

    it('forwards arbitrary rest props (id, role) to the <div> root', () => {
      const { container } = render(
        <Grid id="dashboard-grid" role="list">
          <div>a</div>
        </Grid>,
      )
      const el = container.firstChild as HTMLElement
      expect(el).toHaveAttribute('id', 'dashboard-grid')
      expect(el).toHaveAttribute('role', 'list')
    })
  })
})
