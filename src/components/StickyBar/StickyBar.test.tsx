/**
 * StickyBar Component Tests
 *
 * Covers:
 *  - Renders children with role="region" by default (#23)
 *  - `position="top" | "bottom"` applies the right position class and inline style
 *  - `offset` prop accepts numbers (px) and strings (calc expressions)
 *  - `variant` applies the right surface/blur/transparent class
 *  - `elevation` applies the right shadow class and mounts a sentinel
 *    only when `shadow-on-scroll` is requested
 *  - `zIndex` override lands on inline style
 *  - `aria-label` and custom `role` flow through for accessibility
 *  - `className` is appended, not overridden
 *  - Custom refs are forwarded correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createRef } from 'react'
import { StickyBar } from './StickyBar'

// jsdom does not implement IntersectionObserver — stub it for the
// shadow-on-scroll effect to mount cleanly. Tests that care about
// the pinned state drive the observer callback manually.
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  elements: Element[] = []
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(el: Element) {
    this.elements.push(el)
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  root: Element | null = null
  rootMargin = ''
  thresholds: number[] = []
}

describe('StickyBar', () => {
  beforeEach(() => {
    // Install fresh mock before each test so observer instances don't
    // leak state between them.
    ;(globalThis as any).IntersectionObserver = MockIntersectionObserver
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ===== Basic rendering =====

  it('renders children inside a region landmark by default', () => {
    render(
      <StickyBar aria-label="Filter toolbar">
        <span data-testid="bar-content">Filters</span>
      </StickyBar>
    )
    const region = screen.getByRole('region', { name: 'Filter toolbar' })
    expect(region).toBeInTheDocument()
    expect(screen.getByTestId('bar-content')).toBeInTheDocument()
  })

  it('allows overriding the ARIA role (e.g. toolbar)', () => {
    render(
      <StickyBar role="toolbar" aria-label="Editor tools">
        <button>Bold</button>
      </StickyBar>
    )
    expect(
      screen.getByRole('toolbar', { name: 'Editor tools' })
    ).toBeInTheDocument()
  })

  // ===== Position =====

  it('applies position-top class and top offset by default', () => {
    const { container } = render(
      <StickyBar>
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-position="top"]') as HTMLElement
    expect(bar).toBeInTheDocument()
    expect(bar.className).toMatch(/position-top/)
    // Offset defaults to 0 — expressed as `0px`.
    expect(bar.style.top).toBe('0px')
    expect(bar.style.bottom).toBe('')
  })

  it('applies position-bottom class and bottom offset when position="bottom"', () => {
    const { container } = render(
      <StickyBar position="bottom">
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-position="bottom"]') as HTMLElement
    expect(bar).toBeInTheDocument()
    expect(bar.className).toMatch(/position-bottom/)
    expect(bar.style.bottom).toBe('0px')
    expect(bar.style.top).toBe('')
  })

  // ===== Offset =====

  it('translates numeric offset to pixels', () => {
    const { container } = render(
      <StickyBar offset={64}>
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-position="top"]') as HTMLElement
    expect(bar.style.top).toBe('64px')
  })

  it('passes string offsets through unchanged (calc, tokens)', () => {
    const { container } = render(
      <StickyBar offset="calc(var(--header-height) + 8px)">
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-position="top"]') as HTMLElement
    // jsdom preserves the calc expression verbatim in the style attr.
    expect(bar.getAttribute('style')).toContain(
      'top: calc(var(--header-height) + 8px)'
    )
  })

  it('applies offset to bottom edge when position="bottom"', () => {
    const { container } = render(
      <StickyBar position="bottom" offset={16}>
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-position="bottom"]') as HTMLElement
    expect(bar.style.bottom).toBe('16px')
    expect(bar.style.top).toBe('')
  })

  // ===== Variant =====

  it('applies the surface variant class by default', () => {
    const { container } = render(
      <StickyBar>
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-variant="surface"]')
    expect(bar).toBeInTheDocument()
    expect((bar as HTMLElement).className).toMatch(/variant-surface/)
  })

  it('applies the blur variant class', () => {
    const { container } = render(
      <StickyBar variant="blur">
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-variant="blur"]')
    expect((bar as HTMLElement).className).toMatch(/variant-blur/)
  })

  it('applies the transparent variant class', () => {
    const { container } = render(
      <StickyBar variant="transparent">
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-variant="transparent"]')
    expect((bar as HTMLElement).className).toMatch(/variant-transparent/)
  })

  // ===== Elevation =====

  it('does NOT render the sentinel when elevation="none" (default)', () => {
    render(
      <StickyBar>
        <div>content</div>
      </StickyBar>
    )
    expect(screen.queryByTestId('stickybar-sentinel')).not.toBeInTheDocument()
  })

  it('does NOT render the sentinel for a static "shadow" elevation', () => {
    // Static shadow doesn't need pin detection — no observer, no sentinel.
    const { container } = render(
      <StickyBar elevation="shadow">
        <div>content</div>
      </StickyBar>
    )
    expect(screen.queryByTestId('stickybar-sentinel')).not.toBeInTheDocument()
    const bar = container.querySelector('[data-elevation="shadow"]')
    expect((bar as HTMLElement).className).toMatch(/elevation-shadow/)
  })

  it('renders the sentinel and wires IntersectionObserver when elevation="shadow-on-scroll"', () => {
    const observeSpy = vi.fn()
    const disconnectSpy = vi.fn()
    class SpyObserver extends MockIntersectionObserver {
      observe(el: Element) {
        observeSpy(el)
        super.observe(el)
      }
      disconnect() {
        disconnectSpy()
      }
    }
    ;(globalThis as any).IntersectionObserver = SpyObserver

    const { unmount } = render(
      <StickyBar elevation="shadow-on-scroll">
        <div>content</div>
      </StickyBar>
    )
    const sentinel = screen.getByTestId('stickybar-sentinel')
    expect(sentinel).toBeInTheDocument()
    expect(sentinel).toHaveAttribute('aria-hidden', 'true')
    expect(observeSpy).toHaveBeenCalledWith(sentinel)

    // Cleanup disconnects the observer — no stale listeners.
    unmount()
    expect(disconnectSpy).toHaveBeenCalled()
  })

  it('toggles data-pinned when the sentinel intersection changes', () => {
    // Capture the IO callback so the test can drive it.
    let capturedCallback: IntersectionObserverCallback | null = null
    class CapturingObserver extends MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        super(cb)
        capturedCallback = cb
      }
    }
    ;(globalThis as any).IntersectionObserver = CapturingObserver

    const { container } = render(
      <StickyBar elevation="shadow-on-scroll">
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-elevation="shadow-on-scroll"]') as HTMLElement

    // Default: sentinel is visible → not pinned.
    expect(bar.getAttribute('data-pinned')).toBe('false')

    // Simulate the sentinel scrolling off-screen (bar becomes pinned).
    expect(capturedCallback).not.toBeNull()
    act(() => {
      capturedCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })
    expect(bar.getAttribute('data-pinned')).toBe('true')

    // Simulate scrolling back — sentinel visible again → not pinned.
    act(() => {
      capturedCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })
    expect(bar.getAttribute('data-pinned')).toBe('false')
  })

  // ===== zIndex =====

  it('applies zIndex override to inline style', () => {
    const { container } = render(
      <StickyBar zIndex={500}>
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-position="top"]') as HTMLElement
    expect(bar.style.zIndex).toBe('500')
  })

  it('leaves zIndex unset by default (falls through to CSS token)', () => {
    const { container } = render(
      <StickyBar>
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-position="top"]') as HTMLElement
    // When consumers don't override, the inline style should not set
    // zIndex — the CSS module applies var(--z-index-sticky, 100).
    expect(bar.style.zIndex).toBe('')
  })

  // ===== className + ref =====

  it('appends custom className without clobbering built-in classes', () => {
    const { container } = render(
      <StickyBar className="custom-bar">
        <div>content</div>
      </StickyBar>
    )
    const bar = container.querySelector('[data-position="top"]') as HTMLElement
    expect(bar.className).toMatch(/custom-bar/)
    expect(bar.className).toMatch(/stickybar/)
    expect(bar.className).toMatch(/position-top/)
    expect(bar.className).toMatch(/variant-surface/)
  })

  it('forwards refs to the underlying div', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <StickyBar ref={ref}>
        <div>content</div>
      </StickyBar>
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.getAttribute('data-position')).toBe('top')
  })

  // ===== Default state =====

  it('starts unpinned (data-pinned="false") regardless of elevation mode', () => {
    const { container: c1 } = render(
      <StickyBar>
        <div>content</div>
      </StickyBar>
    )
    const { container: c2 } = render(
      <StickyBar elevation="shadow-on-scroll">
        <div>content</div>
      </StickyBar>
    )
    expect(
      c1.querySelector('[data-position="top"]')?.getAttribute('data-pinned')
    ).toBe('false')
    expect(
      c2.querySelector('[data-position="top"]')?.getAttribute('data-pinned')
    ).toBe('false')
  })

  // ===== #423 — consumer ...rest pass-through to the bar visual root =====
  // (style was already supported; this locks the rest-spread in. The bar is
  // the pinned <div>, distinct from the shadow-on-scroll sentinel.)

  it('lands consumer data-testid on the bar visual root', () => {
    render(
      <StickyBar data-testid="bar-root">
        <div>content</div>
      </StickyBar>
    )
    const bar = screen.getByTestId('bar-root')
    expect(bar.getAttribute('data-position')).toBe('top')
  })

  it('applies consumer style.color to the bar visual root', () => {
    render(
      <StickyBar data-testid="bar-root" style={{ color: 'rgb(1, 2, 3)' }}>
        <div>content</div>
      </StickyBar>
    )
    expect(screen.getByTestId('bar-root')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('keeps the internal role authoritative and forwards arbitrary rest (id)', () => {
    render(
      <StickyBar data-testid="bar-root" id="filter-bar">
        <div>content</div>
      </StickyBar>
    )
    const bar = screen.getByTestId('bar-root')
    expect(bar).toHaveAttribute('id', 'filter-bar')
    // Default role="region" still applied (dedicated prop wins over rest).
    expect(bar).toHaveAttribute('role', 'region')
  })
})
