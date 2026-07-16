/**
 * #480 — ProductTheme override → consumed CSS-var mapping.
 *
 * `computeThemeAttrs` used to write every override as `--<category>-<key>`, which
 * only works when the token category name equals the var prefix AND the shape is
 * flat. It silently broke for:
 *   - typography (nested; read --font-family-*, --font-size-*, … not --typography-*)
 *   - shadows (components read the SINGULAR --shadow-*, not --shadows-*)
 *   - animation (nested; read --duration-*, --easing-*, not --animation-*)
 *
 * These pin the corrected mapping and prove color/spacing/radius (the flat 1:1
 * path) and the #323 injection screen are unchanged.
 */

import { describe, it, expect } from 'vitest'
import type { ProductTheme } from '../tokens'
import { computeThemeAttrs } from './ThemeProvider'

// Fixture helper — `any` so tests can build off-happy-path shapes without
// wrestling the (deliberately strict) ThemeTokens type.
const pt = (tokens: unknown): ProductTheme => ({ name: 'test', tokens: tokens as ProductTheme['tokens'] })

describe('computeThemeAttrs — ProductTheme → consumed CSS vars (#480)', () => {
  describe('typography (nested → --font-*)', () => {
    it('maps fontFamily.base to --font-family-base (not --typography-*)', () => {
      const { vars } = computeThemeAttrs('light', pt({ typography: { fontFamily: { base: 'Inter, sans-serif' } } }))
      expect(vars['--font-family-base']).toBe('Inter, sans-serif')
      expect(Object.keys(vars).some((k) => k.startsWith('--typography'))).toBe(false)
    })

    it('maps fontSize / fontWeight / lineHeight / letterSpacing string values', () => {
      const { vars } = computeThemeAttrs(
        'light',
        pt({
          typography: {
            fontSize: { lg: '1.2rem' },
            fontWeight: { bold: '700' },
            lineHeight: { tight: '1.2' },
            letterSpacing: { wide: '0.05em' },
          },
        }),
      )
      expect(vars['--font-size-lg']).toBe('1.2rem')
      expect(vars['--font-weight-bold']).toBe('700')
      expect(vars['--line-height-tight']).toBe('1.2')
      expect(vars['--letter-spacing-wide']).toBe('0.05em')
    })

    it('composes NUMERIC leaves with the correct per-group unit, not px (#480 skeptic)', () => {
      // The public type steers consumers to numbers (Partial<typeof typography>);
      // without per-group units, lineHeight: 1.5 → `1.5px` (catastrophic).
      const { vars } = computeThemeAttrs(
        'light',
        pt({
          typography: {
            fontWeight: { bold: 700 },
            lineHeight: { normal: 1.5 },
            letterSpacing: { wider: 0.05 },
            fontSize: { xl: 20 },
          },
        }),
      )
      expect(vars['--font-weight-bold']).toBe('700') // unitless, not 700px
      expect(vars['--line-height-normal']).toBe('1.5') // unitless, not 1.5px
      expect(vars['--letter-spacing-wider']).toBe('0.05em') // em, not px
      expect(vars['--font-size-xl']).toBe('20px') // px is correct for font-size
    })

    it('ignores composite type scales (display/heading/body) — no stray vars', () => {
      const { vars } = computeThemeAttrs('light', pt({ typography: { display: { fontSize: 3, fontWeight: 800 } } }))
      expect(Object.keys(vars).some((k) => k.startsWith('--display'))).toBe(false)
      expect(Object.keys(vars).some((k) => k.startsWith('--font'))).toBe(false)
    })
  })

  describe('shadows (flat → singular --shadow-*)', () => {
    it('maps a per-key ShadowLayer[] to --shadow-md (not --shadows-md)', () => {
      const { vars } = computeThemeAttrs(
        'light',
        pt({ shadows: { md: [{ x: 0, y: 4, blur: 6, spread: -1, color: 'rgba(0,0,0,0.1)' }] } }),
      )
      expect(vars['--shadow-md']).toContain('4px')
      expect(vars['--shadow-md']).toContain('rgba(0,0,0,0.1)')
      expect('--shadows-md' in vars).toBe(false)
    })
  })

  describe('animation (nested → --duration-* / --easing-*)', () => {
    it('maps duration (ms number) and easing (cubic-bezier 4-tuple)', () => {
      const { vars } = computeThemeAttrs(
        'light',
        pt({ animation: { duration: { fast: 250 }, easing: { out: [0.4, 0, 0.2, 1] } } }),
      )
      expect(vars['--duration-fast']).toMatch(/^\d+ms$/)
      expect(vars['--easing-out']).toContain('cubic-bezier(')
      expect(Object.keys(vars).some((k) => k.startsWith('--animation'))).toBe(false)
    })

    it('ignores keyframe presets (fadeIn/slideIn*) — no stray vars', () => {
      const { vars } = computeThemeAttrs('light', pt({ animation: { fadeIn: { from: {}, to: {} } } }))
      expect(Object.keys(vars).length).toBe(0)
    })
  })

  describe('flat categories stay 1:1 (regression)', () => {
    it('color / radius / spacing keep --color-* / --radius-* / --spacing-*', () => {
      const { vars } = computeThemeAttrs(
        'light',
        pt({ color: { primary: '#123456' }, radius: { md: '10px' }, spacing: { '4': '1rem' } }),
      )
      expect(vars['--color-primary']).toBe('#123456')
      expect(vars['--radius-md']).toBe('10px')
      expect(vars['--spacing-4']).toBe('1rem')
    })
  })

  describe('security screen preserved (#323)', () => {
    it('drops a typography value carrying an injection vector', () => {
      const { vars } = computeThemeAttrs('light', pt({ typography: { fontFamily: { base: 'url(http://evil/?leak)' } } }))
      expect('--font-family-base' in vars).toBe(false)
    })

    it('drops an unsafe leaf key without writing a var', () => {
      const { vars } = computeThemeAttrs('light', pt({ typography: { fontFamily: { 'evil;key': 'x' } } }))
      expect(Object.keys(vars).length).toBe(0)
    })
  })
})
