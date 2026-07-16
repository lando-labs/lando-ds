// @vitest-environment node

/**
 * Documentation import-resolution guard (Sprint 59, #427 / claims-hygiene).
 *
 * The DS positions as AI-forward: agents read `reference/*.md` literally and
 * copy its `import { … } from '@lando-labs/lando-ds'` lines. If a doc
 * names a component that doesn't exist (e.g. a phantom `SparklineChart`) or
 * imports a subpath-only export through the barrel (e.g. `MarkdownEditor`,
 * which must come from `@lando-labs/lando-ds/markdown-editor`), the agent
 * generates broken code and trust erodes.
 *
 * This guard parses every consumer-facing reference doc and asserts that:
 *   - every named barrel import resolves to a real export reachable from
 *     `src/index.ts` (components, tokens, utils, hooks — wildcards followed), and
 *   - every subpath import (`.../foo`) maps to a real `package.json` `exports` key.
 *
 * Docs bannered as "Internal planning / historical doc" are exempt — they are
 * explicitly not consumer contracts (they may reference planned/phantom APIs).
 *
 * If this flags a real export the resolver missed, extend `collectExports` or
 * add the name to ALLOWLIST_NAMES with a comment.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const SRC = resolve(REPO_ROOT, 'src')
const REF_DIR = resolve(REPO_ROOT, 'reference')

const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'))
const SUBPATH_KEYS = new Set(Object.keys(PKG.exports ?? {}))

// Names a consumer may legitimately import that the static resolver can't see
// (none needed today — kept as the documented escape hatch).
const ALLOWLIST_NAMES = new Set<string>([])

/** Recursively collect every named export reachable from a barrel file. */
function collectExports(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>()
  if (seen.has(file) || !existsSync(file)) return names
  seen.add(file)
  const src = readFileSync(file, 'utf8')

  // export { A, B as C }  /  export type { A, B }   (multi-line safe)
  for (const m of src.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}/g)) {
    // safe: the `{…}` capture group is present in every match
    for (const part of m[1]!.split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && /^[A-Za-z_]\w*$/.test(name)) names.add(name)
    }
  }
  // export const/function/class/type/interface NAME
  for (const m of src.matchAll(
    /export\s+(?:declare\s+)?(?:const|function|class|type|interface)\s+([A-Za-z_]\w*)/g
  )) {
    names.add(m[1]!) // safe: capture group 1 (the export name) present on match
  }
  // export * from './rel'  → resolve + recurse
  for (const m of src.matchAll(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const base = resolve(dirname(file), m[1]!) // safe: capture group 1 (the './rel' path) present on match
    const target = [
      `${base}.ts`,
      `${base}.tsx`,
      join(base, 'index.ts'),
      join(base, 'index.tsx'),
    ].find(existsSync)
    if (target) for (const n of collectExports(target, seen)) names.add(n)
  }
  return names
}

const VALID = collectExports(resolve(SRC, 'index.ts'))
const INTERNAL_BANNER = 'Internal planning'

function referenceDocs(): string[] {
  return readdirSync(REF_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(REF_DIR, f))
}

describe('reference docs — documented imports resolve to real exports', () => {
  it('resolver found a sane number of exports (sanity)', () => {
    expect(VALID.size).toBeGreaterThan(80)
  })

  it('has no phantom or mis-pathed package imports in consumer-facing docs', () => {
    const failures: string[] = []
    for (const doc of referenceDocs()) {
      // Audit ledgers (claims-triage-*) quote bad imports as examples of the
      // bugs they document — they are records, not consumer contracts.
      if (/claims-triage/.test(doc)) continue
      const text = readFileSync(doc, 'utf8')
      if (text.slice(0, 500).includes(INTERNAL_BANNER)) continue // exempt non-contract docs
      const rel = doc.slice(REPO_ROOT.length + 1)

      // `[^}]*` (not `[\s\S]*?`) bounds each match to ONE brace group, so an
      // `@lando-labs` import can't accidentally swallow an adjacent
      // `lucide-react` / `react-router` import's names.
      for (const m of text.matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@lando-labs\/design-system(\/[A-Za-z0-9-]+)?['"]/g
      )) {
        const subpath = m[2] // '/markdown-editor' | undefined
        if (subpath) {
          const key = `.${subpath}`
          if (!SUBPATH_KEYS.has(key)) {
            failures.push(`${rel}: subpath import '${subpath}' has no matching package.json exports key`)
          }
          continue // the subpath module owns its own names
        }
        // safe: the `{…}` names capture group is present in every match
        const cleaned = m[1]!.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
        for (const raw of cleaned.split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0]!.trim() // safe: String.split always returns ≥1 element
          if (!name || !/^[A-Za-z_]\w*$/.test(name)) continue
          if (!VALID.has(name) && !ALLOWLIST_NAMES.has(name)) {
            failures.push(`${rel}: '${name}' is not a barrel export of @lando-labs/lando-ds`)
          }
        }
      }
    }
    expect(failures, `\n${failures.join('\n')}\n`).toEqual([])
  })
})
