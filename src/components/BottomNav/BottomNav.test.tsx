/**
 * BottomNav Tests
 *
 * Sprint 17 (#82) — BottomNav / TabBar primitive. Covers:
 *   - Container renders all children inside a <nav>
 *   - Item with `href` renders an <a href="...">
 *   - Item with `asChild` slots its child element instead
 *   - `active={true}` adds aria-current="page"
 *   - `badge={n}` renders a badge with text "n"
 *   - `badge={null|undefined|0}` does NOT render a badge
 *   - Custom badge ReactNode renders correctly
 *   - 3-tab / 4-tab / 5-tab layouts all render
 *   - jest-axe smoke
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { BottomNav } from './BottomNav'
import { BottomNavItem } from './BottomNavItem'

expect.extend(toHaveNoViolations)

describe('BottomNav', () => {
  it('renders a nav landmark with default aria-label', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/a" icon={<svg data-testid="icon-a" />} label="A" />
        <BottomNavItem href="/b" icon={<svg />} label="B" />
      </BottomNav>,
    )
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav).toBeInTheDocument()
    expect(within(nav).getByTestId('icon-a')).toBeInTheDocument()
  })

  it('accepts a custom aria-label via ariaLabel prop', () => {
    render(
      <BottomNav ariaLabel="Mobile primary">
        <BottomNavItem href="/x" icon={<svg />} label="X" />
      </BottomNav>,
    )
    expect(screen.getByRole('navigation', { name: 'Mobile primary' })).toBeInTheDocument()
  })

  it('renders all children inside the nav element', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/a" icon={<svg />} label="A" />
        <BottomNavItem href="/b" icon={<svg />} label="B" />
        <BottomNavItem href="/c" icon={<svg />} label="C" />
      </BottomNav>,
    )
    const nav = screen.getByRole('navigation')
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(3)
  })
})

describe('BottomNavItem', () => {
  it('renders as <a> with href when href is provided', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/discover" icon={<svg />} label="Discover" />
      </BottomNav>,
    )
    const link = screen.getByRole('link', { name: /discover/i })
    expect(link).toHaveAttribute('href', '/discover')
  })

  it('renders as <button> when no href is provided', () => {
    render(
      <BottomNav>
        <BottomNavItem icon={<svg />} label="Click" />
      </BottomNav>,
    )
    expect(screen.getByRole('button', { name: /click/i })).toBeInTheDocument()
  })

  it('uses asChild to slot the child element instead of rendering its own anchor', () => {
    render(
      <BottomNav>
        <BottomNavItem icon={<svg />} label="Discover" asChild>
          <a href="/custom-route" data-testid="custom-link" />
        </BottomNavItem>
      </BottomNav>,
    )
    const link = screen.getByTestId('custom-link')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/custom-route')
    // Icon + label are still rendered inside the slotted element
    expect(within(link).getByText('Discover')).toBeInTheDocument()
  })

  it('adds aria-current="page" when active is true', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/x" icon={<svg />} label="X" active />
      </BottomNav>,
    )
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page')
  })

  it('does not add aria-current when active is false or absent', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/x" icon={<svg />} label="X" />
      </BottomNav>,
    )
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current')
  })

  it('renders a numeric badge with the number as text', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/inbox" icon={<svg />} label="Inbox" badge={5} />
      </BottomNav>,
    )
    const link = screen.getByRole('link', { name: /inbox/i })
    expect(within(link).getByText('5')).toBeInTheDocument()
  })

  it('does NOT render a badge when badge is null', () => {
    const { container } = render(
      <BottomNav>
        <BottomNavItem href="/x" icon={<svg />} label="X" badge={null} />
      </BottomNav>,
    )
    // No element has the badge class — assert by text absence on numbers/symbols
    expect(container.querySelector('[class*="badge"]')).toBeNull()
  })

  it('does NOT render a badge when badge is undefined', () => {
    const { container } = render(
      <BottomNav>
        <BottomNavItem href="/x" icon={<svg />} label="X" badge={undefined} />
      </BottomNav>,
    )
    expect(container.querySelector('[class*="badge"]')).toBeNull()
  })

  it('does NOT render a badge when badge is 0', () => {
    const { container } = render(
      <BottomNav>
        <BottomNavItem href="/x" icon={<svg />} label="X" badge={0} />
      </BottomNav>,
    )
    expect(container.querySelector('[class*="badge"]')).toBeNull()
    // Sanity: no "0" text rendered
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('renders a custom ReactNode badge as-is', () => {
    render(
      <BottomNav>
        <BottomNavItem
          href="/x"
          icon={<svg />}
          label="X"
          badge={<span data-testid="custom-badge">!</span>}
        />
      </BottomNav>,
    )
    expect(screen.getByTestId('custom-badge')).toBeInTheDocument()
  })
})

describe('BottomNav layouts', () => {
  it('renders a 3-tab layout', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/1" icon={<svg />} label="One" />
        <BottomNavItem href="/2" icon={<svg />} label="Two" />
        <BottomNavItem href="/3" icon={<svg />} label="Three" />
      </BottomNav>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('renders a 4-tab layout (Discover/Library/Serve/Account)', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/discover" icon={<svg />} label="Discover" active />
        <BottomNavItem href="/library" icon={<svg />} label="Library" badge={3} />
        <BottomNavItem href="/serve" icon={<svg />} label="Serve" />
        <BottomNavItem href="/account" icon={<svg />} label="Account" />
      </BottomNav>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('link', { name: /discover/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders a 5-tab layout', () => {
    render(
      <BottomNav>
        <BottomNavItem href="/1" icon={<svg />} label="One" />
        <BottomNavItem href="/2" icon={<svg />} label="Two" />
        <BottomNavItem href="/3" icon={<svg />} label="Three" />
        <BottomNavItem href="/4" icon={<svg />} label="Four" />
        <BottomNavItem href="/5" icon={<svg />} label="Five" />
      </BottomNav>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
})

describe('BottomNav a11y', () => {
  it('has no axe violations in a typical 4-tab layout', async () => {
    const { container } = render(
      <BottomNav>
        <BottomNavItem href="/discover" icon={<svg aria-hidden="true" />} label="Discover" active />
        <BottomNavItem href="/library" icon={<svg aria-hidden="true" />} label="Library" badge={3} />
        <BottomNavItem href="/serve" icon={<svg aria-hidden="true" />} label="Serve" />
        <BottomNavItem href="/account" icon={<svg aria-hidden="true" />} label="Account" />
      </BottomNav>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('BottomNavItem — href safety (#320/#321)', () => {
  const getLink = (href: string) => {
    render(
      <BottomNav>
        <BottomNavItem href={href} label="Tab" icon={<svg aria-hidden="true" />} />
      </BottomNav>,
    )
    return screen.getByRole('link')
  }

  it('neutralizes a javascript: href to the fallback', () => {
    expect(getLink('javascript:alert(1)').getAttribute('href')).toBe('#')
  })

  it('neutralizes a data: href to the fallback', () => {
    expect(
      getLink('data:text/html,<script>alert(1)</script>').getAttribute('href'),
    ).toBe('#')
  })

  it('preserves a safe relative href with no target/rel', () => {
    const a = getLink('/inbox')
    expect(a.getAttribute('href')).toBe('/inbox')
    expect(a).not.toHaveAttribute('target')
  })

  it('adds tabnabbing protection on external links', () => {
    const a = getLink('https://example.com')
    expect(a.getAttribute('href')).toBe('https://example.com')
    expect(a).toHaveAttribute('target', '_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
  })
})

describe('BottomNavItem — consumer passthrough (#422)', () => {
  it('lands consumer data-testid on the anchor visual root', () => {
    render(
      <BottomNav>
        <BottomNavItem
          href="/x"
          icon={<svg aria-hidden="true" />}
          label="X"
          data-testid="nav-item"
        />
      </BottomNav>,
    )
    const el = screen.getByTestId('nav-item')
    expect(el.tagName).toBe('A')
  })

  it('applies consumer style to the anchor visual root', () => {
    render(
      <BottomNav>
        <BottomNavItem
          href="/x"
          icon={<svg aria-hidden="true" />}
          label="X"
          data-testid="nav-item"
          style={{ color: 'rgb(1, 2, 3)' }}
        />
      </BottomNav>,
    )
    expect(screen.getByTestId('nav-item')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('lands consumer style on the <button> visual root when no href', () => {
    render(
      <BottomNav>
        <BottomNavItem
          icon={<svg aria-hidden="true" />}
          label="X"
          data-testid="nav-btn"
          style={{ color: 'rgb(1, 2, 3)' }}
        />
      </BottomNav>,
    )
    const el = screen.getByTestId('nav-btn')
    expect(el.tagName).toBe('BUTTON')
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })
})
