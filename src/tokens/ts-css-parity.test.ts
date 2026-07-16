// @vitest-environment node

/**
 * Sprint 63 / #453 — TS ↔ CSS token parity guard (the keystone).
 *
 * `src/styles/tokens.css` is the shipped, tested source of truth for the web
 * (see `src/styles/tokens.test.ts`). The platform-agnostic TS primitives in
 * `src/tokens/*.ts` are what non-web consumers (React Native, theme tooling)
 * read. Historically the TS files silently drifted from the CSS — the
 * pre-v0.4.1 z-index ordering and the ease-in-out `easing.wave` both lived on
 * in TS long after the CSS was corrected (#35/#46, #65). This guard makes that
 * drift a red test.
 *
 * ── Direction ────────────────────────────────────────────────────────────────
 * ONE-DIRECTIONAL: for each covered TS-primitive family we iterate the TS keys
 * and assert the corresponding `--<family>-<key>` in `tokens.css` composes to
 * the same value. We deliberately do NOT require every CSS `--<family>-*` var
 * to have a TS source. The CSS surface is a superset — it carries legacy
 * aliases (`--font-weight-regular`, `--border-radius-sm`), Tailwind-compat
 * spacing rungs (`--spacing-3/5/6/10`), and (added by a sibling lane) the
 * `--component-padding-*` aliases. Iterating TS→CSS keeps this guard immune to
 * those additive CSS-only surfaces: a new CSS var with no TS twin can't break
 * it, and a new TS export only matters once it's added to a covered family's
 * key set below.
 *
 * ── Covered families (TS primitive → CSS `--<family>-<key>`) ─────────────────
 *   • spacing        spacing (named rungs)     → --spacing-<key>        [px↔rem]
 *   • radius         radius                    → --radius-<key>         [px↔rem]
 *   • duration       animation.duration        → --duration-<key>       [ms]
 *   • easing         animation.easing          → --easing-<key*>        [cubic-bezier/keyword]
 *   • zIndex         zIndex (CSS-backed keys)  → --z-index-<key>        [unitless]
 *   • fontWeight     typography.fontWeight     → --font-weight-<key>    [unitless]
 *   • lineHeight     typography.lineHeight     → --line-height-<key>    [unitless]
 *   • letterSpacing  typography.letterSpacing  → --letter-spacing-<key> [em]
 *   • borderWidth    borderWidth               → --border-width-<key>   [px]
 *   • sizing         popoverSize               → --size-popover-<key>   [px]
 *
 *   (* easing keys are camelCase in TS and kebab in CSS — see EASING_KEY_MAP.)
 *
 * ── Deliberately EXCLUDED (documented, so the guard is honest about scope) ────
 *   • font-size — TS ships integer px (`'2xl': 25`) but CSS ships rem values
 *     that were rounded independently: `--font-size-2xl: 1.563rem` = 25.008px,
 *     NOT 25px. A strict value comparison is BRITTLE (would flag a rounding
 *     artifact, not real drift), and loosening the epsilon enough to pass would
 *     make it vacuous. Excluded on purpose. TODO(#453-followup): reconcile the
 *     rem ladder to exact `n/16` values (or store TS as the sub-px reals) and
 *     fold font-size back into strict parity.
 *   • editorial typography (--font-size-editorial-*, --line-height-editorial-*)
 *     — literal-only serif divergence (Sprint 15 / #94); no TS primitive twin.
 *   • color / semantic / surface / contextual aliases — derived via OKLCH +
 *     color-mix in CSS; parity is covered by the OKLCH/contrast test suite.
 *   • transitions / motion (--transition-*, --motion-*) — composed CSS shorthand
 *     strings, not primitives; their inputs (duration/easing) ARE covered here.
 *   • breakpoints — TS-only (`breakpoints.px` in ./breakpoints). There is NO
 *     `--breakpoint-*` CSS mirror to compare against: custom properties are
 *     illegal inside `@media` by spec, so the dead CSS vars were removed (#454).
 *     Drift for breakpoints is guarded separately by ./breakpoints.test.ts.
 *   • --component-padding-* — sibling-lane aliases of --spacing-*; owned there.
 *   • --z-* short aliases (--z-header/--z-toast/…) and componentZIndex — derived
 *     from the --z-index-* primitives that this guard already pins.
 *
 * If either half regresses on a covered family, this test fails naming the
 * family + key — that's the parity guarantee.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { spacing } from './spacing'
import { radius } from './radius'
import { typography } from './typography'
import { animation, type EasingBezier } from './animation'
import { zIndex } from './zIndex'
import { borderWidth } from './border'
import { popoverSize } from './sizing'

import {
  composeSpacing,
  composeRadius,
  composeDuration,
  composeEasing,
  composeLetterSpacing,
} from '../utils/tokens-web'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = readFileSync(resolve(HERE, '../styles/tokens.css'), 'utf8')

/**
 * Read a single `--name: value;` declaration's raw value from tokens.css.
 * Returns the trimmed value (everything up to the first `;`, so trailing inline
 * comments are excluded), or `undefined` if the var isn't declared. We look up
 * exact var names (never a wildcard), so alias vars that share a prefix but map
 * to `var(...)` — e.g. `--font-weight-regular` — are never matched here.
 */
function readDecl(name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`--${escaped}\\s*:\\s*([^;]+);`)
  const match = re.exec(TOKENS_CSS)
  return match ? match[1]!.trim() : undefined // safe: regex has 1 capture group → present when match is non-null
}

/** `"0.375rem"` → 6, `"280px"` → 280, `"0"` → 0. Length values → px number. */
function cssLengthToPx(raw: string): number {
  const trimmed = raw.trim()
  if (trimmed === '0') return 0
  const rem = /^(-?[\d.]+)rem$/.exec(trimmed)
  if (rem) return parseFloat(rem[1]!) * 16 // safe: capture group 1 present when rem matched
  const px = /^(-?[\d.]+)px$/.exec(trimmed)
  if (px) return parseFloat(px[1]!) // safe: capture group 1 present when px matched
  return NaN
}

/**
 * Covered TS primitive families. Each descriptor knows how to turn its TS value
 * into the thing we compare against the CSS declaration, and which comparison
 * mode to use. `cssKey` maps a TS key to the CSS var suffix (identity unless a
 * family renames keys — only `easing` does).
 */
type FamilyMode = 'string' | 'lengthPx'

interface FamilySpec {
  /** Human label + covered-list documentation. */
  name: string
  /** CSS var family prefix, e.g. `spacing` → `--spacing-<key>`. */
  cssPrefix: string
  /** The TS primitive record for this family. */
  values: Record<string, unknown>
  /** TS key → composed comparable value (string form of the TS value). */
  compose: (tsValue: unknown) => string
  /** TS key → CSS var suffix. Identity for every family except easing. */
  cssKey?: (tsKey: string) => string
  /** How to compare TS vs CSS. */
  mode: FamilyMode
  /**
   * Keys to skip for this family (TS keys with NO CSS `--<prefix>-<key>` twin,
   * by design). Keeps the guard one-directional without going vacuous.
   */
  skipKeys?: readonly string[]
}

/** easing: camelCase TS keys → kebab CSS suffixes (`easeIn` → `ease-in`). */
const EASING_KEY_MAP: Record<string, string> = {
  linear: 'linear',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  wave: 'wave',
  surge: 'surge',
  ripple: 'ripple',
  tide: 'tide',
  bounce: 'bounce',
  elastic: 'elastic',
}

const FAMILIES: readonly FamilySpec[] = [
  {
    name: 'spacing (named rungs)',
    cssPrefix: 'spacing',
    // Only the semantic/named rungs — the numeric `spacing.px` map overlaps the
    // Tailwind-compat `--spacing-3/5/6/10` aliases which intentionally DON'T
    // share the px-key meaning, so we pin the named ladder (none/2xs/xs/…/7xl).
    values: {
      none: spacing.none,
      '2xs': spacing['2xs'],
      '2xs-dense': spacing['2xs-dense'],
      xs: spacing.xs,
      sm: spacing.sm,
      md: spacing.md,
      lg: spacing.lg,
      xl: spacing.xl,
      '2xl': spacing['2xl'],
      '3xl': spacing['3xl'],
      '4xl': spacing['4xl'],
      '5xl': spacing['5xl'],
      '6xl': spacing['6xl'],
      '7xl': spacing['7xl'],
    },
    compose: (v) => composeSpacing(v as number),
    mode: 'lengthPx',
  },
  {
    name: 'radius',
    cssPrefix: 'radius',
    values: { ...radius },
    compose: (v) => composeRadius(v as number),
    mode: 'lengthPx',
  },
  {
    name: 'duration',
    cssPrefix: 'duration',
    values: { ...animation.duration },
    compose: (v) => composeDuration(v as number),
    mode: 'string',
  },
  {
    name: 'easing',
    cssPrefix: 'easing',
    values: { ...animation.easing },
    compose: (v) => composeEasing(v as EasingBezier | 'linear'),
    cssKey: (k) => {
      // Keep the `=> string` contract by throwing on a missing entry: every covered
      // easing key has a kebab twin in EASING_KEY_MAP, so a gap is a real test-setup
      // bug that should fail loudly — never cast the undefined past.
      const mapped = EASING_KEY_MAP[k]
      if (mapped === undefined) throw new Error(`EASING_KEY_MAP has no entry for easing key "${k}"`)
      return mapped
    },
    mode: 'string',
  },
  {
    name: 'zIndex',
    cssPrefix: 'z-index',
    values: { ...zIndex },
    compose: (v) => String(v),
    mode: 'string',
    // `debug` / `maximum` are TS-only escape hatches with no --z-index-* twin.
    skipKeys: ['debug', 'maximum'],
  },
  {
    name: 'fontWeight',
    cssPrefix: 'font-weight',
    values: { ...typography.fontWeight },
    compose: (v) => String(v),
    mode: 'string',
  },
  {
    name: 'lineHeight',
    cssPrefix: 'line-height',
    values: { ...typography.lineHeight },
    compose: (v) => String(v),
    mode: 'string',
  },
  {
    name: 'letterSpacing',
    cssPrefix: 'letter-spacing',
    values: { ...typography.letterSpacing },
    compose: (v) => composeLetterSpacing(v as number),
    mode: 'string',
  },
  {
    name: 'borderWidth',
    cssPrefix: 'border-width',
    values: { ...borderWidth },
    compose: (v) => composeSpacing(v as number),
    // px length: CSS ships `--border-width-0: 0` (bare zero) vs TS `0px`, both
    // of which are the same length — compare numerically in px, not as strings.
    mode: 'lengthPx',
  },
  {
    name: 'sizing (popover)',
    cssPrefix: 'size-popover',
    // popoverSize is camelCase in TS; CSS ships kebab (`--size-popover-min-width`).
    values: {
      'min-width': popoverSize.minWidth,
      'max-width': popoverSize.maxWidth,
      'max-height': popoverSize.maxHeight,
    },
    compose: (v) => composeSpacing(v as number),
    mode: 'lengthPx',
  },
] as const

describe('Sprint 63 / #453 — TS ↔ CSS token parity (one-directional TS→CSS)', () => {
  for (const fam of FAMILIES) {
    describe(fam.name, () => {
      const skip = new Set(fam.skipKeys ?? [])
      for (const tsKey of Object.keys(fam.values)) {
        if (skip.has(tsKey)) continue
        const cssSuffix = fam.cssKey ? fam.cssKey(tsKey) : tsKey
        it(`--${fam.cssPrefix}-${cssSuffix} matches TS ${fam.name} "${tsKey}"`, () => {
          const cssRaw = readDecl(`${fam.cssPrefix}-${cssSuffix}`)
          // The CSS var MUST exist for a covered TS key — a missing declaration
          // is itself drift (TS grew a rung the stylesheet never shipped).
          expect(
            cssRaw,
            `tokens.css is missing --${fam.cssPrefix}-${cssSuffix} (TS ${fam.name}.${tsKey})`,
          ).toBeDefined()

          const tsComposed = fam.compose(fam.values[tsKey])

          if (fam.mode === 'string') {
            expect(cssRaw).toBe(tsComposed)
          } else {
            // lengthPx: compare numerically in px so px↔rem is reconciled.
            // spacing/radius rems convert to exact integers (verified), so an
            // exact numeric equality both passes cleanly AND bites on drift.
            const cssPx = cssLengthToPx(cssRaw as string)
            const tsPx = cssLengthToPx(tsComposed)
            expect(
              Number.isNaN(cssPx),
              `unparseable CSS length "${cssRaw}" for --${fam.cssPrefix}-${cssSuffix}`,
            ).toBe(false)
            expect(cssPx).toBe(tsPx)
          }
        })
      }
    })
  }
})

/**
 * Meta-guards: keep the covered set honest and pin the two specific historical
 * drifts this sprint fixed (#452a z-index ordering, #452b easing.wave), so a
 * future well-meaning "revert" can't slip past unnoticed.
 */
describe('Sprint 63 / #453 — parity meta-guards', () => {
  it('z-index primitives keep the v0.4.1 nested-overlay ordering (#35/#46)', () => {
    // The whole point of #452a: floating overlays sit ABOVE modal/drawer.
    expect(zIndex.dropdown).toBeGreaterThan(zIndex.modal)
    expect(zIndex.popover).toBeGreaterThan(zIndex.dropdown)
    expect(zIndex.tooltip).toBeGreaterThan(zIndex.popover)
    expect(zIndex.notification).toBeGreaterThan(zIndex.tooltip)
    expect(zIndex.modal).toBe(zIndex.drawer)
    // …and those exact numbers match the CSS source of truth.
    expect(String(zIndex.modal)).toBe(readDecl('z-index-modal'))
    expect(String(zIndex.dropdown)).toBe(readDecl('z-index-dropdown'))
  })

  it('easing.wave is ease-out (#65), matching --easing-wave', () => {
    expect(composeEasing(animation.easing.wave)).toBe(readDecl('easing-wave'))
    expect(animation.easing.wave).toEqual([0, 0, 0.2, 1])
  })

  it('font-size is intentionally excluded (documented px↔rem rounding drift)', () => {
    // Guards the EXCLUSION rationale: TS px and CSS rem genuinely disagree here,
    // so if someone "fixes" this by adding font-size to FAMILIES it should be a
    // deliberate reconcile, not a copy-paste. 25 (TS) ≠ 25.008 (CSS 1.563rem).
    expect(typography.fontSize['2xl']).toBe(25)
    expect(cssLengthToPx(readDecl('font-size-2xl') as string)).toBeCloseTo(25.008, 3)
    expect(FAMILIES.some((f) => f.cssPrefix === 'font-size')).toBe(false)
  })
})
