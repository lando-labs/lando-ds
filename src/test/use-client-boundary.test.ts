// @vitest-environment node

/**
 * `use client` boundary regression guard (issue #265).
 *
 * The design system is Server-Component-native: the `'use client'` boundary is
 * kept as small as possible so server-safe presentational leaves render with
 * ZERO client JS inside a React Server Component. The Vite library build uses
 * `preserveModules` + `rollup-plugin-preserve-directives`, so every source
 * module's leading `'use client'` directive is preserved 1:1 into its own dist
 * file. A stray directive on a server-safe leaf is therefore not cosmetic — it
 * pulls that leaf (and its render subtree) onto the client.
 *
 * This guard fails the build if any src/components tsx file declares
 * `'use client'` but shows NO evidence it actually needs the client runtime.
 * "Evidence" = a client signal (see CLIENT_SIGNALS). It is intentionally a
 * cheap static heuristic, not a type-aware analysis: it cannot prove a file is
 * server-safe, but it reliably catches the common regression of copy-pasting a
 * `'use client'` banner onto a brand-new presentational leaf.
 *
 * Note on event handlers: binding `onClick={someProp}` does NOT count as a
 * signal. A Server Component may legitimately forward an event-handler prop down
 * onto a host element or a Client child — several vetted server leaves (Badge,
 * Card, Chip, EmptyState, IconButton) do exactly this. The directive is only
 * required when a component *originates* interactivity (hooks/state, refs, or
 * browser globals), which is what the signals below detect.
 *
 * If this test flags a file you believe is legitimately client, either:
 *   1. the file genuinely needs the client runtime — it almost certainly calls
 *      a hook / creates a context / touches a ref or a browser global, so the
 *      guard will pass once that code is present, or
 *   2. it is a rare exception with no in-file signal (e.g. it is client purely
 *      because it wraps a client-only dependency, or is interactive via handler
 *      props it forwards) — add it to ALLOWLIST below WITH a comment.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative } from 'node:path'
import { globSync } from 'glob'

const HERE = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_DIR = resolve(HERE, '../components')
const REPO_ROOT = resolve(HERE, '../..')

const CLIENT_SIGNALS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\buse[A-Z]\w*\(/, 'hook call'],
  [/\bcreateContext\b/, 'createContext'],
  [/\.current\b/, 'ref write (.current)'],
  [/\bwindow\./, 'window.'],
  [/\bdocument\./, 'document.'],
  [/\bnavigator\./, 'navigator.'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\baddEventListener\b/, 'addEventListener'],
]

/**
 * Legitimate `'use client'` files that show NO in-file signal from the list
 * above. Keep this list TINY and every entry commented — it is an escape hatch,
 * not a dumping ground. Paths are repo-relative with POSIX separators.
 */
const ALLOWLIST: ReadonlySet<string> = new Set([
  // --- Recharts charting wrappers ----------------------------------------
  // Recharts is a client-only library (it measures the DOM via ResizeObserver
  // internally), so these wrappers must ship as client components even when the
  // wrapper file itself contains no hook/ref. Kept as one deliberate client
  // cluster: listing all five keeps the boundary stable if an incidental signal
  // (e.g. a slice onClick on Pie/Donut) is later refactored away.
  'src/components/AreaChart/AreaChart.tsx',
  'src/components/BarChart/BarChart.tsx',
  'src/components/LineChart/LineChart.tsx',
  'src/components/PieChart/PieChart.tsx',
  'src/components/DonutChart/DonutChart.tsx',

  // --- Slot: asChild prop/ref-merging primitive --------------------------
  // Radix-style `asChild` helper. Clones its child element and composes refs +
  // event handlers onto it via React internals — a client-side composition
  // primitive by nature. Allowlisted explicitly (per #265) so the intent is
  // documented and survives any refactor of its ref composition.
  'src/components/Slot/Slot.tsx',

  // --- Second-tier interactive leaves (intentionally out of scope for #265) ---
  // These were deliberately left client in v0.18.0: each is interactive via
  // event-handler props it wires onto host elements (onClick / onPageChange /
  // keyboard handlers), and/or composes other client components. They originate
  // no hook/ref/browser-global themselves, so they have no signal — but
  // converting them to server leaves is explicitly NOT part of #265. They are
  // tracked for a later pass; keep them client until then.
  'src/components/Banner/Banner.tsx',
  'src/components/DetailCard/DetailCard.tsx',
  'src/components/Dropdown/DropdownItem.tsx',
  'src/components/List/ListItem.tsx',
  'src/components/Pagination/Pagination.tsx',
  'src/components/TaskCard/TaskCard.tsx',
])

/**
 * Inverse-direction escape hatch (#446/#447): files that DO show a client
 * signal but are legitimately server-safe (e.g. an SSR-guarded `typeof window`
 * check inside an otherwise server-safe module). EMPTY today — the whole
 * component tree carries a correct boundary after #446/#447. Keep it tiny and
 * comment every entry.
 */
const UNDERMARK_ALLOWLIST: ReadonlySet<string> = new Set<string>([])

function startsWithUseClient(source: string): boolean {
  const lines = source.split('\n')
  let inBlockComment = false

  for (const raw of lines) {
    let line = raw.trim()

    if (inBlockComment) {
      const end = line.indexOf('*/')
      if (end === -1) continue
      inBlockComment = false
      line = line.slice(end + 2).trim()
      if (line === '') continue
    }

    if (line === '') continue
    if (line.startsWith('//')) continue

    if (line.startsWith('/*')) {
      const end = line.indexOf('*/')
      if (end === -1) {
        inBlockComment = true
        continue
      }
      line = line.slice(end + 2).trim()
      if (line === '') continue
    }

    // First real line of code.
    const normalized = line.replace(/;$/, '').trim()
    return normalized === "'use client'" || normalized === '"use client"'
  }

  return false
}

function findClientSignals(source: string): string[] {
  return CLIENT_SIGNALS.filter(([rx]) => rx.test(source)).map(([, label]) => label)
}

/**
 * Blank out comments and string/template literals (replacing their contents
 * with spaces, preserving newlines) so the client-signal scan sees CODE only.
 * Load-bearing for the inverse ("missing but needed") assertion below: a signal
 * that appears only inside a comment or string — e.g. `useToast()` in
 * ToastContainer's JSDoc — would otherwise be a FALSE positive demanding a
 * directive the file doesn't need.
 *
 * Implemented as a single left-to-right scanner, NOT sequential regexes: a
 * per-construct regex can't tell it is standing inside another construct, and
 * either blind spot silently eats a real adjacent signal —
 *   - strings-first: an apostrophe in a `// consumer's` line comment opens a
 *     bogus single-quote span that swallows a following `useId('x')`;
 *   - comments-first: a `//` inside a "https://x" string is mistaken for a line
 *     comment and swallows a following `useState()` on the same line.
 * The scanner tracks exactly one state at a time (code / line / block / '…' /
 * "…" / `…`), so neither case can occur. Caveat: template-literal contents are
 * treated as opaque — a hook called inside a `${…}` interpolation would not be
 * seen — which is safe here because DS components never call hooks inside a
 * template interpolation. Used ONLY for the signal scan; the directive position
 * check (startsWithUseClient) still reads raw source.
 */
function stripCommentsAndStrings(source: string): string {
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'
  let state: State = 'code'
  let out = ''

  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    const next = source[i + 1]

    if (state === 'code') {
      if (c === '/' && next === '/') {
        state = 'line'
        out += '  '
        i++
      } else if (c === '/' && next === '*') {
        state = 'block'
        out += '  '
        i++
      } else if (c === "'") {
        state = 'single'
        out += ' '
      } else if (c === '"') {
        state = 'double'
        out += ' '
      } else if (c === '`') {
        state = 'template'
        out += ' '
      } else {
        out += c
      }
      continue
    }

    if (state === 'line') {
      if (c === '\n') {
        state = 'code'
        out += '\n'
      } else {
        out += ' '
      }
      continue
    }

    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code'
        out += '  '
        i++
      } else {
        out += c === '\n' ? '\n' : ' '
      }
      continue
    }

    // Inside a string/template literal.
    const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`'
    if (c === '\\') {
      out += '  ' // blank the backslash and the escaped char
      i++
    } else if (c === quote) {
      state = 'code'
      out += ' '
    } else {
      out += c === '\n' ? '\n' : ' '
    }
  }

  return out
}

function toRepoRelative(absPath: string): string {
  return relative(REPO_ROOT, absPath).split('\\').join('/')
}

describe('use client boundary (#265)', () => {
  const files = globSync('**/*.tsx', {
    cwd: COMPONENTS_DIR,
    absolute: true,
    ignore: ['**/*.test.tsx', '**/*.stories.tsx'],
  }).sort()

  it('enumerates a meaningful number of component source files', () => {
    // If the glob silently matched nothing, the boundary assertion below would
    // pass vacuously. Lock in a floor so a broken glob fails loudly.
    expect(files.length).toBeGreaterThan(50)
  })

  it('has no "use client" leaf without a client signal (outside the allowlist)', () => {
    const violations: string[] = []

    for (const absPath of files) {
      const relPath = toRepoRelative(absPath)
      const source = readFileSync(absPath, 'utf-8')

      if (!startsWithUseClient(source)) continue
      if (ALLOWLIST.has(relPath)) continue
      if (findClientSignals(source).length > 0) continue

      violations.push(relPath)
    }

    expect(
      violations,
      `\nThese files declare 'use client' but show no client signal ` +
        `(hook / createContext / ref / browser global).\n` +
        `Either remove the directive (server-safe leaf) or, for a real ` +
        `exception, add the file to ALLOWLIST in this test with a reason:\n` +
        violations.map((v) => `  - ${v}`).join('\n') +
        '\n',
    ).toEqual([])
  })

  it('has no client-signal leaf MISSING the "use client" directive (#446, #447)', () => {
    // Inverse of the test above. The guard was historically unidirectional
    // (directive ⇒ needed) and silently shipped #446 (SidebarNavItem) + #447
    // (Progress): both call a render-scope hook but lacked the directive, so
    // an RSC import throws at build time. This pins the other direction:
    // needed ⇒ directive.
    const violations: Array<{ file: string; signals: string[] }> = []

    for (const absPath of files) {
      const relPath = toRepoRelative(absPath)
      if (UNDERMARK_ALLOWLIST.has(relPath)) continue

      const source = readFileSync(absPath, 'utf-8')
      if (startsWithUseClient(source)) continue // boundary already present

      // Scan CODE only — a signal seen inside a comment or string literal is
      // not a real client dependency (see stripCommentsAndStrings).
      const signals = findClientSignals(stripCommentsAndStrings(source))
      if (signals.length === 0) continue

      violations.push({ file: relPath, signals })
    }

    expect(
      violations,
      `\nThese files use a client-only feature but do NOT declare 'use client' ` +
        `as their first statement — importing them into a React Server ` +
        `Component throws at build time (#446, #447). Add 'use client' to the ` +
        `top of each (or, rarely, add to UNDERMARK_ALLOWLIST with a reason):\n` +
        violations
          .map((v) => `  - ${v.file}  [signals: ${v.signals.join(', ')}]`)
          .join('\n') +
        '\n',
    ).toEqual([])
  })

  it('keeps the allowlist tight — every allowlisted file still exists and still declares "use client"', () => {
    // Guards against allowlist rot: if an allowlisted file is deleted, renamed,
    // or has its directive removed, force a deliberate update here.
    const stale: string[] = []

    for (const relPath of ALLOWLIST) {
      const absPath = resolve(REPO_ROOT, relPath)
      let source: string
      try {
        source = readFileSync(absPath, 'utf-8')
      } catch {
        stale.push(`${relPath} (missing)`)
        continue
      }
      if (!startsWithUseClient(source)) {
        stale.push(`${relPath} (no longer declares 'use client')`)
      }
    }

    expect(
      stale,
      `\nALLOWLIST entries that are stale — remove or fix them:\n` +
        stale.map((s) => `  - ${s}`).join('\n') +
        '\n',
    ).toEqual([])
  })
})
