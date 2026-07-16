// @vitest-environment node

/**
 * OKLCH twin parity (#286).
 *
 * `src/tokens/oklch.ts` is the PUBLISHED TypeScript port of the build script's
 * zero-dep `scripts/lib/oklch.mjs`. The `.mjs` stays out of the pre-build graph
 * (no TS loader); this test binds the twins so the math/format can never drift:
 * it imports the same-named functions from BOTH copies and asserts identical
 * results across every DS ramp hex and a sweep of OKLCH triples.
 */

import { describe, it, expect } from 'vitest'

import {
  hexToOklch as tsHexToOklch,
  hexToOklchString as tsHexToOklchString,
  oklchToHex as tsOklchToHex,
  formatOklch as tsFormatOklch,
  oklabFromHex as tsOklabFromHex,
  mixOklab as tsMixOklab,
  oklabDeltaE as tsOklabDeltaE,
} from './oklch'

import {
  hexToOklch as jsHexToOklch,
  hexToOklchString as jsHexToOklchString,
  oklchToHex as jsOklchToHex,
  formatOklch as jsFormatOklch,
  oklabFromHex as jsOklabFromHex,
  mixOklab as jsMixOklab,
  oklabDeltaE as jsOklabDeltaE,
} from '../../scripts/lib/oklch.mjs'

import { colors } from './colors'

const NEAR = 1e-12

/** Walk every hex leaf in the `colors` palette (ocean/teal/neutral/semantic/dark). */
function collectHexes(node: unknown, acc: string[] = []): string[] {
  if (typeof node === 'string') {
    if (/^#[0-9A-Fa-f]{3,8}$/.test(node)) acc.push(node)
    return acc
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) collectHexes(v, acc)
  }
  return acc
}

const HEXES = collectHexes(colors)

describe('OKLCH twin parity: hex ramps (#286)', () => {
  it('walks a non-trivial number of palette hexes', () => {
    // Guard: if collectHexes silently returns nothing, the per-hex assertions
    // below would vacuously pass. The palette has well over a dozen rungs.
    expect(HEXES.length).toBeGreaterThan(20)
  })

  it('hexToOklch L/C/H agree within 1e-12 for every ramp rung', () => {
    for (const hex of HEXES) {
      const ts = tsHexToOklch(hex)
      const js = jsHexToOklch(hex)
      expect(ts.L, hex).toBeCloseTo(js.L, 12)
      expect(ts.C, hex).toBeCloseTo(js.C, 12)
      expect(ts.H, hex).toBeCloseTo(js.H, 12)
    }
  })

  it('hexToOklchString is exactly string-equal for every ramp rung', () => {
    for (const hex of HEXES) {
      expect(tsHexToOklchString(hex), hex).toBe(jsHexToOklchString(hex))
    }
  })

  it('formatOklch is exactly string-equal for every ramp rung', () => {
    for (const hex of HEXES) {
      expect(tsFormatOklch(tsHexToOklch(hex)), hex).toBe(jsFormatOklch(jsHexToOklch(hex)))
    }
  })
})

describe('OKLCH twin parity: OKLCH sweep (#286)', () => {
  const Ls = [0, 0.25, 0.5, 0.75, 1]
  const Cs = [0, 0.1, 0.2]
  const Hs = [0, 90, 180, 270]

  it('oklchToHex is exactly string-equal across the L×C×H sweep', () => {
    for (const L of Ls) {
      for (const C of Cs) {
        for (const H of Hs) {
          const label = `L=${L} C=${C} H=${H}`
          expect(tsOklchToHex(L, C, H), label).toBe(jsOklchToHex(L, C, H))
        }
      }
    }
  })

  it('formatOklch is exactly string-equal across the L×C×H sweep', () => {
    for (const L of Ls) {
      for (const C of Cs) {
        for (const H of Hs) {
          const triple = { L, C, H }
          const label = `L=${L} C=${C} H=${H}`
          expect(tsFormatOklch(triple), label).toBe(jsFormatOklch(triple))
        }
      }
    }
  })
})

describe('OKLCH twin parity: OKLab mixing (#286)', () => {
  const pairs: Array<[string, string]> = [
    ['#2BA3D4', '#FFFFFF'],
    ['#136080', '#000000'],
  ]

  it('mixOklab agrees within 1e-12 on representative pairs', () => {
    for (const [a, b] of pairs) {
      const tsA = tsOklabFromHex(a)
      const tsB = tsOklabFromHex(b)
      const jsA = jsOklabFromHex(a)
      const jsB = jsOklabFromHex(b)
      for (const p of [10, 50, 90]) {
        const ts = tsMixOklab(tsA, tsB, p)
        const js = jsMixOklab(jsA, jsB, p)
        const label = `${a}+${b}@${p}%`
        expect(Math.abs(ts.L - js.L), label).toBeLessThan(NEAR)
        expect(Math.abs(ts.a - js.a), label).toBeLessThan(NEAR)
        expect(Math.abs(ts.b - js.b), label).toBeLessThan(NEAR)
      }
    }
  })

  it('oklabDeltaE agrees within 1e-12 on representative pairs', () => {
    for (const [a, b] of pairs) {
      const ts = tsOklabDeltaE(tsOklabFromHex(a), tsOklabFromHex(b))
      const js = jsOklabDeltaE(jsOklabFromHex(a), jsOklabFromHex(b))
      expect(Math.abs(ts - js), `${a}/${b}`).toBeLessThan(NEAR)
    }
  })
})
