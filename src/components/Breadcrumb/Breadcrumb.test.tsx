/**
 * Breadcrumb Component Tests
 *
 * Behavioral coverage for Breadcrumb + BreadcrumbItem:
 * semantic nav structure, separators, aria-current, and link rendering.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumb } from './Breadcrumb'
import { BreadcrumbItem } from './BreadcrumbItem'

describe('Breadcrumb', () => {
  it('renders as a <nav> with "Breadcrumb" aria-label', () => {
    render(
      <Breadcrumb>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
      </Breadcrumb>
    )

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav.tagName).toBe('NAV')
  })

  it('renders children inside an ordered list', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem href="/products">Products</BreadcrumbItem>
        <BreadcrumbItem active>Details</BreadcrumbItem>
      </Breadcrumb>
    )

    const ol = container.querySelector('ol')
    expect(ol).toBeInTheDocument()
    expect(ol?.querySelectorAll('li')).toHaveLength(3)
  })

  it('renders items with href as <a> links', () => {
    render(
      <Breadcrumb>
        <BreadcrumbItem href="/home">Home</BreadcrumbItem>
        <BreadcrumbItem href="/products">Products</BreadcrumbItem>
        <BreadcrumbItem active>Details</BreadcrumbItem>
      </Breadcrumb>
    )

    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toHaveAttribute('href', '/home')

    const productsLink = screen.getByRole('link', { name: 'Products' })
    expect(productsLink).toHaveAttribute('href', '/products')
  })

  it('applies aria-current="page" to the active item', () => {
    render(
      <Breadcrumb>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem active>Current</BreadcrumbItem>
      </Breadcrumb>
    )

    const current = screen.getByText('Current')
    expect(current).toHaveAttribute('aria-current', 'page')
    // Active item is a <span>, not a link.
    expect(screen.queryByRole('link', { name: 'Current' })).not.toBeInTheDocument()
  })

  it('renders separators between items but not after the active item', () => {
    const { container } = render(
      <Breadcrumb separator=">">
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem href="/products">Products</BreadcrumbItem>
        <BreadcrumbItem active>Details</BreadcrumbItem>
      </Breadcrumb>
    )

    // Non-active items each render a separator; the active item does not.
    const separators = container.querySelectorAll('[aria-hidden="true"]')
    expect(separators).toHaveLength(2)
    for (const sep of separators) {
      expect(sep.textContent).toBe('>')
    }
  })

  it('uses the default "/" separator when none is provided', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
        <BreadcrumbItem active>Current</BreadcrumbItem>
      </Breadcrumb>
    )

    const separator = container.querySelector('[aria-hidden="true"]')
    expect(separator?.textContent).toBe('/')
  })

  it('renders an item without href and without active as plain text', () => {
    render(
      <Breadcrumb>
        <BreadcrumbItem>Just text</BreadcrumbItem>
      </Breadcrumb>
    )

    // No href + no asChild + no active → still renders as <span>.
    expect(screen.queryByRole('link', { name: 'Just text' })).not.toBeInTheDocument()
    expect(screen.getByText('Just text')).toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  #320 — href sanitization
   * ------------------------------------------------------------------ */
  describe('href sanitization (#320)', () => {
    it('neutralizes a javascript: breadcrumb href to the fallback', () => {
      render(
        <Breadcrumb>
          <BreadcrumbItem href="javascript:alert(1)">Evil</BreadcrumbItem>
        </Breadcrumb>
      )
      const link = screen.getByRole('link', { name: 'Evil' })
      expect(link.getAttribute('href')).toBe('#')
      expect(link.getAttribute('href')).not.toContain('javascript:')
    })

    it('passes through a safe href unchanged', () => {
      render(
        <Breadcrumb>
          <BreadcrumbItem href="/products">Products</BreadcrumbItem>
        </Breadcrumb>
      )
      expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
        'href',
        '/products',
      )
    })
  })
})

describe('BreadcrumbItem — consumer passthrough (#422)', () => {
  it('lands consumer data-testid on the <li> visual root', () => {
    render(
      <Breadcrumb>
        <BreadcrumbItem href="/x" data-testid="bc-item">
          Item
        </BreadcrumbItem>
      </Breadcrumb>,
    )
    const el = screen.getByTestId('bc-item')
    expect(el.tagName).toBe('LI')
  })

  it('applies consumer style to the <li> visual root', () => {
    render(
      <Breadcrumb>
        <BreadcrumbItem
          href="/x"
          data-testid="bc-item"
          style={{ color: 'rgb(1, 2, 3)' }}
        >
          Item
        </BreadcrumbItem>
      </Breadcrumb>,
    )
    expect(screen.getByTestId('bc-item')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('merges consumer className onto the <li> visual root', () => {
    render(
      <Breadcrumb>
        <BreadcrumbItem href="/x" data-testid="bc-item" className="consumer-cls">
          Item
        </BreadcrumbItem>
      </Breadcrumb>,
    )
    expect(screen.getByTestId('bc-item').className).toContain('consumer-cls')
  })
})

/* -------------------------------------------------------------------- *
 *  #423 — consumer style / ...rest pass-through to the <nav> root
 * -------------------------------------------------------------------- */
describe('Breadcrumb consumer passthrough (#423)', () => {
  it('lands consumer data-testid on the <nav> visual root', () => {
    render(
      <Breadcrumb data-testid="bc">
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
      </Breadcrumb>,
    )
    expect(screen.getByTestId('bc').tagName).toBe('NAV')
  })

  it('applies consumer style.color to the <nav> visual root', () => {
    render(
      <Breadcrumb data-testid="bc" style={{ color: 'rgb(1, 2, 3)' }}>
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
      </Breadcrumb>,
    )
    expect(screen.getByTestId('bc')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('keeps the internal aria-label authoritative over consumer rest', () => {
    render(
      <Breadcrumb data-testid="bc" aria-label="Consumer override">
        <BreadcrumbItem href="/">Home</BreadcrumbItem>
      </Breadcrumb>,
    )
    // The landmark label stays "Breadcrumb" — internal aria-label wins.
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toBeInTheDocument()
  })
})
