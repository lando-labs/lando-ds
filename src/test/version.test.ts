/**
 * VERSION auto-derive guard (#468).
 *
 * Before this sprint src/index.ts hardcoded `export const VERSION = '0.1.0'`, so
 * every published dist/index.d.ts + dist/index.js shipped a stale, wrong version
 * (0.1.0 vs the real release). VERSION is now inlined from package.json via the
 * `__DS_VERSION__` define wired into BOTH vite.config.ts (build) and
 * vitest.config.ts (test). This guard fails if:
 *   - someone re-hardcodes a literal that drifts from package.json, or
 *   - the `define` wiring breaks (VERSION would be `undefined` / the unreplaced
 *     `__DS_VERSION__` token, neither of which equals package.json's version).
 *
 * Imported from the package ROOT barrel — exactly the surface a consumer uses
 * (`import { VERSION } from '@lando-labs/lando-ds'`).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { VERSION } from '../index'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const PKG = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
  version: string
}

describe('VERSION export (#468)', () => {
  it('auto-derives from package.json (not a hardcoded literal)', () => {
    expect(VERSION).toBe(PKG.version)
  })

  it('is no longer the stale hardcoded 0.1.0', () => {
    expect(VERSION).not.toBe('0.1.0')
  })
})
