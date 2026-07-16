/**
 * Runtime validator for the DS meta shape (#419).
 *
 * Uses Ajv at runtime to verify a meta blob against `./schema.json`. This
 * is the same schema used by the build-time emit step in
 * `scripts/emit-meta.mjs` and the same one exported from the
 * `@lando-labs/lando-ds/meta-schema` subpath — single source of truth.
 *
 * Lazy-loads Ajv so a consumer that imports the schema TYPES (the common
 * case) does not pay Ajv's cost just to look at TS shapes.
 */

import type { Meta } from './types'
import schema from './schema.json'

let cachedValidator: ((data: unknown) => boolean) | null = null
let cachedErrors: unknown = null

/**
 * Build (and cache) the Ajv validator. We require Ajv lazily so the
 * import graph stays minimal when only the TYPES are needed; importing
 * `validate` itself opts in to Ajv.
 */
async function getValidator(): Promise<(data: unknown) => boolean> {
  if (cachedValidator) return cachedValidator
  const AjvModule = (await import('ajv')) as unknown as {
    default: new (opts: Record<string, unknown>) => {
      compile: (schema: unknown) => ((data: unknown) => boolean) & { errors: unknown }
    }
  }
  const Ajv = AjvModule.default ?? (AjvModule as unknown as typeof AjvModule.default)
  const ajv = new Ajv({ allErrors: true, strict: false })
  const compiled = ajv.compile(schema)
  cachedValidator = (data: unknown) => {
    const ok = compiled(data) as boolean
    cachedErrors = compiled.errors
    return ok
  }
  return cachedValidator
}

/**
 * Validate a parsed meta blob against the schema.
 *
 * Async because the validator is lazy-loaded. Returns a discriminated
 * result instead of throwing so callers can decide how to surface
 * failures (build vs consumer).
 */
export async function validateMeta(
  data: unknown
): Promise<{ valid: true; data: Meta } | { valid: false; errors: unknown }> {
  const validator = await getValidator()
  if (validator(data)) {
    return { valid: true, data: data as Meta }
  }
  return { valid: false, errors: cachedErrors }
}

/**
 * Synchronous shape guard that does NOT load Ajv. Useful for hot paths
 * where the caller is willing to trust the producer (e.g. our own build
 * just wrote the file) and only wants a top-level smoke check.
 */
export function isMetaShape(data: unknown): data is Meta {
  if (typeof data !== 'object' || data === null) return false
  const m = data as Partial<Meta>
  return (
    (m.$schemaVersion === '1.0' ||
      m.$schemaVersion === '1.1' ||
      m.$schemaVersion === '1.2' ||
      m.$schemaVersion === '1.3') &&
    typeof m.package === 'object' &&
    m.package !== null &&
    typeof m.components === 'object' &&
    m.components !== null &&
    // `hooks` is required from schema 1.3 (#504). Guard on presence rather than
    // version so a 1.3 artifact without it is correctly rejected.
    (m.$schemaVersion !== '1.3' ||
      (typeof m.hooks === 'object' && m.hooks !== null)) &&
    typeof m.tokens === 'object' &&
    m.tokens !== null &&
    typeof m.icons === 'object' &&
    m.icons !== null &&
    typeof m.exports === 'object' &&
    m.exports !== null &&
    typeof m.capabilities === 'object' &&
    m.capabilities !== null
  )
}

/** Re-export the schema as a value so callers can use it directly. */
export const META_SCHEMA = schema
