// @vitest-environment node

/**
 * Tree-shakeable-per-component guard (#427 — Tier-1 claims enforcement).
 *
 * THE CLAIM
 * ---------
 * `CLAUDE.md:29`: "Tree-shakeable for optimal bundle sizes."
 * Narrowed to its enforceable form (claims-triage-2026-07.md, row CLAUDE.md:29):
 * "The library build uses `preserveModules` so unused modules tree-shake." and
 * `reference/rsc-boundary-matrix.md:157-165` (v0.22.0 #276): each component is a
 * SEPARATE emitted module reachable by deep import, so importing one component
 * does not drag the rest of the library into the consumer's bundle.
 *
 * A full bundler round-trip is heavy; this is the pragmatic, CI-fast proxy that
 * proves the SAME guarantee against the real build artifact:
 *
 *   1. `package.json#sideEffects` is CSS-ONLY (`["**\/*.css"]`). This is the
 *      switch that lets a bundler drop an unused component module; if any JS
 *      were marked side-effectful, tree-shaking would be defeated wholesale.
 *   2. `preserveModules` emitted a SEPARATE per-component entry
 *      (`dist/components/<Dir>/<Dir>.js`) for every barrel component — the unit
 *      of tree-shaking. (A single concatenated bundle would have none of these.)
 *   3. NO deep component entry imports the top-level barrel
 *      (`dist/index.js` / `dist/components.js`). If a leaf re-imported the
 *      barrel, deep-importing it would transitively pull the WHOLE surface —
 *      the exact bug this claim rules out.
 *   4. recharts isolation (the load-bearing witness): the 6 Recharts-based chart
 *      entries import `recharts` in their emitted JS, and representative
 *      non-chart components do NOT. So importing, say, `<Badge>` never pulls the
 *      heaviest dependency in the tree — a concrete "one component doesn't drag
 *      in others" proof with real teeth, plus its own built-in inversion.
 *
 * Self-contained: CI runs `npm test` BEFORE `npm run build`, so the dist
 * artifact may be absent. We build on-demand in `beforeAll` when it's missing
 * (mirrors css-layers.test.ts), then read the emitted files.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const DIST = resolve(REPO_ROOT, 'dist')
const DIST_COMPONENTS = resolve(DIST, 'components')
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8'))

/** Recharts-BASED charts (FunnelChart + Sparkline hand-roll SVG, so excluded). */
const RECHARTS_CHART_DIRS = ['Chart', 'AreaChart', 'BarChart', 'LineChart', 'DonutChart', 'PieChart']

/** Representative components that must NOT pull recharts when deep-imported. */
const RECHARTS_FREE_SAMPLE = ['Badge', 'Button', 'Card', 'Alert', 'Input', 'Stack']

/** Distinct `./Dir` targets referenced by the components barrel. */
function barrelDirs(): string[] {
  const src = readFileSync(resolve(REPO_ROOT, 'src/components/index.ts'), 'utf-8')
  const set = new Set<string>()
  for (const m of src.matchAll(/from '\.\/([A-Za-z0-9]+)'/g)) set.add(m[1]!)
  return [...set].sort()
}

/** ESM import specifiers in an emitted dist file. */
function importSpecifiers(file: string): string[] {
  const src = readFileSync(file, 'utf-8')
  return [...src.matchAll(/(?:import|export)[^'"]*from\s*["']([^"']+)["']/g)].map((m) => m[1]!)
}

/** Deep entry path for a component dir, or null if not emitted. */
function deepEntry(dir: string): string | null {
  const f = join(DIST_COMPONENTS, dir, `${dir}.js`)
  return existsSync(f) ? f : null
}

beforeAll(() => {
  if (!existsSync(join(DIST, 'index.js')) || !existsSync(DIST_COMPONENTS)) {
    execSync('npm run build', { cwd: REPO_ROOT, stdio: 'inherit' })
  }
}, 180_000)

describe('tree-shakeable per-component (#427 · CLAUDE.md:29)', () => {
  it('package.json#sideEffects is CSS-only (enables dropping unused modules)', () => {
    // The single most important tree-shaking switch. If a *.js glob crept in
    // here, bundlers would conservatively keep every imported module.
    expect(
      PKG.sideEffects,
      `\npackage.json#sideEffects must be exactly ["**/*.css"] so bundlers can ` +
        `drop unused component modules. Marking JS as side-effectful defeats ` +
        `the "Tree-shakeable" claim (CLAUDE.md:29).\n`,
    ).toEqual(['**/*.css'])
  })

  it('emitted a separate per-component entry for every barrel component (preserveModules)', () => {
    const dirs = barrelDirs()
    expect(dirs.length).toBeGreaterThan(80)
    const missing = dirs.filter((d) => deepEntry(d) === null)
    expect(
      missing,
      `\nThese barrel components have no per-module dist entry ` +
        `(dist/components/<Dir>/<Dir>.js) — preserveModules is off or the deep ` +
        `import path (rsc-boundary-matrix.md:157-165) is broken:\n  ${missing.join(', ')}\n`,
    ).toEqual([])
  })

  it('no deep component entry re-imports the top-level barrel', () => {
    // If a leaf imported ../index.js / ../../index.js / components.js, deep-
    // importing that leaf would drag the whole library in — the tree-shake
    // killer this claim forbids.
    const BARREL_RE = /(?:^|\/)(?:index|components)\.js$/
    const offenders: string[] = []
    for (const dir of readdirSync(DIST_COMPONENTS)) {
      const entry = deepEntry(dir)
      if (!entry) continue
      const barrelImports = importSpecifiers(entry).filter(
        (s) => s.startsWith('..') && BARREL_RE.test(s),
      )
      if (barrelImports.length) offenders.push(`  ${dir}: imports ${barrelImports.join(', ')}`)
    }
    expect(
      offenders,
      `\nDeep component entries that pull the barrel (defeats per-component ` +
        `tree-shaking, CLAUDE.md:29):\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })

  it('recharts is isolated to the Recharts-based chart entries (load-bearing witness)', () => {
    const importsRecharts = (dir: string): boolean => {
      const entry = deepEntry(dir)
      if (!entry) throw new Error(`missing dist entry for ${dir}`)
      return importSpecifiers(entry).some((s) => s === 'recharts' || s.startsWith('recharts/'))
    }

    // Every recharts-based chart DOES pull recharts (proves the detector can
    // see cross-module deps → the negative half below is non-vacuous).
    const chartsMissingRecharts = RECHARTS_CHART_DIRS.filter((d) => !importsRecharts(d))
    expect(
      chartsMissingRecharts,
      `\nExpected these chart entries to import recharts but they don't — the ` +
        `isolation witness is broken:\n  ${chartsMissingRecharts.join(', ')}\n`,
    ).toEqual([])

    // …and non-chart components do NOT — so importing them never drags the
    // heaviest dependency into a consumer bundle.
    const leaksRecharts = RECHARTS_FREE_SAMPLE.filter((d) => importsRecharts(d))
    expect(
      leaksRecharts,
      `\nThese non-chart components pull recharts when deep-imported — that ` +
        `breaks the "importing one component doesn't drag in others" guarantee ` +
        `(CLAUDE.md:29):\n  ${leaksRecharts.join(', ')}\n`,
    ).toEqual([])
  })
})
