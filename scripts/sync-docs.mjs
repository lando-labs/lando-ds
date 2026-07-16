#!/usr/bin/env node
/**
 * sync-docs.mjs
 *
 * Single source of truth for the component inventory is
 * `src/components/index.ts`. This script derives three things from it and
 * keeps the human-facing docs from drifting:
 *
 *   1. `COMPONENTS.md` at the repo root — every top-level component directory
 *      and the value exports re-exported from it, grouped by section.
 *   2. The component **count** + **inventory list** inside `CLAUDE.md`,
 *      written between explicit generated-region markers.
 *   3. The honest **test-coverage** count inside `CLAUDE.md` (also a marked
 *      region), derived from a real count of `src/components/**\/*.test.tsx`.
 *
 * The canonical component set is the set of Capitalized value exports from
 * `src/components/index.ts` (aliases resolved, hooks like `useToast`
 * filtered out). This is byte-for-byte the same set `emit-meta.mjs` publishes
 * to `dist/meta.json`, so CLAUDE.md, COMPONENTS.md, and meta.json all agree
 * on the headline number. Categories are read from the `COMPONENT_CATEGORIES`
 * map in `emit-meta.mjs` so category assignments have a single home.
 *
 * Usage:
 *   node scripts/sync-docs.mjs           # regenerate COMPONENTS.md + CLAUDE.md regions
 *   node scripts/sync-docs.mjs --check   # exit 1 if either file would change
 *
 * Exit 0:  files written / already up to date.
 * Exit 1:  parse failure (index.ts missing/malformed, markers missing), OR
 *          (--check) drift detected.
 *
 * No external deps — pure node:fs. (Mirrors the --check contract of
 * scripts/emit-meta.mjs.)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const componentsRoot = join(repoRoot, 'src', 'components')
const indexPath = join(componentsRoot, 'index.ts')
const emitMetaPath = join(__dirname, 'emit-meta.mjs')
const componentsMdPath = join(repoRoot, 'COMPONENTS.md')
const claudeMdPath = join(repoRoot, 'CLAUDE.md')

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')

/* Generated-region markers injected into CLAUDE.md. Only the text BETWEEN a
 * matching BEGIN/END pair is regenerated — surrounding prose is untouched. */
const MARK = {
  count: {
    begin: '<!-- BEGIN:GENERATED:component-count -->',
    end: '<!-- END:GENERATED:component-count -->',
  },
  inventory: {
    begin: '<!-- BEGIN:GENERATED:component-inventory -->',
    end: '<!-- END:GENERATED:component-inventory -->',
  },
  testCoverage: {
    begin: '<!-- BEGIN:GENERATED:test-coverage -->',
    end: '<!-- END:GENERATED:test-coverage -->',
  },
  // #504 — the hooks inventory. Generating it from `src/hooks/index.ts` (the
  // same barrel emit-meta reads) means a hook cannot ship undocumented: adding
  // one without running `sync-docs` fails `sync-docs:check` in CI.
  hooks: {
    begin: '<!-- BEGIN:GENERATED:hook-inventory -->',
    end: '<!-- END:GENERATED:hook-inventory -->',
  },
}

function fail(msg) {
  console.error(`[sync-docs] ${msg}`)
  process.exit(1)
}

if (!existsSync(indexPath)) fail(`Cannot find ${indexPath}`)

const indexSrc = readFileSync(indexPath, 'utf8')

/* ------------------------------------------------------------------ */
/* 1. Canonical component name set (matches dist/meta.json exactly).   */
/*    Capitalized value exports, aliases resolved, hooks filtered.     */
/* ------------------------------------------------------------------ */

const valueExportRe = /^export\s+\{([^}]+)\}\s+from\s+['"]\.\/([^'"]+)['"]/gm

/** ordered list of { name, dir } for every canonical component, in source order */
const components = []
const seenNames = new Set()
for (const m of indexSrc.matchAll(valueExportRe)) {
  const dir = m[2]
  for (let raw of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
    // Resolve `Foo as Bar` -> `Bar`
    const name = raw.includes(' as ') ? raw.split(' as ')[1].trim() : raw
    // Components are Capitalized; this drops hooks (useToast, useFormContext, …)
    if (!/^[A-Z]/.test(name)) continue
    if (seenNames.has(name)) continue
    seenNames.add(name)
    components.push({ name, dir })
  }
}

if (components.length === 0) fail('Parsed 0 components from index.ts — refusing to write.')

const componentCount = components.length

/* ------------------------------------------------------------------ */
/* 2. Category map — single source of truth is emit-meta.mjs.          */
/* ------------------------------------------------------------------ */

function loadCategoryMap() {
  if (!existsSync(emitMetaPath)) fail(`Cannot find ${emitMetaPath} (needed for categories)`)
  const src = readFileSync(emitMetaPath, 'utf8')
  const start = src.indexOf('const COMPONENT_CATEGORIES = {')
  if (start === -1) fail('Could not locate COMPONENT_CATEGORIES in emit-meta.mjs')
  const braceStart = src.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) fail('Could not parse COMPONENT_CATEGORIES object literal')
  const objText = src.slice(braceStart, end + 1)
  const entryRe = /([A-Za-z][A-Za-z0-9]*)\s*:\s*['"]([^'"]+)['"]/g
  const map = new Map()
  const order = []
  let m
  while ((m = entryRe.exec(objText)) !== null) {
    const [, name, category] = m
    map.set(name, category)
    if (!order.includes(category)) order.push(category)
  }
  return { map, order }
}

const { map: categoryOf, order: categoryOrder } = loadCategoryMap()

// Every canonical component should have a category. If not, surface it loudly
// rather than silently dropping it from the inventory.
const uncategorized = components.filter((c) => !categoryOf.has(c.name))
if (uncategorized.length > 0) {
  fail(
    `These exported components are missing from COMPONENT_CATEGORIES in emit-meta.mjs: ` +
      uncategorized.map((c) => c.name).join(', ')
  )
}

/* ------------------------------------------------------------------ */
/* 3. Test-coverage figures — real counts from the filesystem.        */
/* ------------------------------------------------------------------ */

function listComponentDirs() {
  return readdirSync(componentsRoot)
    .filter((entry) => statSync(join(componentsRoot, entry)).isDirectory())
    .sort()
}

function dirHasTest(dir) {
  return readdirSync(join(componentsRoot, dir)).some((f) => f.endsWith('.test.tsx'))
}

function countTestFiles(dir) {
  return readdirSync(join(componentsRoot, dir)).filter((f) => f.endsWith('.test.tsx')).length
}

const componentDirs = listComponentDirs()
const dirsWithTests = componentDirs.filter(dirHasTest)
const testFileCount = componentDirs.reduce((n, d) => n + countTestFiles(d), 0)

/* ------------------------------------------------------------------ */
/* 4. Render COMPONENTS.md (directory-grouped, preserves prior shape). */
/* ------------------------------------------------------------------ */

function renderComponentsMd() {
  // Bucket components by their owning directory, in source order.
  const byDir = new Map()
  for (const { name, dir } of components) {
    if (!byDir.has(dir)) byDir.set(dir, [])
    byDir.get(dir).push(name)
  }

  const lines = []
  lines.push('<!--')
  lines.push('  AUTO-GENERATED FILE — do not edit by hand.')
  lines.push('  Regenerate with: node scripts/sync-docs.mjs')
  lines.push('  Source of truth: src/components/index.ts')
  lines.push('-->')
  lines.push('')
  lines.push('# Lando Labs Design System — Component Inventory')
  lines.push('')
  lines.push(
    `This file is generated from \`src/components/index.ts\`. It lists all **${componentCount}** ` +
      `exported components, grouped by category, and matches the count published to ` +
      `\`dist/meta.json\`.`
  )
  lines.push('')

  for (const category of categoryOrder) {
    const inCat = components.filter((c) => categoryOf.get(c.name) === category)
    if (inCat.length === 0) continue
    lines.push(`## ${category}`)
    lines.push('')
    for (const { name, dir } of inCat) {
      lines.push(`- **${name}** — \`./${dir}\``)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* 5. Render the CLAUDE.md generated regions.                          */
/* ------------------------------------------------------------------ */

function renderCountRegion() {
  // Kept intentionally tiny — this is inlined mid-sentence in CLAUDE.md.
  return `**${componentCount} components**`
}

function renderInventoryRegion() {
  const lines = []
  lines.push(
    `The design system exports **${componentCount} components** from ` +
      `\`src/components/index.ts\`, grouped below by role. This count and list are ` +
      `generated from the barrel file and match the set published to \`dist/meta.json\`. ` +
      `All components ship with TypeScript definitions and CSS Modules keyed on design ` +
      `tokens. The related sub-exports (e.g. \`CardHeader\`, \`useToast\`) live alongside ` +
      `each component; see \`COMPONENTS.md\` for the per-directory breakdown and ` +
      `\`/reference/components.md\` for the full API reference.`
  )
  lines.push('')

  for (const category of categoryOrder) {
    const inCat = components.filter((c) => categoryOf.get(c.name) === category)
    if (inCat.length === 0) continue
    lines.push(`**${category}** (${inCat.length}): ${inCat.map((c) => c.name).join(', ')}`)
    lines.push('')
  }

  // Note the Icon wrapper, which is re-exported via `export *` (and therefore
  // not a distinct value export counted above) alongside curated lucide icons.
  lines.push(
    `> The \`Icon\` wrapper and the curated lucide-react icon set are re-exported via ` +
      `\`export * from './Icon'\`; being a wildcard re-export they are not counted in the ` +
      `${componentCount} figure above.`
  )

  return lines.join('\n')
}

function renderTestCoverageRegion() {
  return (
    `**Test coverage status**: Test infrastructure (Vitest + Testing Library) is wired up. ` +
    `**${dirsWithTests.length} of ${componentDirs.length}** component directories have at ` +
    `least one \`*.test.tsx\` file (${testFileCount} test files in total under ` +
    `\`src/components\`). Depth still varies — many are smoke-level — and backfill is ongoing. ` +
    `This line is generated by ` +
    `\`scripts/sync-docs.mjs\` from a real count of \`src/components/**/*.test.tsx\`.`
  )
}

/* ------------------------------------------------------------------ */
/* 5b. Hooks inventory (#504).                                          */
/* ------------------------------------------------------------------ */

/**
 * The public hooks surface, read from the SAME barrel emit-meta reads
 * (`src/hooks/index.ts`), so CLAUDE.md, meta.json and the package agree.
 *
 * This exists because the DS shipped four exported hooks that were documented
 * NOWHERE and absent from meta — so a consumer importing the DS in 77 files
 * still hand-rolled its own `useFocusTrap`. Generating the inventory means a new
 * hook that skips `sync-docs` fails `sync-docs:check` in CI.
 */
function listHooks() {
  const hooksIndex = join(repoRoot, 'src', 'hooks', 'index.ts')
  if (!existsSync(hooksIndex)) return []
  const src = readFileSync(hooksIndex, 'utf8')
  const out = []
  for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"]/g)) {
    const file = m[2]
    for (const raw of m[1].split(',')) {
      const spec = raw.trim()
      if (!spec || spec.startsWith('type ')) continue
      const name = (spec.split(/\s+as\s+/).pop() ?? spec).trim()
      if (!/^use[A-Z]/.test(name)) continue
      const hookFile = ['.ts', '.tsx']
        .map((ext) => join(repoRoot, 'src', 'hooks', `${file}${ext}`))
        .find((p) => existsSync(p))
      let category = 'utility'
      if (hookFile) {
        const tag = readFileSync(hookFile, 'utf8').match(/@category\s+([^\n*]+)/)
        if (tag) category = tag[1].trim()
      }
      out.push({ name, category })
    }
  }
  return out
}

function renderHookRegion() {
  const hooks = listHooks()
  if (hooks.length === 0) return '_(no hooks exported)_'
  const byCategory = new Map()
  for (const h of hooks) {
    if (!byCategory.has(h.category)) byCategory.set(h.category, [])
    byCategory.get(h.category).push(h.name)
  }
  const lines = [
    `The design system exports **${hooks.length} hooks** from \`src/hooks/index.ts\`, importable from the package root or the \`/hooks\` subpath, and queryable from \`meta.json\`'s \`hooks\` section (schema 1.3+).`,
    '',
  ]
  for (const category of [...byCategory.keys()].sort()) {
    const names = byCategory.get(category).sort()
    lines.push(`**${category}** (${names.length}): ${names.join(', ')}`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

/**
 * Replace the content between a BEGIN/END marker pair. The markers themselves
 * are preserved on their own lines; only the body is swapped. Fails loudly if
 * a marker is missing so a malformed CLAUDE.md never gets silently corrupted.
 */
function replaceRegion(source, marker, body) {
  const beginIdx = source.indexOf(marker.begin)
  const endIdx = source.indexOf(marker.end)
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    fail(`Missing or malformed markers in CLAUDE.md: ${marker.begin} / ${marker.end}`)
  }
  const before = source.slice(0, beginIdx + marker.begin.length)
  const after = source.slice(endIdx)
  return `${before}\n${body}\n${after}`
}

function renderClaudeMd(existing) {
  let out = existing
  out = replaceRegion(out, MARK.count, renderCountRegion())
  out = replaceRegion(out, MARK.inventory, renderInventoryRegion())
  out = replaceRegion(out, MARK.testCoverage, renderTestCoverageRegion())
  out = replaceRegion(out, MARK.hooks, renderHookRegion())
  return out
}

/* ------------------------------------------------------------------ */
/* 6. Write or --check.                                                */
/* ------------------------------------------------------------------ */

const nextComponentsMd = renderComponentsMd()

if (!existsSync(claudeMdPath)) fail(`Cannot find ${claudeMdPath}`)
const currentClaudeMd = readFileSync(claudeMdPath, 'utf8')
const nextClaudeMd = renderClaudeMd(currentClaudeMd)

const priorComponentsMd = existsSync(componentsMdPath)
  ? readFileSync(componentsMdPath, 'utf8')
  : null

const componentsMdChanged = priorComponentsMd !== nextComponentsMd
const claudeMdChanged = currentClaudeMd !== nextClaudeMd

if (checkOnly) {
  let drift = false
  if (componentsMdChanged) {
    console.error('[sync-docs] DRIFT: COMPONENTS.md out of date — run `npm run sync-docs`.')
    drift = true
  }
  if (claudeMdChanged) {
    console.error(
      '[sync-docs] DRIFT: CLAUDE.md generated regions out of date — run `npm run sync-docs`.'
    )
    drift = true
  }
  if (!drift) {
    console.log(
      `[sync-docs] Up to date — ${componentCount} components, ` +
        `${dirsWithTests.length}/${componentDirs.length} dirs tested (${testFileCount} test files).`
    )
  }
  process.exit(drift ? 1 : 0)
}

if (componentsMdChanged) {
  writeFileSync(componentsMdPath, nextComponentsMd)
  console.log(`[sync-docs] Wrote COMPONENTS.md — ${componentCount} components.`)
} else {
  console.log(`[sync-docs] COMPONENTS.md already up to date (${componentCount} components).`)
}

if (claudeMdChanged) {
  writeFileSync(claudeMdPath, nextClaudeMd)
  console.log(
    `[sync-docs] Updated CLAUDE.md regions — ${componentCount} components, ` +
      `${dirsWithTests.length}/${componentDirs.length} dirs tested (${testFileCount} test files).`
  )
} else {
  console.log('[sync-docs] CLAUDE.md generated regions already up to date.')
}
