/**
 * Button Component Tests
 *
 * Sprint 12 (#14) — expanded beyond the previous regression-only suite.
 * Covers: all 6 variants, all 5 sizes, loading (spinner + aria-busy),
 * disabled (suppresses onClick), icon slots, asChild pattern, ripple
 * #17 regression lock, and jest-axe a11y.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Button } from './Button'
import { resolveTokenHex } from '../../test/contrast-helpers'
import { contrastRatio, AA_NORMAL, AA_LARGE } from '../../tokens/contrast'

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('renders every visual variant without errors', () => {
    // Button.tsx line 33: variants are primary | secondary | outline | ghost | danger | link
    const variants = [
      'primary',
      'secondary',
      'outline',
      'ghost',
      'danger',
      'link',
    ] as const
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument()
      unmount()
    }
  })

  it('renders every size without errors', () => {
    // Button.tsx line 35: xs | sm | md | lg | xl
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>{size}</Button>)
      expect(screen.getByRole('button', { name: size })).toBeInTheDocument()
      unmount()
    }
  })

  it('shows loading state (aria-busy + effectively disabled + spinner present)', () => {
    const { container } = render(<Button loading>Loading</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    // Button.tsx line 136: `disabled={disabled || loading}`
    expect(btn).toBeDisabled()
    // Spinner SVG is rendered inside the button
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders leftIcon and rightIcon slots', () => {
    render(
      <Button
        leftIcon={<span data-testid="left">L</span>}
        rightIcon={<span data-testid="right">R</span>}
      >
        Labeled
      </Button>
    )
    expect(screen.getByTestId('left')).toBeInTheDocument()
    expect(screen.getByTestId('right')).toBeInTheDocument()
  })

  it('hides leftIcon/rightIcon when loading (spinner replaces them)', () => {
    render(
      <Button
        loading
        leftIcon={<span data-testid="left">L</span>}
        rightIcon={<span data-testid="right">R</span>}
      >
        Loading
      </Button>
    )
    // Button.tsx lines 151, 157: icons only render when !loading.
    expect(screen.queryByTestId('left')).not.toBeInTheDocument()
    expect(screen.queryByTestId('right')).not.toBeInTheDocument()
  })

  it('asChild delegates rendering to the child element (no nested <button>)', () => {
    render(
      <Button asChild variant="primary">
        <a href="/dashboard" data-testid="link-child">
          Go
        </a>
      </Button>
    )
    const link = screen.getByTestId('link-child')
    // Slot merges button classes onto the anchor — assert rendering is the
    // anchor, not an anchor-wrapped-in-button (which would be invalid HTML).
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/dashboard')
    // No <button> should be rendered when asChild is true.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('asChild + disabled forwards aria-disabled and blocks the child action (#509)', () => {
    render(
      <Button asChild disabled>
        <a href="/next">Go</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Go' })
    // The disabled state must be announced on the slotted child (native
    // `disabled` isn't valid on <a>, so aria-disabled carries it).
    expect(link).toHaveAttribute('aria-disabled', 'true')
    // And the action is blocked: handleClick preventDefaults, so the dispatched
    // click's default is cancelled (fireEvent returns false).
    expect(fireEvent.click(link)).toBe(false)
  })

  it('asChild without disabled leaves aria-disabled unset', () => {
    render(
      <Button asChild>
        <a href="/next">Go</a>
      </Button>
    )
    expect(screen.getByRole('link', { name: 'Go' })).not.toHaveAttribute(
      'aria-disabled'
    )
  })

  // #380 — leftIcon/rightIcon must compose into the asChild child so that
  // routing link-buttons can carry an icon. Previously these props were
  // documented as ignored under asChild, blocking every "Open →" card
  // action in a consumer app.
  it('asChild composes leftIcon into the single child (#380)', () => {
    render(
      <Button
        asChild
        leftIcon={<svg data-testid="L" />}
      >
        <a href="/go" data-testid="anchor">
          Go
        </a>
      </Button>
    )
    const anchor = screen.getByTestId('anchor')
    expect(anchor.tagName).toBe('A')
    // The svg icon is now a descendant of the anchor.
    const icon = screen.getByTestId('L')
    expect(anchor).toContainElement(icon)
    // The child's original text content is preserved.
    expect(anchor).toHaveTextContent('Go')
  })

  it('asChild composes rightIcon into the single child (#380)', () => {
    render(
      <Button
        asChild
        rightIcon={<svg data-testid="R" />}
      >
        <a href="/go">Open</a>
      </Button>
    )
    const anchor = screen.getByRole('link', { name: /Open/ })
    const icon = screen.getByTestId('R')
    expect(anchor).toContainElement(icon)
    // Right icon should be ordered AFTER the content. The label text and
    // the icon are siblings inside the anchor; assert visual ordering by
    // comparing DOM positions.
    const labelSpan = anchor.querySelector('span:not([aria-hidden])')
    expect(labelSpan).not.toBeNull()
    expect(
      labelSpan!.compareDocumentPosition(icon) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('asChild composes BOTH leftIcon and rightIcon when supplied (#380)', () => {
    render(
      <Button
        asChild
        leftIcon={<svg data-testid="L" />}
        rightIcon={<svg data-testid="R" />}
      >
        <a href="/go">Open</a>
      </Button>
    )
    const anchor = screen.getByRole('link', { name: /Open/ })
    expect(anchor).toContainElement(screen.getByTestId('L'))
    expect(anchor).toContainElement(screen.getByTestId('R'))
  })

  it('asChild without icons preserves original child semantics (#380)', () => {
    // Regression: icon composition only fires when an icon is supplied.
    // Without icons, the child should pass through verbatim.
    render(
      <Button asChild>
        <a href="/go" data-testid="anchor">
          Plain
        </a>
      </Button>
    )
    const anchor = screen.getByTestId('anchor')
    expect(anchor).toHaveTextContent('Plain')
    // No icon-slot spans should be injected.
    expect(anchor.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  // Regression: #17 — Ripple handler must not call consumer's onClick twice.
  //
  // Previous concern: `onClick={handleClick}` after `{...props}` spread might
  // cause the spread's `onClick` to fire in addition to `handleClick` calling
  // `props.onClick(e)` internally. JSX spread-then-override semantics mean the
  // later prop wins (single native binding), so this should be single-fire.
  // This test pins that behavior so it can't silently regress.
  it('calls consumer onClick exactly once per click (#17)', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(2)
  })

  // Ripple element must be added to the DOM on click so consumers see the
  // ocean-inspired ripple animation.
  it('creates a ripple element on click (#17)', () => {
    render(<Button>Ripple</Button>)
    const button = screen.getByRole('button')
    const before = button.querySelectorAll('span').length

    fireEvent.click(button, { clientX: 10, clientY: 10 })

    const after = button.querySelectorAll('span').length
    expect(after).toBeGreaterThan(before)
  })

  // Loading state must suppress onClick so consumers don't fire mutations
  // while a request is in flight.
  it('suppresses onClick when loading (#17)', () => {
    const handleClick = vi.fn()
    render(
      <Button loading onClick={handleClick}>
        Submitting
      </Button>
    )

    // When loading, the <button> element is disabled=true (see Button.tsx:
    // `disabled={disabled || loading}`), which means the native DOM will
    // not dispatch click events to our handler at all. We assert the
    // consumer's onClick was not called.
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  // Disabled state must suppress onClick for the same reason.
  it('suppresses onClick when disabled (#17)', () => {
    const handleClick = vi.fn()
    render(
      <Button disabled onClick={handleClick}>
        Off
      </Button>
    )

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <div>
        <Button variant="primary">Primary action</Button>
        <Button variant="secondary">Secondary action</Button>
        <Button loading>Submitting</Button>
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  // #337 — the ripple lifecycle moved from hand-appended DOM nodes +
  // setTimeout into React state, so React owns creation AND teardown (the old
  // version leaked a detached node + pending timer on mid-animation unmount).
  describe('ripple lifecycle (#337)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('removes the ripple element after its 600ms animation completes', () => {
      render(<Button>Ripple</Button>)
      const button = screen.getByRole('button')
      const baseline = button.querySelectorAll('span').length

      fireEvent.click(button, { clientX: 5, clientY: 5 })
      expect(button.querySelectorAll('span').length).toBeGreaterThan(baseline)

      act(() => {
        vi.advanceTimersByTime(600)
      })
      // Ripple is gone; only the original content span(s) remain.
      expect(button.querySelectorAll('span').length).toBe(baseline)
    })

    it('clears the pending ripple timer on unmount (no post-unmount state update)', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { unmount } = render(<Button>Ripple</Button>)
      const button = screen.getByRole('button')

      fireEvent.click(button, { clientX: 5, clientY: 5 })
      // Unmount BEFORE the 600ms removal timer fires.
      unmount()

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // The unmount effect cleared the timer, so no state update runs against
      // the unmounted component.
      const unmountWarning = errorSpy.mock.calls.find((call) =>
        String(call[0]).includes('unmounted')
      )
      expect(unmountWarning).toBeUndefined()
      errorSpy.mockRestore()
    })
  })

  // #9 / #71 — outline variant resting-state contrast. jsdom does not resolve
  // `@layer` order or reliably evaluate `color-mix()`/`oklch()` custom-
  // property cascades, so this asserts against the REAL tokens.css values
  // (parsed by `resolveTokenHex`, the same approach `chrome-contrast.test.ts`
  // (#288) established) rather than rendering + `getComputedStyle`. Mirrors
  // Button.module.css's `.outline` rules exactly: the base rule (now
  // `--color-border-emphasis`, fixed by #71) for light, the
  // `[data-theme='dark'] .outline` override (#9) for dark.
  describe('outline variant contrast (#9, #71)', () => {
    it('dark border clears SC 1.4.11 (≥3:1 non-text contrast) against the surface', () => {
      // [data-theme='dark'] .outline { border-color: var(--color-border-emphasis) }
      const border = resolveTokenHex('--color-border-emphasis', 'dark')
      const surface = resolveTokenHex('--color-surface', 'dark')
      // Measured 4.15:1 (was 1.78:1 via --color-border-default pre-fix).
      expect(contrastRatio(border, surface)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('dark label clears SC 1.4.3 (≥4.5:1 text contrast) against the surface', () => {
      // [data-theme='dark'] .outline { color: var(--color-primary-base) }
      const label = resolveTokenHex('--color-primary-base', 'dark')
      const surface = resolveTokenHex('--color-surface', 'dark')
      // Measured 5.50:1 (was 2.96:1 via bare --color-primary pre-#9; 4.81:1
      // after #9's 23%-white-mix, before #73 bumped it to 30%).
      expect(contrastRatio(label, surface)).toBeGreaterThanOrEqual(AA_NORMAL)
    })

    it('#71 — light border clears SC 1.4.11 (≥3:1 non-text contrast) against the surface and the page background', () => {
      // .outline { border-color: var(--color-border-emphasis) } (light default)
      const border = resolveTokenHex('--color-border-emphasis', 'light')
      const surface = resolveTokenHex('--color-surface', 'light')
      const pageBg = resolveTokenHex('--color-neutral-50', 'light')
      // Measured 3.61:1 vs --color-surface, 3.45:1 vs --color-neutral-50
      // (was 1.525:1 / 1.457:1 via --color-border-default pre-fix — the
      // acceptance criteria's own quoted 1.53:1 failure).
      expect(contrastRatio(border, surface)).toBeGreaterThanOrEqual(AA_LARGE)
      expect(contrastRatio(border, pageBg)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('#73 — dark label clears SC 1.4.3 (≥4.5:1) against the elevated surface too', () => {
      // The #9 fix only checked --color-surface. --color-surface-elevated is
      // both a Card interior (outline buttons inside cards are a common
      // composition) and the background [data-theme='dark'] .outline:hover
      // paints as the button fill — and the same label measured only 4.19:1
      // there, under the 4.5:1 floor. Fixed by nudging --color-primary-base's
      // dark-only white-mix from 23% to 30% (src/styles/tokens.css).
      const label = resolveTokenHex('--color-primary-base', 'dark')
      const elevated = resolveTokenHex('--color-surface-elevated', 'dark')
      const ratio = contrastRatio(label, elevated)
      // Was 4.19:1 (sub-AA) pre-fix.
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL)
      expect(ratio).toBeCloseTo(4.83, 1)
    })

    it('#73 — border-emphasis (border) is untouched by the primary-base nudge', () => {
      // Regression lock: the #73 fix only touches --color-primary-base, not
      // --color-border-emphasis. Locks #9's original border numbers.
      const border = resolveTokenHex('--color-border-emphasis', 'dark')
      const surface = resolveTokenHex('--color-surface', 'dark')
      const elevated = resolveTokenHex('--color-surface-elevated', 'dark')
      expect(contrastRatio(border, surface)).toBeCloseTo(4.15, 1)
      expect(contrastRatio(border, elevated)).toBeCloseTo(3.64, 1)
    })

    it('light label clears SC 1.4.3 (≥4.5:1 text contrast) against the surface — untouched by #71', () => {
      // .outline { color: var(--color-primary) } — #71 only changed
      // border-color; the label token is unmodified.
      const label = resolveTokenHex('--color-primary', 'light')
      const surface = resolveTokenHex('--color-surface', 'light')
      expect(contrastRatio(label, surface)).toBeCloseTo(6.005, 2)
      expect(contrastRatio(label, surface)).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  })
})
