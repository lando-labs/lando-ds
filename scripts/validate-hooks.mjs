#!/usr/bin/env node
/**
 * validate-hooks.mjs (#504)
 *
 * Enforces that the hooks surface stays DISCOVERABLE. Mirrors
 * `validate-state-contract.mjs`: a standalone build hook wired into CI via the
 * `validate:hooks` npm script, run AFTER `build` so the meta artifact exists.
 *
 * WHY this check exists: the DS shipped four exported, fully-typed hooks that
 * appeared in no meta section and no doc. They were importable but invisible —
 * and a consumer that imports the DS in 77 files still hand-rolled its own
 * 116-LOC `useFocusTrap`. A hook that isn't in `meta.json` does not exist as far
 * as the MCP server or any AI agent grounding on it is concerned. This guard
 * makes that failure mode impossible to reintroduce.
 *
 * Checks (all grounded in `src/hooks/index.ts`, the public-surface SSoT):
 *   1. Every barrel-exported hook has a `meta.hooks` entry.
 *   2. Every entry carries a non-empty description and category — an entry with
 *      no prose is not discoverable in any useful sense.
 *   3. Every entry carries a `signature` (the build emits the declaration, so a
 *      missing one means the .d.ts didn't emit — a real packaging bug).
 *   4. No STALE entries: nothing in `meta.hooks` that the barrel no longer exports.
 *   5. Hooks are documented in `reference/hooks.md`.
 *
 * Usage: node scripts/validate-hooks.mjs
 * Exit 0: the hooks surface is discoverable.  Exit 1: any violation (or the meta
 * artifact is missing — silently passing is exactly the failure this prevents).
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from './lib/meta-pkg-common.mjs'

/** The public hooks surface = whatever the barrel re-exports (values, not types). */
function barrelHooks() {
  const barrelPath = join(repoRoot, 'src', 'hooks', 'index.ts')
  if (!existsSync(barrelPath)) {
    console.error('[validate-hooks] src/hooks/index.ts not found.')
    process.exit(1)
  }
  const src = readFileSync(barrelPath, 'utf8')
  const names = []
  for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"]/g)) {
    for (const raw of m[1].split(',')) {
      const spec = raw.trim()
      if (!spec || spec.startsWith('type ')) continue
      const name = (spec.split(/\s+as\s+/).pop() ?? spec).trim()
      if (/^use[A-Z]/.test(name)) names.push(name)
    }
  }
  return names
}

function loadMeta() {
  for (const p of [
    join(repoRoot, 'dist', 'meta.verbose.json'),
    join(repoRoot, 'dist', 'meta.json'),
  ]) {
    if (existsSync(p)) return { meta: JSON.parse(readFileSync(p, 'utf8')), path: p }
  }
  console.error(
    '[validate-hooks] dist/meta.{verbose.,}json not found. Run `npm run build` ' +
      'first — this check reads the emitted meta and will not silently pass ' +
      'without it.'
  )
  process.exit(1)
}

const { meta, path } = loadMeta()
console.log(`[validate-hooks] meta source: ${path.replace(repoRoot + '/', '')}`)

const exported = barrelHooks()
const metaHooks = meta.hooks ?? {}
const violations = []

if (exported.length === 0) {
  violations.push('src/hooks/index.ts exports no hooks — refusing to pass vacuously.')
}

const docPath = join(repoRoot, 'reference', 'hooks.md')
const doc = existsSync(docPath) ? readFileSync(docPath, 'utf8') : null
if (doc == null) violations.push('reference/hooks.md is missing — hooks must be documented.')

for (const name of exported) {
  const entry = metaHooks[name]
  if (!entry) {
    violations.push(
      `${name}: exported from src/hooks/index.ts but MISSING from meta.hooks. A hook ` +
        `absent from meta is invisible to the MCP server and to AI agents — which is ` +
        `exactly why a consumer once rebuilt useFocusTrap by hand.`
    )
    continue
  }
  if (typeof entry.description !== 'string' || entry.description.trim().length === 0) {
    violations.push(`${name}: meta entry has no description (add a leading JSDoc).`)
  }
  if (typeof entry.category !== 'string' || entry.category.trim().length === 0) {
    violations.push(`${name}: meta entry has no category (add an \`@category\` JSDoc tag).`)
  }
  if (typeof entry.signature !== 'string' || entry.signature.trim().length === 0) {
    violations.push(
      `${name}: meta entry has no signature — the emitted dist/hooks/${name}.d.ts ` +
        `declaration was not found. Use a named \`export function ${name}(…)\`.`
    )
  } else {
    // A truncated inline-object signature is non-empty but UNBALANCED (skeptic
    // defect 3a: the first-`;` terminator lost `useClipboard`'s copied/error/
    // reset). Presence-only was why that sailed through — reject imbalance too.
    for (const [open, close] of [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ]) {
      const o = entry.signature.split(open).length - 1
      const c = entry.signature.split(close).length - 1
      if (o !== c) {
        violations.push(
          `${name}: meta signature looks truncated — unbalanced "${open}${close}": ${entry.signature}`
        )
        break
      }
    }
  }
  // Word-boundary match, not substring: a `hooks.md` that documents
  // `useHoverIntent` must not satisfy `useHover` (skeptic-demonstrated false-pass).
  if (doc != null && !new RegExp(`\\b${name}\\b`).test(doc)) {
    violations.push(`${name}: not documented in reference/hooks.md.`)
  }
}

// Stale entries: meta lists a hook the barrel no longer exports.
for (const name of Object.keys(metaHooks)) {
  if (!exported.includes(name)) {
    violations.push(
      `${name}: present in meta.hooks but NOT exported from src/hooks/index.ts (stale).`
    )
  }
}

if (violations.length > 0) {
  console.error(`\n[validate-hooks] ✗ ${violations.length} violation(s):\n`)
  for (const v of violations) console.error(`  • ${v}`)
  console.error('\nThe hooks surface is documented in reference/hooks.md.')
  process.exit(1)
}

console.log(
  `[validate-hooks] ✓ ${exported.length} hooks exported, all present in meta.hooks ` +
    `with a description, category and signature, and documented.`
)
