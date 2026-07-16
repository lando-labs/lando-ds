/**
 * Tooltip Component Tests
 *
 * Regression coverage for #31 (Tooltip: anchorRef / SVG / overflow container):
 * - `anchorRef` positions against external element and bypasses child cloneElement
 * - SVG children don't crash (auto-wrapped in span) and still show tooltip on hover
 * - Tooltip inside an `overflow: hidden` container portals to document.body
 *   (escapes the clip) rather than being clipped
 * - Existing consumers (HTML child via cloneElement) still work unchanged
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRef } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Tooltip } from './Tooltip'

// Tooltip uses a setTimeout for the show delay (default 300ms). We use fake
// timers so tests don't have to wait real time, and we advance them with
// act() so React state updates flush inside the timer tick.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // Run any pending timers (mouseleave debounce, etc) before flipping back to
  // real timers — otherwise the next test can inherit scheduled state.
  act(() => {
    vi.runOnlyPendingTimers()
  })
  vi.useRealTimers()
})

function advanceDelay(ms = 300) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

// Tooltip is visibility:hidden until positioning completes, which Testing
// Library treats as inaccessible. Use `hidden: true` so assertions don't
// depend on whether the rAF retry loop has flushed in jsdom. Portal location
// and attribute assertions don't need the tooltip to be visible — they verify
// correctness regardless of measurement state.
const tooltipQuery = { hidden: true } as const
function getTooltip() {
  return screen.getByRole('tooltip', tooltipQuery)
}
function queryTooltip() {
  return screen.queryByRole('tooltip', tooltipQuery)
}

describe('Tooltip', () => {
  describe('HTML child (backward compat)', () => {
    it('shows tooltip content on mouseenter after the delay', () => {
      render(
        <Tooltip content="Helpful tip" delay={300}>
          <button>Hover me</button>
        </Tooltip>
      )

      const trigger = screen.getByRole('button', { name: 'Hover me' })
      fireEvent.mouseEnter(trigger)

      // Before the delay, the tooltip should not yet be in the DOM
      expect(queryTooltip()).not.toBeInTheDocument()

      advanceDelay(300)

      expect(getTooltip()).toHaveTextContent('Helpful tip')
    })

    it('hides tooltip on mouseleave', () => {
      render(
        <Tooltip content="Tip" delay={100}>
          <button>Hover me</button>
        </Tooltip>
      )

      const trigger = screen.getByRole('button', { name: 'Hover me' })
      fireEvent.mouseEnter(trigger)
      advanceDelay(100)

      expect(getTooltip()).toBeInTheDocument()

      fireEvent.mouseLeave(trigger)
      expect(queryTooltip()).not.toBeInTheDocument()
    })

    it('respects disabled prop (does not show)', () => {
      render(
        <Tooltip content="Tip" delay={50} disabled>
          <button>Hover me</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByRole('button'))
      advanceDelay(1000)

      expect(queryTooltip()).not.toBeInTheDocument()
    })

    it('preserves original event handlers on child', () => {
      const onMouseEnter = vi.fn()
      render(
        <Tooltip content="Tip" delay={50}>
          <button onMouseEnter={onMouseEnter}>Hover me</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByRole('button'))
      expect(onMouseEnter).toHaveBeenCalledTimes(1)
    })
  })

  describe('overflow-clipped container (#31)', () => {
    it('portals to document.body so it escapes overflow: hidden ancestor', () => {
      render(
        <div
          data-testid="clip"
          style={{ overflow: 'hidden', width: 100, height: 20 }}
        >
          <Tooltip content="Escapes the clip" delay={0}>
            <button>Hover me</button>
          </Tooltip>
        </div>
      )

      const trigger = screen.getByRole('button')
      fireEvent.mouseEnter(trigger)
      advanceDelay(0)

      const tooltip = getTooltip()
      // The key assertion: the tooltip is NOT a descendant of the clipped
      // container. It lives on document.body via <Portal>.
      const clip = screen.getByTestId('clip')
      expect(clip.contains(tooltip)).toBe(false)
      expect(document.body.contains(tooltip)).toBe(true)
    })

    it('marks the portaled tooltip with data-portal-content and data-placement', () => {
      render(
        <Tooltip content="Tip" delay={0} position="top">
          <button>Hover me</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByRole('button'))
      advanceDelay(0)

      const tooltip = getTooltip()
      // Consumers use `data-portal-content` to tell outside-click handlers
      // that a click inside the tooltip is still "inside".
      expect(tooltip).toHaveAttribute('data-portal-content')
      // `data-placement` drives flip-aware CSS animation origins.
      expect(tooltip.getAttribute('data-placement')).toMatch(/top|bottom|left|right/)
    })
  })

  describe('anchorRef (#31)', () => {
    it('uses anchorRef element as the trigger and does not clone onto children', () => {
      // Consumer component owns the anchor element directly — this is the
      // escape hatch for cases where cloneElement can't forward refs or
      // wrapping the child isn't feasible.
      function Consumer() {
        const anchorRef = useRef<HTMLDivElement>(null)
        return (
          <>
            <div
              ref={anchorRef}
              data-testid="anchor"
              tabIndex={0}
              style={{ width: 50, height: 50 }}
            >
              anchor
            </div>
            <Tooltip content="External anchor tip" anchorRef={anchorRef} delay={0}>
              {/* Intentionally empty — Tooltip does not attach handlers here. */}
              <></>
            </Tooltip>
          </>
        )
      }

      render(<Consumer />)

      const anchor = screen.getByTestId('anchor')

      // Hovering the anchor element (not the children of Tooltip) must show
      // the tooltip — proves the anchorRef wiring went through.
      fireEvent.mouseEnter(anchor)
      advanceDelay(0)

      expect(getTooltip()).toHaveTextContent('External anchor tip')

      // And mouseleave on the anchor hides it.
      fireEvent.mouseLeave(anchor)
      expect(queryTooltip()).not.toBeInTheDocument()
    })

    it('does not attach event handlers to the children when anchorRef is provided', () => {
      // This is the important contract: children pass-through when anchorRef
      // is used. Hovering the children element (not the anchor) must NOT
      // trigger the tooltip, otherwise consumers can't keep their own hover
      // semantics on children.
      function Consumer() {
        const anchorRef = useRef<HTMLDivElement>(null)
        return (
          <>
            <div ref={anchorRef} data-testid="anchor" />
            <Tooltip content="Tip" anchorRef={anchorRef} delay={0}>
              <button data-testid="child">Child</button>
            </Tooltip>
          </>
        )
      }

      render(<Consumer />)

      // Hover the CHILD, not the anchor.
      fireEvent.mouseEnter(screen.getByTestId('child'))
      advanceDelay(100)

      expect(queryTooltip()).not.toBeInTheDocument()
    })
  })

  describe('SVG children (#31)', () => {
    it('auto-wraps SVG child in a span without crashing', () => {
      // Without anchorRef, SVG children get wrapped so Tooltip has a stable
      // HTML anchor for hover events. The consumer sees hover on the wrapper
      // region trigger the tooltip.
      render(
        <svg width={100} height={100}>
          <Tooltip content="15 events · Apr 14 — Apr 15" delay={0}>
            <rect x={10} y={10} width={20} height={40} />
          </Tooltip>
        </svg>
      )

      // The SVG rect is rendered, and the wrapping span wraps it.
      // display: contents keeps layout identical.
      const rect = document.querySelector('rect')
      expect(rect).toBeInTheDocument()

      // The wrapper span should exist and contain the rect.
      const wrapper = rect?.parentElement
      expect(wrapper?.tagName.toLowerCase()).toBe('span')

      // Hovering the wrapper shows the tooltip.
      fireEvent.mouseEnter(wrapper!)
      advanceDelay(0)

      expect(getTooltip()).toHaveTextContent('15 events · Apr 14 — Apr 15')
    })

    it('supports SVG element as trigger via anchorRef (no wrapping)', () => {
      // With anchorRef, SVG children are NOT wrapped — the consumer owns the
      // ref and the Tooltip attaches hover listeners directly on the SVG
      // element. This is the recommended path for sparklines.
      function Consumer() {
        const rectRef = useRef<SVGRectElement>(null)
        return (
          <svg width={100} height={100}>
            <rect
              ref={rectRef}
              x={10}
              y={10}
              width={20}
              height={40}
              data-testid="svg-rect"
            />
            <Tooltip content="SVG tip" anchorRef={rectRef} delay={0}>
              <></>
            </Tooltip>
          </svg>
        )
      }

      render(<Consumer />)

      const rect = screen.getByTestId('svg-rect')
      // The rect should NOT be wrapped in a span because anchorRef is used.
      expect(rect.parentElement?.tagName.toLowerCase()).toBe('svg')

      // Hovering the SVG rect triggers the tooltip.
      fireEvent.mouseEnter(rect)
      advanceDelay(0)

      expect(getTooltip()).toHaveTextContent('SVG tip')
    })
  })

  describe('positioning', () => {
    it('sets initial off-screen coords and visibility:hidden until measured', () => {
      // Consumers of usePortalPosition expect the overlay to mount at
      // (-9999, -9999) with visibility:hidden to prevent a flash at (0, 0)
      // on first paint. This test verifies Tooltip follows the same contract.
      render(
        <Tooltip content="Positioned" delay={0} position="top">
          <button>Hover me</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByRole('button'))
      advanceDelay(0)

      const tooltip = getTooltip()
      // On first render (before rAF flushes) the tooltip style should be
      // off-screen + hidden. This is the fix for the flash-at-(0,0) bug.
      expect(tooltip.style.visibility).toBe('hidden')
      expect(tooltip.style.top).toBe('-9999px')
      expect(tooltip.style.left).toBe('-9999px')
    })

    it('exposes data-placement on the portaled tooltip', () => {
      render(
        <Tooltip content="Tip" delay={0} position="top">
          <button>Hover me</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByRole('button'))
      advanceDelay(0)

      const tooltip = getTooltip()
      // Placement is either top or bottom because jsdom reports 0-sized
      // viewport; above/below flip maps to 'top'/'bottom' CSS class.
      expect(tooltip.getAttribute('data-placement')).toMatch(/top|bottom/)
    })

    it('handles left/right positions without crashing (mirrored rAF loop)', () => {
      // Left/right use the inline useHorizontalTooltipPosition helper that
      // mirrors usePortalPosition's rAF retry pattern. Regression that the
      // four-direction API still works.
      const { unmount } = render(
        <Tooltip content="Left" delay={0} position="left">
          <button>Hover me</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByRole('button'))
      advanceDelay(0)

      expect(getTooltip()).toHaveTextContent('Left')
      unmount()

      render(
        <Tooltip content="Right" delay={0} position="right">
          <button>Hover me</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByRole('button'))
      advanceDelay(0)
      expect(getTooltip()).toHaveTextContent('Right')
    })
  })

  describe('invalid children', () => {
    it('warns and returns children as-is when children is not a valid element', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // @ts-expect-error — intentionally invalid to exercise the guard path
      render(<Tooltip content="Tip">{null}</Tooltip>)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('children must be a valid React element')
      )
      warn.mockRestore()
    })
  })
})

describe('Tooltip — unique ids (#330 regression)', () => {
  it('two visible Tooltips get DISTINCT ids (no hardcoded "tooltip")', () => {
    // #330: the id was hardcoded to "tooltip", so two Tooltips on one page
    // produced duplicate ids (invalid HTML + broken aria-describedby). They
    // now derive from useId(); pin that two instances never collide.
    render(
      <>
        <Tooltip content="First" delay={0}>
          <button>One</button>
        </Tooltip>
        <Tooltip content="Second" delay={0}>
          <button>Two</button>
        </Tooltip>
      </>
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'One' }))
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Two' }))
    advanceDelay(0)

    const tips = screen.getAllByRole('tooltip', tooltipQuery)
    expect(tips).toHaveLength(2)

    const [idA, idB] = tips.map((t) => t.id)
    expect(idA).toBeTruthy()
    expect(idB).toBeTruthy()
    expect(idA).not.toBe(idB)
  })
})

describe('Tooltip — passthrough (#423)', () => {
  it('forwards data-testid and style to the tooltip surface (visual root)', () => {
    render(
      <Tooltip
        content="Tip"
        delay={0}
        data-testid="my-tooltip"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <button>Hover me</button>
      </Tooltip>
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    advanceDelay(0)

    const tip = screen.getByTestId('my-tooltip')
    // Passthrough lands on the tooltip surface, not the trigger.
    expect(tip).toBe(getTooltip())
    expect(tip).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('does not let a consumer role override the internal tooltip role', () => {
    render(
      <Tooltip content="Tip" delay={0} data-testid="role-tooltip" role="menu">
        <button>Hover me</button>
      </Tooltip>
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    advanceDelay(0)

    const tip = screen.getByTestId('role-tooltip')
    expect(tip).toHaveAttribute('role', 'tooltip')
  })
})
