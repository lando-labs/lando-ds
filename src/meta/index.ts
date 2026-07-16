/**
 * Lando Labs Design System — Meta Schema (#418, #419)
 *
 * Public entry for the inline meta-schema. Re-exported from
 * `@lando-labs/lando-ds/meta-schema`.
 *
 * @example
 * import type { Meta, LightComponentMeta } from '@lando-labs/lando-ds/meta-schema'
 * import { validateMeta, META_SCHEMA } from '@lando-labs/lando-ds/meta-schema'
 *
 * @example
 * // Load the emitted meta and verify it
 * import meta from '@lando-labs/lando-ds/meta'
 * const result = await validateMeta(meta)
 * if (!result.valid) console.error(result.errors)
 */

export type {
  Meta,
  MetaSchemaVersion,
  PackageMeta,
  PropMeta,
  DeprecationMeta,
  ComposesMeta,
  LightComponentMeta,
  VerboseComponentMeta,
  TokensMeta,
  IconRegistryEntry,
  IconsMeta,
  ExportsMeta,
  CapabilitiesMeta,
  LightMeta,
  VerboseMeta,
} from './types'

export { validateMeta, isMetaShape, META_SCHEMA } from './validate'
