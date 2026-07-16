// @vitest-environment node

/**
 * Every-component-has-a-test guard (Sprint 59, #427 / claims-hygiene).
 *
 * The docs claim test coverage numbers derived from source (sync-docs.mjs).
 * This guard backs the stronger, testable form: every component directory
 * (a dir under src/components with an index.ts barrel) has at least one
 * co-located `*.test.tsx`. Before this sprint, AreaChart / PieChart / Portal
 * silently lacked tests while docs implied full coverage.
 *
 * If a component directory legitimately has no co-located test (e.g. it is
 * exercised entirely through a sibling's suite), add it to ALLOWLIST with a
 * comment justifying why.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_DIR = resolve(HERE, '../components')

// Component dirs that are covered elsewhere and intentionally have no own test.
const ALLOWLIST = new Set<string>([])

function componentDirs(): string[] {
  return readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    // A "component directory" is one that publishes a barrel.
    .filter((name) => existsSync(join(COMPONENTS_DIR, name, 'index.ts')))
}

function hasTest(dir: string): boolean {
  return readdirSync(join(COMPONENTS_DIR, dir)).some((f) => f.endsWith('.test.tsx'))
}

describe('every component directory has a co-located test', () => {
  it('has no untested component directories', () => {
    const untested = componentDirs()
      .filter((d) => !ALLOWLIST.has(d))
      .filter((d) => !hasTest(d))
    expect(untested, `component dirs missing a *.test.tsx: ${untested.join(', ')}`).toEqual([])
  })
})
