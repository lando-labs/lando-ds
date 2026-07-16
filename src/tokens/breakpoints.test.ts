/**
 * Breakpoint single-source-of-truth guard (#454).
 *
 * Before this, the responsive breakpoints existed as up to four unbound copies
 * (breakpoints.ts, dead `--breakpoint-*` CSS vars, containerQueries, and the
 * Sidebar JS constants). This test pins the canonical numeric table, proves the
 * derived media-query strings + container tiers stay bound to it, and asserts
 * the dead `--breakpoint-*` CSS custom properties are gone and unreferenced.
 *
 * NOTE: authored `@media` rules inside `*.module.css` unavoidably hardcode
 * these px/rem values (CSS custom properties are illegal inside `@media` by
 * spec). If you change a value in `CANONICAL_PX` below, you MUST also update
 * every hardcoded threshold in the component stylesheets to match.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

import {
  breakpoints,
  devices,
  containerMaxWidth,
  createMediaQuery,
} from './breakpoints'
import { containerQueries } from './containerQueries'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = resolve(HERE, '..')
const TOKENS_CSS = readFileSync(resolve(HERE, '../styles/tokens.css'), 'utf8')

/** The canonical breakpoint table — the ONE place these numbers are asserted. */
const CANONICAL_PX = {
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  '2xl': 1536,
  '3xl': 1920,
  xl: 1280,
} as const

/** Recursively collect every `.css` file under `dir`. */
function collectCssFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectCssFiles(full))
    else if (entry.name.endsWith('.css')) out.push(full)
  }
  return out
}

describe('breakpoints: canonical numeric source of truth', () => {
  it('breakpoints.px matches the canonical table', () => {
    expect(breakpoints.px).toEqual(CANONICAL_PX)
  })

  it('exposes exactly the seven expected tiers', () => {
    expect(Object.keys(breakpoints.px).sort()).toEqual(
      ['2xl', '3xl', 'lg', 'md', 'sm', 'xl', 'xs'],
    )
  })
})

describe('breakpoints: derived media-query strings stay bound to px', () => {
  it('mobile-first (up) queries derive from px / 16', () => {
    expect(breakpoints.up).toEqual({
      xs: '@media (min-width: 23.4375rem)',
      sm: '@media (min-width: 40rem)',
      md: '@media (min-width: 48rem)',
      lg: '@media (min-width: 64rem)',
      xl: '@media (min-width: 80rem)',
      '2xl': '@media (min-width: 96rem)',
      '3xl': '@media (min-width: 120rem)',
    })
  })

  it('desktop-first (down) queries derive from (px − 1) / 16', () => {
    expect(breakpoints.down).toEqual({
      xs: '@media (max-width: 23.375rem)',
      sm: '@media (max-width: 39.9375rem)',
      md: '@media (max-width: 47.9375rem)',
      lg: '@media (max-width: 63.9375rem)',
      xl: '@media (max-width: 79.9375rem)',
      '2xl': '@media (max-width: 95.9375rem)',
      '3xl': '@media (max-width: 119.9375rem)',
    })
  })

  it('range (between) queries pair consecutive tiers', () => {
    expect(breakpoints.between).toEqual({
      xsToSm: '@media (min-width: 23.4375rem) and (max-width: 39.9375rem)',
      smToMd: '@media (min-width: 40rem) and (max-width: 47.9375rem)',
      mdToLg: '@media (min-width: 48rem) and (max-width: 63.9375rem)',
      lgToXl: '@media (min-width: 64rem) and (max-width: 79.9375rem)',
      xlTo2xl: '@media (min-width: 80rem) and (max-width: 95.9375rem)',
      '2xlTo3xl': '@media (min-width: 96rem) and (max-width: 119.9375rem)',
    })
  })

  it('containerMaxWidth numeric part derives from px', () => {
    expect(containerMaxWidth).toEqual({
      xs: '100%',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    })
  })

  it('devices are wired to the derived queries', () => {
    expect(devices.mobile).toBe(breakpoints.down.md)
    expect(devices.tablet).toBe(breakpoints.between.mdToLg)
    expect(devices.desktop).toBe(breakpoints.up.lg)
    expect(devices.wide).toBe(breakpoints.up['2xl'])
  })

  it('createMediaQuery matches the up/down derivations', () => {
    expect(createMediaQuery('md', 'up')).toBe('@media (min-width: 48rem)')
    expect(createMediaQuery('md', 'down')).toBe('@media (max-width: 47.9375rem)')
    expect(createMediaQuery('lg')).toBe(breakpoints.up.lg)
  })
})

describe('containerQueries: shared tiers bound to breakpoints.px (#454)', () => {
  it('px tiers equal the breakpoint source of truth', () => {
    expect(containerQueries.px.sm).toBe(breakpoints.px.sm)
    expect(containerQueries.px.md).toBe(breakpoints.px.md)
  })

  it('rem tiers equal px / 16', () => {
    expect(containerQueries.rem.sm).toBe(breakpoints.px.sm / 16)
    expect(containerQueries.rem.md).toBe(breakpoints.px.md / 16)
  })

  it('anonymous container-query strings embed the derived rem tiers', () => {
    expect(containerQueries.down.sm).toBe(
      `@container (max-width: ${containerQueries.rem.sm}rem)`,
    )
    expect(containerQueries.down.md).toBe(
      `@container (max-width: ${containerQueries.rem.md}rem)`,
    )
  })
})

describe('breakpoints: dead --breakpoint-* CSS vars removed (#454)', () => {
  it('tokens.css declares no --breakpoint-* custom property', () => {
    expect(TOKENS_CSS).not.toMatch(/--breakpoint-[\w-]+\s*:/)
  })

  it('no CSS file anywhere in src references var(--breakpoint …)', () => {
    const offenders = collectCssFiles(SRC_DIR).filter((file) =>
      readFileSync(file, 'utf8').includes('var(--breakpoint'),
    )
    expect(offenders).toEqual([])
  })
})
