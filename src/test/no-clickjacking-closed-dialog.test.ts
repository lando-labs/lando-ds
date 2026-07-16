// @vitest-environment node

/**
 * Closed-dialog click-blocker guard (#387 — v0.30.1 P0).
 *
 * BACKGROUND
 * ----------
 * The Lane B v0.29.0 native-`<dialog>` migration (#273) needed `display: block`
 * on the `.dialog` selector unconditionally — that's what gives the discrete-
 * display CSS transition a from-value to animate (`transition-behavior:
 * allow-discrete`). But an author `display: block` overrides the UA
 * `dialog:not([open]) { display: none }` rule regardless of specificity, so a
 * CLOSED dialog renders as a position:fixed; inset:0; width:100% block —
 * visually invisible (opacity:0) but intercepts every click across the
 * viewport. Mounting `<Modal open={false}>` (a common pattern — a Settings
 * modal whose trigger lives on the page) made entire consumer apps unclickable.
 *
 * THE FIX (Modal.module.css)
 * --------------------------
 * Keep `display: block` (still required for the discrete-display animation),
 * but make the closed state inert: `pointer-events: none` + `visibility:
 * hidden` (a11y). The `[open]` rule restores both.
 *
 * THIS GUARD
 * ----------
 * Any DS component CSS that selects a native `<dialog>` (or a class on one) AND
 * sets `display: block` (or `flex`/`grid`/etc — anything non-`none`) MUST ALSO
 * make the closed state inert. Concretely: if a rule sets a non-none `display`
 * on a `dialog`-shaped selector, there MUST be a paired `:not([open])` (or
 * `[open]`) rule that handles `pointer-events`. This catches the #387 defect
 * class and any sibling overlay component that copies the `allow-discrete`
 * pattern (Drawer/Sheet/etc).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_DIR = resolve(HERE, '../components')

/** Files exempt from the check (none today — keep this empty unless a deliberate exception arises). */
const ALLOWLIST: Record<string, string> = {}

/** Strip `/* … *\/` block comments so commented-out CSS doesn't trip the scan. */
function stripBlockComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Recursively collect every `*.module.css` under a directory. */
function collectModuleCss(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectModuleCss(full))
    else if (entry.endsWith('.module.css')) out.push(full)
  }
  return out
}

/**
 * Heuristic: a stylesheet "operates on a native <dialog>" if it mentions
 * `dialog` anywhere as a selector token OR uses `allow-discrete` (the CSS
 * feature that drives the #387 defect pattern).
 */
function operatesOnDialog(css: string): boolean {
  return /\ballow-discrete\b/.test(css) || /(^|[^a-z-])dialog([^a-z-]|$)/.test(css)
}

/**
 * Within a stylesheet that operates on a dialog: is the closed state made inert
 * (either via `pointer-events: none` on the closed state, OR via display:none
 * on the closed state)? The `[open]` companion rule is the implicit signal.
 */
function closedStateIsInert(css: string): boolean {
  // Any rule that restores pointer-events on [open], OR a :not([open]) block
  // that sets pointer-events:none, satisfies the contract.
  return (
    /\[open\][^{}]*\{[^}]*pointer-events\s*:\s*auto/.test(css) ||
    /:not\(\[open\]\)[^{}]*\{[^}]*pointer-events\s*:\s*none/.test(css) ||
    // Or: never sets display to something other than 'none' on a dialog-shaped
    // selector (i.e. the bug doesn't apply because UA display:none stands).
    !/\.[\w-]+\s*\{[^}]*display\s*:\s*(?!none\b)[a-z]+/.test(css)
  )
}

describe('overlay components inert their closed state (#387)', () => {
  const files = collectModuleCss(COMPONENTS_DIR).sort()
  const rel = (f: string) => relative(COMPONENTS_DIR, f).split('\\').join('/')

  it('finds the component stylesheets (sanity)', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it('every dialog-operating stylesheet inerts its closed state', () => {
    const offenders: string[] = []
    for (const file of files) {
      const key = rel(file)
      if (key in ALLOWLIST) continue
      const css = stripBlockComments(readFileSync(file, 'utf-8'))
      if (!operatesOnDialog(css)) continue
      if (!closedStateIsInert(css)) offenders.push(`  ${key}`)
    }
    expect(
      offenders,
      `\nDialog-operating stylesheets must inert their CLOSED state ` +
        `(pointer-events:none on :not([open]), restored on [open]) so an ` +
        `invisible closed dialog doesn't block clicks. See #387.\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })
})
