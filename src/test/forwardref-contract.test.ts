// @vitest-environment node

/**
 * forwardRef contract guard (#427 — Tier-1 claims enforcement).
 *
 * THE CLAIM
 * ---------
 * `reference/component-authoring.md:15-16` (Rule 1):
 *
 *   "**Every component uses `React.forwardRef`** — no `React.FC`, no bare
 *    function components for anything with a ref-able root DOM element."
 *
 * A forwarded ref is Layer-3 of the DS customizability contract (a consumer
 * must be able to reach the underlying DOM node — focus it, measure it, attach
 * a library like Floating-UI / react-aria to it). A component that silently
 * drops its ref is a hole in that promise.
 *
 * WHAT THIS LOCKS
 * ---------------
 * It scans the ROOT source file of every component directory
 * (`src/components/<Dir>/<Dir>.tsx`) and asserts the file uses `forwardRef`,
 * UNLESS the directory is in the justified ALLOWLIST below.
 *
 *   - A brand-new component that forgets `forwardRef` → fails (its dir isn't
 *     allowlisted, and its root file has no `forwardRef`).
 *   - An allowlisted component that LATER adopts `forwardRef` → also fails
 *     (the "allowlist is stale" guard), forcing the entry to be pruned so the
 *     allowlist can never rot into a silent blanket exemption.
 *
 * `component-authoring.md` explicitly documents Template 5 (Portal) as the one
 * sanctioned no-ref shape (root is not a DOM element the component owns). The
 * other allowlisted entries are Recharts wrappers (root is a Recharts
 * `ResponsiveContainer` / the composite `<Chart>`, not a DS-owned DOM node),
 * generic `<T>` components (`forwardRef` erases the type parameter — the
 * documented limitation in Template 2), and composite wrappers (root is another
 * DS component that itself forwards a ref).
 *
 * Detection is a file-level scan (house style — mirrors css-layers /
 * no-raw-brand-color): a root file "uses forwardRef" if the token `forwardRef`
 * appears in it. The ground-truth set of non-forwardRef roots today is exactly
 * the 14 allowlisted dirs, so the scan is precise for the current tree.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const COMPONENTS_DIR = resolve(REPO_ROOT, 'src/components')

/**
 * Component directories whose ROOT export legitimately does NOT use
 * `forwardRef`. Each entry carries a one-line justification (mirrors the
 * container-query sweep's allowlist style). Two buckets:
 *
 *   LEGIT  — a sanctioned no-ref shape (documented Template 5 / Recharts SVG
 *            wrapper / generic-erasure / composite-over-another-DS-component).
 *   FIXME  — a genuine gap: the component owns a ref-able DOM root and SHOULD
 *            forward per component-authoring.md:15 but doesn't. Allowlisted so
 *            the guard passes today; tagged `FIXME(#427)` for a follow-up.
 */
const ALLOWLIST: Record<string, string> = {
  // --- LEGIT: chart sub-types. Root is the composite `<Chart>` (a DS component,
  //     not a raw DOM node); a consumer ref flows through `<Chart>` once Chart
  //     forwards it — tracked with Chart itself in #516.
  AreaChart: 'chart sub-type — root is the composite `<Chart>`; ref flows through Chart (see the Chart FIXME below + #516)',
  BarChart: 'chart sub-type — root is the composite `<Chart>`; ref flows through Chart (see the Chart FIXME below + #516)',
  LineChart: 'chart sub-type — root is the composite `<Chart>`; ref flows through Chart (see the Chart FIXME below + #516)',
  DonutChart: 'chart sub-type — root is the composite `<Chart>`; ref flows through Chart (see the Chart FIXME below + #516)',
  PieChart: 'chart sub-type — root is the composite `<Chart>`; ref flows through Chart (see the Chart FIXME below + #516)',

  // --- LEGIT: no DS-owned DOM root / composite over another DS component.
  Portal: 'component-authoring.md Template 5 — `createPortal` renders elsewhere; no ref-able root DOM node (see Portal.tsx JSDoc)',
  CommandPalette: 'composite over `<Modal>` — Modal owns the dialog DOM + focus; CommandPalette has no own DOM root to ref',
  Field: 'form-field wrapper — path-dependent root: on the bare path owns a label/error <div>; no CONSUMER ref is forwarded (its internal mergedRef is <Form>-focus plumbing). Soft gap; revisit with #516',

  // --- LEGIT: generic `<T>` components. `React.forwardRef` cannot preserve a
  //     generic type parameter through its return type (the documented
  //     TS/React limitation, component-authoring.md Template 2). Ref-forwarding
  //     could be re-added later via the same `as PolymorphicX` cast Text uses.
  Select: 'generic `<T>` component — forwardRef erases the type parameter (component-authoring.md Template 2 limitation); manages internal focus refs',
  Table: 'generic `<T extends object>` — forwardRef erases the type parameter (component-authoring.md Template 2 limitation)',
  DataTable: 'generic `<T extends object>` + `DataTable.Static` namespace — forwardRef erases `<T>` and complicates the attached-namespace shape',

  // --- FIXME(#427): genuine gaps — owns a ref-able DOM root but drops the ref.
  // (ThemeScope fixed in v0.50.0 — now forwards its ref; removed from allowlist.)
  Chart:
    'FIXME(#427/#516): owns DS `.sizer` + `.chartContainer` <div>s (already spreads {...rest} onto .chartContainer, Chart.tsx:150-158) — should forward a ref there. Deferred: two return paths + the container-query host need care (see #516)',
  MarkdownEditor:
    'FIXME(#427): should forward ref — uses `React.FC` (banned by component-authoring.md:15) and owns a wrapping `<div>`; thin wrapper around @uiw/react-md-editor, off the main barrel',
}

/**
 * A component "uses forwardRef" if the token appears in its root source with
 * comments stripped — so a `forwardRef` mentioned only in a comment doesn't read
 * as compliant (and can't rot the stale-allowlist guard). Mirrors the
 * comment-stripping the override-contract sweep already does.
 */
function usesForwardRef(source: string): boolean {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/\/\/[^\n]*/g, '') // line comments
  return /\bforwardRef\b/.test(code)
}

/** Directories under src/components that publish a component (have a barrel). */
function componentDirs(): string[] {
  return readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(COMPONENTS_DIR, name, 'index.ts')))
    .sort()
}

/** The conventional root source file for a component dir: `<Dir>/<Dir>.tsx`. */
function rootFileOf(dir: string): string | null {
  const f = join(COMPONENTS_DIR, dir, `${dir}.tsx`)
  return existsSync(f) && statSync(f).isFile() ? f : null
}

describe('forwardRef contract (#427 · reference/component-authoring.md:15-16)', () => {
  const dirs = componentDirs()

  it('finds the component directories (sanity)', () => {
    expect(dirs.length).toBeGreaterThan(80)
  })

  it('every component dir has a conventional `<Dir>/<Dir>.tsx` root file', () => {
    const missing = dirs.filter((d) => rootFileOf(d) === null)
    expect(
      missing,
      `\nThese component dirs have no <Dir>/<Dir>.tsx root file, so the ` +
        `forwardRef scan can't classify them — adjust rootFileOf() if a new ` +
        `naming convention was introduced:\n  ${missing.join(', ')}\n`,
    ).toEqual([])
  })

  it('every component root uses React.forwardRef, else is justified in the allowlist', () => {
    const offenders: string[] = []
    for (const dir of dirs) {
      const root = rootFileOf(dir)
      if (!root) continue
      if (usesForwardRef(readFileSync(root, 'utf-8'))) continue
      if (dir in ALLOWLIST) continue
      offenders.push(
        `  ${dir} (${dir}.tsx): root export does not use React.forwardRef and ` +
          `is not allowlisted. Either wrap it in React.forwardRef (see ` +
          `reference/component-authoring.md Template 1) or add a justified ` +
          `entry to ALLOWLIST in src/test/forwardref-contract.test.ts.`,
      )
    }
    expect(
      offenders,
      `\nComponents violating the "every component uses React.forwardRef" ` +
        `contract (reference/component-authoring.md:15-16):\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })

  it('allowlist is not stale — every allowlisted component STILL lacks forwardRef', () => {
    // Self-pruning guard: if an allowlisted component is fixed to use
    // forwardRef, its entry must be removed so the allowlist can't decay into a
    // permanent blanket exemption that hides a future regression.
    const nowCompliant: string[] = []
    for (const dir of Object.keys(ALLOWLIST)) {
      const root = rootFileOf(dir)
      if (root && usesForwardRef(readFileSync(root, 'utf-8'))) nowCompliant.push(dir)
    }
    expect(
      nowCompliant,
      `\nThese components are allowlisted as non-forwardRef but now USE ` +
        `forwardRef — delete their ALLOWLIST entries in ` +
        `src/test/forwardref-contract.test.ts:\n  ${nowCompliant.join(', ')}\n`,
    ).toEqual([])
  })

  it('detector is non-vacuous — flips between forwardRef and plain sources', () => {
    // Inverted/expected-fail demonstration: prove the check would CATCH a
    // regression rather than passing vacuously.
    expect(usesForwardRef(`export const X = React.forwardRef((p, ref) => null)`)).toBe(true)
    expect(usesForwardRef(`export function X(props) { return null }`)).toBe(false)
    // And a real known-compliant component is detected as compliant.
    const button = rootFileOf('Button')
    expect(button && usesForwardRef(readFileSync(button, 'utf-8'))).toBe(true)
  })
})
