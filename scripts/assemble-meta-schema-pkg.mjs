#!/usr/bin/env node
/**
 * assemble-meta-schema-pkg.mjs (#419)
 *
 * Assembles the publishable directory `dist-meta-schema/` for the package
 *
 *     @lando-labs/lando-ds-meta-schema
 *
 * This package is the SCHEMA + VALIDATOR, decoupled from any particular
 * DS build. Its npm version === the meta schema's `$schemaVersion` (read
 * at runtime from src/meta/schema.json — NEVER hard-coded). Ship a new
 * schema version → publish a new package version.
 *
 * Contents:
 *   - meta-schema.json  copied verbatim from src/meta/schema.json
 *   - types.d.ts        the meta TS types (vendored from src/meta/types.ts)
 *   - validate.mjs      runtime `validate(meta) => { valid, errors }` (ajv)
 *   - validate.d.ts     declarations for validate.mjs
 *   - README.md
 *   - package.json      name, version=$schemaVersion, exports, publishConfig
 *
 * Runtime dependency: ajv (this package validates at runtime; ajv is the
 * one acceptable runtime dep here).
 *
 * Usage: node scripts/assemble-meta-schema-pkg.mjs
 * Exit 0 on success; non-zero on any failure.
 */

import { join } from 'node:path'

import {
  repoRoot,
  readJson,
  readText,
  readSchemaVersion,
  schemaSemver,
  freshDir,
  writeFile,
  writePackageJson,
  buildTypesDts,
  dirSizeBytes,
  kb,
} from './lib/meta-pkg-common.mjs'

const OUT_DIR = join(repoRoot, 'dist-meta-schema')

/* ------------------------------------------------------------------ */
/* 1. Read sources + resolve the schema version.                       */
/* ------------------------------------------------------------------ */

const schema = readJson('src/meta/schema.json')
const schemaVersion = readSchemaVersion(schema)
// npm version = strict semver of the schema shape (1.2 -> 1.2.0); PATCH is
// free for validator/packaging fixes that don't change the schema shape.
const schemaPkgVersion = schemaSemver(schemaVersion)

// The ajv version we pin as a runtime dep should track the one already in
// the DS devDeps, so the validator behaves identically to the build-time
// emit step. Read it rather than hard-coding.
const rootPkg = readJson('package.json')
const ajvRange =
  rootPkg.dependencies?.ajv ??
  rootPkg.devDependencies?.ajv ??
  '^8.0.0'

console.log(
  `[assemble-meta-schema] schema $schemaVersion = ${schemaVersion} -> pkg version ${schemaPkgVersion}`
)

/* ------------------------------------------------------------------ */
/* 2. (Re)create the output dir.                                       */
/* ------------------------------------------------------------------ */

freshDir(OUT_DIR)

/* ------------------------------------------------------------------ */
/* 3. meta-schema.json — verbatim copy (byte-for-byte).                */
/* ------------------------------------------------------------------ */

const schemaRaw = readText('src/meta/schema.json')
writeFile(join(OUT_DIR, 'meta-schema.json'), schemaRaw)

/* ------------------------------------------------------------------ */
/* 4. types.d.ts — vendored declarations from src/meta/types.ts.       */
/* ------------------------------------------------------------------ */

const typesBanner = `/**
 * @lando-labs/lando-ds-meta-schema — meta type declarations
 *
 * Vendored verbatim from the Lando Labs Design System source
 * (src/meta/types.ts). Do not edit by hand; regenerate via the DS repo's
 * \`npm run assemble:meta-schema\`.
 *
 * Schema version: ${schemaVersion}
 * Source: https://github.com/lando-labs/lando-ds
 */`
writeFile(join(OUT_DIR, 'types.d.ts'), buildTypesDts(typesBanner))

/* ------------------------------------------------------------------ */
/* 5. validate.mjs + validate.d.ts — runtime ajv validator.            */
/*                                                                     */
/*    Mirrors src/meta/validate.ts's contract but as a self-contained  */
/*    ESM module that imports the vendored meta-schema.json and ajv.    */
/*    VERSION-AGNOSTIC: it validates against whatever schema shipped.   */
/* ------------------------------------------------------------------ */

const validateMjs = `/**
 * @lando-labs/lando-ds-meta-schema — runtime validator
 *
 * validate(meta) => { valid: boolean; errors: object[] | null }
 *
 * Validates a parsed meta blob against the vendored meta-schema.json using
 * ajv. The schema is self-contained in this package, so validation does
 * not depend on the DS being installed.
 *
 * @example
 *   import { validate } from '@lando-labs/lando-ds-meta-schema/validate'
 *   import meta from '@lando-labs/lando-ds-meta'
 *   const { valid, errors } = validate(meta)
 *   if (!valid) console.error(errors)
 */

import Ajv from 'ajv'
import schema from './meta-schema.json' with { type: 'json' }

/** The vendored meta JSON schema (draft-07). */
export { default as schema } from './meta-schema.json' with { type: 'json' }

let cachedValidator = null

function getValidator() {
  if (cachedValidator) return cachedValidator
  const ajv = new Ajv({ allErrors: true, strict: false })
  cachedValidator = ajv.compile(schema)
  return cachedValidator
}

/**
 * Validate a parsed meta object against the meta schema.
 *
 * @param {unknown} meta - Parsed meta.json / meta.verbose.json contents.
 * @returns {{ valid: boolean, errors: object[] | null }}
 */
export function validate(meta) {
  const validator = getValidator()
  const valid = validator(meta)
  return { valid, errors: valid ? null : (validator.errors ?? null) }
}

export default validate
`
writeFile(join(OUT_DIR, 'validate.mjs'), validateMjs)

const validateDts = `/**
 * @lando-labs/lando-ds-meta-schema — validator declarations
 */
import type { Meta } from './types'

/** Ajv validation error object (see ajv's ErrorObject). */
export interface MetaValidationError {
  keyword: string
  instancePath: string
  schemaPath: string
  params: Record<string, unknown>
  message?: string
}

export interface MetaValidationResult {
  valid: boolean
  errors: MetaValidationError[] | null
}

/** The vendored meta JSON schema (draft-07) as a plain object. */
export declare const schema: Record<string, unknown>

/**
 * Validate a parsed meta object against the meta schema.
 * When \`valid\` is true the input conforms to {@link Meta}.
 */
export declare function validate(meta: unknown): MetaValidationResult
export default validate
`
writeFile(join(OUT_DIR, 'validate.d.ts'), validateDts)

/* ------------------------------------------------------------------ */
/* 6. README.md                                                        */
/* ------------------------------------------------------------------ */

const schemaReadme = `# @lando-labs/lando-ds-meta-schema

The **schema + runtime validator** for the [Lando Labs Design System][ds]
self-describing \`meta.json\` artifact.

- **What it is:** the JSON Schema (draft-07) that every DS \`meta.json\` /
  \`meta.verbose.json\` conforms to, plus TypeScript types and an \`ajv\`-backed
  \`validate()\` helper.
- **Versioning:** this package's version tracks the meta **schema version**
  (\`$schemaVersion\`), *not* the DS release. Current: \`${schemaVersion}\`.
  For the DS *content* snapshot (components/tokens/icons of a specific
  release), install [\`@lando-labs/lando-ds-meta\`][data] instead.

## Install

\`\`\`sh
npm install @lando-labs/lando-ds-meta-schema
\`\`\`

> Published publicly on npm.

## Usage

\`\`\`js
import { validate, schema } from '@lando-labs/lando-ds-meta-schema/validate'
import type { Meta } from '@lando-labs/lando-ds-meta-schema/types'

import meta from '@lando-labs/lando-ds-meta' // or any DS meta.json

const { valid, errors } = validate(meta)
if (!valid) {
  console.error('meta.json failed schema validation:', errors)
}
\`\`\`

### Exports

| Subpath | What |
| --- | --- |
| \`.\` | \`validate\`, \`schema\` (default = \`validate\`) |
| \`./schema\` | the raw \`meta-schema.json\` |
| \`./validate\` | \`validate\`, \`schema\` |
| \`./types\` | TypeScript type declarations only |

## Links

- Design System repo: https://github.com/lando-labs/lando-ds
- Data package: [@lando-labs/lando-ds-meta][data]

[ds]: https://github.com/lando-labs/lando-ds
[data]: https://github.com/lando-labs/lando-ds
`
writeFile(join(OUT_DIR, 'README.md'), schemaReadme)

/* ------------------------------------------------------------------ */
/* 7. package.json                                                     */
/*                                                                     */
/*    version === schema $schemaVersion (read above). exports map for  */
/*    ., ./schema, ./validate, ./types. publishConfig restricted.      */
/* ------------------------------------------------------------------ */

const schemaPkg = {
  name: '@lando-labs/lando-ds-meta-schema',
  version: schemaPkgVersion,
  description:
    'JSON Schema, TypeScript types, and runtime validator for the Lando Labs Design System meta.json artifact.',
  license: rootPkg.license ?? 'Apache-2.0',
  author: rootPkg.author ?? 'Lando Labs',
  repository: rootPkg.repository,
  type: 'module',
  types: './types.d.ts',
  exports: {
    '.': {
      types: './validate.d.ts',
      import: './validate.mjs',
    },
    './schema': {
      types: './types.d.ts',
      default: './meta-schema.json',
    },
    './validate': {
      types: './validate.d.ts',
      import: './validate.mjs',
    },
    './types': {
      types: './types.d.ts',
    },
  },
  files: ['meta-schema.json', 'types.d.ts', 'validate.mjs', 'validate.d.ts', 'README.md'],
  dependencies: {
    ajv: ajvRange,
  },
  publishConfig: {
    access: 'public',
  },
  keywords: ['lando-labs', 'design-system', 'meta', 'json-schema', 'ajv', 'validation'],
}
writePackageJson(join(OUT_DIR, 'package.json'), schemaPkg)

/* ------------------------------------------------------------------ */
/* 8. Report.                                                          */
/* ------------------------------------------------------------------ */

const size = dirSizeBytes(OUT_DIR)
console.log(
  `[assemble-meta-schema] Wrote dist-meta-schema/ ` +
    `(${schemaPkg.name}@${schemaPkg.version}, ${kb(size)} KB, ` +
    `runtime deps: ajv ${ajvRange})`
)
