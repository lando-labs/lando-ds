/**
 * Badge Component Tests
 *
 * Sprint 12 (#14) — expanded beyond the initial stub. Covers every
 * variant + size, pill shape, dot-only variant, icon slot, removable
 * behavior (onRemove + accessible remove button), and jest-axe a11y.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders children as the label', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('renders every variant without errors', () => {
    // Badge.tsx line 22: default | primary | success | warning | danger | info
    const variants = [
      'default',
      'primary',
      'success',
      'warning',
      'danger',
      'info',
    ] as const
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>)
      expect(screen.getByText(variant)).toBeInTheDocument()
      unmount()
    }
  })

  it('renders every size without errors', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      const { unmount } = render(<Badge size={size}>{size}</Badge>)
      expect(screen.getByText(size)).toBeInTheDocument()
      unmount()
    }
  })

  it('applies pill class when pill prop is true', () => {
    const { container } = render(<Badge pill>Pilled</Badge>)
    // CSS Modules hash class names — match the substring.
    expect(container.firstChild).toHaveProperty('className')
    expect((container.firstChild as HTMLElement).className).toMatch(/pill/)
  })

  it('renders as dot-only (no text content) when dot prop is true', () => {
    const { container } = render(<Badge dot variant="success" />)
    // Badge.tsx lines 84–92: in dot mode, the content span is not rendered.
    const dot = container.querySelector('[class*="dot"]') as HTMLElement
    expect(dot).toBeInTheDocument()
    expect(dot.textContent).toBe('')
  })

  it('renders icon slot when icon is supplied', () => {
    render(
      <Badge icon={<span data-testid="badge-icon">★</span>}>Starred</Badge>
    )
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument()
    expect(screen.getByText('Starred')).toBeInTheDocument()
  })

  it('renders an accessible remove button when onRemove is provided', () => {
    render(<Badge onRemove={() => {}}>Removable</Badge>)
    // Badge.tsx line 99: aria-label="Remove badge"
    expect(
      screen.getByRole('button', { name: /remove badge/i })
    ).toBeInTheDocument()
  })

  it('fires onRemove when the remove button is clicked', () => {
    const handleRemove = vi.fn()
    render(<Badge onRemove={handleRemove}>Removable</Badge>)

    fireEvent.click(screen.getByRole('button', { name: /remove badge/i }))
    expect(handleRemove).toHaveBeenCalledTimes(1)
  })

  it('does not render a remove button when onRemove is not provided', () => {
    render(<Badge>Plain</Badge>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // #424 — Layer-7 polymorphism via asChild. Makes a badge clickable by
  // delegating to a supplied <a>/<button>, avoiding nested interactives.
  describe('asChild (#424)', () => {
    it('renders the child element carrying the Badge root class + forwarded className/style', () => {
      render(
        <Badge asChild className="extra" style={{ color: 'rgb(1, 2, 3)' }}>
          <a href="/tag" data-testid="x">
            Tag
          </a>
        </Badge>,
      )
      const el = screen.getByTestId('x')
      // Renders as the anchor, not a <span>-wrapped anchor.
      expect(el.tagName).toBe('A')
      expect(el).toHaveAttribute('href', '/tag')
      expect(el.className).toMatch(/badge/)
      expect(el.className).toMatch(/extra/)
      expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
      // The child's own text becomes the badge label.
      expect(el).toHaveTextContent('Tag')
    })

    it('composes the remove button into the asChild child', () => {
      const handleRemove = vi.fn()
      render(
        <Badge asChild onRemove={handleRemove}>
          <a href="/tag" data-testid="x">
            Tag
          </a>
        </Badge>,
      )
      const el = screen.getByTestId('x')
      const removeBtn = screen.getByRole('button', { name: /remove badge/i })
      expect(el).toContainElement(removeBtn)
      fireEvent.click(removeBtn)
      expect(handleRemove).toHaveBeenCalledTimes(1)
    })
  })

  it('has no a11y violations (axe)', async () => {
    // NOTE: dot-only Badge variants render a bare <span>. In production,
    // consumers typically wrap them with visible accompanying text for
    // context. We don't include a dot variant here to keep the axe pass
    // focused on labeled badges.
    const { container } = render(
      <div>
        <Badge variant="primary">New</Badge>
        <Badge variant="success" size="sm">
          Active
        </Badge>
        <Badge onRemove={() => {}}>Removable</Badge>
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  /*
   * #87 — colorScheme prop (Sprint 16). Identity palettes orthogonal to
   * `variant`. Both can co-exist; colorScheme wins for color.
   */
  describe('colorScheme prop (#87)', () => {
    const palettes = [
      'sky',
      'teal',
      'orange',
      'blue',
      'purple',
      'green',
      'rose',
    ] as const

    it('renders every colorScheme value with the matching CSS class', () => {
      for (const scheme of palettes) {
        const { container, unmount } = render(
          <Badge colorScheme={scheme}>{scheme}</Badge>
        )
        // CSS Modules hash the class name but preserve a `cs-<key>`
        // substring we can match on.
        expect((container.firstChild as HTMLElement).className).toMatch(
          new RegExp(`cs-${scheme}`)
        )
        unmount()
      }
    })

    it('renders without colorScheme class when prop is omitted', () => {
      const { container } = render(<Badge>Plain</Badge>)
      expect((container.firstChild as HTMLElement).className).not.toMatch(
        /cs-/
      )
    })

    it('co-exists with variant — both classes are emitted on the element', () => {
      // The brief: when both are passed, colorScheme wins for color but
      // variant is retained for non-color semantics. Both classes should
      // be present in the DOM so consumers can target either.
      const { container } = render(
        <Badge variant="success" colorScheme="orange">
          RSS
        </Badge>
      )
      const className = (container.firstChild as HTMLElement).className
      expect(className).toMatch(/success/)
      expect(className).toMatch(/cs-orange/)
    })

    it('does not regress existing variant rendering', () => {
      // Sanity: omitting colorScheme leaves variant untouched.
      const { container } = render(<Badge variant="warning">Pending</Badge>)
      expect((container.firstChild as HTMLElement).className).toMatch(
        /warning/
      )
    })

    it('has no a11y violations across colorScheme palettes (axe)', async () => {
      const { container } = render(
        <div>
          <Badge colorScheme="orange">RSS</Badge>
          <Badge colorScheme="blue">NewsAPI</Badge>
          <Badge colorScheme="purple">PubMed</Badge>
          <Badge colorScheme="green">ThinkTank</Badge>
          <Badge colorScheme="teal">Topic</Badge>
          <Badge colorScheme="sky">Sky</Badge>
          <Badge colorScheme="rose">Rose</Badge>
        </div>
      )
      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
