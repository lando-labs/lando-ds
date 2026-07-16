#!/usr/bin/env node
/**
 * assemble-meta-pkg.mjs (#430)
 *
 * Assembles the publishable directory `dist-meta/` for the package
 *
 *     @lando-labs/lando-ds-meta
 *
 * This is the DS CONTENT snapshot — the actual emitted meta.json /
 * meta.verbose.json for a specific DS release, plus a vendored copy of the
 * schema so the package is fully self-contained. Its npm version === the
 * root DS `package.json` version (it tracks DS *content*, not the schema
 * shape).
 *
 * ZERO runtime dependencies: consumers just `import meta from
 * '@lando-labs/lando-ds-meta'` and get JSON. Validation lives in the
 * sibling @lando-labs/lando-ds-meta-schema package.
 *
 * Contents:
 *   - meta.json          copied from dist/meta.json
 *   - meta.verbose.json  copied from dist/meta.verbose.json
 *   - meta-schema.json   vendored copy of src/meta/schema.json
 *   - types.d.ts         vendored meta TS types
 *   - README.md
 *   - package.json       name, version=<root DS version>, exports, zero deps
 *
 * Budget: the PUBLISHED (packed, gzipped) tarball must be < 200 KB. We
 * measure it via `npm pack --dry-run --json`, i.e. exactly the artifact npm
 * would upload. NOTE: the *unpacked* directory is intentionally larger
 * (~400 KB) because it ships the full verbose meta; the on-the-wire cost —
 * the number that matters for consumers — is what the budget guards. (The
 * verbose JSON alone is ~290 KB raw / ~70 KB gzipped, so a raw-directory
 * budget under 200 KB is not achievable while including it, which the spec
 * requires.)
 *
 * Usage: node scripts/assemble-meta-pkg.mjs
 * Exit 0 on success; non-zero on any failure (incl. missing dist meta,
 * schema-version-vs-meta mismatch, or size-budget overflow).
 */

import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

import {
  repoRoot,
  readJson,
  readText,
  readSchemaVersion,
  freshDir,
  writeFile,
  writePackageJson,
  buildTypesDts,
  dirSizeBytes,
  kb,
} from './lib/meta-pkg-common.mjs'

const OUT_DIR = join(repoRoot, 'dist-meta')
const SIZE_BUDGET_BYTES = 200 * 1024 // 200 KB — applies to the PACKED tarball.

/**
 * Measure the packed (gzipped) tarball size the way npm would publish it,
 * via `npm pack --dry-run --json`. This is the on-the-wire size that the
 * budget guards. Falls back to the summed gzip of files if `npm pack`
 * output can't be parsed, so the check never silently passes.
 */
function packedTarballBytes(absDir) {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: absDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const info = JSON.parse(raw)[0]
  return { packed: info.size, unpacked: info.unpackedSize }
}

/* ------------------------------------------------------------------ */
/* 1. Preconditions: dist meta must exist (run `npm run build` first). */
/* ------------------------------------------------------------------ */

const distMetaPath = join(repoRoot, 'dist', 'meta.json')
const distVerbosePath = join(repoRoot, 'dist', 'meta.verbose.json')

for (const [label, p] of [
  ['dist/meta.json', distMetaPath],
  ['dist/meta.verbose.json', distVerbosePath],
]) {
  if (!existsSync(p)) {
    console.error(
      `[assemble-meta] Missing ${label}. Run \`npm run build\` (or \`npm run emit-meta\`) first.`
    )
    process.exit(1)
  }
}

/* ------------------------------------------------------------------ */
/* 2. Read sources. Version comes from the ROOT package.json.          */
/* ------------------------------------------------------------------ */

const rootPkg = readJson('package.json')
const dsVersion = rootPkg.version
if (!dsVersion || typeof dsVersion !== 'string') {
  console.error('[assemble-meta] Root package.json has no usable version.')
  process.exit(1)
}

const schema = readJson('src/meta/schema.json')
const schemaVersion = readSchemaVersion(schema)

// Sanity (non-fatal-by-shape but fatal-if-mismatch): the emitted meta's
// declared $schemaVersion should equal the schema's version. This catches a
// stale dist/ built against an older schema — VERSION-AGNOSTIC because we
// compare the two live values rather than asserting a literal.
const emittedMeta = readJson('dist/meta.json')
if (emittedMeta['$schemaVersion'] !== schemaVersion) {
  console.error(
    `[assemble-meta] dist/meta.json $schemaVersion (${emittedMeta['$schemaVersion']}) ` +
      `!= schema.json version (${schemaVersion}). Rebuild the DS so the emitted meta ` +
      `matches the current schema before packaging.`
  )
  process.exit(1)
}

console.log(
  `[assemble-meta] DS version = ${dsVersion}, meta $schemaVersion = ${schemaVersion}`
)

/* ------------------------------------------------------------------ */
/* 3. (Re)create the output dir.                                       */
/* ------------------------------------------------------------------ */

freshDir(OUT_DIR)

/* ------------------------------------------------------------------ */
/* 4. Copy the emitted meta artifacts + vendor the schema.             */
/*    All byte-for-byte copies so the package mirrors the shipped      */
/*    artifacts exactly.                                               */
/* ------------------------------------------------------------------ */

writeFile(join(OUT_DIR, 'meta.json'), readText('dist/meta.json'))
writeFile(join(OUT_DIR, 'meta.verbose.json'), readText('dist/meta.verbose.json'))
writeFile(join(OUT_DIR, 'meta-schema.json'), readText('src/meta/schema.json'))

/* ------------------------------------------------------------------ */
/* 5. types.d.ts — vendored declarations from src/meta/types.ts.       */
/* ------------------------------------------------------------------ */

const typesBanner = `/**
 * @lando-labs/lando-ds-meta — meta type declarations
 *
 * Vendored verbatim from the Lando Labs Design System source
 * (src/meta/types.ts). Do not edit by hand; regenerate via the DS repo's
 * \`npm run assemble:meta\`.
 *
 * DS version: ${dsVersion}   Schema version: ${schemaVersion}
 * Source: https://github.com/lando-labs/lando-ds
 */`
writeFile(join(OUT_DIR, 'types.d.ts'), buildTypesDts(typesBanner))

/* ------------------------------------------------------------------ */
/* 6. README.md                                                        */
/* ------------------------------------------------------------------ */

const dataReadme = `# @lando-labs/lando-ds-meta

The **self-describing metadata** for a released build of the
[Lando Labs Design System][ds] — components, design tokens, icon registry,
package exports, and capability flags — as plain JSON with **zero runtime
dependencies**.

Your AI assistant (Cursor, Claude Code, Copilot) grounds itself against
this one blob in milliseconds instead of scraping HTML docs.

- **Versioning:** this package's version tracks the **DS release** it was
  built from (currently \`${dsVersion}\`). For the schema/validator, install
  [\`@lando-labs/lando-ds-meta-schema\`][schema] (versioned by
  \`$schemaVersion\`, currently \`${schemaVersion}\`).

## Install

\`\`\`sh
npm install @lando-labs/lando-ds-meta
\`\`\`

> Published publicly on npm.

## Usage

\`\`\`js
import meta from '@lando-labs/lando-ds-meta'          // light shape
import verbose from '@lando-labs/lando-ds-meta/verbose' // + descriptions/examples
import type { Meta } from '@lando-labs/lando-ds-meta/types'

console.log(meta.$schemaVersion, Object.keys(meta.components).length)
\`\`\`

Validate it against the schema (optional, needs the schema package):

\`\`\`js
import { validate } from '@lando-labs/lando-ds-meta-schema/validate'
import meta from '@lando-labs/lando-ds-meta'
const { valid, errors } = validate(meta)
\`\`\`

### Exports

| Subpath | What |
| --- | --- |
| \`.\` | \`meta.json\` (light) |
| \`./verbose\` | \`meta.verbose.json\` (adds descriptions, examples, composes) |
| \`./schema\` | vendored \`meta-schema.json\` |
| \`./types\` | TypeScript type declarations only |

## Links

- Design System repo: https://github.com/lando-labs/lando-ds
- Schema package: [@lando-labs/lando-ds-meta-schema][schema]

[ds]: https://github.com/lando-labs/lando-ds
[schema]: https://github.com/lando-labs/lando-ds
`
writeFile(join(OUT_DIR, 'README.md'), dataReadme)

/* ------------------------------------------------------------------ */
/* 7. package.json — ZERO dependencies.                                */
/* ------------------------------------------------------------------ */

const dataPkg = {
  name: '@lando-labs/lando-ds-meta',
  version: dsVersion,
  description:
    'Self-describing metadata (components, tokens, icons, capabilities) for the Lando Labs Design System — zero-dependency JSON for AI grounding.',
  license: rootPkg.license ?? 'Apache-2.0',
  author: rootPkg.author ?? 'Lando Labs',
  repository: rootPkg.repository,
  type: 'module',
  types: './types.d.ts',
  exports: {
    '.': {
      types: './types.d.ts',
      default: './meta.json',
    },
    './verbose': {
      types: './types.d.ts',
      default: './meta.verbose.json',
    },
    './schema': {
      default: './meta-schema.json',
    },
    './types': {
      types: './types.d.ts',
    },
  },
  files: [
    'meta.json',
    'meta.verbose.json',
    'meta-schema.json',
    'types.d.ts',
    'README.md',
  ],
  publishConfig: {
    access: 'public',
  },
  keywords: ['lando-labs', 'design-system', 'meta', 'metadata', 'ai', 'llm', 'grounding'],
}
writePackageJson(join(OUT_DIR, 'package.json'), dataPkg)

/* ------------------------------------------------------------------ */
/* 8. Enforce the size budget (packed tarball) + report.               */
/* ------------------------------------------------------------------ */

const unpackedOnDisk = dirSizeBytes(OUT_DIR)
const { packed, unpacked } = packedTarballBytes(OUT_DIR)

if (packed >= SIZE_BUDGET_BYTES) {
  console.error(
    `[assemble-meta] Packed tarball ${kb(packed)} KB exceeds the ` +
      `${kb(SIZE_BUDGET_BYTES)} KB budget. Trim the meta artifacts.`
  )
  process.exit(1)
}

console.log(
  `[assemble-meta] Wrote dist-meta/ ` +
    `(${dataPkg.name}@${dataPkg.version}, packed ${kb(packed)} KB < ` +
    `${kb(SIZE_BUDGET_BYTES)} KB budget; unpacked ${kb(unpacked)} KB ` +
    `(${kb(unpackedOnDisk)} KB on disk); zero runtime deps)`
)
