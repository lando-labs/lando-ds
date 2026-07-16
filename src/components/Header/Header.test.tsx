/**
 * Header Component Tests
 *
 * Covers:
 *  - Basic rendering of logo/navigation/actions slots
 *  - Actions right-alignment regardless of logo slot occupancy (#21)
 *  - maxWidth prop controlling inner container width (#21)
 *  - Sticky + transparent modifiers
 *  - Mobile hamburger gated on navigation prop presence (#36)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from './Header'

describe('Header', () => {
  it('renders logo, navigation, and actions slots', () => {
    render(
      <Header
        logo={<span>LOGO</span>}
        navigation={<span>NAV</span>}
        actions={<span>ACTIONS</span>}
      />
    )
    expect(screen.getByText('LOGO')).toBeInTheDocument()
    // Nav renders twice on mobile (desktop + mobile menu placeholder) —
    // but mobile menu is closed by default, so only once.
    expect(screen.getByText('NAV')).toBeInTheDocument()
    expect(screen.getByText('ACTIONS')).toBeInTheDocument()
  })

  it('renders actions with auto inline-start margin when logo slot is empty', () => {
    // Issue #21 #1: when only actions are provided, the container
    // previously used justify-content: space-between with a single
    // child — pinning actions to the leading edge. The fix applies
    // margin-inline-start: auto on .actions so they always end-align.
    // (#272 RTL — migrated from margin-left:auto; assertion target updated
    // to marginInlineStart so jsdom — which doesn't fold logical -> physical
    // — can read the rule. In real browsers, LTR resolves marginInlineStart
    // to marginLeft and RTL resolves to marginRight, both equal to 'auto'.)
    const { container } = render(<Header actions={<span>ACTIONS</span>} />)
    const actionsEl = container.querySelector('[class*="actions"]')
    expect(actionsEl).toBeInTheDocument()
    expect(actionsEl).toHaveTextContent('ACTIONS')

    // Verify the computed style resolves margin-inline-start to `auto`.
    // (jsdom applies stylesheets for CSS Modules via vitest's css: true.)
    const computed = window.getComputedStyle(actionsEl as HTMLElement)
    expect(computed.marginInlineStart).toBe('auto')
  })

  it('renders actions with auto inline-start margin even when logo is also present', () => {
    // The fix must not regress the logo+actions layout.
    const { container } = render(
      <Header logo={<span>LOGO</span>} actions={<span>ACTIONS</span>} />
    )
    const actionsEl = container.querySelector('[class*="actions"]')
    const computed = window.getComputedStyle(actionsEl as HTMLElement)
    expect(computed.marginInlineStart).toBe('auto')
  })

  it('applies default (no inline style) container width when maxWidth is omitted', () => {
    const { container } = render(<Header logo={<span>LOGO</span>} />)
    const containerEl = container.querySelector('[class*="container"]')
    expect(containerEl).toBeInTheDocument()
    // No inline style should be applied — the CSS default (1280px) wins.
    expect((containerEl as HTMLElement).style.maxWidth).toBe('')
  })

  it('applies numeric maxWidth as pixels', () => {
    const { container } = render(
      <Header maxWidth={1440} logo={<span>LOGO</span>} />
    )
    const containerEl = container.querySelector(
      '[class*="container"]'
    ) as HTMLElement
    expect(containerEl.style.maxWidth).toBe('1440px')
  })

  it('applies string maxWidth verbatim', () => {
    const { container } = render(
      <Header maxWidth="90rem" logo={<span>LOGO</span>} />
    )
    const containerEl = container.querySelector(
      '[class*="container"]'
    ) as HTMLElement
    expect(containerEl.style.maxWidth).toBe('90rem')
  })

  it('applies maxWidth="none" to produce a full-bleed container', () => {
    // A consumer app's workaround in v0.21.1 overrode max-width to `none`
    // from consumer CSS. This replaces that workaround with a first-
    // class prop path.
    const { container } = render(
      <Header maxWidth="none" actions={<span>ACTIONS</span>} />
    )
    const containerEl = container.querySelector(
      '[class*="container"]'
    ) as HTMLElement
    expect(containerEl.style.maxWidth).toBe('none')
    // Centering margins must also be reset so the full-bleed
    // actually spans edge-to-edge.
    expect(containerEl.style.marginLeft).toBe('0px')
    expect(containerEl.style.marginRight).toBe('0px')
  })

  it('applies sticky class when sticky prop is set', () => {
    const { container } = render(<Header sticky logo={<span>L</span>} />)
    const headerEl = container.querySelector('header')
    expect(headerEl?.className).toMatch(/sticky/)
  })

  /* ------------------------------------------------------------------ *
   *  Sprint 10 (#59) — Brand-by-default smoke tests
   *
   *  Header now gets a subtle ocean-foam → surface gradient by default.
   *  variant="flat" is the opt-out for consumers that prefer the pre-
   *  Sprint-10 flat look.
   * ------------------------------------------------------------------ */

  describe('brand defaults (#59)', () => {
    it('does not add a flat class in the default variant', () => {
      const { container } = render(<Header logo={<span>L</span>} />)
      const headerEl = container.querySelector('header') as HTMLElement
      // The default variant (no `variant` prop) must NOT be marked flat —
      // that's the whole point of the ocean-foam gradient landing on
      // every Header by default.
      expect(headerEl.className).not.toMatch(/flat/)
    })

    it('applies the flat class when variant="flat"', () => {
      const { container } = render(
        <Header variant="flat" logo={<span>L</span>} />
      )
      const headerEl = container.querySelector('header') as HTMLElement
      expect(headerEl.className).toMatch(/flat/)
    })
  })

  /* ------------------------------------------------------------------ *
   *  Issue #13 — Skip link support (WCAG 2.4.1 Bypass Blocks)
   * ------------------------------------------------------------------ */

  describe('skip link (#13)', () => {
    it('does not render a skip link when skipLinkHref is omitted', () => {
      render(<Header logo={<span>LOGO</span>} />)
      expect(
        screen.queryByRole('link', { name: /skip to content/i })
      ).not.toBeInTheDocument()
    })

    it('renders a skip link pointing at the provided href', () => {
      render(<Header skipLinkHref="#main" logo={<span>LOGO</span>} />)
      const skip = screen.getByRole('link', { name: /skip to content/i })
      expect(skip).toBeInTheDocument()
      expect(skip).toHaveAttribute('href', '#main')
    })

    it('supports a custom skipLinkLabel', () => {
      render(
        <Header
          skipLinkHref="#app"
          skipLinkLabel="Jump to app"
          logo={<span>LOGO</span>}
        />
      )
      const skip = screen.getByRole('link', { name: 'Jump to app' })
      expect(skip).toBeInTheDocument()
      expect(skip).toHaveAttribute('href', '#app')
    })

    it('renders the skip link as the first focusable element in the header', () => {
      const { container } = render(
        <Header
          skipLinkHref="#main"
          logo={<a href="/home">LOGO LINK</a>}
          navigation={<a href="/about">ABOUT</a>}
        />
      )
      const headerEl = container.querySelector('header') as HTMLElement
      const focusables = headerEl.querySelectorAll('a, button')
      // First focusable is the skip link (WCAG 2.4.1)
      expect((focusables[0] as HTMLAnchorElement).getAttribute('href')).toBe('#main')
    })
  })

  /* ------------------------------------------------------------------ *
   *  Issue #36 — Mobile actions-only lockout
   *
   *  Regression coverage for Headers that do NOT provide a `navigation`
   *  slot. Prior to the fix, the hamburger button was conditionally
   *  rendered only when `navigation` was provided, but the CSS rule that
   *  hid `.actions` at <= 768px was applied unconditionally. Result:
   *  consumers with just `actions` (no nav) saw an empty bar on mobile
   *  viewports.
   *
   *  The fix renders a `hasNavigation` class on the inner container and
   *  scopes the mobile-hide rule to `.container.hasNavigation .actions`.
   *
   *  Assertions below are deterministic in jsdom:
   *    - React hamburger rendering is gated on the `navigation` prop.
   *    - Structural `hasNavigation` class on `.container` proves the CSS
   *      gate is wired (media queries don't evaluate through jsdom's
   *      getComputedStyle, so we assert the selector shape instead).
   *    - Actions are present in the DOM at every slot combination.
   *
   *  We query the hamburger via `querySelector('button[aria-label=...]')`
   *  rather than `getByRole` because jsdom doesn't evaluate @media queries
   *  — the hamburger's base CSS is `display: none` (it's only flipped to
   *  `flex` via @media (max-width: 768px)), so in jsdom it is always
   *  `display: none` and thus excluded from the a11y tree. The raw
   *  attribute selector bypasses that and asserts the intended markup.
   * ------------------------------------------------------------------ */

  describe('mobile hamburger gating (#36)', () => {
    it('does not render the hamburger when navigation is omitted (actions-only)', () => {
      const { container } = render(<Header actions={<span>ACTIONS</span>} />)
      expect(
        container.querySelector('button[aria-label="Toggle menu"]')
      ).not.toBeInTheDocument()
      // Actions remain in the DOM so they can be shown at all viewports.
      expect(screen.getByText('ACTIONS')).toBeInTheDocument()
    })

    it('does not render the hamburger when only logo + actions are provided', () => {
      const { container } = render(
        <Header logo={<span>LOGO</span>} actions={<span>ACTIONS</span>} />
      )
      expect(
        container.querySelector('button[aria-label="Toggle menu"]')
      ).not.toBeInTheDocument()
      expect(screen.getByText('LOGO')).toBeInTheDocument()
      expect(screen.getByText('ACTIONS')).toBeInTheDocument()
    })

    it('renders the hamburger when navigation is provided', () => {
      const { container } = render(
        <Header
          logo={<span>LOGO</span>}
          navigation={<span>NAV</span>}
          actions={<span>ACTIONS</span>}
        />
      )
      // Query by aria-label since the button is CSS-hidden by default
      // (jsdom can't evaluate the @media (max-width: 768px) rule that
      // flips it to display: flex).
      expect(
        container.querySelector('button[aria-label="Toggle menu"]')
      ).toBeInTheDocument()
    })

    it('renders the hamburger with navigation only (no actions)', () => {
      const { container } = render(<Header navigation={<span>NAV</span>} />)
      expect(
        container.querySelector('button[aria-label="Toggle menu"]')
      ).toBeInTheDocument()
    })

    it('adds hasNavigation modifier class to .container only when nav is provided', () => {
      // Without navigation — actions-only Header, the case that triggered
      // the lockout at 500px viewport.
      const { container: withoutNav } = render(
        <Header actions={<span>ACTIONS</span>} />
      )
      const containerWithoutNav = withoutNav.querySelector(
        '[class*="container"]'
      ) as HTMLElement
      expect(containerWithoutNav).toBeInTheDocument()
      expect(containerWithoutNav.className).not.toMatch(/hasNavigation/)

      // With navigation — prior behavior preserved.
      const { container: withNav } = render(
        <Header navigation={<span>NAV</span>} actions={<span>ACTIONS</span>} />
      )
      const containerWithNav = withNav.querySelector(
        '[class*="container"]'
      ) as HTMLElement
      expect(containerWithNav.className).toMatch(/hasNavigation/)
    })

    it('keeps actions in the DOM at mobile viewport when navigation is absent', () => {
      // Explicitly simulate a 500px viewport. jsdom doesn't evaluate
      // @media queries in getComputedStyle, but this locks in the
      // expected viewport for the scenario and guards against a future
      // regression where rendering itself became viewport-dependent.
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      })
      window.dispatchEvent(new Event('resize'))

      const { container } = render(
        <Header actions={<span data-testid="only-actions">PROFILE</span>} />
      )

      // The actions element is present in the rendered tree.
      expect(screen.getByTestId('only-actions')).toBeInTheDocument()

      // Structural proof that the CSS mobile-hide selector
      // (.container.hasNavigation .actions) does NOT match: the
      // container lacks the `hasNavigation` modifier class.
      const containerEl = container.querySelector(
        '[class*="container"]'
      ) as HTMLElement
      expect(containerEl.className).not.toMatch(/hasNavigation/)

      // And no hamburger was rendered to replace them.
      expect(
        container.querySelector('button[aria-label="Toggle menu"]')
      ).not.toBeInTheDocument()
    })
  })

  describe('skip link href safety (#320)', () => {
    it('neutralizes a javascript: skip-link href to the fallback', () => {
      render(<Header skipLinkHref="javascript:alert(1)" skipLinkLabel="Skip" />)
      expect(screen.getByText('Skip').getAttribute('href')).toBe('#')
    })

    it('preserves a normal fragment skip link', () => {
      render(<Header skipLinkHref="#main-content" skipLinkLabel="Skip to content" />)
      expect(screen.getByText('Skip to content').getAttribute('href')).toBe('#main-content')
    })
  })

  /* ------------------------------------------------------------------ *
   *  #422 — className / style / ...rest pass-through to the <header> root
   * ------------------------------------------------------------------ */
  describe('root pass-through (#422)', () => {
    it('forwards a consumer data-testid onto the <header> root', () => {
      const { container } = render(
        <Header logo={<span>L</span>} data-testid="header-root" />
      )
      const header = container.querySelector('header') as HTMLElement
      expect(header.getAttribute('data-testid')).toBe('header-root')
    })

    it('lets a consumer style win on the <header> root', () => {
      const { container } = render(
        <Header logo={<span>L</span>} style={{ color: 'rgb(1, 2, 3)' }} />
      )
      const header = container.querySelector('header') as HTMLElement
      expect(header.style.color).toBe('rgb(1, 2, 3)')
    })

    it('merges a consumer className onto the <header> root', () => {
      const { container } = render(
        <Header logo={<span>L</span>} className="consumer-header" />
      )
      const header = container.querySelector('header') as HTMLElement
      expect(header.className).toContain('consumer-header')
      expect(header.className.split(' ').length).toBeGreaterThan(1)
    })

    it('does not leak pass-through props onto the inner content container', () => {
      const { container } = render(
        <Header logo={<span>L</span>} data-testid="only-on-header" />
      )
      const innerContainer = container.querySelector(
        '[class*="container"]'
      ) as HTMLElement
      expect(innerContainer.getAttribute('data-testid')).toBeNull()
    })
  })
})
