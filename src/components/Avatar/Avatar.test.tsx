/**
 * Avatar Component Tests
 *
 * Covers image vs initials vs fallback rendering, loading state, status
 * indicator (with #13 WCAG 1.4.1 glyph-diversity regression locks),
 * Sprint 10 (#59) gradient-by-default behavior, size variants, and
 * Sprint 12 (#14) jest-axe a11y smoke.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders image when src is provided', () => {
    render(<Avatar src="/test.jpg" alt="Test User" />)
    // Query by img role but filter out status indicators
    const img = screen.getByAltText('Test User')
    expect(img).toBeInTheDocument()
  })

  it('renders initials when provided and no image', () => {
    render(<Avatar initials="JD" alt="John Doe" />)
    expect(screen.getByLabelText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('shows loading state when loading prop is true', () => {
    const { container } = render(<Avatar loading />)
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('displays status indicator when status prop is provided', () => {
    render(<Avatar initials="JD" status="online" />)
    expect(screen.getByLabelText('Status: online')).toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  Issue #13 — WCAG 1.4.1 (use of color)
   *
   *  Each status must be distinguishable by shape/glyph in addition to
   *  color. online = solid dot, offline = hollow ring, busy = minus bar,
   *  away = crescent moon. Offline/busy/away render an inner SVG; online
   *  intentionally has no glyph (the filled disc IS the visual affordance).
   * ------------------------------------------------------------------ */

  describe('status glyph diversity (#13)', () => {
    it('renders a distinct SVG glyph for offline status', () => {
      render(<Avatar initials="JD" status="offline" />)
      const statusEl = screen.getByLabelText('Status: offline')
      expect(statusEl.querySelector('svg')).not.toBeNull()
    })

    it('renders a distinct SVG glyph for busy status', () => {
      render(<Avatar initials="JD" status="busy" />)
      const statusEl = screen.getByLabelText('Status: busy')
      expect(statusEl.querySelector('svg')).not.toBeNull()
      // The busy glyph is a horizontal bar, so we expect a <rect>
      expect(statusEl.querySelector('rect')).not.toBeNull()
    })

    it('renders a distinct SVG glyph for away status', () => {
      render(<Avatar initials="JD" status="away" />)
      const statusEl = screen.getByLabelText('Status: away')
      expect(statusEl.querySelector('svg')).not.toBeNull()
      // The away glyph is a crescent moon, so we expect a <path>
      expect(statusEl.querySelector('path')).not.toBeNull()
    })

    it('online status keeps the solid dot (no inner glyph)', () => {
      render(<Avatar initials="JD" status="online" />)
      const statusEl = screen.getByLabelText('Status: online')
      // online renders no SVG — the filled colored disc is the visual cue
      expect(statusEl.querySelector('svg')).toBeNull()
    })

    it('status indicator exposes role=img + aria-label for AT', () => {
      render(<Avatar initials="JD" status="busy" />)
      const statusEl = screen.getByLabelText('Status: busy')
      expect(statusEl).toHaveAttribute('role', 'img')
    })
  })

  /* ------------------------------------------------------------------ *
   *  Sprint 10 (#59) — Gradient-by-default when initials are set
   *
   *  Avatars with `initials` (and no `src`) now default to a hash-
   *  indexed ocean gradient so contact lists render as richly-colored
   *  sets rather than 20 identical blue circles. `gradient={false}`
   *  remains the opt-out for the flat neutral-300 look.
   * ------------------------------------------------------------------ */
  describe('gradient defaults (#59)', () => {
    it('enables a gradient by default when initials are provided', () => {
      const { container } = render(
        <Avatar initials="JD" data-testid="av" />
      )
      const el = container.querySelector('[data-testid="av"]') as HTMLElement
      expect(el.className).toMatch(/gradient/)
    })

    it('opts out of the gradient with gradient={false}', () => {
      const { container } = render(
        <Avatar initials="JD" gradient={false} data-testid="av" />
      )
      const el = container.querySelector('[data-testid="av"]') as HTMLElement
      expect(el.className).not.toMatch(/gradient/)
    })

    it('does not apply a gradient when src is provided (image wins)', () => {
      const { container } = render(
        <Avatar src="/u.jpg" alt="U" initials="U" data-testid="av" />
      )
      const el = container.querySelector('[data-testid="av"]') as HTMLElement
      // src + no error state → image path renders, no gradient needed.
      expect(el.className).not.toMatch(/gradient/)
    })

    it('hashes initials deterministically (same input → same slot class)', () => {
      const { container: a } = render(<Avatar initials="JD" data-testid="a" />)
      const { container: b } = render(<Avatar initials="JD" data-testid="b" />)
      const elA = a.querySelector('[data-testid="a"]') as HTMLElement
      const elB = b.querySelector('[data-testid="b"]') as HTMLElement
      // Extract the gradient-N slot tokens from each className and compare.
      const slotA = elA.className.match(/gradient-\d/)?.[0]
      const slotB = elB.className.match(/gradient-\d/)?.[0]
      expect(slotA).toBeDefined()
      expect(slotA).toBe(slotB)
    })
  })

  /* ------------------------------------------------------------------ *
   *  Sprint 12 (#14) — coverage expansion
   * ------------------------------------------------------------------ */
  describe('size variants (#14)', () => {
    it('renders every size without error', () => {
      // Avatar.tsx line 26: size = xs | sm | md | lg | xl | 2xl
      const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
      for (const size of sizes) {
        const { unmount } = render(
          <Avatar initials="JD" size={size} data-testid={`av-${size}`} />
        )
        expect(screen.getByTestId(`av-${size}`)).toBeInTheDocument()
        unmount()
      }
    })
  })

  describe('fallback behavior (#14)', () => {
    it('renders the user icon fallback when no src and no initials are supplied', () => {
      render(<Avatar data-testid="av" />)
      // Fallback is a <span> with aria-label="User avatar".
      expect(screen.getByLabelText('User avatar')).toBeInTheDocument()
    })
  })

  describe('a11y (#14)', () => {
    it('has no a11y violations (axe) — image variant', async () => {
      const { container } = render(
        <Avatar src="/example.jpg" alt="Jane Doe" />
      )
      expect(await axe(container)).toHaveNoViolations()
    })

    it('has no a11y violations (axe) — initials variant with status', async () => {
      const { container } = render(
        <Avatar initials="JD" alt="Jane Doe" status="online" />
      )
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  // #424 — Layer-7 polymorphism via asChild. Makes an avatar clickable by
  // delegating to a supplied <a>/<button> rather than nesting one.
  describe('asChild (#424)', () => {
    it('renders the child element carrying the Avatar root class + forwarded className/style', () => {
      render(
        <Avatar
          asChild
          initials="JD"
          className="extra"
          style={{ color: 'rgb(1, 2, 3)' }}
        >
          <a href="/profile" data-testid="x" />
        </Avatar>,
      )
      const el = screen.getByTestId('x')
      // Renders as the anchor, not a <div>-wrapped anchor.
      expect(el.tagName).toBe('A')
      expect(el).toHaveAttribute('href', '/profile')
      expect(el.className).toMatch(/avatar/)
      expect(el.className).toMatch(/extra/)
      expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    })

    it('composes the avatar inner content (initials) into the child', () => {
      render(
        <Avatar asChild initials="JD" alt="Jane Doe">
          <a href="/profile" data-testid="x" />
        </Avatar>,
      )
      const el = screen.getByTestId('x')
      expect(el).toHaveTextContent('JD')
    })
  })
})
