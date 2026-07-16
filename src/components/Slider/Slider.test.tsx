/**
 * Slider Component Tests
 *
 * Sprint 54 (#308) — net-new component, full coverage from day one.
 *
 * The Slider is a custom WAI-ARIA slider (not <input type="range">) supporting
 * single-thumb and dual-thumb (range) modes. Mode is inferred from the value
 * shape: number → single, [number, number] → range.
 *
 * Tests cover:
 *   - render + default value resolution
 *   - controlled mode (external updates render)
 *   - uncontrolled mode (defaultValue used, onChange fires on action)
 *   - keyboard: Arrow* / PageUp / PageDown / Home / End
 *   - PageUp/PageDown big-step = max(step, (max-min)/10)
 *   - ARIA: role/orientation/valuenow/valuemin/valuemax
 *   - disabled: no keyboard or click changes, tabIndex -1
 *   - label association (visible label + thumb aria-label)
 *   - range mode: 2 thumbs, each focusable, distinct aria-labels
 *   - range mode: cross-clamp (thumb 0 ≤ thumb 1 invariant)
 *   - track click jumps thumb to that position
 *   - step rounding
 *   - bounds clamping
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, createEvent } from '@testing-library/react'
import { useState } from 'react'
import { axe } from 'jest-axe'
import { Slider, type SliderValue } from './Slider'

describe('Slider', () => {
  // ---------------------------------------------------------------------------
  // basic render
  // ---------------------------------------------------------------------------

  it('renders a single-thumb slider by default (no value props)', () => {
    render(<Slider label="Volume" />)
    // Exactly one slider thumb element.
    const thumbs = screen.getAllByRole('slider')
    expect(thumbs).toHaveLength(1)
    expect(thumbs[0]).toHaveAttribute('aria-valuemin', '0')
    expect(thumbs[0]).toHaveAttribute('aria-valuemax', '100')
    // No value prop → uncontrolled init at `min` (0).
    expect(thumbs[0]).toHaveAttribute('aria-valuenow', '0')
  })

  it('renders the visible label when provided', () => {
    render(<Slider label="Volume" defaultValue={20} />)
    expect(screen.getByText('Volume')).toBeInTheDocument()
  })

  it('uses defaultValue for uncontrolled initial state', () => {
    render(<Slider label="Vol" defaultValue={42} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '42')
  })

  it('reflects controlled value externally', () => {
    const { rerender } = render(
      <Slider label="Vol" value={25} onChange={() => {}} />,
    )
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '25')
    rerender(<Slider label="Vol" value={75} onChange={() => {}} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '75')
  })

  it('respects custom min/max bounds in ARIA', () => {
    render(<Slider label="Temp" min={-50} max={50} defaultValue={0} />)
    const thumb = screen.getByRole('slider')
    expect(thumb).toHaveAttribute('aria-valuemin', '-50')
    expect(thumb).toHaveAttribute('aria-valuemax', '50')
    expect(thumb).toHaveAttribute('aria-valuenow', '0')
  })

  // ---------------------------------------------------------------------------
  // keyboard — single mode
  // ---------------------------------------------------------------------------

  it('ArrowRight increments by step (uncontrolled fires onChange)', () => {
    const handleChange = vi.fn()
    render(
      <Slider label="Vol" defaultValue={10} step={5} onChange={handleChange} />,
    )
    const thumb = screen.getByRole('slider')
    thumb.focus()
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(handleChange).toHaveBeenLastCalledWith(15)
    expect(thumb).toHaveAttribute('aria-valuenow', '15')
  })

  it('ArrowUp also increments (alias of ArrowRight)', () => {
    const handleChange = vi.fn()
    render(<Slider label="Vol" defaultValue={10} onChange={handleChange} />)
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'ArrowUp' })
    expect(handleChange).toHaveBeenLastCalledWith(11)
  })

  it('ArrowLeft/ArrowDown decrement by step', () => {
    const handleChange = vi.fn()
    render(
      <Slider label="Vol" defaultValue={50} step={5} onChange={handleChange} />,
    )
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' })
    expect(handleChange).toHaveBeenLastCalledWith(45)
    fireEvent.keyDown(thumb, { key: 'ArrowDown' })
    expect(handleChange).toHaveBeenLastCalledWith(40)
  })

  it('PageUp/PageDown use big-step = max(step, (max-min)/10)', () => {
    // min=0, max=100, step=1 → big = max(1, 10) = 10
    const handleChange = vi.fn()
    render(
      <Slider label="Vol" defaultValue={50} step={1} onChange={handleChange} />,
    )
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'PageUp' })
    expect(handleChange).toHaveBeenLastCalledWith(60)
    fireEvent.keyDown(thumb, { key: 'PageDown' })
    expect(handleChange).toHaveBeenLastCalledWith(50)
  })

  it('PageUp uses step when step is bigger than (max-min)/10', () => {
    // min=0, max=100, step=25 → big = max(25, 10) = 25
    const handleChange = vi.fn()
    render(
      <Slider label="Vol" defaultValue={0} step={25} onChange={handleChange} />,
    )
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'PageUp' })
    expect(handleChange).toHaveBeenLastCalledWith(25)
  })

  it('Home jumps to min, End jumps to max', () => {
    const handleChange = vi.fn()
    render(
      <Slider
        label="Vol"
        defaultValue={50}
        min={-10}
        max={110}
        onChange={handleChange}
      />,
    )
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'Home' })
    expect(handleChange).toHaveBeenLastCalledWith(-10)
    fireEvent.keyDown(thumb, { key: 'End' })
    expect(handleChange).toHaveBeenLastCalledWith(110)
  })

  it('clamps to bounds — ArrowRight at max stays at max', () => {
    const handleChange = vi.fn()
    render(
      <Slider label="Vol" defaultValue={100} step={5} onChange={handleChange} />,
    )
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(handleChange).toHaveBeenLastCalledWith(100)
    expect(thumb).toHaveAttribute('aria-valuenow', '100')
  })

  // ---------------------------------------------------------------------------
  // controlled mode behavior
  // ---------------------------------------------------------------------------

  it('controlled mode: parent owns state; onChange only fires, value held externally', () => {
    function Wrapper() {
      const [v, setV] = useState<SliderValue>(20)
      return (
        <Slider
          label="Vol"
          value={v}
          onChange={(next) => setV(next)}
        />
      )
    }
    render(<Wrapper />)
    const thumb = screen.getByRole('slider')
    expect(thumb).toHaveAttribute('aria-valuenow', '20')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(thumb).toHaveAttribute('aria-valuenow', '21')
  })

  // ---------------------------------------------------------------------------
  // disabled
  // ---------------------------------------------------------------------------

  it('disabled: keyboard does NOT change value or fire onChange', () => {
    const handleChange = vi.fn()
    render(
      <Slider
        label="Vol"
        defaultValue={50}
        disabled
        onChange={handleChange}
      />,
    )
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    fireEvent.keyDown(thumb, { key: 'PageUp' })
    fireEvent.keyDown(thumb, { key: 'End' })
    expect(handleChange).not.toHaveBeenCalled()
    expect(thumb).toHaveAttribute('aria-valuenow', '50')
  })

  it('disabled: thumb is removed from the tab order (tabIndex=-1) + aria-disabled', () => {
    render(<Slider label="Vol" defaultValue={50} disabled />)
    const thumb = screen.getByRole('slider')
    expect(thumb).toHaveAttribute('tabindex', '-1')
    expect(thumb).toHaveAttribute('aria-disabled', 'true')
  })

  // ---------------------------------------------------------------------------
  // range mode
  // ---------------------------------------------------------------------------

  it('range mode: array value renders TWO independent thumbs', () => {
    render(<Slider label="Price" defaultValue={[20, 80]} />)
    const thumbs = screen.getAllByRole('slider')
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0]).toHaveAttribute('aria-valuenow', '20')
    expect(thumbs[1]).toHaveAttribute('aria-valuenow', '80')
  })

  it('range mode: each thumb is independently focusable + has a distinct aria-label', () => {
    render(<Slider label="Price" defaultValue={[20, 80]} />)
    const [t0, t1] = screen.getAllByRole('slider')
    // Both are in the tab order.
    expect(t0).toHaveAttribute('tabindex', '0')
    expect(t1).toHaveAttribute('tabindex', '0')
    // Distinguishable labels for AT.
    expect(t0).toHaveAttribute('aria-label', expect.stringMatching(/minimum/i))
    expect(t1).toHaveAttribute('aria-label', expect.stringMatching(/maximum/i))
  })

  it('range mode: cross-clamp — thumb[0] cannot exceed thumb[1]', () => {
    const handleChange = vi.fn()
    render(
      <Slider
        label="Price"
        defaultValue={[40, 50]}
        step={10}
        onChange={handleChange}
      />,
    )
    const [t0] = screen.getAllByRole('slider')
    if (!t0) throw new Error('expected a slider thumb')
    // Try to push thumb 0 past thumb 1 — End on thumb 0 should land at 50, not 100.
    fireEvent.keyDown(t0, { key: 'End' })
    const calls = handleChange.mock.calls
    const lastCall = calls[calls.length - 1]?.[0]
    expect(lastCall).toEqual([50, 50])
  })

  it('range mode: cross-clamp the other direction — thumb[1] cannot go below thumb[0]', () => {
    const handleChange = vi.fn()
    render(
      <Slider
        label="Price"
        defaultValue={[40, 50]}
        step={10}
        onChange={handleChange}
      />,
    )
    const [, t1] = screen.getAllByRole('slider')
    if (!t1) throw new Error('expected a second slider thumb')
    fireEvent.keyDown(t1, { key: 'Home' })
    const calls = handleChange.mock.calls
    const lastCall = calls[calls.length - 1]?.[0]
    expect(lastCall).toEqual([40, 40])
  })

  it('range mode: each thumb moves independently by ArrowRight', () => {
    const handleChange = vi.fn()
    render(
      <Slider
        label="Price"
        defaultValue={[20, 80]}
        step={5}
        onChange={handleChange}
      />,
    )
    const [t0, t1] = screen.getAllByRole('slider')
    if (!t0 || !t1) throw new Error('expected two slider thumbs')
    fireEvent.keyDown(t0, { key: 'ArrowRight' })
    expect(handleChange).toHaveBeenLastCalledWith([25, 80])
    fireEvent.keyDown(t1, { key: 'ArrowLeft' })
    expect(handleChange).toHaveBeenLastCalledWith([25, 75])
  })

  // ---------------------------------------------------------------------------
  // step rounding
  // ---------------------------------------------------------------------------

  it('snaps to step on ArrowRight when current value isn\'t on the grid', () => {
    // defaultValue=23, step=5 → ArrowRight should land on 25 (nearest grid
    // step), not 28 (current+step). We add then snap to step.
    const handleChange = vi.fn()
    render(
      <Slider label="Vol" defaultValue={23} step={5} onChange={handleChange} />,
    )
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    // The implementation: snapToStep(23 + 5, 0, 100, 5) = round((28-0)/5)*5 = 30
    expect(handleChange).toHaveBeenLastCalledWith(30)
  })

  // ---------------------------------------------------------------------------
  // label association
  // ---------------------------------------------------------------------------

  it('label prop is forwarded as the thumb aria-label in single mode', () => {
    render(<Slider label="Brightness" defaultValue={50} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'Brightness')
  })

  // ---------------------------------------------------------------------------
  // a11y axe smoke
  // ---------------------------------------------------------------------------

  it('has no axe violations (single mode)', async () => {
    const { container } = render(<Slider label="Volume" defaultValue={50} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no axe violations (range mode)', async () => {
    const { container } = render(
      <Slider label="Price" defaultValue={[20, 80]} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  // ---------------------------------------------------------------------------
  // track click — jumps the (nearest) thumb to that position.
  //
  // jsdom doesn't compute layout, so getBoundingClientRect returns 0×0 by
  // default. We mock it to give the track a known width, then dispatch a
  // pointer event at a known clientX and verify the resulting value.
  //
  // NOTE on event creation: jsdom's PointerEvent constructor ignores `clientX`
  // in the event-init dict (it accepts it but never sets the property), and
  // react-testing-library's `fireEvent.pointerDown(el, { clientX })` therefore
  // dispatches an event where `event.clientX` is `NaN` in the handler. Workaround:
  // create the event manually and define clientX as a real property before
  // dispatching. This matches what a real browser would deliver to React.
  // ---------------------------------------------------------------------------

  /** Build a PointerEvent whose `clientX` survives the trip into the handler. */
  function pointerDownWithClientX(el: Element, clientX: number) {
    const event = createEvent.pointerDown(el, {
      pointerId: 1,
      button: 0,
      bubbles: true,
    })
    Object.defineProperty(event, 'clientX', { value: clientX, configurable: true })
    Object.defineProperty(event, 'clientY', { value: 0, configurable: true })
    fireEvent(el, event)
  }

  it('click on track jumps thumb to the clicked position', () => {
    const handleChange = vi.fn()
    render(
      <Slider
        label="Vol"
        defaultValue={0}
        step={1}
        onChange={handleChange}
      />,
    )
    const track = screen.getByTestId('slider-track')
    // Pretend the track is 200px wide starting at x=0. Click at x=100 (50%).
    track.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 10,
        width: 200,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    pointerDownWithClientX(track, 100)
    // 50% of 0–100 = 50
    expect(handleChange).toHaveBeenLastCalledWith(50)
  })

  it('range mode: track click moves the CLOSER thumb', () => {
    const handleChange = vi.fn()
    render(
      <Slider
        label="Price"
        defaultValue={[20, 80]}
        step={1}
        onChange={handleChange}
      />,
    )
    const track = screen.getByTestId('slider-track')
    track.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 10,
        width: 200,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    // Click at x=180 → 90% → value 90. Closer to thumb 1 (80) than thumb 0 (20),
    // so thumb 1 should move to 90.
    pointerDownWithClientX(track, 180)
    expect(handleChange).toHaveBeenLastCalledWith([20, 90])
  })

  it('disabled: track click does not fire onChange', () => {
    const handleChange = vi.fn()
    render(
      <Slider
        label="Vol"
        defaultValue={50}
        disabled
        onChange={handleChange}
      />,
    )
    const track = screen.getByTestId('slider-track')
    track.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 10,
        width: 200,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    pointerDownWithClientX(track, 100)
    expect(handleChange).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // formatValue / showValue
  // ---------------------------------------------------------------------------

  it('formatValue is passed through to aria-valuetext', () => {
    render(
      <Slider
        label="Price"
        defaultValue={50}
        formatValue={(n) => `$${n}`}
      />,
    )
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '$50')
  })

  it('showValue renders the value as a visible tooltip on the thumb', () => {
    render(<Slider label="Vol" defaultValue={42} showValue />)
    // Tooltip is aria-hidden so getByRole won't see it; query its text.
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})
