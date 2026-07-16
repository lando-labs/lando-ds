/**
 * meta-pkg-common.mjs (#430, #419)
 *
 * Shared, VERSION-AGNOSTIC helpers for the two meta-artifact packaging
 * scripts:
 *
 *   - scripts/assemble-meta-schema-pkg.mjs → @lando-labs/lando-ds-meta-schema
 *   - scripts/assemble-meta-pkg.mjs        → @lando-labs/lando-ds-meta
 *
 * NOTHING here hard-codes a schema version. The schema version is always
 * read from `src/meta/schema.json` at runtime so the machinery
 * automatically wraps whatever shape ships (1.0 today, 1.2 after the
 * sibling schema lane merges).
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Absolute repo root (this file lives at scripts/lib/). */
export const repoRoot = resolve(__dirname, '..', '..')

/** Read + parse a JSON file relative to the repo root. */
export function readJson(relPath) {
  return JSON.parse(readFileSync(join(repoRoot, relPath), 'utf8'))
}

/** Read a UTF-8 file relative to the repo root. */
export function readText(relPath) {
  return readFileSync(join(repoRoot, relPath), 'utf8')
}

/**
 * Resolve the meta schema version WITHOUT hard-coding it.
 *
 * The JSON-schema draft used here pins the version via a `const` on the
 * `$schemaVersion` property (currently `const: "1.0"`). Some future schema
 * revisions may instead (or additionally) carry a literal top-level
 * `$schemaVersion` field, or express the pin as a single-element `enum`.
 * We check all three locations, most-specific first, so this keeps working
 * across schema restructures the sibling lane may make.
 *
 * Throws if none is found — a missing version is a hard error, not a
 * silently-defaulted "0.0.0".
 */
export function readSchemaVersion(schema) {
  const literal = schema?.['$schemaVersion']
  if (typeof literal === 'string' && literal.length > 0) return literal

  const prop = schema?.properties?.['$schemaVersion']
  if (prop && typeof prop === 'object') {
    if (typeof prop.const === 'string' && prop.const.length > 0) return prop.const
    if (Array.isArray(prop.enum) && typeof prop.enum[0] === 'string' && prop.enum[0].length > 0) {
      return prop.enum[0]
    }
  }

  throw new Error(
    '[meta-pkg] Could not resolve schema version from schema.json ' +
      '(looked at top-level $schemaVersion, properties.$schemaVersion.const, ' +
      'and properties.$schemaVersion.enum[0]).'
  )
}

/**
 * Normalize a meta schema version (e.g. "1.2") to a strict semver string
 * ("1.2.0") for use as an npm `package.json` version. The schema shape's
 * MAJOR.MINOR tracks `$schemaVersion`; the PATCH slot is reserved for
 * validator/packaging fixes that don't change the schema shape.
 */
export function schemaSemver(schemaVersion) {
  const parts = String(schemaVersion).split('.')
  while (parts.length < 3) parts.push('0')
  return parts.slice(0, 3).join('.')
}

/** Recreate a directory empty (wipe if it exists, then mkdir -p). */
export function freshDir(absDir) {
  if (existsSync(absDir)) rmSync(absDir, { recursive: true, force: true })
  mkdirSync(absDir, { recursive: true })
}

/** Write a UTF-8 file, creating parent dirs as needed. */
export function writeFile(absPath, contents) {
  mkdirSync(dirname(absPath), { recursive: true })
  writeFileSync(absPath, contents, 'utf8')
}

/** Write a package.json with a trailing newline + 2-space indent. */
export function writePackageJson(absPath, obj) {
  writeFile(absPath, JSON.stringify(obj, null, 2) + '\n')
}

/**
 * Total size on disk of every file under `absDir`, in bytes. Used to
 * enforce the assembled-size budget for the data package.
 */
export function dirSizeBytes(absDir) {
  let total = 0
  for (const entry of readdirSync(absDir)) {
    const full = join(absDir, entry)
    const st = statSync(full)
    if (st.isDirectory()) total += dirSizeBytes(full)
    else total += st.size
  }
  return total
}

/** Format bytes as KB with one decimal. */
export function kb(bytes) {
  return (bytes / 1024).toFixed(1)
}

/**
 * Emit a `types.d.ts` derived from `src/meta/types.ts`.
 *
 * `src/meta/types.ts` is already a declaration-only module (pure `export
 * interface` / `export type` — no runtime code), so we can vendor it
 * verbatim as a `.d.ts`. We prepend a provenance banner and normalize the
 * leading header comment's package reference. Doing a copy (rather than a
 * one-line re-export) keeps each published package SELF-CONTAINED with no
 * dependency back on the DS source tree.
 *
 * VERSION-AGNOSTIC: whatever interfaces/types the sibling lane adds to
 * types.ts flow through untouched.
 */
export function buildTypesDts(banner) {
  const src = readText('src/meta/types.ts')
  return banner + '\n' + src
}
