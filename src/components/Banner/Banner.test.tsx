/**
 * Banner Component Tests
 *
 * Behavioral coverage for Banner:
 * - content rendering
 * - all 4 variants (info / success / warning / error) emit a variant class
 * - placement="top" and placement="bottom" emit the right placement class
 * - onDismiss callback fires when close button clicked
 * - close button is absent when onDismiss not provided
 * - actions slot renders correctly, alongside dismiss button when both present
 * - role="alert" for error variant; role="status" for non-error variants
 * - z-index tokens (--z-bottomnav and --z-banner) are present in tokens.css
 * - axe a11y smoke check
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Banner } from './Banner'

expect.extend(toHaveNoViolations)

describe('Banner', () => {
  it('renders children content', () => {
    render(<Banner>Cookie notice</Banner>)
    expect(screen.getByText('Cookie notice')).toBeInTheDocument()
  })

  it('applies variant class for each semantic variant', () => {
    const variants: Array<'info' | 'success' | 'warning' | 'error'> = [
      'info',
      'success',
      'warning',
      'error',
    ]
    variants.forEach((variant) => {
      const { unmount } = render(<Banner variant={variant}>msg</Banner>)
      // For error variant the role is 'alert'; for non-error it's 'status'.
      const banner =
        variant === 'error'
          ? screen.getByRole('alert')
          : screen.getByRole('status')
      // CSS Modules hash the class name, but the variant key still appears.
      expect(banner.className).toMatch(new RegExp(`variant-${variant}`))
      expect(banner).toHaveAttribute('data-variant', variant)
      unmount()
    })
  })

  it('applies placement="top" class and data attribute', () => {
    render(<Banner placement="top">Top notice</Banner>)
    const banner = screen.getByRole('status')
    expect(banner.className).toMatch(/placement-top/)
    expect(banner).toHaveAttribute('data-placement', 'top')
  })

  it('applies placement="bottom" class and data attribute', () => {
    render(<Banner placement="bottom">Bottom notice</Banner>)
    const banner = screen.getByRole('status')
    expect(banner.className).toMatch(/placement-bottom/)
    expect(banner).toHaveAttribute('data-placement', 'bottom')
  })

  it('defaults to placement="bottom" when not provided', () => {
    render(<Banner>Default placement</Banner>)
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('data-placement', 'bottom')
  })

  it('does not render close button when onDismiss is not provided', () => {
    render(<Banner>Persistent</Banner>)
    expect(screen.queryByRole('button', { name: /dismiss banner/i })).toBeNull()
  })

  it('renders close button and fires onDismiss when clicked', () => {
    const onDismiss = vi.fn()
    render(<Banner onDismiss={onDismiss}>Dismissible</Banner>)
    const closeBtn = screen.getByRole('button', { name: /dismiss banner/i })
    fireEvent.click(closeBtn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders actions slot to the right of the message', () => {
    render(
      <Banner actions={<button data-testid="accept-btn">Accept</button>}>
        Cookie notice
      </Banner>
    )
    expect(screen.getByTestId('accept-btn')).toBeInTheDocument()
  })

  it('renders actions and close button together when both provided', () => {
    const onDismiss = vi.fn()
    render(
      <Banner
        onDismiss={onDismiss}
        actions={<button data-testid="accept-btn">Accept</button>}
      >
        Cookie notice
      </Banner>
    )
    expect(screen.getByTestId('accept-btn')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /dismiss banner/i })
    ).toBeInTheDocument()
  })

  it('uses role="alert" for error variant', () => {
    render(<Banner variant="error">Critical error</Banner>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    // role="status" should NOT be present for error
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('uses role="status" for non-error variants', () => {
    const variants: Array<'info' | 'success' | 'warning'> = [
      'info',
      'success',
      'warning',
    ]
    variants.forEach((variant) => {
      const { unmount } = render(<Banner variant={variant}>msg</Banner>)
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
      unmount()
    })
  })

  it('forwards refs to the root element', () => {
    const ref = { current: null as HTMLDivElement | null }
    render(<Banner ref={ref}>Ref test</Banner>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('appends className without overriding internal classes', () => {
    render(<Banner className="my-custom-class">msg</Banner>)
    const banner = screen.getByRole('status')
    expect(banner.className).toMatch(/my-custom-class/)
    // Internal class still present
    expect(banner.className).toMatch(/banner/)
  })

  it('has no a11y violations (axe smoke)', async () => {
    const { container } = render(
      <Banner
        variant="info"
        onDismiss={() => {}}
        actions={<button type="button">Accept</button>}
      >
        We use cookies to improve your experience.
      </Banner>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('tokens.css declares both --z-bottomnav and --z-banner', () => {
    // Lane 3 owns the z-index token additions for both BottomNav (Lane 2)
    // and Banner. This guards against a regression where the tokens are
    // dropped or renamed.
    const tokensPath = resolve(__dirname, '../../styles/tokens.css')
    const tokens = readFileSync(tokensPath, 'utf-8')
    expect(tokens).toMatch(/--z-bottomnav:\s*900/)
    expect(tokens).toMatch(/--z-banner:\s*950/)
  })
})

// ===== Consumer passthrough contract (#423) =====
// BannerProps extends React.HTMLAttributes<HTMLDivElement>: a consumer
// `data-testid` and `style` land on the visual `.banner` root, while the
// internal `role` (alert/status) is applied AFTER `{...rest}` so the a11y
// contract always wins over a conflicting consumer prop.
describe('Banner — consumer passthrough (#423)', () => {
  it('lands consumer data-testid on the visual root', () => {
    render(<Banner data-testid="my-banner">Cookie notice</Banner>)
    const el = screen.getByTestId('my-banner')
    expect(el.tagName).toBe('DIV')
    // the message text lives inside the visual root
    expect(el).toContainElement(screen.getByText('Cookie notice'))
  })

  it('applies consumer style to the visual root', () => {
    render(
      <Banner data-testid="my-banner" style={{ color: 'rgb(1, 2, 3)' }}>
        Cookie notice
      </Banner>
    )
    expect(screen.getByTestId('my-banner')).toHaveStyle({
      color: 'rgb(1, 2, 3)',
    })
  })

  it('keeps internal role even when consumer passes a conflicting role', () => {
    // Non-error banners use role="status"; the role is applied AFTER {...rest}
    // so a consumer role="presentation" cannot clobber the a11y contract.
    render(
      <Banner data-testid="my-banner" variant="info" role="presentation">
        Notice
      </Banner>
    )
    expect(screen.getByTestId('my-banner')).toHaveAttribute('role', 'status')
  })

  it('error variant keeps role="alert" over a conflicting consumer role', () => {
    render(
      <Banner data-testid="my-banner" variant="error" role="presentation">
        Something broke
      </Banner>
    )
    expect(screen.getByTestId('my-banner')).toHaveAttribute('role', 'alert')
  })
})
