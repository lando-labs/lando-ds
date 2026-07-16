/**
 * Divider Component Tests
 *
 * Covers:
 *  - Plain horizontal divider renders as <hr> with separator role
 *  - Labeled section-break variant renders "line — label — line" (#22)
 *  - Label accepts ReactNode content, not just strings
 *  - labelPosition logical aliases (start/end) work
 *  - Vertical divider ignores label
 *  - spacing/variant modifier classes are applied
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Divider } from './Divider'

describe('Divider', () => {
  it('renders a plain horizontal divider as <hr> by default', () => {
    const { container } = render(<Divider />)
    const hr = container.querySelector('hr')
    expect(hr).toBeInTheDocument()
    expect(hr).toHaveAttribute('role', 'separator')
    expect(hr).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('renders a vertical divider as <div>', () => {
    const { container } = render(<Divider orientation="vertical" />)
    // Vertical must NOT render an <hr> (not semantically vertical).
    expect(container.querySelector('hr')).not.toBeInTheDocument()
    const sep = container.querySelector('[role="separator"]')
    expect(sep).toBeInTheDocument()
    expect(sep).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('renders labeled section-break with two lines flanking the label (#22)', () => {
    // The classic "────── Or Continue With ──────" pattern.
    const { container } = render(<Divider label="Or Continue With" />)
    // Label text is visible
    expect(screen.getByText('Or Continue With')).toBeInTheDocument()
    // No <hr> — labeled variant uses <div> so we can host children
    expect(container.querySelector('hr')).not.toBeInTheDocument()
    // Two decorative line spans (aria-hidden) flanking the label
    const lines = container.querySelectorAll('[aria-hidden="true"]')
    expect(lines.length).toBe(2)
    // Still exposes separator semantics
    const sep = container.querySelector('[role="separator"]')
    expect(sep).toBeInTheDocument()
    expect(sep).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('accepts ReactNode label, not just string (#22)', () => {
    // Consumers may want an icon + text or a <Badge> inside the label.
    render(
      <Divider
        label={
          <span data-testid="rich-label">
            <strong>Agents</strong> section
          </span>
        }
      />
    )
    expect(screen.getByTestId('rich-label')).toBeInTheDocument()
    expect(screen.getByText('Agents')).toBeInTheDocument()
  })

  it('ignores label on vertical dividers (out of scope for #22)', () => {
    render(
      <Divider
        orientation="vertical"
        label="Should not appear"
      />
    )
    // Label should NOT be rendered for vertical orientation.
    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument()
  })

  it('supports logical labelPosition aliases (start / end)', () => {
    // Both logical and directional values should yield the same class.
    const { container: startContainer } = render(
      <Divider label="L" labelPosition="start" />
    )
    const { container: leftContainer } = render(
      <Divider label="L" labelPosition="left" />
    )
    // Both should apply the "label-left" styling (CSS Modules hash,
    // but both renderings should carry the same hashed class name).
    const startClass = startContainer
      .querySelector('[role="separator"]')
      ?.className.split(' ')
      .find((c) => c.includes('label-left'))
    const leftClass = leftContainer
      .querySelector('[role="separator"]')
      ?.className.split(' ')
      .find((c) => c.includes('label-left'))
    expect(startClass).toBeDefined()
    expect(leftClass).toBeDefined()
    expect(startClass).toBe(leftClass)
  })

  it('supports end alias mapping to right', () => {
    const { container: endContainer } = render(
      <Divider label="R" labelPosition="end" />
    )
    const { container: rightContainer } = render(
      <Divider label="R" labelPosition="right" />
    )
    const endClass = endContainer
      .querySelector('[role="separator"]')
      ?.className.split(' ')
      .find((c) => c.includes('label-right'))
    const rightClass = rightContainer
      .querySelector('[role="separator"]')
      ?.className.split(' ')
      .find((c) => c.includes('label-right'))
    expect(endClass).toBeDefined()
    expect(rightClass).toBeDefined()
    expect(endClass).toBe(rightClass)
  })

  it('applies spacing modifier class', () => {
    const { container } = render(<Divider spacing="lg" />)
    const hr = container.querySelector('hr')
    expect(hr?.className).toMatch(/spacing-lg/)
  })

  it('applies variant modifier class', () => {
    const { container } = render(<Divider variant="dashed" />)
    const hr = container.querySelector('hr')
    expect(hr?.className).toMatch(/dashed/)
  })

  it('works with label + spacing + variant together', () => {
    // Interop check — labeled variant should still pick up spacing/variant
    // modifier classes.
    const { container } = render(
      <Divider label="Section" spacing="lg" variant="dashed" />
    )
    const sep = container.querySelector('[role="separator"]')
    expect(sep?.className).toMatch(/withLabel/)
    expect(sep?.className).toMatch(/spacing-lg/)
    expect(sep?.className).toMatch(/dashed/)
    expect(screen.getByText('Section')).toBeInTheDocument()
  })

  // #423 — style / ...rest passthrough onto the visual root. Divider
  // previously extended no HTMLAttributes and dropped both.
  describe('attribute passthrough (#423)', () => {
    it('lands consumer data-testid and style.color on the horizontal <hr> root', () => {
      render(<Divider data-testid="rule" style={{ color: 'rgb(1, 2, 3)' }} />)
      const el = screen.getByTestId('rule')
      expect(el.tagName).toBe('HR')
      expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    })

    it('lands consumer data-testid and style on the vertical divider root', () => {
      render(
        <Divider
          orientation="vertical"
          data-testid="rule"
          style={{ color: 'rgb(1, 2, 3)' }}
        />,
      )
      const el = screen.getByTestId('rule')
      expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
      expect(el).toHaveAttribute('aria-orientation', 'vertical')
    })

    it('lands consumer data-testid and style on the labeled divider root', () => {
      render(
        <Divider
          label="Section"
          data-testid="rule"
          style={{ color: 'rgb(1, 2, 3)' }}
        />,
      )
      const el = screen.getByTestId('rule')
      expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    })

    it('does not let a consumer clobber the semantic separator role', () => {
      // rest is spread BEFORE the internal role/aria, so the contract holds.
      render(<Divider data-testid="rule" role="presentation" />)
      expect(screen.getByTestId('rule')).toHaveAttribute('role', 'separator')
    })
  })

  // #424 — Layer-7 polymorphism via asChild (unlabeled dividers only).
  describe('asChild (#424)', () => {
    it('renders the child element carrying the Divider root class + role (horizontal)', () => {
      render(
        <Divider asChild className="extra" style={{ color: 'rgb(1, 2, 3)' }}>
          <hr data-testid="x" />
        </Divider>,
      )
      const el = screen.getByTestId('x')
      expect(el.tagName).toBe('HR')
      expect(el.className).toMatch(/divider/)
      expect(el.className).toMatch(/extra/)
      expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
      expect(el).toHaveAttribute('role', 'separator')
    })

    it('renders the child element as a vertical separator', () => {
      render(
        <Divider asChild orientation="vertical">
          <div data-testid="x" />
        </Divider>,
      )
      const el = screen.getByTestId('x')
      expect(el.tagName).toBe('DIV')
      expect(el.className).toMatch(/divider/)
      expect(el).toHaveAttribute('aria-orientation', 'vertical')
    })
  })
})
