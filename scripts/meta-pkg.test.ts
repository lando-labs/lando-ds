/**
 * meta-pkg.test.ts (#430, #419)
 *
 * Tests the ASSEMBLED meta-artifact packages, reading the REAL output on
 * disk (not fixtures). The test assembles both packages in `beforeAll`
 * (the assemble scripts are pure, fast Node) against the actual emitted
 * `dist/meta.json`, then asserts VERSION-AGNOSTIC invariants only.
 *
 * IMPORTANT: this file deliberately asserts NOTHING about any specific
 * schema version's fields (no 1.0/1.1/1.2-specific keys). The sibling
 * schema lane evolves the shape; these invariants must survive that. We
 * only assert structural packaging guarantees + that the real emitted
 * meta validates against the real vendored schema.
 *
 * Requires `dist/meta.json` + `dist/meta.verbose.json` to exist (run
 * `npm run build` first); the repo's existing meta tests share that
 * precondition.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = resolve(__dirname, '..')
const schemaPkgDir = join(repoRoot, 'dist-meta-schema')
const dataPkgDir = join(repoRoot, 'dist-meta')

const distMetaPath = join(repoRoot, 'dist', 'meta.json')

function readJson(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, 'utf8'))
}

function dirSizeBytes(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    total += st.isDirectory() ? dirSizeBytes(full) : st.size
  }
  return total
}

/**
 * Packed (gzipped) tarball size npm would publish — measured via
 * `npm pack --dry-run --json`, the same way the assemble script enforces
 * the budget. This is the on-the-wire size that the < 200 KB budget guards
 * (the unpacked dir is larger because it ships the full verbose meta).
 */
function packedTarballBytes(dir: string): number {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return JSON.parse(raw)[0].size as number
}

let schemaPkg: Record<string, unknown>
let dataPkg: Record<string, unknown>

beforeAll(() => {
  if (!existsSync(distMetaPath)) {
    throw new Error(
      `dist/meta.json missing. Run 'npm run build' before this test. Looked for:\n  ${distMetaPath}`
    )
  }
  // Assemble both packages against the real emitted dist. `stdio: 'pipe'`
  // keeps the vitest reporter clean; a non-zero exit throws and fails here.
  execFileSync('node', ['scripts/assemble-meta-schema-pkg.mjs'], {
    cwd: repoRoot,
    stdio: 'pipe',
  })
  execFileSync('node', ['scripts/assemble-meta-pkg.mjs'], {
    cwd: repoRoot,
    stdio: 'pipe',
  })
  schemaPkg = readJson(join(schemaPkgDir, 'package.json'))
  dataPkg = readJson(join(dataPkgDir, 'package.json'))
})

describe('assembled meta-schema package (@lando-labs/lando-ds-meta-schema)', () => {
  it('has the correct name', () => {
    expect(schemaPkg.name).toBe('@lando-labs/lando-ds-meta-schema')
  })

  it('has a non-empty version', () => {
    expect(typeof schemaPkg.version).toBe('string')
    expect((schemaPkg.version as string).length).toBeGreaterThan(0)
  })

  it('version is strict semver whose major.minor tracks the schema $schemaVersion', () => {
    // Read the schema version the SAME version-agnostic way the script does,
    // so this invariant holds when the sibling lane bumps the schema.
    const schema = readJson(join(schemaPkgDir, 'meta-schema.json'))
    const version =
      (schema['$schemaVersion'] as string | undefined) ??
      ((schema.properties as Record<string, { const?: string; enum?: string[] }> | undefined)
        ?.['$schemaVersion']?.const) ??
      ((schema.properties as Record<string, { const?: string; enum?: string[] }> | undefined)
        ?.['$schemaVersion']?.enum?.[0])
    expect(version).toBeTruthy()
    // The npm version is strict semver (1.2 -> 1.2.0); its major.minor tracks
    // the schema shape, with PATCH reserved for validator-only fixes.
    const pkgVersion = schemaPkg.version as string
    expect(pkgVersion).toMatch(/^\d+\.\d+\.\d+$/)
    const [maj, min] = pkgVersion.split('.')
    expect(`${maj}.${min}`).toBe(version)
  })

  it('declares an exports map for . / ./schema / ./validate / ./types', () => {
    const exp = schemaPkg.exports as Record<string, unknown>
    expect(exp).toBeTruthy()
    expect(exp['.']).toBeTruthy()
    expect(exp['./schema']).toBeTruthy()
    expect(exp['./validate']).toBeTruthy()
    expect(exp['./types']).toBeTruthy()
  })

  it('has public publishConfig targeting npmjs', () => {
    const pc = schemaPkg.publishConfig as Record<string, string>
    expect(pc).toBeTruthy()
    expect(pc.access).toBe('public')
    expect(pc.registry).toBeUndefined()
  })

  it('is an ESM package', () => {
    expect(schemaPkg.type).toBe('module')
  })

  it('ships the schema, types, and validator files', () => {
    for (const f of ['meta-schema.json', 'types.d.ts', 'validate.mjs', 'validate.d.ts', 'README.md']) {
      expect(existsSync(join(schemaPkgDir, f)), `${f} should exist`).toBe(true)
    }
  })

  it("vendored meta-schema.json byte-matches src/meta/schema.json", () => {
    const vendored = readFileSync(join(schemaPkgDir, 'meta-schema.json'), 'utf8')
    const source = readFileSync(join(repoRoot, 'src', 'meta', 'schema.json'), 'utf8')
    expect(vendored).toBe(source)
  })
})

describe('assembled data package (@lando-labs/lando-ds-meta)', () => {
  it('has the correct name', () => {
    expect(dataPkg.name).toBe('@lando-labs/lando-ds-meta')
  })

  it('has a non-empty version matching the root DS package version', () => {
    const rootPkg = readJson(join(repoRoot, 'package.json'))
    expect(typeof dataPkg.version).toBe('string')
    expect((dataPkg.version as string).length).toBeGreaterThan(0)
    expect(dataPkg.version).toBe(rootPkg.version)
  })

  it('declares an exports map for . / ./verbose / ./schema / ./types', () => {
    const exp = dataPkg.exports as Record<string, unknown>
    expect(exp).toBeTruthy()
    expect(exp['.']).toBeTruthy()
    expect(exp['./verbose']).toBeTruthy()
    expect(exp['./schema']).toBeTruthy()
    expect(exp['./types']).toBeTruthy()
  })

  it('has public publishConfig targeting npmjs', () => {
    const pc = dataPkg.publishConfig as Record<string, string>
    expect(pc).toBeTruthy()
    expect(pc.access).toBe('public')
    expect(pc.registry).toBeUndefined()
  })

  it('is an ESM package', () => {
    expect(dataPkg.type).toBe('module')
  })

  it('has ZERO runtime dependencies', () => {
    const deps = (dataPkg.dependencies ?? {}) as Record<string, string>
    expect(Object.keys(deps)).toHaveLength(0)
  })

  it('packed tarball is under the 200 KB budget', () => {
    // The budget applies to the PUBLISHED (gzipped) tarball — the on-the-wire
    // install cost — not the unpacked dir (which is larger because it ships
    // the full verbose meta the spec requires).
    const packed = packedTarballBytes(dataPkgDir)
    expect(packed).toBeLessThan(200 * 1024)
    // Sanity: the raw dir is measurable and non-trivial (guards a stubbed dir).
    expect(dirSizeBytes(dataPkgDir)).toBeGreaterThan(0)
  })

  it('ships meta.json, meta.verbose.json, the vendored schema, types, README', () => {
    for (const f of ['meta.json', 'meta.verbose.json', 'meta-schema.json', 'types.d.ts', 'README.md']) {
      expect(existsSync(join(dataPkgDir, f)), `${f} should exist`).toBe(true)
    }
  })

  it("vendored meta-schema.json byte-matches src/meta/schema.json", () => {
    const vendored = readFileSync(join(dataPkgDir, 'meta-schema.json'), 'utf8')
    const source = readFileSync(join(repoRoot, 'src', 'meta', 'schema.json'), 'utf8')
    expect(vendored).toBe(source)
  })

  it('bundled meta.json byte-matches the emitted dist/meta.json', () => {
    const bundled = readFileSync(join(dataPkgDir, 'meta.json'), 'utf8')
    const emitted = readFileSync(distMetaPath, 'utf8')
    expect(bundled).toBe(emitted)
  })
})

describe('schema package validate() against the REAL emitted meta', () => {
  it('returns { valid: true } on the actual dist/meta.json', async () => {
    const validateMod = await import(
      pathToFileURL(join(schemaPkgDir, 'validate.mjs')).href
    )
    const meta = readJson(distMetaPath)
    const result = validateMod.validate(meta)
    if (!result.valid) {
      // Surface why, so a real drift is debuggable from CI output.
      console.error('validate() errors:', JSON.stringify(result.errors, null, 2).slice(0, 2000))
    }
    expect(result.valid).toBe(true)
    expect(result.errors).toBeNull()
  })

  it('validates the verbose artifact too', async () => {
    const validateMod = await import(
      pathToFileURL(join(schemaPkgDir, 'validate.mjs')).href
    )
    const verbose = readJson(join(repoRoot, 'dist', 'meta.verbose.json'))
    const result = validateMod.validate(verbose)
    expect(result.valid).toBe(true)
  })

  it('rejects an obviously-broken blob (guards against a no-op validator)', async () => {
    const validateMod = await import(
      pathToFileURL(join(schemaPkgDir, 'validate.mjs')).href
    )
    const result = validateMod.validate({ not: 'a meta blob' })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeTruthy()
  })
})
