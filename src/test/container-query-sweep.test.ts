// @vitest-environment node

/**
 * Container-query sweep guard (#270/#281, follows the #269 card flagship).
 *
 * BACKGROUND
 * ----------
 * Components in a library are dropped into unknown-width slots, so a component
 * that reflows its OWN internals must do so by its own width (`@container`),
 * not the viewport (`@media`). #269 converted the 6 card roots; #270 converted
 * the next wave of NON-card components (List, Table, Footer, Banner, Breadcrumb,
 * Chart, ChatMessage, CodeBlock, Modal, Pagination, SegmentedControl); #281
 * drained the remaining (D) bucket — converting the embeddable set (Chat,
 * ChatInput, Markdown, EmptyState, ThemeBuilder) and reclassifying the genuinely
 * viewport-tier ones (Drawer, Heading, Text, Toast trio) into category (B).
 *
 * WHAT THIS TEST LOCKS
 * --------------------
 * It scans every `*.module.css` under `src/components/**`, strips comments, and
 * collects each remaining WIDTH `@media` (one mentioning `max-width`/`min-width`
 * — preference/print queries like `prefers-reduced-motion` are intentionally
 * ignored; those are category (C) and stay as `@media` forever).
 *
 * Every remaining width-`@media` MUST belong to a known, justified bucket:
 *
 *   (B) PAGE/VIEWPORT — a deliberate viewport API. These describe how a piece of
 *       page CHROME responds to the *screen*, which is the correct axis for
 *       them (a sidebar becoming a drawer, a header showing a hamburger, the
 *       responsive `Grid cols-*` public API, page containers). They must stay
 *       `@media`. Converting them would be wrong.
 *
 *   (D) DEFERRED — component-internal width-`@media` in components NOT in the
 *       #270 batch. These SHOULD eventually become `@container` (same rationale
 *       as the converted set) but are out of scope for this sprint. Listed
 *       explicitly so they're tracked, not forgotten — a follow-up issue can
 *       drain this bucket to empty.
 *
 * The test FAILS if a `*.module.css` not in either bucket contains a
 * width-`@media`. So:
 *   - Re-introducing a width-`@media` into any CONVERTED component → fail
 *     (its file isn't in (B) or (D), so any width-`@media` there is unexpected).
 *   - Adding a NEW component-internal width-`@media` to a brand-new component →
 *     fail (forces a conscious choice: convert it, or justify it in a bucket).
 *
 * The buckets carry a one-line justification each (per the issue's acceptance
 * criterion). Counts are pinned so silently ADDING a query to an allowed file
 * also trips the guard.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const COMPONENTS_DIR = resolve(REPO_ROOT, 'src/components')

function stripBlockComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function countWidthMediaQueries(css: string): number {
  const body = stripBlockComments(css)
  const matches = body.match(/@media[^{]*\{/g) ?? []
  return matches.filter((m) => /\b(?:max-width|min-width)\b/.test(m)).length
}

function findContainerHostSelector(body: string, name: string): string | null {
  const re = new RegExp(
    `([^{}]+)\\{[^{}]*container:\\s*${name}\\s*/\\s*inline-size[^{}]*\\}`,
  )
  const m = body.match(re)
  return m ? m[1]!.trim() : null // safe: regex has 1 capture group → present when m is non-null
}

function selectorsQueriedByContainer(body: string, name: string): string[] {
  const selectors: string[] = []
  // Walk each `@container <name> ( … ) {` and capture its block body by scanning
  // braces (the block can contain multiple nested rule `{ … }` groups).
  const opener = new RegExp(`@container\\s+${name}\\b[^{]*\\{`, 'g')
  let match: RegExpExecArray | null
  while ((match = opener.exec(body)) !== null) {
    let depth = 1
    let i = match.index + match[0].length
    const start = i
    while (i < body.length && depth > 0) {
      const ch = body[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
    }
    const block = body.slice(start, i - 1)
    // Inside the block, each inner rule is `<selector-list> { … }`. Grab the
    // selector-list preludes (the text before each `{`).
    const inner = block.match(/([^{}]+)\{[^{}]*\}/g) ?? []
    for (const rule of inner) {
      const prelude = rule.slice(0, rule.indexOf('{'))
      for (const sel of prelude.split(',')) {
        const trimmed = sel.trim()
        if (trimmed) selectors.push(trimmed)
      }
    }
  }
  return selectors
}

function collectModuleCss(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collectModuleCss(full))
    } else if (entry.endsWith('.module.css')) {
      out.push(full)
    }
  }
  return out
}

/**
 * (B) PAGE/VIEWPORT — keep as `@media`. Key = path relative to src/components.
 * Value = [expected width-`@media` count, justification].
 * These are the deliberate viewport APIs: category (B) from #270, extended by
 * #281 with the components whose reflow is genuinely viewport-tier (fixed page
 * chrome, or leaf typography with no safe container host) rather than a
 * component-box decision.
 */
const PAGE_VIEWPORT_ALLOWLIST: Record<string, [number, string]> = {
  'AppShell/AppShell.module.css': [1, 'sidebar→drawer is a viewport/page-shell decision (the shell IS the page)'],
  'Header/Header.module.css': [4, 'hamburger / mobile-nav collapse ×4 — app chrome responding to the screen'],
  'BottomNav/BottomNav.module.css': [1, 'mobile-only bottom tab bar; hidden above the viewport breakpoint by design'],
  'Container/Container.module.css': [2, 'max-width page container — its whole job is viewport-tier padding/width'],
  'Grid/Grid.module.css': [2, 'responsive `cols-*` is a PUBLIC viewport API (explicitly out of scope, #270)'],
  'PageHeader/PageHeader.module.css': [1, 'page-level header layout responds to the viewport tier'],
  // #281 — reclassified from the (D) deferred bucket: genuinely viewport-tier.
  'Drawer/Drawer.module.css': [1, 'off-canvas drawer pinned to a viewport EDGE (same class as AppShell drawer); % clamps are about the screen'],
  'Heading/Heading.module.css': [1, 'responsive TYPE SCALE — a viewport decision; <hN> leaf has no descendant to host a container'],
  'Text/Text.module.css': [1, 'responsive TYPE SCALE — viewport decision; polymorphic/inline-capable so no safe `.sizer` wrapper'],
  'Toast/Toast.module.css': [1, 'irreducibly viewport (max-width: calc(100vw - …)); standalone <Toast> has no container host'],
  'Toast/ToastContainer.module.css': [1, 'fixed toast stack anchored to the viewport edge; centered→edge-to-edge is a screen decision'],
  'Toast/ToastProvider.module.css': [1, 'fixed toast stack (max-width capped) anchored to the viewport edge — a screen decision'],
}

/**
 * (D) DEFERRED — historically: component-internal width-`@media` not yet
 * converted. #281 drained this bucket to EMPTY: the embeddable components were
 * converted to `@container` (see CONVERTED_281 below) and the genuinely
 * viewport-tier ones were reclassified into PAGE_VIEWPORT_ALLOWLIST above.
 * Kept (empty) so the structure is obvious and a future deferral has a home.
 */
const DEFERRED_ALLOWLIST: Record<string, [number, string]> = {}

const ALLOWLIST = { ...PAGE_VIEWPORT_ALLOWLIST, ...DEFERRED_ALLOWLIST }

/**
 * Components converted by #270 — they MUST have a `container:` host and MUST NOT
 * contain any width-`@media`. (Tabs was in the issue's list but had no
 * width-`@media` in the current source, so it is intentionally absent here.)
 */
const CONVERTED_COMPONENTS: Record<string, string> = {
  'List/List.module.css': 'list',
  'Table/Table.module.css': 'table',
  'Footer/Footer.module.css': 'footer',
  'Banner/Banner.module.css': 'banner',
  'Breadcrumb/Breadcrumb.module.css': 'breadcrumb',
  'Chart/Chart.module.css': 'chart',
  'Chat/ChatMessage.module.css': 'chat-message',
  'CodeBlock/CodeBlock.module.css': 'code-block',
  'Modal/Modal.module.css': 'modal',
  'Pagination/Pagination.module.css': 'pagination',
  'SegmentedControl/SegmentedControl.module.css': 'segmented-control',
}

/**
 * Components converted by #281 (the embeddable, arbitrary-width-slot set). Same
 * contract as CONVERTED_COMPONENTS: each MUST declare a `container: <name> /
 * inline-size` host, use a named `@container <name>` query, have ZERO
 * width-`@media`, and must NOT style its own host from `@container` (the
 * self-rule no-op guard). Chat/ChatInput/Markdown/EmptyState use a `.sizer`
 * wrapper as the host (the root element is the one that reflows); ThemeBuilder
 * hosts on its own root because every queried rule targets a descendant.
 */
const CONVERTED_281: Record<string, string> = {
  'Chat/Chat.module.css': 'chat',
  'Chat/ChatInput.module.css': 'chat-input',
  'Markdown/Markdown.module.css': 'markdown',
  'EmptyState/EmptyState.module.css': 'empty-state',
  'ThemeBuilder/ThemeBuilder.module.css': 'theme-builder',
}

/** All container-converted components (#270 + #281) share the same guards. */
const ALL_CONVERTED: Record<string, string> = {
  ...CONVERTED_COMPONENTS,
  ...CONVERTED_281,
}

describe('container-query sweep (#270)', () => {
  const files = collectModuleCss(COMPONENTS_DIR).sort()
  const rel = (f: string) => relative(COMPONENTS_DIR, f).split('\\').join('/')

  it('finds the component stylesheets (sanity)', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it('every remaining width-@media belongs to a justified (B)/(D) bucket', () => {
    const offenders: string[] = []
    for (const file of files) {
      const key = rel(file)
      const count = countWidthMediaQueries(readFileSync(file, 'utf-8'))
      if (count === 0) continue
      if (!(key in ALLOWLIST)) {
        offenders.push(
          `  ${key}: ${count} width-@media but NOT in the (B) page-viewport ` +
            `or (D) deferred allowlist. Convert it to @container (#270 pattern) ` +
            `or add a justified entry to src/test/container-query-sweep.test.ts.`,
        )
      }
    }
    expect(
      offenders,
      `\nUnaccounted component-internal width-@media found:\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })

  it('allowlisted files keep EXACTLY their pinned width-@media count', () => {
    const drift: string[] = []
    for (const [key, [expected, why]] of Object.entries(ALLOWLIST)) {
      const file = resolve(COMPONENTS_DIR, key)
      const actual = countWidthMediaQueries(readFileSync(file, 'utf-8'))
      if (actual !== expected) {
        drift.push(`  ${key}: expected ${expected} (${why}), found ${actual}`)
      }
    }
    expect(
      drift,
      `\nWidth-@media count drifted in an allowlisted file. If intentional, ` +
        `update the pinned count (and reconsider whether it should be @container):\n` +
        `${drift.join('\n')}\n`,
    ).toEqual([])
  })

  it('every converted component (#270 + #281) has a `container:` host and ZERO width-@media', () => {
    const problems: string[] = []
    for (const [key, name] of Object.entries(ALL_CONVERTED)) {
      const file = resolve(COMPONENTS_DIR, key)
      const css = readFileSync(file, 'utf-8')
      const body = stripBlockComments(css)
      // Host declares the container via the `container: <name> / inline-size` shorthand.
      if (!new RegExp(`container:\\s*${name}\\s*/\\s*inline-size`).test(body)) {
        problems.push(`  ${key}: missing \`container: ${name} / inline-size\` host`)
      }
      // …and uses a named `@container <name>` query somewhere.
      if (!new RegExp(`@container\\s+${name}\\b`).test(body)) {
        problems.push(`  ${key}: no \`@container ${name}\` query found`)
      }
      // …and has NO width-@media left.
      const widthMedia = countWidthMediaQueries(css)
      if (widthMedia !== 0) {
        problems.push(`  ${key}: still has ${widthMedia} width-@media (should be 0)`)
      }
    }
    expect(problems, `\nConverted-component problems:\n${problems.join('\n')}\n`).toEqual([])
  })

  /**
   * The #270 correctness guard.
   *
   * An element's `@container <name>` query is resolved against its nearest
   * ANCESTOR query container, NEVER itself — only DESCENDANTS of the host match
   * its `@container` rules. So a rule that styles the SAME element that declares
   * `container: <name> / inline-size` (a "self-rule") silently does nothing.
   *
   * This locks every converted component so the responsive rules land on a
   * DESCENDANT of the host: the host selector must not appear among the
   * selectors targeted inside any `@container <name>` block. (Earlier in this
   * sweep, six components shipped exactly this broken self-rule — Table, Chart,
   * CodeBlock, ChatMessage, Banner, Modal — and rendered no responsive change.)
   *
   * Pseudo-classes/elements are stripped before comparing so that, e.g.,
   * `.modal:not(.fullscreen)` is recognized as the `.modal` element. The host is
   * always a bare class here.
   */
  it('no converted component styles its OWN container host from `@container` (self-rule no-op)', () => {
    /** `.modal:not(.fullscreen)::before` → `.modal` (the base element class). */
    const baseClass = (selector: string): string => {
      const m = selector.trim().match(/^\.[A-Za-z0-9_-]+/)
      return m ? m[0] : selector.trim()
    }

    const offenders: string[] = []
    for (const [key, name] of Object.entries(ALL_CONVERTED)) {
      const file = resolve(COMPONENTS_DIR, key)
      const body = stripBlockComments(readFileSync(file, 'utf-8'))

      const host = findContainerHostSelector(body, name)
      if (!host) {
        offenders.push(`  ${key}: could not locate the \`container: ${name}\` host selector`)
        continue
      }
      const hostBase = baseClass(host)

      const queried = selectorsQueriedByContainer(body, name)
      const selfRules = queried.filter((sel) => baseClass(sel) === hostBase)
      if (selfRules.length > 0) {
        offenders.push(
          `  ${key}: \`@container ${name}\` styles its OWN host \`${host}\` ` +
            `(via ${[...new Set(selfRules)].join(', ')}). A container never matches ` +
            `its own \`@container\` query — move the rule onto a DESCENDANT of the ` +
            `host (move \`container:\` up to a parent, or add a \`.sizer\` wrapper).`,
        )
      }
    }
    expect(
      offenders,
      `\nSelf-\`@container\` no-op rule(s) found (#270 bug class):\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })
})
