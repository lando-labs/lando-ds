import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Sidebar } from './Sidebar'
import { SidebarNavItem } from './SidebarNavItem'

/* --- stylesheet-contract helpers (#389) --------------------------------- *
 * jsdom's getComputedStyle can't resolve a descendant-combinator cascade
 * (`[data-theme='dark'] .item.active`) or evaluate colors, so the mode-aware
 * active-background contract — the literal title of #389 — is locked in the
 * stylesheet SOURCE. Actual rendered colors are browser/lab-verified.
 * --------------------------------------------------------------------- */
const readModuleCss = (file: string): string =>
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), file), 'utf-8')
    // strip comments so prose that mentions "background-color" can't taint matches
    .replace(/\/\*[\s\S]*?\*\//g, '')

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

describe('SidebarNavItem', () => {
  it('renders as anchor with href', () => {
    render(<SidebarNavItem href="/x">Label</SidebarNavItem>)
    expect(screen.getByRole('link', { name: 'Label' })).toHaveAttribute('href', '/x')
  })

  it('applies aria-current when active', () => {
    render(<SidebarNavItem href="/x" active>Label</SidebarNavItem>)
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page')
  })

  it('renders icon and badge', () => {
    render(
      <SidebarNavItem
        href="/x"
        icon={<span data-testid="icon" />}
        badge={<span data-testid="badge" />}
      >
        Label
      </SidebarNavItem>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toBeInTheDocument()
  })

  it('renders button when no href provided', () => {
    render(<SidebarNavItem>Label</SidebarNavItem>)
    expect(screen.getByRole('button', { name: 'Label' })).toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  #320 — href sanitization + rest-prop hardening
   * ------------------------------------------------------------------ */
  describe('security (#320)', () => {
    it('neutralizes a javascript: href to the fallback', () => {
      render(<SidebarNavItem href="javascript:alert(1)">Evil</SidebarNavItem>)
      const link = screen.getByRole('link', { name: 'Evil' })
      expect(link.getAttribute('href')).toBe('#')
      expect(link.getAttribute('href')).not.toContain('javascript:')
    })

    it('passes through a safe href unchanged', () => {
      render(<SidebarNavItem href="/dashboard">Dashboard</SidebarNavItem>)
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/dashboard',
      )
    })

    it('does not spread dangerouslySetInnerHTML onto the anchor', () => {
      const evil = { __html: '<img src=x onerror="window.__pwn=1">' }
      render(
        // `dangerouslySetInnerHTML` is now structurally typeable (the props
        // extend HTMLAttributes for the pass-through stack, #422), but it is
        // still stripped at runtime by sanitizeRestProps (#320) — that
        // defense, not the type, is what this test locks.
        <SidebarNavItem href="/x" dangerouslySetInnerHTML={evil}>
          Label
        </SidebarNavItem>,
      )
      // The injected HTML must NOT have been rendered.
      expect(document.querySelector('img')).toBeNull()
      // The real label content survives.
      expect(screen.getByRole('link', { name: 'Label' })).toBeInTheDocument()
      expect(
        (window as unknown as { __pwn?: number }).__pwn,
      ).toBeUndefined()
    })

    it('drops a string-valued on* handler from the spread', () => {
      render(
        // @ts-expect-error — string handler is an injection signal, not a valid prop.
        <SidebarNavItem href="/x" onMouseOver="window.__pwnOver=1">
          Label
        </SidebarNavItem>,
      )
      const link = screen.getByRole('link', { name: 'Label' })
      expect(link.getAttribute('onmouseover')).toBeNull()
    })
  })

  /* ------------------------------------------------------------------ *
   *  #391 — Collapsed state inherited from Sidebar via context
   *
   *  Pre-fix, the consumer had to thread `collapsed` down to every
   *  SidebarNavItem manually — and could not even do so when Sidebar
   *  owned the collapsed state internally (collapsible + persistKey).
   *  Now <Sidebar> publishes its collapsed flag via context and the item
   *  reads it as a default, with an explicit prop still winning.
   * ------------------------------------------------------------------ */
  describe('collapsed inheritance from Sidebar (#391)', () => {
    it('inherits collapsed=true from a parent <Sidebar collapsed>', () => {
      const { container } = render(
        <Sidebar collapsed onCollapsedChange={() => {}} collapsible={false}>
          <SidebarNavItem
            href="/x"
            icon={<span data-testid="icon" />}
          >
            Hidden Label
          </SidebarNavItem>
        </Sidebar>,
      )

      // The item wrapper must carry the collapsed class (rail mode).
      const item = container.querySelector('[class*="item"]') as HTMLElement
      expect(item).toBeInTheDocument()
      expect(item.className).toMatch(/collapsed/)

      // Anchor still rendered with its safeHref'd href (label inside the
      // anchor is dropped in collapsed mode, so it has no accessible name —
      // query by tag, not by role).
      const anchor = item.querySelector('a') as HTMLAnchorElement
      expect(anchor).toBeInTheDocument()
      expect(anchor.getAttribute('href')).toBe('/x')

      // Label text is NOT rendered into the anchor in collapsed mode (the
      // anchor branch passes `!collapsed && children`). The icon survives.
      expect(screen.getByTestId('icon')).toBeInTheDocument()
      expect(anchor.textContent ?? '').not.toContain('Hidden Label')
    })

    it('inherits collapsed=false (expanded) from a parent <Sidebar>', () => {
      const { container } = render(
        <Sidebar collapsed={false} onCollapsedChange={() => {}} collapsible={false}>
          <SidebarNavItem href="/x">Visible Label</SidebarNavItem>
        </Sidebar>,
      )
      const item = container.querySelector('[class*="item"]') as HTMLElement
      expect(item.className).not.toMatch(/collapsed/)
      // Label IS rendered when expanded.
      expect(screen.getByRole('link', { name: 'Visible Label' })).toBeInTheDocument()
    })

    it('defaults to collapsed=false when rendered outside a Sidebar', () => {
      const { container } = render(
        <SidebarNavItem href="/x">Standalone</SidebarNavItem>,
      )
      const item = container.querySelector('[class*="item"]') as HTMLElement
      expect(item.className).not.toMatch(/collapsed/)
      expect(screen.getByRole('link', { name: 'Standalone' })).toBeInTheDocument()
    })

    it('explicit collapsed prop overrides the Sidebar context', () => {
      // Sidebar says expanded; item explicitly forces rail mode.
      const { container } = render(
        <Sidebar collapsed={false} onCollapsedChange={() => {}} collapsible={false}>
          <SidebarNavItem href="/x" collapsed icon={<span data-testid="ico" />}>
            Forced Rail
          </SidebarNavItem>
        </Sidebar>,
      )
      const item = container.querySelector('[class*="item"]') as HTMLElement
      expect(item.className).toMatch(/collapsed/)
    })
  })

  /* ------------------------------------------------------------------ *
   *  #389 — Active-state DOM has ONE active-highlighted layer
   *
   *  Pre-fix, BOTH the wrapper (`.item.active`) and the inner anchor
   *  (`[aria-current="page"]`, styled by Sidebar.module.css) painted a
   *  background, stacking into a visible box-in-box. Post-fix, only the
   *  wrapper paints the active background; the descendant rule keeps only
   *  color + weight.
   *
   *  We assert on the DOM shape: ONE element on the active path carries
   *  an active-background class (the wrapper). The anchor child carries
   *  aria-current="page" but no background-paint class.
   * ------------------------------------------------------------------ */
  describe('active state has a single highlight layer (#389)', () => {
    it('only the outer item wrapper carries the active class', () => {
      const { container } = render(
        <Sidebar collapsed={false} onCollapsedChange={() => {}} collapsible={false}>
          <SidebarNavItem href="/changelog" active>
            Changelog
          </SidebarNavItem>
        </Sidebar>,
      )

      const wrapper = container.querySelector('[class*="item"]') as HTMLElement
      expect(wrapper).toBeInTheDocument()
      // The wrapper IS the canonical active owner.
      expect(wrapper.className).toMatch(/active/)

      // The inner anchor carries aria-current for AT, but NO duplicate
      // active wrapper class on the anchor (that would re-introduce the
      // box-in-box). Note: the anchor still gets `.labelActive` for text
      // weight; the smell signal would be a SECOND `.item.active` class
      // chain on the path.
      const anchors = wrapper.querySelectorAll('a')
      expect(anchors.length).toBe(1)
      const anchor = anchors[0]
      if (!anchor) throw new Error('expected exactly one rendered anchor')
      expect(anchor.getAttribute('aria-current')).toBe('page')
      expect(anchor.className).not.toMatch(/_item/)
    })
  })

  /* ------------------------------------------------------------------ *
   *  #389 — the single active background is MODE-AWARE
   *
   *  The other half of #389: pre-fix, `.item.active` used a single
   *  non-mode-aware token (`--color-primary-lightest`, ~near-white in BOTH
   *  modes) — on a dark sidebar that read as a broken pale wash. The fix
   *  keeps ONE owner (the wrapper) but gives dark mode its own rung via a
   *  `[data-theme='dark'] .item.active` override. jsdom can't resolve that
   *  descendant cascade, so we lock the contract in the stylesheet source.
   * ------------------------------------------------------------------ */
  describe('active background is mode-aware (#389)', () => {
    const css = readModuleCss('SidebarNavItem.module.css')

    it('.item.active is the single active-background owner (exactly one base rule, and it paints)', () => {
      const bodies = cssRuleBodies(css, '.item.active')
      // Exactly one BASE rule (`:hover` / `.item.active .label` don't match).
      expect(bodies.length, 'expected exactly one base `.item.active` rule').toBe(1)
      expect(bodies[0]).toMatch(/background-color\s*:/)
    })

    it('dark mode overrides the active background to a DIFFERENT token (not near-white)', () => {
      const bg = (body: string | undefined): string | undefined =>
        (body?.match(/background-color\s*:\s*([^;]+);/) ?? [])[1]?.trim()

      const lightBg = bg(cssRuleBodies(css, '.item.active')[0])
      const darkBg = bg(cssRuleBodies(css, "[data-theme='dark'] .item.active")[0])

      expect(lightBg, 'light `.item.active` has no background-color').toBeTruthy()
      expect(
        darkBg,
        'no `[data-theme="dark"] .item.active` background override — active state is NOT mode-aware (the #389 bug)',
      ).toBeTruthy()
      // The regression: one value shared across modes. The fix: distinct rungs.
      expect(darkBg).not.toBe(lightBg)
    })
  })

  /* ------------------------------------------------------------------ *
   *  #422 — typed pass-through stack
   *
   *  SidebarNavItem already routed `...rest` (sanitized) onto the rendered
   *  label element and `className` onto the wrapper; #422 made the props
   *  TYPED (extends HTMLAttributes) without changing that routing. These
   *  tests lock the routing so a future refactor can't silently drop it.
   *
   *    - className           → the OUTER wrapper <div> (item row box)
   *    - style / data-* / …  → the INNER rendered label (<a>/<button>/Slot
   *                            child), the interactive node
   * ------------------------------------------------------------------ */
  describe('pass-through stack (#422)', () => {
    it('routes a consumer data-testid onto the rendered anchor (label)', () => {
      render(
        <SidebarNavItem href="/x" data-testid="nav-label">
          Label
        </SidebarNavItem>
      )
      const link = screen.getByRole('link', { name: 'Label' })
      expect(link.getAttribute('data-testid')).toBe('nav-label')
    })

    it('lets a consumer style win on the rendered anchor (label)', () => {
      render(
        <SidebarNavItem href="/x" style={{ color: 'rgb(1, 2, 3)' }}>
          Label
        </SidebarNavItem>
      )
      const link = screen.getByRole('link', { name: 'Label' })
      expect(link.style.color).toBe('rgb(1, 2, 3)')
    })

    it('routes a consumer style onto a <button> when no href is provided', () => {
      render(
        <SidebarNavItem style={{ color: 'rgb(1, 2, 3)' }}>Label</SidebarNavItem>
      )
      const button = screen.getByRole('button', { name: 'Label' })
      expect(button.style.color).toBe('rgb(1, 2, 3)')
    })

    it('merges a consumer className onto the OUTER wrapper (not the anchor)', () => {
      const { container } = render(
        <SidebarNavItem href="/x" className="consumer-row">
          Label
        </SidebarNavItem>
      )
      const wrapper = container.querySelector('[class*="item"]') as HTMLElement
      expect(wrapper.className).toContain('consumer-row')
      // The anchor (label) does NOT receive the wrapper className.
      const link = screen.getByRole('link', { name: 'Label' })
      expect(link.className).not.toContain('consumer-row')
    })

    it('asChild: data-testid + style flow THROUGH Slot onto the consumer child', () => {
      render(
        <SidebarNavItem asChild data-testid="slotted" style={{ color: 'rgb(1, 2, 3)' }}>
          <a href="/x">Slotted</a>
        </SidebarNavItem>
      )
      const link = screen.getByRole('link', { name: 'Slotted' })
      // Slot merged the consumer pass-through onto the rendered <a>.
      expect(link.getAttribute('data-testid')).toBe('slotted')
      expect(link.style.color).toBe('rgb(1, 2, 3)')
      // The child kept its own href.
      expect(link).toHaveAttribute('href', '/x')
    })
  })
})
