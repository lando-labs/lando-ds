/**
 * safeHref unit tests (#320)
 *
 * Pins the allow/block matrix and the obfuscation defenses. This helper is
 * the single chokepoint every `<a href>` sink routes through, so its decision
 * table is treated as a security contract.
 */

import { describe, it, expect } from 'vitest'
import { safeHref } from './safeHref'

describe('safeHref', () => {
  describe('allowed inputs (returned as-is, trimmed)', () => {
    it.each([
      ['/absolute/path', '/absolute/path'],
      ['./relative', './relative'],
      ['../up', '../up'],
      ['bare-relative', 'bare-relative'],
      ['#fragment', '#fragment'],
      ['?query=1', '?query=1'],
      ['//cdn.example.com/a.js', '//cdn.example.com/a.js'],
      ['https://example.com', 'https://example.com'],
      ['http://example.com', 'http://example.com'],
      ['HTTPS://EXAMPLE.COM', 'HTTPS://EXAMPLE.COM'],
      ['mailto:a@b.com', 'mailto:a@b.com'],
      ['tel:+15551234567', 'tel:+15551234567'],
      ['sms:+15551234567', 'sms:+15551234567'],
      ['/path/with:colon/after-slash', '/path/with:colon/after-slash'],
    ])('allows %s', (input, expected) => {
      expect(safeHref(input)).toBe(expected)
    })

    it('trims surrounding whitespace on allowed values', () => {
      expect(safeHref('   https://example.com   ')).toBe('https://example.com')
    })
  })

  describe('blocked inputs (→ fallback)', () => {
    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'chrome://settings',
      'about:blank',
    ])('blocks %s', (input) => {
      expect(safeHref(input)).toBe('#')
    })

    it('blocks obfuscated javascript: with embedded tab', () => {
      expect(safeHref('java\tscript:alert(1)')).toBe('#')
    })

    it('blocks obfuscated javascript: with embedded newline', () => {
      expect(safeHref('java\nscript:alert(1)')).toBe('#')
    })

    it('blocks javascript: with a leading control char', () => {
      expect(safeHref('javascript:alert(1)')).toBe('#')
    })

    it('blocks javascript: with leading whitespace', () => {
      expect(safeHref('  javascript:alert(1)')).toBe('#')
    })
  })

  describe('empty / nullish (→ fallback)', () => {
    it('returns fallback for null', () => {
      expect(safeHref(null)).toBe('#')
    })
    it('returns fallback for undefined', () => {
      expect(safeHref(undefined)).toBe('#')
    })
    it('returns fallback for empty string', () => {
      expect(safeHref('')).toBe('#')
    })
    it('returns fallback for whitespace-only', () => {
      expect(safeHref('   ')).toBe('#')
    })
  })

  describe('custom fallback', () => {
    it('uses the supplied fallback for blocked input', () => {
      expect(safeHref('javascript:alert(1)', '/home')).toBe('/home')
    })
    it('uses the supplied fallback for empty input', () => {
      expect(safeHref('', '/home')).toBe('/home')
    })
  })
})
