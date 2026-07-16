/**
 * SegmentedControl Component Tests
 *
 * Covers the mutually-exclusive pill control:
 * - renders all options with correct roles (tablist/tab)
 * - marks the selected option with aria-selected
 * - onChange fires with the clicked option's value
 * - supports controlled value (rerender flips selection)
 * - keyboard navigation: ArrowLeft/ArrowRight/Home/End cycle selection
 * - size variant applies CSS class
 * - disabled blocks interaction
 * - includes axe a11y smoke check
 */

import { useState } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { SegmentedControl, SegmentedControlOption } from './SegmentedControl'

expect.extend(toHaveNoViolations)

const OPTIONS: SegmentedControlOption[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'kanban', label: 'Kanban' },
]

function classAttr(el: Element | null): string {
  if (!el) return ''
  return el.getAttribute('class') ?? ''
}

describe('SegmentedControl', () => {
  it('renders all options as tabs with a tablist container', () => {
    render(
      <SegmentedControl options={OPTIONS} value="list" onChange={() => {}} />
    )
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(OPTIONS.length)
    for (const opt of OPTIONS) {
      expect(screen.getByRole('tab', { name: opt.label })).toBeInTheDocument()
    }
  })

  it('marks the selected option with aria-selected=true', () => {
    render(
      <SegmentedControl options={OPTIONS} value="grid" onChange={() => {}} />
    )
    const selected = screen.getByRole('tab', { name: 'Grid' })
    const unselected = screen.getByRole('tab', { name: 'List' })
    expect(selected.getAttribute('aria-selected')).toBe('true')
    expect(unselected.getAttribute('aria-selected')).toBe('false')
  })

  it('fires onChange with the new value when an option is clicked', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl options={OPTIONS} value="list" onChange={onChange} />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Kanban' }))
    expect(onChange).toHaveBeenCalledWith('kanban')
  })

  it('supports controlled value (selection follows rerender)', () => {
    function Controlled() {
      const [value, setValue] = useState('list')
      return (
        <SegmentedControl options={OPTIONS} value={value} onChange={setValue} />
      )
    }
    render(<Controlled />)
    expect(
      screen
        .getByRole('tab', { name: 'List' })
        .getAttribute('aria-selected')
    ).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Grid' }))
    expect(
      screen
        .getByRole('tab', { name: 'Grid' })
        .getAttribute('aria-selected')
    ).toBe('true')
  })

  it('keyboard: ArrowRight advances selection (and wraps at end)', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl options={OPTIONS} value="list" onChange={onChange} />
    )
    fireEvent.keyDown(screen.getByRole('tab', { name: 'List' }), {
      key: 'ArrowRight',
    })
    expect(onChange).toHaveBeenLastCalledWith('grid')
  })

  it('keyboard: ArrowLeft moves selection back (and wraps at start)', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl options={OPTIONS} value="list" onChange={onChange} />
    )
    fireEvent.keyDown(screen.getByRole('tab', { name: 'List' }), {
      key: 'ArrowLeft',
    })
    // wraps to last
    expect(onChange).toHaveBeenLastCalledWith('kanban')
  })

  it('keyboard: Home jumps to first and End jumps to last', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl options={OPTIONS} value="grid" onChange={onChange} />
    )
    const selected = screen.getByRole('tab', { name: 'Grid' })
    fireEvent.keyDown(selected, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('list')
    fireEvent.keyDown(selected, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('kanban')
  })

  it('applies size variant class (sm/md/lg)', () => {
    // #270 — the size class lives on the `role="tablist"` control element, not
    // on the outer `.sizer` container-query wrapper, so assert against the
    // tablist directly (was `container.firstChild`, which is now the wrapper).
    const { rerender } = render(
      <SegmentedControl
        options={OPTIONS}
        value="list"
        onChange={() => {}}
        size="sm"
      />
    )
    expect(classAttr(screen.getByRole('tablist'))).toMatch(/sm/)
    rerender(
      <SegmentedControl
        options={OPTIONS}
        value="list"
        onChange={() => {}}
        size="lg"
      />
    )
    expect(classAttr(screen.getByRole('tablist'))).toMatch(/lg/)
  })

  it('disabled: does not fire onChange and marks buttons disabled', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        options={OPTIONS}
        value="list"
        onChange={onChange}
        disabled
      />
    )
    const tabs = screen.getAllByRole('tab')
    for (const t of tabs) {
      expect((t as HTMLButtonElement).disabled).toBe(true)
    }
    fireEvent.click(tabs[1]!) // safe: 3 OPTIONS render 3 tabs; getAllByRole throws on zero
    expect(onChange).not.toHaveBeenCalled()
  })

  // #422 — consumer className / style / testid land on the VISUAL ROOT (the
  // `role="tablist"` control), not the outer `.sizer` container-query wrapper.
  it('routes data-testid to the visual root (the tablist), not the sizer wrapper', () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="list"
        onChange={() => {}}
        data-testid="segmented"
      />
    )
    const tablist = screen.getByRole('tablist')
    expect(screen.getByTestId('segmented')).toBe(tablist)
    // The sizer wrapper is the tablist's parent and must NOT carry the testid.
    expect((tablist.parentElement as HTMLElement).getAttribute('data-testid')).toBeNull()
  })

  it('consumer inline style wins on the visual root (the tablist)', () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="list"
        onChange={() => {}}
        style={{ color: 'rgb(1, 2, 3)' }}
      />
    )
    expect(screen.getByRole('tablist')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('consumer className lands on the tablist, not the sizer wrapper', () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="list"
        onChange={() => {}}
        className="custom-cls"
      />
    )
    const tablist = screen.getByRole('tablist')
    expect(classAttr(tablist)).toMatch(/custom-cls/)
    expect(classAttr(tablist.parentElement)).not.toMatch(/custom-cls/)
  })

  it('wrapperClassName / wrapperStyle land on the outer sizer wrapper', () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="list"
        onChange={() => {}}
        wrapperClassName="wrap-cls"
        wrapperStyle={{ marginTop: '8px' }}
      />
    )
    const wrapper = screen.getByRole('tablist').parentElement as HTMLElement
    expect(classAttr(wrapper)).toMatch(/wrap-cls/)
    expect(wrapper).toHaveStyle({ marginTop: '8px' })
    // The tablist itself should not carry the wrapper class.
    expect(classAttr(screen.getByRole('tablist'))).not.toMatch(/wrap-cls/)
  })

  it('keeps role="tablist" even if a consumer passes their own role', () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="list"
        onChange={() => {}}
        role="presentation"
        data-testid="seg-root"
      />
    )
    // `role` is a hard a11y contract — the internal tablist role must win
    // over consumer rest-props.
    expect(screen.getByTestId('seg-root')).toHaveAttribute('role', 'tablist')
  })

  // #463 — a `SegmentedControl` in a flex row (Header actions / any Inline/flex
  // container) collapsed to ~0 and overflowed the page: `.sizer` is an
  // inline-size container-query host (`container-type: inline-size`, applies
  // size containment) and, as a flex/grid item with no intrinsic width, shrank
  // to 0 while the inner control spilled past the viewport. The fix gives
  // `.sizer` an EXTRINSIC `width: 100%` so containment cannot collapse it, while
  // KEEPING the container-query host (locked by container-query-sweep.test.ts).
  // jsdom applies no layout / container-queries, so lock the fix in the
  // stylesheet SOURCE (browser-verified separately for actual widths).
  it('.sizer keeps its inline-size query host AND an explicit width so it cannot collapse in a flex row (#463)', () => {
    const cssPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      'SegmentedControl.module.css'
    )
    const css = readFileSync(cssPath, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')
    const match = css.match(/\.sizer\s*\{([^}]*)\}/)
    expect(match, 'could not find the .sizer rule in SegmentedControl.module.css').toBeTruthy()
    const body = match![1]
    // #270 — still an inline-size container-query host (also enforced by the sweep guard).
    expect(body).toMatch(/container:\s*segmented-control\s*\/\s*inline-size/)
    // #463 — extrinsic width prevents inline-size containment collapsing the wrapper to 0.
    expect(body).toMatch(/width:\s*100%/)
  })

  it('has no axe violations', async () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="list" onChange={() => {}} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  describe('uncontrolled (#508)', () => {
    it('selects via defaultValue and moves selection on click without a controlling parent', () => {
      const onChange = vi.fn()
      render(
        <SegmentedControl options={OPTIONS} defaultValue="list" onChange={onChange} />
      )
      expect(screen.getByRole('tab', { name: 'List' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      // No parent feeds `value` back — selection must move via internal state.
      fireEvent.click(screen.getByRole('tab', { name: 'Grid' }))
      expect(screen.getByRole('tab', { name: 'Grid' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      expect(screen.getByRole('tab', { name: 'List' })).toHaveAttribute(
        'aria-selected',
        'false'
      )
      expect(onChange).toHaveBeenCalledWith('grid')
    })

    it('is usable with neither value nor onChange (starts unselected)', () => {
      render(<SegmentedControl options={OPTIONS} />)
      OPTIONS.forEach((o) => {
        expect(screen.getByRole('tab', { name: o.label })).toHaveAttribute(
          'aria-selected',
          'false'
        )
      })
      fireEvent.click(screen.getByRole('tab', { name: 'Kanban' }))
      expect(screen.getByRole('tab', { name: 'Kanban' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })
  })

  describe('controlled-ness by prop presence (#508 regression)', () => {
    it('stays controlled when value is undefined (does not self-activate)', () => {
      // value present (even as undefined) → controlled. With onChange ignored,
      // clicking must NOT move selection internally. (Guards the undefined-
      // sentinel collision the naive value!==undefined rule would introduce.)
      const onChange = vi.fn()
      render(<SegmentedControl options={OPTIONS} value={undefined} onChange={onChange} />)
      fireEvent.click(screen.getByRole('tab', { name: 'Grid' }))
      expect(screen.getByRole('tab', { name: 'Grid' })).toHaveAttribute(
        'aria-selected',
        'false'
      )
      expect(onChange).toHaveBeenCalledWith('grid') // still notifies the parent
    })
  })
})
