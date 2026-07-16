/**
 * Z-index Contract Tests (#35, #46)
 *
 * The nested-overlay class of bug (#35, #46) was rooted in a z-index ordering
 * mistake: Modal backdrop at 1100 sat above Dropdown/Select at 1000, so an
 * overlay opened INSIDE a Modal rendered behind the backdrop. Sprint 5 Lane 2
 * fixes this by raising the dropdown/popover/tooltip/toast tiers above modal.
 *
 * These tests parse tokens.css directly and assert the numeric ordering. They
 * guard against silent regressions if someone re-orders the z-index block in a
 * future change.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const tokensPath = join(here, 'tokens.css')
const tokensCss = readFileSync(tokensPath, 'utf-8')

/** Read a numeric custom property from the :root block. */
function readZ(name: string): number {
  const re = new RegExp(`--z-index-${name}:\\s*(-?\\d+)`)
  const m = tokensCss.match(re)
  if (!m) throw new Error(`Could not find --z-index-${name} in tokens.css`)
  return Number(m[1])
}

describe('Z-index layering contract (#35, #46)', () => {
  it('base < below is inverted (negative is below)', () => {
    expect(readZ('below')).toBeLessThan(readZ('base'))
  })

  it('sticky < fixed < modal (document chrome below dialogs)', () => {
    expect(readZ('sticky')).toBeLessThan(readZ('fixed'))
    expect(readZ('fixed')).toBeLessThan(readZ('modal'))
  })

  /**
   * #35 core contract: dropdown, popover, and tooltip are ABOVE modal so an
   * overlay opened INSIDE a Modal paints above the Modal's backdrop. The
   * previous contract (dropdown 1000 < modal 1100) was the source of the
   * bug that Sprint 5 Lane 2 closes.
   */
  it('dropdown > modal (nested overlays render above backdrop) [#35]', () => {
    expect(readZ('dropdown')).toBeGreaterThan(readZ('modal'))
  })

  it('popover > modal (Popover-in-Modal) [#35, #37]', () => {
    expect(readZ('popover')).toBeGreaterThan(readZ('modal'))
  })

  it('tooltip > modal (Tooltip-in-Modal)', () => {
    expect(readZ('tooltip')).toBeGreaterThan(readZ('modal'))
  })

  it('toast > tooltip > popover > dropdown (overlay tier internal order)', () => {
    expect(readZ('toast')).toBeGreaterThan(readZ('tooltip'))
    expect(readZ('tooltip')).toBeGreaterThan(readZ('popover'))
    expect(readZ('popover')).toBeGreaterThan(readZ('dropdown'))
  })

  it('all overlay tiers stay above modal/drawer', () => {
    const modal = readZ('modal')
    expect(readZ('drawer')).toBeLessThanOrEqual(modal + 10)
    expect(readZ('dropdown')).toBeGreaterThan(modal)
    expect(readZ('popover')).toBeGreaterThan(modal)
    expect(readZ('tooltip')).toBeGreaterThan(modal)
    expect(readZ('toast')).toBeGreaterThan(modal)
  })
})
