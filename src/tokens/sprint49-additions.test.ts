// @vitest-environment node

/**
 * Sprint 49 / #375 — token-addition smoke tests.
 *
 * Asserts the new primitives land in BOTH halves of the tokens contract:
 *   1. The TypeScript exports (consumers reading `from '@lando-labs/lando-ds/tokens'`)
 *   2. The CSS `:root` declarations in `src/styles/tokens.css` (consumers
 *      reading `var(--token)` from stylesheets)
 *
 * If either side regresses the test fails — that's the parity guarantee.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { borderWidth } from './border'
import { sizing, popoverSize } from './sizing'
import { textTransform } from './typography'
import { spacing } from './spacing'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = readFileSync(
  resolve(HERE, '../styles/tokens.css'),
  'utf8',
)

/** Pull all `--name: value;` declarations from any selector in the file. */
function hasDecl(name: string, value?: string | RegExp): boolean {
  // Match: `--name: …;` (allows whitespace around the colon and value).
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`--${escaped}\\s*:\\s*([^;]+);`)
  const match = re.exec(TOKENS_CSS)
  if (!match) return false
  if (value === undefined) return true
  const raw = match[1]!.trim() // safe: match non-null (checked above) → capture group 1 present
  if (typeof value === 'string') return raw === value
  return value.test(raw)
}

describe('Sprint 49 / #375 — TS token exports', () => {
  it('exports `borderWidth` with values 0 / 1 / 2 / 4 (px numbers)', () => {
    expect(borderWidth).toEqual({ 0: 0, 1: 1, 2: 2, 4: 4 })
  })

  it('exports `popoverSize` with min-width / max-width / max-height (px numbers)', () => {
    expect(popoverSize.minWidth).toBe(280)
    expect(popoverSize.maxWidth).toBe(420)
    expect(popoverSize.maxHeight).toBe(320)
  })

  it('exposes `popoverSize` under the unified `sizing` group', () => {
    expect(sizing.popover).toBe(popoverSize)
  })

  it('exports `textTransform` keyword constants', () => {
    expect(textTransform).toEqual({
      none: 'none',
      uppercase: 'uppercase',
      capitalize: 'capitalize',
    })
  })

  it('extends `spacing` with the dense 6px step', () => {
    expect(spacing['2xs-dense']).toBe(6)
  })

  it('preserves the surrounding spacing rungs (no regression)', () => {
    expect(spacing['2xs']).toBe(4)
    expect(spacing.xs).toBe(8)
  })
})

describe('Sprint 49 / #375 — CSS custom property declarations', () => {
  it('emits --border-width-{0,1,2,4} primitives', () => {
    expect(hasDecl('border-width-0', '0')).toBe(true)
    expect(hasDecl('border-width-1', '1px')).toBe(true)
    expect(hasDecl('border-width-2', '2px')).toBe(true)
    expect(hasDecl('border-width-4', '4px')).toBe(true)
  })

  it('emits --text-transform-{none,uppercase,capitalize}', () => {
    expect(hasDecl('text-transform-none', 'none')).toBe(true)
    expect(hasDecl('text-transform-uppercase', 'uppercase')).toBe(true)
    expect(hasDecl('text-transform-capitalize', 'capitalize')).toBe(true)
  })

  it('emits --spacing-2xs-dense as 0.375rem (6px)', () => {
    expect(hasDecl('spacing-2xs-dense', '0.375rem')).toBe(true)
  })

  it('emits --size-popover-{min-width,max-width,max-height}', () => {
    expect(hasDecl('size-popover-min-width', '280px')).toBe(true)
    expect(hasDecl('size-popover-max-width', '420px')).toBe(true)
    expect(hasDecl('size-popover-max-height', '320px')).toBe(true)
  })

  it('keeps the published letter-spacing tokens (tight/normal/wide/wider)', () => {
    // #375 only requires that this named subset is published; the file may
    // already include `tighter` / `widest` which is fine.
    expect(hasDecl('letter-spacing-tight', '-0.025em')).toBe(true)
    expect(hasDecl('letter-spacing-normal', '0')).toBe(true)
    expect(hasDecl('letter-spacing-wide', '0.025em')).toBe(true)
    expect(hasDecl('letter-spacing-wider', '0.05em')).toBe(true)
  })

  it('lives inside the appendix region (a marker comment is present)', () => {
    expect(TOKENS_CSS).toContain('Sprint 49 / #375 token additions')
  })

  it('does not break the @layer ll.tokens wrapper (closing tag still last)', () => {
    // Last 200 chars should still include the close-of-layer comment.
    expect(TOKENS_CSS.slice(-300)).toContain('@layer ll.tokens')
  })
})
