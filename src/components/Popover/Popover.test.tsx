/**
 * Popover Component Tests
 *
 * Regression coverage for:
 * - #37 Popover isPositioned race: overlay stuck at (0, 0) opacity 0 on first click
 * - #35/#46 Nested overlays inside Modal: Popover-in-Modal must render above the
 *   Modal backdrop, not behind it
 *
 * Notes on test infrastructure:
 *
 * `jsdom` does not run a real rAF loop unless we either use fake timers or
 * manually flush. For the positioning-race test we rely on `act()` wrapping the
 * click + the default browser rAF behavior from vitest's jsdom to flush the
 * synchronous `useLayoutEffect` + rAF measurement. We assert on the settled
 * state (`opacity: 1`) as the observable contract: if the race regresses,
 * `isPositioned` never flips and the class stays off.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Popover } from './Popover'
import { Modal } from '../Modal'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => {
    vi.runOnlyPendingTimers()
  })
  vi.useRealTimers()
})

function advance(ms = 0) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

// The rAF measurement loop isn't driven by jest-style fake timers; jsdom's
// rAF falls back to a setTimeout-like trampoline. advance() covers both.
function flushRaf(times = 3) {
  for (let i = 0; i < times; i++) {
    advance(16)
  }
}

describe('Popover', () => {
  describe('click mode — basic visibility', () => {
    it('appends popover to DOM when trigger is clicked', () => {
      render(
        <Popover
          content={<div>Tip content</div>}
          triggerOn="click"
          trigger={<button>Open</button>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      flushRaf()

      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('Tip content')).toBeInTheDocument()
    })

    it('portals content to document.body, not into the trigger subtree (#31 parity)', () => {
      render(
        <div
          data-testid="clip"
          style={{ overflow: 'hidden', width: 100, height: 20 }}
        >
          <Popover
            content={<div>Escapes</div>}
            triggerOn="click"
            trigger={<button>Open</button>}
          />
        </div>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      flushRaf()

      const popover = screen.getByRole('tooltip')
      const clip = screen.getByTestId('clip')
      expect(clip.contains(popover)).toBe(false)
      expect(document.body.contains(popover)).toBe(true)
    })
  })

  describe('isPositioned race (#37)', () => {
    it('flips visible class on after first mount (no stuck-at-opacity-0)', () => {
      // This is the core #37 regression. Before the fix, clicking the trigger
      // appended the overlay to the DOM but `isPositioned` stayed false —
      // `.visible` class never attached, opacity stayed 0, user saw nothing.
      render(
        <Popover
          content={<div>Filter options</div>}
          triggerOn="click"
          trigger={<button>Filter</button>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
      flushRaf()

      const popover = screen.getByRole('tooltip')
      // The `.visible` style is what drives opacity: 1 in Popover.module.css.
      // If positioning races, the className stays `popover top` without the
      // visible modifier, which is the bug we're guarding against.
      expect(popover.className).toMatch(/visible/)
    })

    it('does not remain at initial coordinates (0, 0) after mount', () => {
      // The observable side of the race. Before the fix the inline style was
      // `top: 0px; left: 0px`. After the fix we should see either the
      // off-screen sentinel `-9999px` (pre-measurement, visibility: hidden) or
      // measured coords. We assert the class flip since jsdom's layout doesn't
      // populate real rects, but assert coords aren't the stuck 0,0 default.
      render(
        <Popover
          content={<div>x</div>}
          triggerOn="click"
          trigger={<button>Trig</button>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Trig' }))
      flushRaf()

      const popover = screen.getByRole('tooltip')
      // The fix sets `top` from the usePortalPosition hook. In jsdom both rect
      // measurements are zero, which lands at non-0 values because of the
      // negative-offset calculation (trigger.top - popover.height - offset =
      // 0 - 0 - 8 = -8). The bug-state is exactly `0, 0`, so anything other
      // than that pair is acceptable.
      expect([popover.style.top, popover.style.left]).not.toEqual(['0px', '0px'])
    })
  })

  describe('usePortalPosition parity', () => {
    it('exposes data-placement and data-portal-content attributes', () => {
      render(
        <Popover
          content={<div>Tip</div>}
          triggerOn="click"
          placement="top"
          trigger={<button>Open</button>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Open' }))
      flushRaf()

      const popover = screen.getByRole('tooltip')
      // data-placement is read by consumer outside-click handlers and by
      // test harnesses. Must be one of the four directions.
      expect(popover.getAttribute('data-placement')).toMatch(
        /top|bottom|left|right/
      )
      // data-portal-content tells consumer overlays (e.g. Modal's outside-
      // click handler) that a click inside the popover is "inside".
      expect(popover).toHaveAttribute('data-portal-content')
    })

    it('handles left/right placement without crashing (horizontal rAF loop)', () => {
      const { unmount } = render(
        <Popover
          content={<div>L</div>}
          triggerOn="click"
          placement="left"
          trigger={<button>Left</button>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Left' }))
      flushRaf()

      expect(screen.getByRole('tooltip')).toHaveTextContent('L')
      unmount()

      render(
        <Popover
          content={<div>R</div>}
          triggerOn="click"
          placement="right"
          trigger={<button>Right</button>}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Right' }))
      flushRaf()

      expect(screen.getByRole('tooltip')).toHaveTextContent('R')
    })
  })

  describe('keyboard accessibility (#13)', () => {
    it('shows on keyboard focus when triggerOn="hover" (WCAG 2.1.1)', () => {
      render(
        <Popover
          content={<div>Keyboard-reachable tip</div>}
          triggerOn="hover"
          trigger={<button>Focus me</button>}
        />
      )

      // Before the fix, hover-only popovers were invisible to keyboard users.
      // Focus should now act as a show trigger equivalent to hover.
      const triggerBtn = screen.getByRole('button', { name: 'Focus me' })
      fireEvent.focus(triggerBtn)
      flushRaf()

      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'Keyboard-reachable tip'
      )
    })

    it('hides on blur when triggerOn="hover"', () => {
      render(
        <Popover
          content={<div>Keyboard tip</div>}
          triggerOn="hover"
          trigger={<button>Focus me</button>}
        />
      )

      const triggerBtn = screen.getByRole('button', { name: 'Focus me' })
      fireEvent.focus(triggerBtn)
      flushRaf()
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      fireEvent.blur(triggerBtn)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('dismisses on Escape in hover mode (WCAG 2.1.1)', () => {
      render(
        <Popover
          content={<div>Dismissable tip</div>}
          triggerOn="hover"
          trigger={<button>Focus me</button>}
        />
      )

      const triggerBtn = screen.getByRole('button', { name: 'Focus me' })
      fireEvent.focus(triggerBtn)
      flushRaf()
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      // Escape must dismiss even though triggerOn is hover, not click.
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('hover popover content has mouseenter/mouseleave handlers (hover bridge)', () => {
      // The hover bridge — Popover.tsx wires onMouseEnter/onMouseLeave on the
      // portaled content so moving the pointer from trigger → content doesn't
      // race the hide. We assert the content renders and reopening works.
      render(
        <Popover
          content={<a href="#link">Inside link</a>}
          triggerOn="hover"
          trigger={<button>Hover</button>}
        />
      )

      const triggerBtn = screen.getByRole('button', { name: 'Hover' })
      fireEvent.mouseEnter(triggerBtn)
      act(() => {
        vi.advanceTimersByTime(300)
      })
      flushRaf()

      const popover = screen.getByRole('tooltip')
      expect(popover).toBeInTheDocument()
      expect(popover).toHaveTextContent('Inside link')

      // Hovering the popover content re-cancels any pending hide. We simulate
      // this by entering the content — because there's no hide pending in
      // this moment, the popover simply stays up.
      fireEvent.mouseEnter(popover)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      // Leaving the popover content triggers an explicit hide path.
      fireEvent.mouseLeave(popover)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  describe('nested inside Modal (#35, #46)', () => {
    function PopoverInModal() {
      const [open, setOpen] = useState(true)
      return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Form">
          <Popover
            content={<div>Help text</div>}
            triggerOn="click"
            trigger={<button>Help</button>}
          />
        </Modal>
      )
    }

    it('renders Popover content inside the open Modal dialog subtree (#14 v2)', () => {
      render(<PopoverInModal />)

      fireEvent.click(screen.getByRole('button', { name: 'Help' }))
      flushRaf()

      const popover = screen.getByRole('tooltip')
      const popoverZ = Number(
        getComputedStyle(popover).getPropertyValue('z-index') || '0'
      )
      expect(document.body.contains(popover)).toBe(true)

      // #14 v2 (see Modal.tsx file-top comment / NestedOverlays.test.tsx):
      // a Popover nested in an OPEN Modal now renders as a DOM DESCENDANT of
      // that Modal's <dialog> via useModalPortalContainer(), not a
      // document.body sibling — that's what exempts it from the dialog's
      // native `inert` subtree in a real browser (the z-index-based
      // top-layer-escape z-index contract below still holds for the
      // STANDALONE, non-nested case; see the "standalone" tests elsewhere in
      // this file and the Dropdown/Popover-in-Modal coverage in
      // nested-overlays.test.tsx for that path).
      const modalDialog = screen.getByRole('dialog')
      expect(popover.contains(modalDialog)).toBe(false)
      expect(modalDialog.contains(popover)).toBe(true)

      // The numeric z-index should either be a resolved number or come from
      // the custom property; either way, the class name includes `.visible`
      // confirming `isPositioned` flipped correctly inside the Modal portal.
      expect(popover.className).toMatch(/visible/)
      // Guard: if jsdom resolved z-index, it must be >= modal's (1100).
      if (!Number.isNaN(popoverZ) && popoverZ > 0) {
        expect(popoverZ).toBeGreaterThanOrEqual(1100)
      }

      // Nested in an open Modal, the popover does NOT opt into the Popover
      // API (it's already exempt from inertness by DOM ancestry — see
      // Popover.tsx). Emitting `popover="manual"` without ever calling
      // showPopover() would leave it UA-stylesheet-hidden.
      expect(popover).not.toHaveAttribute('popover')
    })
  })
})

describe('Popover — unique ids (#330 regression)', () => {
  it('two open Popovers get DISTINCT ids (no hardcoded "popover-content")', () => {
    // #330: the id was hardcoded to "popover-content", so two Popovers on one
    // page produced duplicate ids (invalid HTML + broken aria-describedby).
    // They now derive from useId(); pin that two instances never collide.
    render(
      <>
        <Popover
          content={<div>First</div>}
          triggerOn="click"
          trigger={<button>One</button>}
        />
        <Popover
          content={<div>Second</div>}
          triggerOn="click"
          trigger={<button>Two</button>}
        />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'One' }))
    fireEvent.click(screen.getByRole('button', { name: 'Two' }))
    flushRaf()

    const popovers = screen.getAllByRole('tooltip')
    expect(popovers).toHaveLength(2)

    const [idA, idB] = popovers.map((p) => p.id)
    expect(idA).toBeTruthy()
    expect(idB).toBeTruthy()
    expect(idA).not.toBe(idB)
  })
})

describe('Popover — passthrough (#423)', () => {
  it('forwards data-testid and style to the popover surface (visual root)', () => {
    render(
      <Popover
        content={<div>Tip content</div>}
        triggerOn="click"
        trigger={<button>Open</button>}
        data-testid="my-popover"
        style={{ color: 'rgb(1, 2, 3)' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    flushRaf()

    const popover = screen.getByTestId('my-popover')
    expect(popover).toBe(screen.getByRole('tooltip'))
    expect(popover).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('does not let a consumer role override the internal role', () => {
    render(
      <Popover
        content={<div>Tip content</div>}
        triggerOn="click"
        trigger={<button>Open</button>}
        data-testid="role-popover"
        role="menu"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    flushRaf()

    const popover = screen.getByTestId('role-popover')
    expect(popover).toHaveAttribute('role', 'tooltip')
  })
})
