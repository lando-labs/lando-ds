/**
 * ScrollArea Component Tests
 *
 * Covers:
 *  - Renders children
 *  - maxHeight as number → px; as string → passthrough; omitted → no inline cap
 *  - tabIndex=0 so keyboard scrolling works
 *  - role="region" only when an accessible name is provided
 *  - aria-label / aria-labelledby pass through
 *  - orientation class wiring (vertical / horizontal / both)
 *  - scrollbarMode class + data-attr wiring (incl. default = overlay)
 *  - scrollbarVisibility class + data-attr wiring (incl. default = hover)
 *  - className is appended, not overridden
 *  - refs forward to the underlying div
 *  - Empty children → renders the scroller without crashing
 *  - axe smoke test
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { axe } from 'jest-axe'
import { ScrollArea } from './ScrollArea'

describe('ScrollArea', () => {
  // ===== Children + smoke =====

  it('renders its children', () => {
    render(
      <ScrollArea maxHeight={200}>
        <span data-testid="content">Scrollable content</span>
      </ScrollArea>,
    )
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('renders without crashing when children are omitted entirely', () => {
    // `children` is typed as required, but JSX consumers can still pass
    // `undefined` / empty fragments. The wrapper must stay mountable so
    // empty-state callers don't have to guard.
    const { container } = render(
      // @ts-expect-error — exercising the no-children edge case
      <ScrollArea maxHeight={200} />,
    )
    const scroller = container.querySelector('[data-orientation="vertical"]')
    expect(scroller).toBeInTheDocument()
  })

  // ===== maxHeight =====

  it('translates a numeric maxHeight to pixels in the inline style', () => {
    const { container } = render(
      <ScrollArea maxHeight={320}>
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement
    expect(scroller.style.maxHeight).toBe('320px')
  })

  it('passes a string maxHeight through unchanged (vh / clamp / calc)', () => {
    const { container } = render(
      <ScrollArea maxHeight="50vh">
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement
    expect(scroller.style.maxHeight).toBe('50vh')
  })

  it('does not set an inline maxHeight when the prop is omitted', () => {
    const { container } = render(
      <ScrollArea>
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement
    expect(scroller.style.maxHeight).toBe('')
  })

  // ===== a11y =====

  it('is focusable for keyboard arrow-key scrolling (tabIndex=0)', () => {
    const { container } = render(
      <ScrollArea maxHeight={200}>
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement
    expect(scroller.tabIndex).toBe(0)
  })

  it('omits role="region" when no accessible name is provided', () => {
    // Unnamed regions are AT noise. Only become a landmark when the
    // consumer provides an aria-label / aria-labelledby.
    const { container } = render(
      <ScrollArea maxHeight={200}>
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement
    expect(scroller.getAttribute('role')).toBeNull()
  })

  it('exposes role="region" with the consumer aria-label', () => {
    render(
      <ScrollArea maxHeight={200} aria-label="Search results">
        <div>x</div>
      </ScrollArea>,
    )
    expect(
      screen.getByRole('region', { name: 'Search results' }),
    ).toBeInTheDocument()
  })

  it('exposes role="region" with aria-labelledby', () => {
    const { container } = render(
      <>
        <h2 id="my-heading">Heading</h2>
        <ScrollArea maxHeight={200} aria-labelledby="my-heading">
          <div>x</div>
        </ScrollArea>
      </>,
    )
    const scroller = container.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement
    expect(scroller.getAttribute('role')).toBe('region')
    expect(scroller.getAttribute('aria-labelledby')).toBe('my-heading')
  })

  it('has no axe violations when labelled', async () => {
    const { container } = render(
      <ScrollArea maxHeight={200} aria-label="Activity feed">
        <ul>
          <li>One</li>
          <li>Two</li>
        </ul>
      </ScrollArea>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  // ===== Orientation =====

  it('applies the vertical orientation class by default', () => {
    const { container } = render(
      <ScrollArea maxHeight={200}>
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement
    expect(scroller).toBeInTheDocument()
    expect(scroller.className).toMatch(/orientation-vertical/)
  })

  it('applies horizontal and both orientation classes when requested', () => {
    const { container: h } = render(
      <ScrollArea maxHeight={200} orientation="horizontal">
        <div>x</div>
      </ScrollArea>,
    )
    const horizontal = h.querySelector(
      '[data-orientation="horizontal"]',
    ) as HTMLElement
    expect(horizontal.className).toMatch(/orientation-horizontal/)

    const { container: b } = render(
      <ScrollArea maxHeight={200} orientation="both">
        <div>x</div>
      </ScrollArea>,
    )
    const both = b.querySelector('[data-orientation="both"]') as HTMLElement
    expect(both.className).toMatch(/orientation-both/)
  })

  // ===== scrollbarMode =====

  it('defaults scrollbarMode to overlay and stamps data + class', () => {
    const { container } = render(
      <ScrollArea maxHeight={200}>
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-scrollbar-mode="overlay"]',
    ) as HTMLElement
    expect(scroller).toBeInTheDocument()
    expect(scroller.className).toMatch(/mode-overlay/)
  })

  it('honors inset and auto scrollbarMode values', () => {
    const { container: a } = render(
      <ScrollArea maxHeight={200} scrollbarMode="inset">
        <div>x</div>
      </ScrollArea>,
    )
    expect(
      (a.querySelector('[data-scrollbar-mode="inset"]') as HTMLElement)
        .className,
    ).toMatch(/mode-inset/)

    const { container: b } = render(
      <ScrollArea maxHeight={200} scrollbarMode="auto">
        <div>x</div>
      </ScrollArea>,
    )
    expect(
      (b.querySelector('[data-scrollbar-mode="auto"]') as HTMLElement)
        .className,
    ).toMatch(/mode-auto/)
  })

  // ===== scrollbarVisibility =====

  it('defaults scrollbarVisibility to hover', () => {
    const { container } = render(
      <ScrollArea maxHeight={200}>
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-scrollbar-visibility="hover"]',
    ) as HTMLElement
    expect(scroller).toBeInTheDocument()
    expect(scroller.className).toMatch(/visibility-hover/)
  })

  it('applies always and scroll visibility classes when requested', () => {
    const { container: a } = render(
      <ScrollArea maxHeight={200} scrollbarVisibility="always">
        <div>x</div>
      </ScrollArea>,
    )
    expect(
      (
        a.querySelector('[data-scrollbar-visibility="always"]') as HTMLElement
      ).className,
    ).toMatch(/visibility-always/)

    const { container: s } = render(
      <ScrollArea maxHeight={200} scrollbarVisibility="scroll">
        <div>x</div>
      </ScrollArea>,
    )
    expect(
      (
        s.querySelector('[data-scrollbar-visibility="scroll"]') as HTMLElement
      ).className,
    ).toMatch(/visibility-scroll/)
  })

  // ===== className + ref =====

  it('appends a consumer className without clobbering built-in classes', () => {
    const { container } = render(
      <ScrollArea maxHeight={200} className="custom-scroller">
        <div>x</div>
      </ScrollArea>,
    )
    const scroller = container.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement
    expect(scroller.className).toMatch(/custom-scroller/)
    expect(scroller.className).toMatch(/scrollArea/)
    expect(scroller.className).toMatch(/mode-overlay/)
    expect(scroller.className).toMatch(/visibility-hover/)
  })

  it('forwards refs to the underlying div', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <ScrollArea ref={ref} maxHeight={200}>
        <div>x</div>
      </ScrollArea>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.getAttribute('data-orientation')).toBe('vertical')
  })
})
