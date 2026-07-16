/**
 * NavTabs Component Tests (#377)
 *
 * Behavioural coverage:
 *  - Plain anchor flavor renders <a href="…">
 *  - `safeHref` neutralizes `javascript:` / etc. (verifies the v0.27 anchor
 *    guard catches it for the new component)
 *  - `active` adds `aria-current="page"` AND the active-state class
 *  - `asChild` wraps a consumer <a> via Slot, merging className + aria-current
 *  - <nav> landmark + custom aria-label
 *  - icon + badge slots render
 *  - <ul role="list"> wrapper exists (Safari/iOS VoiceOver list-semantics fix)
 *  - jest-axe smoke
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { NavTabs } from './NavTabs'

expect.extend(toHaveNoViolations)

describe('NavTabs', () => {
  /* ------------------------------------------------------------------ *
   *  Landmark + structure
   * ------------------------------------------------------------------ */

  it('renders as <nav> with the default "Primary" aria-label', () => {
    render(
      <NavTabs>
        <NavTabs.Item href="/x">Dashboard</NavTabs.Item>
      </NavTabs>,
    )
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav.tagName).toBe('NAV')
  })

  it('honors a custom aria-label', () => {
    render(
      <NavTabs aria-label="Workspace areas">
        <NavTabs.Item href="/x">Dashboard</NavTabs.Item>
      </NavTabs>,
    )
    expect(
      screen.getByRole('navigation', { name: 'Workspace areas' }),
    ).toBeInTheDocument()
  })

  it('wraps items in a <ul role="list"> for Safari/iOS list-semantics', () => {
    const { container } = render(
      <NavTabs>
        <NavTabs.Item href="/a">A</NavTabs.Item>
        <NavTabs.Item href="/b">B</NavTabs.Item>
      </NavTabs>,
    )
    const ul = container.querySelector('ul')
    expect(ul).toBeInTheDocument()
    expect(ul).toHaveAttribute('role', 'list')
    expect(ul?.querySelectorAll('li')).toHaveLength(2)
  })

  /* ------------------------------------------------------------------ *
   *  Plain anchor flavor
   * ------------------------------------------------------------------ */

  it('renders an item with href as an <a> with that href', () => {
    render(
      <NavTabs>
        <NavTabs.Item href="/dashboard">Dashboard</NavTabs.Item>
      </NavTabs>,
    )
    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/dashboard')
  })

  it('renders an icon and a badge alongside the label', () => {
    render(
      <NavTabs>
        <NavTabs.Item
          href="/inbox"
          icon={<span data-testid="icon">📥</span>}
          badge={<span data-testid="badge">3</span>}
        >
          Inbox
        </NavTabs.Item>
      </NavTabs>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    // Label still readable as the link's accessible name.
    expect(screen.getByRole('link', { name: /Inbox/ })).toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  Active state
   * ------------------------------------------------------------------ */

  it('marks the active item with aria-current="page"', () => {
    render(
      <NavTabs>
        <NavTabs.Item href="/a">A</NavTabs.Item>
        <NavTabs.Item href="/b" active>
          B
        </NavTabs.Item>
      </NavTabs>,
    )
    const activeLink = screen.getByRole('link', { name: 'B' })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'A' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('applies an active-state class to the active item', () => {
    render(
      <NavTabs>
        <NavTabs.Item href="/a">A</NavTabs.Item>
        <NavTabs.Item href="/b" active>
          B
        </NavTabs.Item>
      </NavTabs>,
    )
    const activeLink = screen.getByRole('link', { name: 'B' })
    const inactiveLink = screen.getByRole('link', { name: 'A' })
    // CSS Modules hashes the class, so test the substring rather than the
    // exact name. The base `item` class is on every link; the modifier is
    // only on the active one.
    expect(activeLink.className).toMatch(/itemActive/)
    expect(inactiveLink.className).not.toMatch(/itemActive/)
  })

  /* ------------------------------------------------------------------ *
   *  asChild composition (next/link integration)
   * ------------------------------------------------------------------ */

  it('asChild slots into the consumer-provided <a> with merged className', () => {
    render(
      <NavTabs>
        <NavTabs.Item asChild active>
          <a href="/routed" data-testid="routed">
            Dashboard
          </a>
        </NavTabs.Item>
      </NavTabs>,
    )
    const link = screen.getByTestId('routed')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/routed')
    expect(link).toHaveAttribute('aria-current', 'page')
    // The DS item classes were merged onto the consumer's <a>.
    expect(link.className).toMatch(/item/)
    expect(link.className).toMatch(/itemActive/)
    // The icon/label/badge tree was injected into the slotted child.
    expect(link.textContent).toContain('Dashboard')
  })

  it('asChild renders icon + badge inside the slotted child', () => {
    render(
      <NavTabs>
        <NavTabs.Item
          asChild
          icon={<span data-testid="icon" />}
          badge={<span data-testid="badge" />}
        >
          <a href="/routed">Inbox</a>
        </NavTabs.Item>
      </NavTabs>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Inbox/ })).toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  #320 — href sanitization
   * ------------------------------------------------------------------ */

  describe('href sanitization (#320)', () => {
    it('neutralizes a javascript: href to the fallback', () => {
      render(
        <NavTabs>
          <NavTabs.Item href="javascript:alert(1)">Evil</NavTabs.Item>
        </NavTabs>,
      )
      const link = screen.getByRole('link', { name: 'Evil' })
      expect(link.getAttribute('href')).toBe('#')
      expect(link.getAttribute('href')).not.toContain('javascript:')
    })

    it('neutralizes a data: href to the fallback', () => {
      render(
        <NavTabs>
          <NavTabs.Item href="data:text/html,<script>alert(1)</script>">
            Evil
          </NavTabs.Item>
        </NavTabs>,
      )
      const link = screen.getByRole('link', { name: 'Evil' })
      expect(link.getAttribute('href')).toBe('#')
    })

    it('passes a safe relative href through unchanged', () => {
      render(
        <NavTabs>
          <NavTabs.Item href="/dashboard">Dashboard</NavTabs.Item>
        </NavTabs>,
      )
      expect(
        screen.getByRole('link', { name: 'Dashboard' }),
      ).toHaveAttribute('href', '/dashboard')
    })
  })

  /* ------------------------------------------------------------------ *
   *  Rest-prop hardening (#320)
   * ------------------------------------------------------------------ */

  describe('rest-prop hardening (#320)', () => {
    it('does not spread dangerouslySetInnerHTML onto the anchor', () => {
      const evil = { __html: '<img src=x onerror="window.__navpwn=1">' }
      render(
        <NavTabs>
          {/* @ts-expect-error — intentionally smuggling a forbidden prop */}
          <NavTabs.Item href="/x" dangerouslySetInnerHTML={evil}>
            Label
          </NavTabs.Item>
        </NavTabs>,
      )
      expect(document.querySelector('img')).toBeNull()
      expect(screen.getByRole('link', { name: 'Label' })).toBeInTheDocument()
      expect(
        (window as unknown as { __navpwn?: number }).__navpwn,
      ).toBeUndefined()
    })

    it('drops a string-valued on* handler from the spread', () => {
      render(
        <NavTabs>
          {/* @ts-expect-error — string handler is an injection signal */}
          <NavTabs.Item href="/x" onMouseOver="window.__navpwn2=1">
            Label
          </NavTabs.Item>
        </NavTabs>,
      )
      const link = screen.getByRole('link', { name: 'Label' })
      expect(link.getAttribute('onmouseover')).toBeNull()
    })
  })

  /* ------------------------------------------------------------------ *
   *  jest-axe smoke
   * ------------------------------------------------------------------ */

  describe('a11y (jest-axe)', () => {
    it('has no a11y violations on a typical primary nav', async () => {
      const { container } = render(
        <NavTabs aria-label="Primary">
          <NavTabs.Item href="/dashboard" active>
            Dashboard
          </NavTabs.Item>
          <NavTabs.Item href="/contacts">Contacts</NavTabs.Item>
          <NavTabs.Item href="/settings">Settings</NavTabs.Item>
        </NavTabs>,
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no a11y violations with icon + badge slots', async () => {
      const { container } = render(
        <NavTabs aria-label="Primary">
          <NavTabs.Item
            href="/inbox"
            icon={<span aria-hidden="true">📥</span>}
            badge={<span aria-label="3 unread">3</span>}
            active
          >
            Inbox
          </NavTabs.Item>
          <NavTabs.Item href="/archive">Archive</NavTabs.Item>
        </NavTabs>,
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  /* ------------------------------------------------------------------ *
   *  #423 — consumer style / ...rest pass-through to the <nav> root
   * ------------------------------------------------------------------ */
  describe('consumer passthrough (#423)', () => {
    it('lands consumer data-testid on the <nav> visual root', () => {
      render(
        <NavTabs data-testid="nt">
          <NavTabs.Item href="/a">A</NavTabs.Item>
        </NavTabs>,
      )
      expect(screen.getByTestId('nt').tagName).toBe('NAV')
    })

    it('applies consumer style.color to the <nav> visual root', () => {
      render(
        <NavTabs data-testid="nt" style={{ color: 'rgb(1, 2, 3)' }}>
          <NavTabs.Item href="/a">A</NavTabs.Item>
        </NavTabs>,
      )
      expect(screen.getByTestId('nt')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    })

    it('keeps the dedicated aria-label prop authoritative over rest', () => {
      render(
        <NavTabs data-testid="nt" aria-label="Section nav">
          <NavTabs.Item href="/a">A</NavTabs.Item>
        </NavTabs>,
      )
      // Explicit aria-label prop wins (rest is spread before it).
      expect(
        screen.getByRole('navigation', { name: 'Section nav' }),
      ).toBeInTheDocument()
    })
  })
})
