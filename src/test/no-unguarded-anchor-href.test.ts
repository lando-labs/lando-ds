// @vitest-environment node

/**
 * Anchor-href guard (#320) — every dynamic `<a href={…}>` must route through
 * `safeHref(...)`.
 *
 * WHY THIS EXISTS
 * ---------------
 * #320 added `safeHref` and wired it into the five anchor sinks the audit issue
 * listed — but the issue's list was incomplete: `BottomNavItem` and the `Header`
 * skip link rendered a raw consumer `href` and shipped a `javascript:`/`data:`
 * hole that only React 19's runtime net partially covered (and the package's
 * peerDeps still allow React 18). An independent adversarial pass found them by
 * grepping ALL anchors. Manual application can't be trusted to stay complete, so
 * this test makes "every anchor sink is sanitized" an enforced invariant instead
 * of a checklist.
 *
 * WHAT IT LOCKS
 * -------------
 * For every `*.tsx` under `src/components/**` (block comments stripped, so JSDoc
 * `<a href="…">` examples are ignored), any opening `<a>` tag with a DYNAMIC
 * `href={expr}` must have `expr` begin with `safeHref(`. Static string hrefs
 * (`href="/x"`, author-controlled literals) are allowed. Polymorphic components
 * that can render an anchor via `as="a"` (Text) sanitize their href in code and
 * are covered by their own unit tests, not this literal-`<a>` scan.
 *
 * If a raw dynamic href is ever genuinely intentional, add the file to ALLOWLIST
 * with a one-line justification.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_DIR = resolve(HERE, '../components')

/** Files permitted a raw dynamic anchor href, each with a reason. Empty today. */
const ALLOWLIST: Record<string, string> = {}

/** Strip `/* … *\/` block comments so commented-out examples are ignored. */
function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Recursively collect every non-test `*.tsx` under a directory. */
function collectTsx(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectTsx(full))
    else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) out.push(full)
  }
  return out
}

/** Dynamic `<a href={expr}>` occurrences whose `expr` is not sanitized. */
function findUnguardedAnchorHrefs(src: string): string[] {
  const body = stripBlockComments(src)

  // Local variables assigned directly from `safeHref(...)` count as sanitized,
  // so `const sanitized = safeHref(raw); … href={sanitized}` (e.g. Markdown,
  // which also derives target/rel from the same value) passes.
  const sanitizedVars = new Set<string>()
  const assignRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*safeHref\(/g
  let a: RegExpExecArray | null
  while ((a = assignRe.exec(body)) !== null) sanitizedVars.add(a[1]!) // safe: capture group 1 present when exec matched

  const offenders: string[] = []
  // `<a` … (no `>` yet) … `href={ expr }`. `[^}]+` captures the expression up to
  // its closing brace — fine for `safeHref(href)` (no inner `}`).
  const re = /<a\b[^>]*?\bhref=\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const expr = m[1]!.trim() // safe: capture group 1 present when exec matched
    if (expr.startsWith('safeHref(')) continue
    if (sanitizedVars.has(expr)) continue
    offenders.push(`href={${expr}}`)
  }
  return offenders
}

describe('every dynamic <a href={…}> routes through safeHref (#320)', () => {
  const files = collectTsx(COMPONENTS_DIR).sort()
  const rel = (f: string) => relative(COMPONENTS_DIR, f).split('\\').join('/')

  it('finds the component sources (sanity)', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it('no component renders a raw consumer href on an anchor', () => {
    const offenders: string[] = []
    for (const file of files) {
      const key = rel(file)
      if (key in ALLOWLIST) continue
      const hits = findUnguardedAnchorHrefs(readFileSync(file, 'utf-8'))
      if (hits.length) offenders.push(`  ${key}: ${[...new Set(hits)].join(', ')}`)
    }
    expect(
      offenders,
      `\nDynamic <a href={…}> must use safeHref(...) — a consumer/CMS/AI-supplied ` +
        `href can be javascript:/data:/vbscript:\n${offenders.join('\n')}\n`,
    ).toEqual([])
  })
})
