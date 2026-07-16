#!/usr/bin/env node
/**
 * validate-meta.mjs (#419)
 *
 * Standalone build hook: validate the DS's OWN emitted meta artifacts
 * (dist/meta.json and dist/meta.verbose.json) using the SAME validator the
 * @lando-labs/lando-ds-meta-schema package ships.
 *
 * This is intentionally a NEW, non-breaking script (it does NOT touch
 * emit-meta.mjs). Wire it into CI / a release check via the
 * `validate:meta` npm script.
 *
 * Validator resolution (VERSION-AGNOSTIC — never assumes a schema version):
 *   1. If `dist-meta-schema/validate.mjs` has been assembled, import and use
 *      its `validate()` — exercises the exact artifact we publish.
 *   2. Otherwise, compile `src/meta/schema.json` with ajv directly (same
 *      options as the schema package). This keeps the hook usable in a
 *      fresh checkout that hasn't run `assemble:meta-schema` yet.
 *
 * Usage: node scripts/validate-meta.mjs
 * Exit 0: both artifacts valid (or gracefully skipped if absent).
 * Exit 1: any artifact fails schema validation.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { repoRoot } from './lib/meta-pkg-common.mjs'

/**
 * Resolve a `validate(meta) => { valid, errors }` function, preferring the
 * assembled package artifact and falling back to a fresh ajv compile of the
 * in-repo schema.
 */
async function resolveValidator() {
  const assembled = join(repoRoot, 'dist-meta-schema', 'validate.mjs')
  if (existsSync(assembled)) {
    const mod = await import(pathToFileURL(assembled).href)
    if (typeof mod.validate === 'function') {
      return { validate: mod.validate, source: 'dist-meta-schema/validate.mjs' }
    }
  }

  // Fallback: compile the in-repo schema directly with ajv.
  const { default: Ajv } = await import('ajv')
  const schema = JSON.parse(
    readFileSync(join(repoRoot, 'src', 'meta', 'schema.json'), 'utf8')
  )
  const ajv = new Ajv({ allErrors: true, strict: false })
  const compiled = ajv.compile(schema)
  const validate = (meta) => {
    const valid = compiled(meta)
    return { valid, errors: valid ? null : (compiled.errors ?? null) }
  }
  return { validate, source: 'src/meta/schema.json (ajv fallback)' }
}

const { validate, source } = await resolveValidator()
console.log(`[validate-meta] validator: ${source}`)

const targets = [
  ['dist/meta.json', join(repoRoot, 'dist', 'meta.json')],
  ['dist/meta.verbose.json', join(repoRoot, 'dist', 'meta.verbose.json')],
]

let failed = false
let checked = 0

for (const [label, path] of targets) {
  if (!existsSync(path)) {
    console.warn(`[validate-meta] ${label} not found — skipping (run \`npm run build\`).`)
    continue
  }
  checked++
  const meta = JSON.parse(readFileSync(path, 'utf8'))
  const { valid, errors } = validate(meta)
  if (valid) {
    console.log(`[validate-meta] OK  ${label} (schema ${meta['$schemaVersion']})`)
  } else {
    failed = true
    console.error(`[validate-meta] FAIL ${label}:`)
    console.error(JSON.stringify(errors, null, 2).slice(0, 4000))
  }
}

if (checked === 0) {
  console.warn('[validate-meta] No meta artifacts found to validate.')
}

process.exit(failed ? 1 : 0)
