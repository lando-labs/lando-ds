// @vitest-environment jsdom

/**
 * Geometry SoT tests (#331).
 *
 * Before the positioning consolidation, `calculatePosition` (4-direction) and the
 * below/above math inside `usePortalPosition` had NO direct unit coverage — only
 * indirect exercise via component tests. This pins the numeric behavior of both
 * geometry functions now that they live side-by-side in `positioning.ts`, so the
 * "zero behavior change" consolidation can't silently drift a flip threshold.
 *
 * The `computePortalPosition` assertions below are the exact values the previous
 * inline `usePortalPosition` math produced for the same inputs (hand-derived from
 * the algorithm), making this the parity guard for the moved code.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { calculatePosition, computePortalPosition, clamp } from './positioning'

/** Build a detached element whose getBoundingClientRect returns `rect`. */
function elWithRect(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div')
  const full: DOMRect = {
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    toJSON: () => ({}),
  }
  el.getBoundingClientRect = () => full
  return el
}

const originalW = window.innerWidth
const originalH = window.innerHeight
function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true })
}
afterEach(() => setViewport(originalW, originalH))

describe('computePortalPosition — below/above + align (usePortalPosition SoT)', () => {
  it('places BELOW with ample room; left-aligned to the trigger', () => {
    setViewport(1000, 800)
    // trigger 100×20 at (200,100); overlay 150×50; offset 4
    const trigger = elWithRect({ top: 100, bottom: 120, left: 200, right: 300, width: 100, height: 20 })
    const overlay = elWithRect({ width: 150, height: 50 })
    const r = computePortalPosition(trigger, overlay, { align: 'left', offset: 4 })
    expect(r.placement).toBe('below')
    expect(r.top).toBe(124) // triggerRect.bottom (120) + offset (4)
    expect(r.left).toBe(200) // trigger.left
    expect(r.width).toBe(100) // trigger width, always reported
  })

  it('flips ABOVE only when room below is insufficient AND less than room above', () => {
    setViewport(1000, 300)
    // trigger near the bottom: bottom=280 → spaceBelow=20; top=260 → spaceAbove=260.
    // overlay height 100 + offset 4 = 104 > 20, and 20 < 260 → flip above.
    const trigger = elWithRect({ top: 260, bottom: 280, left: 100, right: 200, width: 100, height: 20 })
    const overlay = elWithRect({ width: 100, height: 100 })
    const r = computePortalPosition(trigger, overlay, { offset: 4 })
    expect(r.placement).toBe('above')
    expect(r.top).toBe(156) // trigger.top (260) - overlayHeight (100) - offset (4)
  })

  it('stays BELOW when room below is tight but still >= room above', () => {
    setViewport(1000, 300)
    // spaceBelow=140 (bottom 160), spaceAbove=140 (top 140): equal → the
    // `spaceBelow >= spaceAbove` branch keeps it below.
    const trigger = elWithRect({ top: 140, bottom: 160, left: 0, right: 100, width: 100, height: 20 })
    const overlay = elWithRect({ width: 100, height: 200 })
    const r = computePortalPosition(trigger, overlay, { offset: 4 })
    expect(r.placement).toBe('below')
  })

  it('keeps BELOW at the exact boundary spaceBelow === overlayHeight + offset (inclusive >=)', () => {
    setViewport(1000, 1000)
    // trigger.bottom 896 → spaceBelow = 104; overlay height 100 + offset 4 = 104.
    // spaceAbove = trigger.top 800 > 104, so the second (spaceBelow >= spaceAbove)
    // branch does NOT apply — only the inclusive `>=` on the first term keeps it
    // below. This pins the boundary as inclusive (a `>` regression would flip it).
    const trigger = elWithRect({ top: 800, bottom: 896, left: 100, right: 200, width: 100, height: 96 })
    const overlay = elWithRect({ width: 100, height: 100 })
    const r = computePortalPosition(trigger, overlay, { offset: 4 })
    expect(r.placement).toBe('below')
    expect(r.top).toBe(900) // trigger.bottom (896) + offset (4)
  })

  it('align="right" right-aligns the overlay to the trigger', () => {
    setViewport(1000, 800)
    const trigger = elWithRect({ top: 100, bottom: 120, left: 200, right: 300, width: 100, height: 20 })
    const overlay = elWithRect({ width: 150, height: 50 })
    const r = computePortalPosition(trigger, overlay, { align: 'right' })
    expect(r.left).toBe(150) // trigger.right (300) - overlay.width (150)
  })

  it('align="center" centers the overlay on the trigger', () => {
    setViewport(1000, 800)
    const trigger = elWithRect({ top: 100, bottom: 120, left: 200, right: 300, width: 100, height: 20 })
    const overlay = elWithRect({ width: 40, height: 50 })
    const r = computePortalPosition(trigger, overlay, { align: 'center' })
    expect(r.left).toBe(230) // 200 + (100 - 40)/2
  })

  it('clamps left into the viewport with an 8px margin', () => {
    setViewport(500, 800)
    // trigger far right; left-align would push overlay past the right edge → clamp.
    const trigger = elWithRect({ top: 100, bottom: 120, left: 480, right: 500, width: 20, height: 20 })
    const overlay = elWithRect({ width: 200, height: 50 })
    const r = computePortalPosition(trigger, overlay, { align: 'left' })
    expect(r.left).toBe(292) // innerWidth(500) - overlayWidth(200) - 8
  })

  it('defaults align→left and offset→4 when omitted', () => {
    setViewport(1000, 800)
    const trigger = elWithRect({ top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 })
    const overlay = elWithRect({ width: 80, height: 40 })
    const r = computePortalPosition(trigger, overlay)
    expect(r.left).toBe(50)
    expect(r.top).toBe(124) // bottom 120 + default offset 4
  })
})

describe('calculatePosition — four-direction flip (Tooltip/Popover SoT)', () => {
  it('positions bottom with room; centered horizontally', () => {
    setViewport(1000, 800)
    const trigger = elWithRect({ top: 100, bottom: 120, left: 200, right: 300, width: 100, height: 20 })
    const overlay = elWithRect({ width: 80, height: 40 })
    const r = calculatePosition(trigger, overlay, 'bottom', 8)
    expect(r.position).toBe('bottom')
    expect(r.top).toBe(128) // bottom 120 + offset 8
    expect(r.transformOrigin).toBe('top center')
  })

  it('flips bottom→top when there is not enough room below', () => {
    setViewport(1000, 200)
    // bottom=180 → spaceBelow=20; overlay 100 + offset 8 + padding 8 = 116 > 20 → flip.
    const trigger = elWithRect({ top: 160, bottom: 180, left: 100, right: 200, width: 100, height: 20 })
    const overlay = elWithRect({ width: 100, height: 100 })
    const r = calculatePosition(trigger, overlay, 'bottom', 8)
    expect(r.position).toBe('top')
  })

  it('flips right→left when there is not enough room on the right', () => {
    setViewport(300, 800)
    // right=290 → spaceRight=10; overlay 100 + offset 8 + padding 8 = 116 > 10 → flip.
    const trigger = elWithRect({ top: 100, bottom: 120, left: 270, right: 290, width: 20, height: 20 })
    const overlay = elWithRect({ width: 100, height: 40 })
    const r = calculatePosition(trigger, overlay, 'right', 8)
    expect(r.position).toBe('left')
  })

  it('uses a DIFFERENT flip threshold than computePortalPosition (they must not be merged)', () => {
    setViewport(1000, 300)
    // spaceBelow = 300 - 280 = 20; overlay height 30, offset 4.
    // calculatePosition flip test: spaceBelow(20) < 30 + 4 + PADDING(8)=42 → FLIPS to top.
    // computePortalPosition flip test: spaceBelow(20) >= 30+4? no. spaceBelow(20) >= spaceAbove(260)? no → also above.
    // Pick a case where they DIVERGE: overlay height 10.
    //   calc: spaceBelow(20) < 10+4+8=22 → still flips (top).
    //   portal: spaceBelow(20) >= 10+4=14 → stays BELOW.
    const trigger = elWithRect({ top: 260, bottom: 280, left: 100, right: 200, width: 100, height: 20 })
    const overlay = elWithRect({ width: 100, height: 10 })
    const calc = calculatePosition(trigger, overlay, 'bottom', 4)
    const portal = computePortalPosition(trigger, overlay, { offset: 4 })
    expect(calc.position).toBe('top') // padding term makes it flip
    expect(portal.placement).toBe('below') // no padding term → stays below
    // This divergence is the reason the two functions stay distinct.
  })
})

describe('clamp', () => {
  it('bounds a value between min and max', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })
})
