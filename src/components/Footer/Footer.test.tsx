/**
 * Footer Component Tests
 *
 * Focused on Sprint 10 (#59) brand-by-default smoke coverage: the
 * 2px ocean → teal gradient ribbon sits on the footer's top edge by
 * default, and `accent={false}` is the explicit opt-out.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'

describe('Footer', () => {
  it('renders copyright text', () => {
    render(<Footer copyright="© 2026 Lando Labs" />)
    expect(screen.getByText('© 2026 Lando Labs')).toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  Sprint 10 (#59) — Gradient ribbon by default
   * ------------------------------------------------------------------ */
  describe('brand defaults (#59)', () => {
    it('applies the accent class by default', () => {
      const { container } = render(<Footer copyright="c" />)
      const footerEl = container.querySelector('footer') as HTMLElement
      expect(footerEl).toBeInTheDocument()
      expect(footerEl.className).toMatch(/accent/)
    })

    it('opts out of the ribbon with accent={false}', () => {
      const { container } = render(<Footer copyright="c" accent={false} />)
      const footerEl = container.querySelector('footer') as HTMLElement
      expect(footerEl).toBeInTheDocument()
      expect(footerEl.className).not.toMatch(/accent/)
    })
  })

  /* ------------------------------------------------------------------ *
   *  #320 — href sanitization on column + social links
   * ------------------------------------------------------------------ */
  describe('href sanitization (#320)', () => {
    it('neutralizes a javascript: column link to the fallback', () => {
      render(
        <Footer
          variant="rich"
          logo={<span>Logo</span>}
          columns={[
            {
              title: 'Bad',
              links: [{ label: 'Evil', href: 'javascript:alert(1)' }],
            },
          ]}
        />,
      )
      const link = screen.getByRole('link', { name: 'Evil' })
      expect(link.getAttribute('href')).toBe('#')
      expect(link.getAttribute('href')).not.toContain('javascript:')
    })

    it('neutralizes a javascript: social link to the fallback', () => {
      render(
        <Footer
          variant="rich"
          logo={<span>Logo</span>}
          social={[
            { icon: <span>x</span>, href: 'javascript:alert(1)', label: 'Evil' },
          ]}
        />,
      )
      const link = screen.getByRole('link', { name: 'Evil' })
      expect(link.getAttribute('href')).toBe('#')
    })

    it('passes through a safe absolute column link unchanged', () => {
      render(
        <Footer
          variant="rich"
          logo={<span>Logo</span>}
          columns={[
            {
              title: 'Good',
              links: [{ label: 'Docs', href: 'https://example.com/docs' }],
            },
          ]}
        />,
      )
      expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
        'href',
        'https://example.com/docs',
      )
    })
  })

  /* ------------------------------------------------------------------ *
   *  #321 — external links get target/rel; internal links do not
   * ------------------------------------------------------------------ */
  describe('external link rel/target policy (#321)', () => {
    it('adds target=_blank + rel=noopener noreferrer to external column links', () => {
      render(
        <Footer
          variant="rich"
          logo={<span>Logo</span>}
          columns={[
            {
              title: 'Product',
              links: [{ label: 'External', href: 'https://example.com' }],
            },
          ]}
        />,
      )
      const link = screen.getByRole('link', { name: 'External' })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('does NOT add target=_blank to relative/internal column links', () => {
      render(
        <Footer
          variant="rich"
          logo={<span>Logo</span>}
          columns={[
            {
              title: 'Product',
              links: [{ label: 'Internal', href: '/pricing' }],
            },
          ]}
        />,
      )
      const link = screen.getByRole('link', { name: 'Internal' })
      expect(link).toHaveAttribute('href', '/pricing')
      expect(link).not.toHaveAttribute('target')
      expect(link).not.toHaveAttribute('rel')
    })
  })

  /* ------------------------------------------------------------------ *
   *  #423 — consumer style / ...rest pass-through to the <footer> root
   * ------------------------------------------------------------------ */
  describe('consumer passthrough (#423)', () => {
    it('lands consumer data-testid on the <footer> visual root (simple)', () => {
      render(<Footer copyright="c" data-testid="ft" />)
      expect(screen.getByTestId('ft').tagName).toBe('FOOTER')
    })

    it('lands consumer data-testid on the <footer> visual root (rich)', () => {
      render(<Footer variant="rich" copyright="c" data-testid="ft-rich" />)
      expect(screen.getByTestId('ft-rich').tagName).toBe('FOOTER')
    })

    it('applies consumer style.color to the <footer> visual root', () => {
      render(
        <Footer copyright="c" data-testid="ft" style={{ color: 'rgb(1, 2, 3)' }} />,
      )
      expect(screen.getByTestId('ft')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    })

    it('forwards arbitrary rest props (id) to the <footer> root', () => {
      render(<Footer copyright="c" data-testid="ft" id="site-footer" />)
      expect(screen.getByTestId('ft')).toHaveAttribute('id', 'site-footer')
    })
  })
})
