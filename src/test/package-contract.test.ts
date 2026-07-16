// @vitest-environment node

/**
 * package.json contract guard (Sprint 59, #427 / claims-hygiene).
 *
 * Two documented promises live in package.json and were false/at-risk before
 * this sprint:
 *   1. The `--check` drift guards (emit-meta / emit-tokens / sync-docs) must
 *      exist as scripts AND be the ones CI wires in — losing them silently
 *      un-guards the self-describing artifacts.
 *   2. `llms.txt` is advertised (README) as shipped in the package. It is only
 *      reachable if it's in `files` AND `exports` AND present on disk.
 *
 * A missing `dev` script is intentional (the repo is library-only; the showcase
 * was removed — see CLAUDE.md), so `dev` is deliberately NOT required here.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'))

describe('package.json contract', () => {
  it('keeps the required lifecycle + drift-check scripts', () => {
    const required = [
      'typecheck',
      'test',
      'build',
      'emit-meta:check',
      'emit-tokens:check',
      'sync-docs:check',
    ]
    const missing = required.filter((s) => !PKG.scripts?.[s])
    expect(missing, `missing scripts: ${missing.join(', ')}`).toEqual([])
  })

  it('ships llms.txt reachably (files + exports + on disk)', () => {
    expect(PKG.files, 'package.json "files" must include "llms.txt"').toContain('llms.txt')
    expect(PKG.exports?.['./llms.txt'], 'package.json "exports" must expose "./llms.txt"').toBeTruthy()
    expect(existsSync(resolve(REPO_ROOT, 'llms.txt')), 'llms.txt must exist at repo root').toBe(true)
  })
})
