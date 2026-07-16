/**
 * StatusDot Component Tests
 *
 * Sprint 19 (#108) — covers every variant + size, accessibility
 * branching (aria-label vs decorative), deterministic class composition
 * (so visual regression CI can rely on it), and jest-axe a11y.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { StatusDot } from './StatusDot'

describe('StatusDot', () => {
  it('renders a span element', () => {
    const { container } = render(<StatusDot />)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })

  it('renders every variant without errors', () => {
    const variants = [
      'success',
      'warning',
      'danger',
      'neutral',
      'info',
    ] as const
    for (const variant of variants) {
      const { container, unmount } = render(
        <StatusDot variant={variant} aria-label={variant} />
      )
      // CSS Modules hash the class name but preserve the token as a
      // substring so we can match on it.
      expect((container.firstChild as HTMLElement).className).toMatch(
        new RegExp(variant)
      )
      unmount()
    }
  })

  it('applies the sm size class by default', () => {
    const { container } = render(<StatusDot />)
    expect((container.firstChild as HTMLElement).className).toMatch(/sm/)
  })

  it('applies the md size class when size="md"', () => {
    const { container } = render(<StatusDot size="md" />)
    const className = (container.firstChild as HTMLElement).className
    expect(className).toMatch(/md/)
    // sm and md are mutually exclusive — the sm class should NOT be
    // present when md is requested.
    expect(className).not.toMatch(/(^|\s)\S*sm\S*(\s|$)/)
  })

  it('renders sm and md with different size classes (deterministic)', () => {
    const { container: smContainer } = render(<StatusDot size="sm" />)
    const { container: mdContainer } = render(<StatusDot size="md" />)
    const smClass = (smContainer.firstChild as HTMLElement).className
    const mdClass = (mdContainer.firstChild as HTMLElement).className
    expect(smClass).not.toEqual(mdClass)
  })

  it('exposes the aria-label and role="img" when aria-label is provided', () => {
    render(<StatusDot variant="success" aria-label="Healthy" />)
    const dot = screen.getByRole('img', { name: 'Healthy' })
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('aria-label', 'Healthy')
  })

  it('honors a custom role when provided alongside aria-label', () => {
    render(
      <StatusDot
        variant="warning"
        aria-label="Drifted"
        role="status"
      />
    )
    expect(
      screen.getByRole('status', { name: 'Drifted' })
    ).toBeInTheDocument()
  })

  it('is decorative (aria-hidden) when no aria-label is provided', () => {
    const { container } = render(<StatusDot variant="neutral" />)
    const dot = container.firstChild as HTMLElement
    expect(dot).toHaveAttribute('aria-hidden', 'true')
    expect(dot).not.toHaveAttribute('aria-label')
    expect(dot).not.toHaveAttribute('role')
  })

  it('produces deterministic class composition for the same props', () => {
    // Visual regression CI relies on the rendered className being
    // stable across builds for a given prop set.
    const { container: a } = render(
      <StatusDot variant="success" size="md" />
    )
    const { container: b } = render(
      <StatusDot variant="success" size="md" />
    )
    expect((a.firstChild as HTMLElement).className).toEqual(
      (b.firstChild as HTMLElement).className
    )
  })

  it('appends a consumer-supplied className', () => {
    const { container } = render(<StatusDot className="my-custom" />)
    expect((container.firstChild as HTMLElement).className).toMatch(
      /my-custom/
    )
  })

  it('forwards refs to the underlying span', () => {
    const ref = { current: null as HTMLSpanElement | null }
    render(<StatusDot ref={ref} aria-label="Healthy" />)
    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
  })

  it('has no a11y violations across labeled variants (axe)', async () => {
    const { container } = render(
      <div>
        <StatusDot variant="success" aria-label="Healthy" />
        <StatusDot variant="warning" aria-label="Drifted" />
        <StatusDot variant="danger" aria-label="Failed" />
        <StatusDot variant="neutral" aria-label="Idle" />
        <StatusDot variant="info" aria-label="Active" />
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no a11y violations when used decoratively beside text', async () => {
    // Decorative case: aria-hidden dot with sibling text carrying meaning.
    const { container } = render(
      <div>
        <span>
          <StatusDot variant="success" /> Healthy
        </span>
        <span>
          <StatusDot variant="warning" /> Drifted
        </span>
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  // ===== Sprint 20 (#113): label prop =====

  it('renders label text in the DOM when label is provided', () => {
    render(<StatusDot variant="success" label="Healthy" />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('composes label with every variant correctly', () => {
    const variants = [
      'success',
      'warning',
      'danger',
      'neutral',
      'info',
    ] as const
    for (const variant of variants) {
      const { container, unmount } = render(
        <StatusDot variant={variant} label={`${variant}-label`} />
      )
      // Wrapper is the outer span; the inner dot child carries the
      // variant class.
      const root = container.firstChild as HTMLElement
      const dot = root.firstChild as HTMLElement
      expect(dot.className).toMatch(new RegExp(variant))
      expect(root.textContent).toBe(`${variant}-label`)
      unmount()
    }
  })

  it('marks the dot aria-hidden when label is provided (label carries meaning)', () => {
    const { container } = render(
      <StatusDot variant="success" label="Healthy" />
    )
    const root = container.firstChild as HTMLElement
    const dot = root.firstChild as HTMLElement
    expect(dot).toHaveAttribute('aria-hidden', 'true')
    // The dot must NOT have role="img" or aria-label in labeled mode —
    // the label text is the accessible name.
    expect(dot).not.toHaveAttribute('role')
    expect(dot).not.toHaveAttribute('aria-label')
  })

  it('preserves the no-label rendering path (single bare span)', () => {
    // Regression check: without `label`, the component must render as
    // a single span with the dot classes directly on it (no wrapper).
    const { container } = render(<StatusDot variant="success" />)
    const root = container.firstChild as HTMLElement
    expect(root.nodeName).toBe('SPAN')
    expect(root.children.length).toBe(0)
    expect(root.className).toMatch(/success/)
    expect(root).toHaveAttribute('aria-hidden', 'true')
  })

  it('label inherits Text-style typography via class composition (deterministic)', () => {
    // The label child must carry the .label class, which keys on
    // --font-size-sm and --color-text-primary. Visual regression CI
    // relies on this class string being stable.
    const { container: a } = render(
      <StatusDot variant="success" label="Healthy" />
    )
    const { container: b } = render(
      <StatusDot variant="success" label="Healthy" />
    )
    const aLabel = (a.firstChild as HTMLElement).lastChild as HTMLElement
    const bLabel = (b.firstChild as HTMLElement).lastChild as HTMLElement
    expect(aLabel.className).toMatch(/label/)
    expect(aLabel.className).toEqual(bLabel.className)
  })

  it('forwards refs to the wrapper span in labeled mode', () => {
    const ref = { current: null as HTMLSpanElement | null }
    render(<StatusDot variant="success" label="Healthy" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
    // Ref points to the outer wrapper, which contains the dot + label.
    expect(ref.current?.children.length).toBe(2)
  })

  it('appends consumer className to the wrapper in labeled mode', () => {
    const { container } = render(
      <StatusDot variant="success" label="Healthy" className="my-custom" />
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toMatch(/my-custom/)
  })

  it('has no a11y violations in labeled mode (axe)', async () => {
    const { container } = render(
      <div>
        <StatusDot variant="success" label="Healthy" />
        <StatusDot variant="warning" label="Drifted" />
        <StatusDot variant="danger" label="Failed" />
        <StatusDot variant="neutral" label="Idle" />
        <StatusDot variant="info" label="Active" />
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
