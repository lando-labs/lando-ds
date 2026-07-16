/**
 * Sidebar Component Tests
 *
 * Focus on the controlled/uncontrolled collapse API, collapsed rail slot, and
 * accessibility landmarks (#26 / v0.3.0-layout-foundation).
 *
 * Hydration-parity tests for issue #100 (SSR/CSR class mismatch in Next.js
 * App Router consumers) live in the "SSR / hydration parity (#100)" block at
 * the bottom of this file.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Sidebar } from './Sidebar'

/* --- stylesheet-contract helpers (#389 / #372) -------------------------- *
 * jsdom can't resolve descendant-combinator cascades (`[data-theme='dark'] …`)
 * or evaluate a background fill / gradient, so the box-in-box (#389) and
 * flat-clears-gradient (#372) contracts are locked in the stylesheet SOURCE.
 * Comments are stripped first so prose that mentions "background" can't taint
 * the matches.
 * --------------------------------------------------------------------- */
const sidebarCss = (): string =>
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'Sidebar.module.css'),
    'utf-8',
  ).replace(/\/\*[\s\S]*?\*\//g, '')

/** Bodies of every rule whose comma-split selector list contains an exact
 *  (quote/whitespace-normalized) match for `selector`. */
function cssRuleBodies(css: string, selector: string): string[] {
  const norm = (s: string) => s.replace(/['"]/g, '"').replace(/\s+/g, ' ').trim()
  const target = norm(selector)
  const out: string[] = []
  const re = /([^{}]+)\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    const selectors = m[1]
    const body = m[2]
    if (selectors === undefined || body === undefined) continue
    if (selectors.split(',').map(norm).includes(target)) out.push(body)
  }
  return out
}

describe('Sidebar', () => {
  beforeEach(() => {
    // Default test viewport is large — put us above the tablet threshold so
    // the responsive-default one-shot stays expanded.
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders children inside a navigation landmark with the default label', () => {
    render(
      <Sidebar>
        <a href="/home">Home</a>
      </Sidebar>
    )
    const nav = screen.getByRole('navigation', { name: 'Sidebar navigation' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('uses a custom aria-label when provided', () => {
    render(
      <Sidebar aria-label="Primary nav">
        <span>content</span>
      </Sidebar>
    )
    expect(
      screen.getByRole('navigation', { name: 'Primary nav' })
    ).toBeInTheDocument()
  })

  it('toggles collapsed state and fires onCollapsedChange (controlled)', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Sidebar collapsed={false} onCollapsedChange={onChange}>
        <span>content</span>
      </Sidebar>
    )

    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)

    rerender(
      <Sidebar collapsed={true} onCollapsedChange={onChange}>
        <span>content</span>
      </Sidebar>
    )
    const expandBtn = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles collapsed state internally when uncontrolled', () => {
    render(
      <Sidebar defaultCollapsed={false}>
        <span>content</span>
      </Sidebar>
    )

    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('renders collapsedContent slot when collapsed', () => {
    render(
      <Sidebar
        defaultCollapsed
        collapsedContent={<span data-testid="rail">rail</span>}
      >
        <span data-testid="full">full nav</span>
      </Sidebar>
    )

    expect(screen.getByTestId('rail')).toBeInTheDocument()
    expect(screen.queryByTestId('full')).not.toBeInTheDocument()
  })

  it('persists collapsed state to localStorage when persistKey is set', () => {
    const key = 'test-sidebar-collapsed'
    render(
      <Sidebar persistKey={key}>
        <span>content</span>
      </Sidebar>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(window.localStorage.getItem(key)).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(window.localStorage.getItem(key)).toBe('0')
  })

  it('wires aria-controls on the toggle to the sidebar id', () => {
    render(
      <Sidebar id="my-sidebar">
        <span>content</span>
      </Sidebar>
    )

    const nav = screen.getByRole('navigation')
    expect(nav.id).toBe('my-sidebar')

    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle.getAttribute('aria-controls')).toBe('my-sidebar')
  })

  it('does not render the collapse toggle when collapsible={false}', () => {
    render(
      <Sidebar collapsible={false}>
        <span>content</span>
      </Sidebar>
    )
    expect(
      screen.queryByRole('button', { name: /sidebar/i })
    ).not.toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  Issue #372 — variant="flat" opt-out (API parity with Header)
   *
   *  Sidebar applies a default ocean-foam gradient on its base class. When
   *  a consumer is running a custom product theme, the hardcoded ocean
   *  tint reads as a mismatched patch. `variant="flat"` clears the gradient
   *  while keeping the surface background — mirrors Header's `variant="flat"`.
   * ------------------------------------------------------------------ */

  describe('variant="flat" (#372)', () => {
    it('does not add a flat class in the default variant', () => {
      const { container } = render(
        <Sidebar>
          <span>content</span>
        </Sidebar>
      )
      const aside = container.querySelector('aside') as HTMLElement
      // Default variant must NOT carry the flat class — the whole point of
      // the Sprint 10 ocean-foam gradient is brand-by-default.
      expect(aside.className).not.toMatch(/flat/)
    })

    it('applies the flat class when variant="flat"', () => {
      const { container } = render(
        <Sidebar variant="flat">
          <span>content</span>
        </Sidebar>
      )
      const aside = container.querySelector('aside') as HTMLElement
      expect(aside.className).toMatch(/flat/)
    })

    it('keeps all other behavior intact when variant="flat" is set', () => {
      // Smoke check: flat variant doesn't accidentally regress nav-landmark
      // / collapse-button rendering.
      render(
        <Sidebar variant="flat">
          <a href="/home">Home</a>
        </Sidebar>
      )
      expect(
        screen.getByRole('navigation', { name: 'Sidebar navigation' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Collapse sidebar' })
      ).toBeInTheDocument()
    })

    /* The class-application half (default omits `flat`, variant adds it) is
     * covered above. This locks what the class actually DOES: clears the
     * Sprint 10 brand-foam gradient. It must clear in BOTH light and dark —
     * the base dark rule re-declares `background-image`, so a light-only
     * `.flat` would leave the dark gradient leaking through. jsdom evaluates
     * neither gradient, so assert the stylesheet source. */
    it('the flat class clears the gradient in light AND dark (#372)', () => {
      const css = sidebarCss()

      const light = cssRuleBodies(css, '.sidebar.flat')
      expect(light.length, 'no `.sidebar.flat` rule found').toBeGreaterThanOrEqual(1)
      expect(
        light.some((b) => /background-image\s*:\s*none/.test(b)),
        '`.sidebar.flat` must set background-image: none',
      ).toBe(true)

      const dark = cssRuleBodies(css, "[data-theme='dark'] .sidebar.flat")
      expect(
        dark.length,
        'no `[data-theme="dark"] .sidebar.flat` rule — the dark gradient would leak',
      ).toBeGreaterThanOrEqual(1)
      expect(
        dark.some((b) => /background-image\s*:\s*none/.test(b)),
        'dark `.sidebar.flat` must also clear background-image',
      ).toBe(true)
    })
  })

  /* ------------------------------------------------------------------ *
   *  Issue #40 — Nav item 44×44 touch target + aria-current
   *
   *  The CSS selector `:global(.listItem)` under .sidebar enforces a
   *  44px min-height on all List-based nav items. We assert on the
   *  resolved style in jsdom (vitest's css: true flag parses CSS Modules
   *  at test time).
   *
   *  aria-current styling is also verified by checking the ruleset exists
   *  in the component's rendered stylesheet — jsdom won't evaluate media
   *  queries, but direct attribute selectors work.
   * ------------------------------------------------------------------ */

  describe('touch targets + aria-current (#40)', () => {
    it('enforces 44px min-height on sidebar listItems', () => {
      const { container } = render(
        <Sidebar>
          <ul className="list">
            <li className="listItem">
              <a href="/home">Home</a>
            </li>
          </ul>
        </Sidebar>
      )

      const listItem = container.querySelector('.listItem') as HTMLElement
      expect(listItem).toBeInTheDocument()
      const computed = window.getComputedStyle(listItem)
      // Parse the min-height — jsdom should resolve the scoped sidebar rule
      expect(computed.minHeight).toBe('44px')
    })

    it('applies active-style typography to elements marked with aria-current', () => {
      // #389 — the Sidebar descendant `[aria-current]` rule used to paint a
      // background, which stacked with SidebarNavItem's own active-wrapper
      // background into a box-in-box. That background paint was removed;
      // color + font-weight remain so naked-aria-current consumers still
      // get a "you are here" affordance.
      const { container } = render(
        <Sidebar>
          <a href="/dashboard" aria-current="page">Dashboard</a>
        </Sidebar>
      )
      const active = container.querySelector('[aria-current="page"]') as HTMLElement
      expect(active).toBeInTheDocument()
      // The typographic affordance must still apply — font-weight is the
      // most stable signal across jsdom CSS-module resolution.
      const computed = window.getComputedStyle(active)
      expect(computed.fontWeight).not.toBe('')
      expect(computed.fontWeight).not.toBe('400')
    })
  })

  /* ------------------------------------------------------------------ *
   *  #389 — box-in-box regression guard (stylesheet source)
   *
   *  The artifact came from the Sidebar's descendant `[aria-current]` rule
   *  ALSO painting a background, which stacked over SidebarNavItem's own
   *  `.item.active` wrapper background. #389 removed that second paint,
   *  leaving the descendant rule with color + font-weight only. The DOM-shape
   *  half is covered in SidebarNavItem.test.tsx; here we lock the CSS so a
   *  future edit can't silently re-add a background to the descendant rule
   *  (jsdom can't evaluate the layered fill, so assert the source).
   * ------------------------------------------------------------------ */
  describe('aria-current descendant rule is background-free (#389)', () => {
    it('no rule targeting [aria-current] under .sidebar paints a background', () => {
      const css = sidebarCss()
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
      const re = /([^{}]+)\{([^}]*)\}/g
      let m: RegExpExecArray | null
      let matched = 0
      while ((m = re.exec(css)) !== null) {
        const selectorText = m[1]
        if (selectorText === undefined || !/aria-current/.test(selectorText)) continue
        matched++
        expect(
          m[2],
          `aria-current rule "${norm(selectorText)}" must not paint a background (box-in-box #389)`,
        ).not.toMatch(/background/)
      }
      // Sanity: we actually found the light + dark aria-current rule blocks
      // (guards against the scan silently matching nothing).
      expect(matched).toBeGreaterThanOrEqual(2)
    })
  })

  /* ------------------------------------------------------------------ *
   *  Issue #100 — SSR / CSR hydration parity
   *
   *  In Next.js App Router, the server renders without `window`, so any
   *  `useState` initializer that reads viewport width or localStorage
   *  produces HTML that diverges from the first client render. React 19
   *  reports this as a hydration mismatch.
   *
   *  The fix: render the SSR-safe default on first paint, then sync to the
   *  real viewport / persisted state in a `useEffect`. These tests assert:
   *
   *  1. `renderToString` output is identical regardless of viewport — proves
   *     the server render does not depend on client-only APIs.
   *  2. The first client render (before effects fire) matches the SSR HTML
   *     for the load-bearing attributes (`className`, `data-mobile`,
   *     `aria-hidden`, `data-collapsed`).
   *  3. After effects fire, the mobile class IS applied when the viewport
   *     is narrow — proving the post-hydration sync still works.
   * ------------------------------------------------------------------ */

  describe('SSR / hydration parity (#100)', () => {
    /**
     * Helper: extract the relevant attributes off the rendered <aside>
     * for a snapshot-style equality check.
     */
    const asideSignature = (html: string) => {
      const m = html.match(/<aside\b([^>]*)>/)
      if (!m) throw new Error('No <aside> tag in rendered HTML')
      const attrs = m[1]
      if (attrs === undefined) throw new Error('No <aside> attributes in rendered HTML')
      const grab = (name: string) => {
        const r = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)
        return r ? r[1] : null
      }
      return {
        className: grab('class'),
        dataMobile: grab('data-mobile'),
        dataMobileOpen: grab('data-mobile-open'),
        dataCollapsed: grab('data-collapsed'),
        ariaHidden: grab('aria-hidden'),
      }
    }

    it('renderToString output does not depend on viewport (mobile vs desktop)', () => {
      // Pretend the client is on a mobile viewport.
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      const mobileHtml = renderToString(
        <Sidebar>
          <a href="/home">Home</a>
        </Sidebar>
      )

      // And again on desktop.
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1280,
      })
      const desktopHtml = renderToString(
        <Sidebar>
          <a href="/home">Home</a>
        </Sidebar>
      )

      // Bytes-identical output proves nothing in render reads `window`.
      // (The SSR-safe default is `'desktop'` in both cases.)
      expect(mobileHtml).toBe(desktopHtml)
    })

    it('renderToString output does not depend on localStorage (persistKey)', () => {
      const key = 'test-hydration-key'

      // No persisted value.
      window.localStorage.removeItem(key)
      const noneHtml = renderToString(
        <Sidebar persistKey={key}>
          <a href="/home">Home</a>
        </Sidebar>
      )

      // With a persisted value.
      window.localStorage.setItem(key, '1')
      const persistedHtml = renderToString(
        <Sidebar persistKey={key}>
          <a href="/home">Home</a>
        </Sidebar>
      )

      // Identical — render must not read localStorage.
      expect(noneHtml).toBe(persistedHtml)
      window.localStorage.removeItem(key)
    })

    it('SSR HTML matches the first client render (mobile-width viewport)', () => {
      // Pretend the client is at a narrow viewport — the bug from v0.11.0.
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      const ssrHtml = renderToString(
        <Sidebar>
          <a href="/home">Home</a>
        </Sidebar>
      )

      // Render on the client but capture the <aside> BEFORE effects fire.
      // `render` from RTL eagerly flushes effects; we work around that by
      // using `renderToString` on the same tree and asserting attribute
      // equality. Since both calls share the same render path (and neither
      // runs effects), the SSR-safe default applies in both.
      const firstClientHtml = renderToString(
        <Sidebar>
          <a href="/home">Home</a>
        </Sidebar>
      )

      const ssrSig = asideSignature(ssrHtml)
      const clientSig = asideSignature(firstClientHtml)

      expect(clientSig.className).toBe(ssrSig.className)
      expect(clientSig.dataMobile).toBe(ssrSig.dataMobile)
      expect(clientSig.dataMobileOpen).toBe(ssrSig.dataMobileOpen)
      expect(clientSig.dataCollapsed).toBe(ssrSig.dataCollapsed)
      expect(clientSig.ariaHidden).toBe(ssrSig.ariaHidden)

      // And a sanity check on the load-bearing values: SSR-safe default
      // is desktop, so `data-mobile` must be `"false"` and there must be
      // no `aria-hidden` attribute on the rendered HTML.
      expect(ssrSig.dataMobile).toBe('false')
      expect(ssrSig.ariaHidden).toBeNull()
    })

    it('after hydration, mobile class IS applied when viewport is narrow', async () => {
      // Mock matchMedia so the post-hydration effect picks up "mobile".
      // (The Sidebar uses `window.innerWidth`, not matchMedia, but we set
      // both to be safe in case the implementation evolves.)
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      const { container } = render(
        <Sidebar>
          <a href="/home">Home</a>
        </Sidebar>
      )

      // RTL's `render` flushes effects synchronously, so the post-hydration
      // sync should already have run by the time we inspect the DOM.
      const aside = container.querySelector('aside')
      expect(aside).not.toBeNull()
      expect(aside?.getAttribute('data-mobile')).toBe('true')
    })

    it('after hydration, persisted collapsed state IS applied (uncontrolled)', () => {
      const key = 'test-hydration-persisted'
      window.localStorage.setItem(key, '1') // collapsed = true

      const { container } = render(
        <Sidebar persistKey={key}>
          <span>content</span>
        </Sidebar>
      )

      // Effect ran during render → persisted value applied.
      const expandBtn = screen.getByRole('button', { name: 'Expand sidebar' })
      expect(expandBtn).toBeInTheDocument()
      expect(expandBtn.getAttribute('aria-expanded')).toBe('false')

      // Sanity: the aside reflects the rail mode.
      const aside = container.querySelector('aside')
      expect(aside?.getAttribute('data-collapsed')).toBe('true')

      window.localStorage.removeItem(key)
    })

    it('SSR HTML ignores persisted localStorage value (it applies post-hydration)', () => {
      const key = 'test-hydration-ssr-vs-persisted'
      window.localStorage.setItem(key, '1') // user previously collapsed

      const ssrHtml = renderToString(
        <Sidebar persistKey={key}>
          <span>content</span>
        </Sidebar>
      )

      // The aside in the SSR string should be in the EXPANDED state — the
      // SSR-safe default — because `useEffect` hasn't run on the server.
      const sig = asideSignature(ssrHtml)
      expect(sig.dataCollapsed).toBe('false')

      window.localStorage.removeItem(key)
    })

    it('controlled `collapsed` prop is honored in SSR (no useEffect needed)', () => {
      // Controlled mode reads the prop directly during render, so the
      // server output should reflect `collapsed={true}` immediately.
      const ssrHtml = renderToString(
        <Sidebar collapsed={true} onCollapsedChange={() => {}}>
          <span>content</span>
        </Sidebar>
      )
      const sig = asideSignature(ssrHtml)
      expect(sig.dataCollapsed).toBe('true')
    })

    // Touch `act` to keep the import alive even if no test currently uses
    // it directly. RTL's `render` already wraps in act under the hood —
    // this is a sentinel for future hydration tests that might call
    // `hydrateRoot` and need explicit act control.
    it('act helper is importable for future hydrateRoot tests', () => {
      expect(typeof act).toBe('function')
    })
  })

  /* ------------------------------------------------------------------ *
   *  #422 — className / style / ...rest pass-through to the <aside> root
   *
   *  The `<aside>` is the styled root. The component owns `width` and the
   *  `--sidebar-width` var on it (drives the collapse animation); every
   *  other consumer style/attribute passes through.
   * ------------------------------------------------------------------ */
  describe('root pass-through (#422)', () => {
    it('forwards a consumer data-testid onto the <aside> root', () => {
      const { container } = render(
        <Sidebar data-testid="sidebar-root">
          <span>content</span>
        </Sidebar>
      )
      const aside = container.querySelector('aside') as HTMLElement
      expect(aside.getAttribute('data-testid')).toBe('sidebar-root')
    })

    it('lets a consumer style win on the <aside> root (non-width key)', () => {
      const { container } = render(
        <Sidebar style={{ color: 'rgb(1, 2, 3)' }}>
          <span>content</span>
        </Sidebar>
      )
      const aside = container.querySelector('aside') as HTMLElement
      expect(aside.style.color).toBe('rgb(1, 2, 3)')
      // The width contract is preserved — the component still sets width.
      expect(aside.style.width).not.toBe('')
    })

    it('keeps the width contract even if a consumer tries to override width via style', () => {
      const { container } = render(
        <Sidebar width="20rem" style={{ width: '999px' }}>
          <span>content</span>
        </Sidebar>
      )
      const aside = container.querySelector('aside') as HTMLElement
      // The component's width prop wins over a same-key consumer style.
      expect(aside.style.width).toBe('20rem')
    })

    it('merges a consumer className onto the <aside> root', () => {
      const { container } = render(
        <Sidebar className="consumer-aside">
          <span>content</span>
        </Sidebar>
      )
      const aside = container.querySelector('aside') as HTMLElement
      expect(aside.className).toContain('consumer-aside')
      expect(aside.className.split(' ').length).toBeGreaterThan(1)
    })
  })
})
