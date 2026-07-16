/**
 * Override-contract guard (#427 — Tier-1 claims enforcement).
 *
 * THE CLAIM
 * ---------
 * The DS customizability promise (CLAUDE.md "Component Features": "CSS Modules
 * wired to design tokens" + `className`/`style` passthrough; memory
 * "full-customizability"; #427 acceptance criteria "7-layer override contract"):
 *
 *   - Layer 3a/c — "Every component's props extend `HTMLAttributes<E>` for the
 *     appropriate `E`", so `className`, `style`, `data-*`, `aria-*`, and event
 *     handlers all flow through to the DOM.
 *   - Layer 3 spot-check — "`data-testid` lands on the visual root for every
 *     component."
 *
 * WHAT THIS LOCKS
 * ---------------
 * Two complementary halves — a type-level scan and a runtime render:
 *
 *   (a) TYPE SCAN — every component's root source references an `HTMLAttributes`
 *       variant (or `ComponentPropsWith[out]Ref`), else it's in a justified
 *       ALLOWLIST. This is the static half of the passthrough promise.
 *
 *   (b) RUNTIME RENDER — a representative SAMPLE of components is rendered with
 *       `data-testid="probe"`; the probe must land on the rendered VISUAL ROOT
 *       (extending the type in (a) is necessary but not sufficient — the
 *       component must also spread the rest props onto its root at runtime).
 *
 * Failure messages point back at #427 (Layer 3) and
 * reference/component-authoring.md (Template 1: "`className` is merged, not
 * replaced"; ref applied to the "outermost ref-able DOM node").
 *
 * Runs in the default jsdom env (this file renders components).
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

import { Badge } from '../components/Badge'
import { Alert } from '../components/Alert'
import { Container } from '../components/Container'
import { Stack } from '../components/Stack'
import { Box } from '../components/Box'
import { Divider } from '../components/Divider'
import { StatusDot } from '../components/StatusDot'
import { Kbd } from '../components/Kbd'
import { Chip } from '../components/Chip'
import { Center } from '../components/Center'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const COMPONENTS_DIR = resolve(REPO_ROOT, 'src/components')

/* -------------------------------------------------------------------------- *
 *  (a) Type scan — props extend an HTMLAttributes variant
 * -------------------------------------------------------------------------- */

/**
 * Component dirs whose root source does NOT directly reference an
 * `HTMLAttributes` variant. Each carries a one-line justification:
 *
 *   LEGIT  — compliant transitively, or HTMLAttributes doesn't apply (no host
 *            DOM element / internal surface not composed by consumers).
 *   FIXME  — a genuine gap: owns a DOM root but exposes only `className`, no
 *            full HTMLAttributes passthrough. Allowlisted so the guard passes
 *            today; tagged `FIXME(#427)` for a follow-up.
 */
const HTMLATTRS_ALLOWLIST: Record<string, string> = {
  // LEGIT — sub-charts extend `BaseChartProps & ChartConfigProps`, and
  // BaseChartProps extends `React.HTMLAttributes<HTMLDivElement>`
  // (Chart/types.ts:53) — so className/style/data-* flow through transitively.
  Chart: 'props are BaseChartProps → extends React.HTMLAttributes<HTMLDivElement> (Chart/types.ts:53)',
  AreaChart: 'props extend BaseChartProps & ChartConfigProps → HTMLAttributes<HTMLDivElement> (transitive)',
  BarChart: 'props extend BaseChartProps & ChartConfigProps → HTMLAttributes<HTMLDivElement> (transitive)',
  LineChart: 'props extend BaseChartProps & ChartConfigProps → HTMLAttributes<HTMLDivElement> (transitive)',
  DonutChart: 'props extend BaseChartProps & ChartConfigProps → HTMLAttributes<HTMLDivElement> (transitive)',
  PieChart: 'props extend BaseChartProps & ChartConfigProps → HTMLAttributes<HTMLDivElement> (transitive)',
  FunnelChart:
    'props extend BaseChartProps & ChartConfigProps → HTMLAttributes<HTMLDivElement> (transitive); hand-rolled SVG funnel, only HTMLAttributes mention is a comment',

  // LEGIT — HTMLAttributes<E> does not apply.
  Portal: 'no host DOM element — `createPortal` renders children directly (component-authoring.md Template 5)',
  Toast: 'internal surface rendered by ToastProvider/ToastContainer, not a consumer-composed DOM wrapper; bespoke props',

  // FIXME(#427) — owns a DOM root but exposes only `className`, no data-*/style
  // passthrough. Should extend the matching HTMLAttributes variant.
  FileInput:
    'FIXME(#427): should extend HTMLAttributes<HTMLDivElement> — owns a dropzone <div> but exposes only `className`, no data-*/style passthrough',
  // (Skeleton fixed in v0.50.0 — now extends HTMLAttributes<HTMLSpanElement>; removed from allowlist.)
  MarkdownEditor:
    'FIXME(#427): bespoke props (also uses React.FC) — off-barrel wrapper around @uiw/react-md-editor; see forwardref-contract allowlist',
}

// Matches any `*HTMLAttributes` variant (HTMLAttributes, ButtonHTMLAttributes,
// InputHTMLAttributes, DialogHTMLAttributes, …) plus ComponentPropsWith[out]Ref
// / HTMLProps. NO leading word boundary — the element-specific variants have no
// boundary before "HTMLAttributes" (e.g. `ButtonHTMLAttributes`).
const HTMLATTRS_RE = /HTMLAttributes|ComponentPropsWith(?:out)?Ref|HTMLProps/

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function componentDirs(): string[] {
  return readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(COMPONENTS_DIR, name, 'index.ts')))
    .sort()
}

function rootFileOf(dir: string): string | null {
  const f = join(COMPONENTS_DIR, dir, `${dir}.tsx`)
  return existsSync(f) && statSync(f).isFile() ? f : null
}

/* -------------------------------------------------------------------------- *
 *  (b) Render sample — data-testid lands on the visual root
 * -------------------------------------------------------------------------- */

// Only components verified to (1) extend HTMLAttributes and (2) spread the rest
// props onto a single visual root are sampled here. The point is to prove the
// RUNTIME passthrough, so the sample must actually forward.
const RENDER_SAMPLE: Array<readonly [string, React.ReactElement]> = [
  ['Badge', <Badge data-testid="probe">x</Badge>],
  ['Alert', <Alert data-testid="probe">x</Alert>],
  ['Container', <Container data-testid="probe">x</Container>],
  ['Stack', <Stack data-testid="probe">x</Stack>],
  ['Box', <Box data-testid="probe">x</Box>],
  ['Divider', <Divider data-testid="probe" />],
  ['StatusDot', <StatusDot data-testid="probe" />],
  ['Kbd', <Kbd data-testid="probe">K</Kbd>],
  ['Chip', <Chip data-testid="probe">x</Chip>],
  ['Center', <Center data-testid="probe">x</Center>],
]

describe('override contract — props extend HTMLAttributes (#427 · Layer 3a/c)', () => {
  const dirs = componentDirs()

  it('finds the component directories (sanity)', () => {
    expect(dirs.length).toBeGreaterThan(80)
  })

  it('every component root references an HTMLAttributes variant, else is allowlisted', () => {
    const offenders: string[] = []
    for (const dir of dirs) {
      const root = rootFileOf(dir)
      if (!root) continue
      if (HTMLATTRS_RE.test(stripComments(readFileSync(root, 'utf-8')))) continue
      if (dir in HTMLATTRS_ALLOWLIST) continue
      offenders.push(
        `  ${dir} (${dir}.tsx): props don't extend an HTMLAttributes<E> variant ` +
          `and it's not allowlisted. Extend the matching HTMLAttributes<E> so ` +
          `className/style/data-*/aria-* pass through (#427 Layer 3a/c), or add a ` +
          `justified entry to HTMLATTRS_ALLOWLIST in src/test/override-contract.test.tsx.`,
      )
    }
    expect(
      offenders,
      `\nComponents whose props don't extend HTMLAttributes<E> (#427 override ` +
        `contract, Layer 3a/c):\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })

  it('allowlist is not stale — every allowlisted root STILL lacks a direct HTMLAttributes ref', () => {
    // Self-pruning: if an allowlisted component adopts HTMLAttributes directly,
    // its entry must be removed so the allowlist can't mask a future regression.
    const nowCompliant: string[] = []
    for (const dir of Object.keys(HTMLATTRS_ALLOWLIST)) {
      const root = rootFileOf(dir)
      if (root && HTMLATTRS_RE.test(stripComments(readFileSync(root, 'utf-8')))) {
        nowCompliant.push(dir)
      }
    }
    expect(
      nowCompliant,
      `\nThese are allowlisted but now reference HTMLAttributes directly — ` +
        `remove their HTMLATTRS_ALLOWLIST entries:\n  ${nowCompliant.join(', ')}\n`,
    ).toEqual([])
  })
})

describe('override contract — data-testid lands on the visual root (#427 · Layer 3)', () => {
  it.each(RENDER_SAMPLE)('%s forwards data-testid onto its root node', (_name, element) => {
    const { container, unmount } = render(element)
    const probe = container.querySelector('[data-testid="probe"]')
    expect(
      probe,
      `data-testid was not forwarded to the DOM at all — the component drops ` +
        `arbitrary props (#427 override contract, Layer 3).`,
    ).not.toBeNull()
    // It must land on the VISUAL ROOT, not a nested descendant.
    expect(
      probe,
      `data-testid landed on a descendant, not the visual root — apply {...rest} ` +
        `to the outermost element (component-authoring.md Template 1).`,
    ).toBe(container.firstElementChild)
    unmount()
  })

  it('check is non-vacuous — a component that drops props fails the probe', () => {
    // Inverted/expected-fail demonstration: a component that ignores its props
    // yields NO probe, proving the assertions above aren't vacuously green.
    function Dropper(_props: React.HTMLAttributes<HTMLDivElement>) {
      return <div>ignores its props</div>
    }
    const { container, unmount } = render(<Dropper data-testid="probe" />)
    expect(container.querySelector('[data-testid="probe"]')).toBeNull()
    unmount()
  })
})
