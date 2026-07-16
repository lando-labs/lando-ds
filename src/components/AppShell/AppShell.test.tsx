/**
 * AppShell Component Tests
 *
 * Focus on layout composition, sidebar wiring (controlled + uncontrolled),
 * keyboard shortcut, and landmark roles (#26 / v0.3.0-layout-foundation).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppShell } from './AppShell'
import { Sidebar } from '../Sidebar'

describe('AppShell', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders header / main / footer landmarks', () => {
    render(
      <AppShell
        header={<div>header text</div>}
        footer={<div>footer text</div>}
        mainAriaLabel="Test main"
      >
        <p>page body</p>
      </AppShell>
    )

    expect(screen.getByRole('banner')).toHaveTextContent('header text')
    expect(screen.getByRole('main', { name: 'Test main' })).toHaveTextContent(
      'page body'
    )
    expect(screen.getByRole('contentinfo')).toHaveTextContent('footer text')
  })

  it('renders without sidebar when sidebar prop is omitted', () => {
    render(
      <AppShell header={<div>h</div>}>
        <p>body</p>
      </AppShell>
    )
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('wraps plain sidebar content in a default Sidebar', () => {
    render(
      <AppShell sidebar={<a href="/home">Home link</a>}>
        <p>body</p>
      </AppShell>
    )
    // There should be a navigation landmark around the wrapped content
    const nav = screen.getByRole('navigation')
    expect(nav).toContainElement(screen.getByText('Home link'))
  })

  it('clones a provided <Sidebar> and wires collapse state', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <AppShell
        sidebar={
          <Sidebar aria-label="Primary">
            <span>content</span>
          </Sidebar>
        }
        sidebarCollapsed={false}
        onSidebarCollapsedChange={onChange}
      >
        <p>body</p>
      </AppShell>
    )

    // Toggle button should read "Collapse sidebar" when expanded.
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)

    rerender(
      <AppShell
        sidebar={
          <Sidebar aria-label="Primary">
            <span>content</span>
          </Sidebar>
        }
        sidebarCollapsed={true}
        onSidebarCollapsedChange={onChange}
      >
        <p>body</p>
      </AppShell>
    )

    expect(
      screen.getByRole('button', { name: 'Expand sidebar' })
    ).toBeInTheDocument()
  })

  it('toggles sidebar via Cmd+B keyboard shortcut', () => {
    const onChange = vi.fn()
    render(
      <AppShell
        sidebar={<span>nav</span>}
        defaultSidebarCollapsed={false}
        onSidebarCollapsedChange={onChange}
      >
        <p>body</p>
      </AppShell>
    )

    fireEvent.keyDown(window, { key: 'b', metaKey: true })
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('ignores keyboard shortcut while focus is inside an input', () => {
    const onChange = vi.fn()
    render(
      <AppShell
        sidebar={<span>nav</span>}
        defaultSidebarCollapsed={false}
        onSidebarCollapsedChange={onChange}
      >
        <input aria-label="test-input" />
      </AppShell>
    )

    const input = screen.getByLabelText('test-input')
    input.focus()
    // Fire the event from the input element so e.target is the input.
    fireEvent.keyDown(input, { key: 'b', metaKey: true })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables the keyboard shortcut when sidebarShortcut={false}', () => {
    const onChange = vi.fn()
    render(
      <AppShell
        sidebar={<span>nav</span>}
        sidebarShortcut={false}
        defaultSidebarCollapsed={false}
        onSidebarCollapsedChange={onChange}
      >
        <p>body</p>
      </AppShell>
    )

    fireEvent.keyDown(window, { key: 'b', metaKey: true })
    expect(onChange).not.toHaveBeenCalled()
  })

  // ── content layout opinions (Sprint 10, issue #60) ─────────────────────

  it('maps contentPadding semantic tokens to spacing CSS vars', () => {
    const { container } = render(
      <AppShell contentPadding="lg">
        <p>body</p>
      </AppShell>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.getPropertyValue('--app-shell-content-padding')).toBe(
      'var(--spacing-lg)'
    )
  })

  it('maps contentPadding="none" to 0', () => {
    const { container } = render(
      <AppShell contentPadding="none">
        <p>body</p>
      </AppShell>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.getPropertyValue('--app-shell-content-padding')).toBe('0')
  })

  it('maps contentMaxWidth semantic tokens to px', () => {
    const { container } = render(
      <AppShell contentMaxWidth="lg">
        <p>body</p>
      </AppShell>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.getPropertyValue('--app-shell-content-max-width')).toBe(
      '1024px'
    )
  })

  it('passes through custom CSS length strings unchanged for contentMaxWidth', () => {
    const { container } = render(
      <AppShell contentMaxWidth="800px">
        <p>body</p>
      </AppShell>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.getPropertyValue('--app-shell-content-max-width')).toBe(
      '800px'
    )
  })

  it('does not emit inline CSS vars when content props are omitted', () => {
    const { container } = render(
      <AppShell>
        <p>body</p>
      </AppShell>
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.getPropertyValue('--app-shell-content-padding')).toBe('')
    expect(el.style.getPropertyValue('--app-shell-content-max-width')).toBe('')
  })
})

/* ------------------------------------------------------------------ *
 *  #422 — className / style / ...rest pass-through to the shell root
 *
 *  The outer shell `<div>` (container.firstChild) is the visual root.
 *  Consumer overrides must land there, alongside the component's own
 *  shell classes and `--app-shell-*` vars.
 * ------------------------------------------------------------------ */
describe('AppShell — root pass-through (#422)', () => {
  it('forwards a consumer data-testid onto the shell root', () => {
    render(
      <AppShell header={<div>h</div>} data-testid="shell-root">
        <p>body</p>
      </AppShell>
    )
    const el = screen.getByTestId('shell-root')
    // The shell root carries the main landmark as a descendant.
    expect(el.querySelector('main')).not.toBeNull()
  })

  it('lets a consumer style win on the shell root and still emits the content var', () => {
    const { container } = render(
      <AppShell
        header={<div>h</div>}
        contentPadding="lg"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <p>body</p>
      </AppShell>
    )
    const el = container.firstChild as HTMLElement
    // Consumer style key passes through.
    expect(el.style.color).toBe('rgb(1, 2, 3)')
    // The component's own content-padding var is still layered on top.
    expect(el.style.getPropertyValue('--app-shell-content-padding')).not.toBe('')
  })

  it('merges a consumer className onto the shell root', () => {
    const { container } = render(
      <AppShell header={<div>h</div>} className="consumer-shell">
        <p>body</p>
      </AppShell>
    )
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('consumer-shell')
    expect(el.className.split(' ').length).toBeGreaterThan(1)
  })

  it('does not leak pass-through props onto the inner <main>', () => {
    const { container } = render(
      <AppShell header={<div>h</div>} data-testid="only-on-root">
        <p>body</p>
      </AppShell>
    )
    const main = container.querySelector('main') as HTMLElement
    expect(main.getAttribute('data-testid')).toBeNull()
  })
})
