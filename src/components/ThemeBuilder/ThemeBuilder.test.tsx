/**
 * ThemeBuilder Component Tests
 *
 * ThemeBuilder is a large interactive showcase surface. These tests are a
 * smoke render plus the #422 root pass-through contract — the outer
 * `.themeBuilder` <div> is the styled root that must accept consumer
 * className / style / ...rest.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeBuilder } from './ThemeBuilder'

describe('ThemeBuilder', () => {
  it('renders its heading', () => {
    render(<ThemeBuilder />)
    expect(
      screen.getByRole('heading', { name: 'Theme Builder' })
    ).toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  #422 — className / style / ...rest pass-through to the outer root
   * ------------------------------------------------------------------ */
  describe('root pass-through (#422)', () => {
    it('forwards a consumer data-testid onto the outer .themeBuilder root', () => {
      const { container } = render(<ThemeBuilder data-testid="tb-root" />)
      const root = container.firstChild as HTMLElement
      expect(root.getAttribute('data-testid')).toBe('tb-root')
    })

    it('lets a consumer style win on the outer root', () => {
      const { container } = render(
        <ThemeBuilder style={{ color: 'rgb(1, 2, 3)' }} />
      )
      const root = container.firstChild as HTMLElement
      expect(root.style.color).toBe('rgb(1, 2, 3)')
    })

    it('merges a consumer className onto the outer root', () => {
      const { container } = render(<ThemeBuilder className="consumer-tb" />)
      const root = container.firstChild as HTMLElement
      expect(root.className).toContain('consumer-tb')
      expect(root.className.split(' ').length).toBeGreaterThan(1)
    })
  })
})
