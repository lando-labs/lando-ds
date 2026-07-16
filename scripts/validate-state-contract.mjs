#!/usr/bin/env node
/**
 * validate-state-contract.mjs (#508)
 *
 * Enforces the uncontrolled-first state contract against the DS's OWN emitted
 * meta prop tables. Mirrors `validate-meta.mjs`: a standalone build hook, wired
 * into CI via the `validate:state` npm script, run AFTER `build` so the meta
 * artifact exists.
 *
 * It dogfoods `dist/meta.json` as the single source of truth for the authored
 * API — the same artifact the MCP server and consumers read — rather than a
 * second, drift-prone parse of the source.
 *
 * Two checks, both grounded in `scripts/state-contract.mjs`:
 *   1. Registry conformance — every listed component/state exists, and every
 *      non-exempt state exposes BOTH its `value` and `default` props. Exempt
 *      states must carry a non-empty reason (no silent one-sided gaps).
 *   2. Completeness guard — every `on*Change` value-callback in meta must be
 *      accounted for in the registry, so a newly-added stateful component
 *      cannot silently escape the contract.
 *
 * Usage: node scripts/validate-state-contract.mjs
 * Exit 0: contract holds.  Exit 1: any violation (or meta artifact missing —
 * a state-contract violation silently passing is exactly the anti-pattern this
 * check exists to prevent, so a missing artifact is a hard failure, not a skip).
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from './lib/meta-pkg-common.mjs'
import { STATE_CONTRACT } from './state-contract.mjs'

/** Load the richest available meta artifact (verbose has every authored prop). */
function loadMeta() {
  const candidates = [
    join(repoRoot, 'dist', 'meta.verbose.json'),
    join(repoRoot, 'dist', 'meta.json'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      return { meta: JSON.parse(readFileSync(path, 'utf8')), path }
    }
  }
  console.error(
    '[validate-state] dist/meta.{verbose.,}json not found. Run `npm run build` ' +
      'first — this check reads the emitted meta prop tables and will not ' +
      'silently pass without them.'
  )
  process.exit(1)
}

/**
 * The contract governs `on*Change` controlled-state callbacks — the paired half
 * of an `X` + `defaultX` triple. Action/event callbacks NOT named `on*Change`
 * (`onSort`, `onSelect`, `onClick`, `onSubmit`, …) are out of scope by design:
 * they are not controlled-state pairs.
 *
 * The guard is deliberately FAIL-CLOSED: every `on*Change` prop must be
 * accounted for in the registry. We intentionally do NOT infer "native DOM
 * handler vs value callback" from the type string — that heuristic fails open
 * (a value callback with an event second-arg, or a domain type whose name
 * merely contains "Event", would be skipped and could smuggle in an
 * unregistered stateful component). If a component ever exposes a genuinely
 * native `onChange: (e: ChangeEvent) => void`, that must be an explicit `exempt`
 * entry with a reason — never silently inferred. (Today: 0 of the library's
 * on*Change props are native — all are value callbacks.)
 */
const CHANGE_NAME = /^on([A-Z][A-Za-z]*)?Change$/
function isStateChangeCallback(propName) {
  return CHANGE_NAME.test(propName)
}

const { meta, path } = loadMeta()
console.log(`[validate-state] meta source: ${path.replace(repoRoot + '/', '')}`)

const components = meta.components ?? {}
const propsOf = (name) => components[name]?.props ?? null
const violations = []

// ── Check 1: registry conformance ───────────────────────────────────────────
// Also builds the coverage set for the completeness guard.
const covered = new Set() // `${component}::${changeProp}`

for (const entry of STATE_CONTRACT) {
  const { component, states } = entry
  const props = propsOf(component)
  if (props == null) {
    violations.push(
      `Registry lists "${component}" but it has no prop table in meta — stale ` +
        `entry? Remove it or fix the name in scripts/state-contract.mjs.`
    )
    continue
  }
  for (const state of states) {
    const { change, value, default: def, exempt } = state
    covered.add(`${component}::${change}`)

    // The change callback must be a real, current prop — proves non-vacuity.
    if (!(change in props)) {
      violations.push(
        `${component}: registry references change prop "${change}" which is not ` +
          `in the authored API (renamed/removed?). Update scripts/state-contract.mjs.`
      )
      continue
    }

    // Key on the PRESENCE of `exempt`, not its truthiness — otherwise a blank
    // reason would silently fall through to the contract-bound path with a
    // misleading message instead of being rejected as an empty exemption.
    if ('exempt' in state) {
      if (typeof exempt !== 'string' || exempt.trim().length === 0) {
        violations.push(
          `${component}.${change}: exemption must carry a non-empty reason ` +
            `(no silent one-sided contracts).`
        )
      } else if (value != null && !(value in props)) {
        // A controlled-only exemption still names a real controlled prop —
        // catch a stale reference. (Uncontrolled-only exemptions, e.g. Table,
        // omit `value` because no controlled prop exists.)
        violations.push(
          `${component}.${change}: exempt state references controlled prop ` +
            `"${value}" which is not in the authored API (stale?). Fix or drop ` +
            `the \`value\` in scripts/state-contract.mjs.`
        )
      }
      continue // exempt states waive the default (uncontrolled seed) requirement
    }

    // Contract-bound: BOTH the controlled prop and the uncontrolled seed exist.
    if (value != null && !(value in props)) {
      violations.push(
        `${component}.${change}: controlled prop "${value}" is missing from the ` +
          `authored API.`
      )
    }
    if (def == null) {
      violations.push(
        `${component}.${change}: contract-bound state must declare a \`default\` ` +
          `prop in the registry (or be marked \`exempt\` with a reason).`
      )
    } else if (!(def in props)) {
      violations.push(
        `${component}.${change}: uncontrolled seed prop "${def}" is missing from ` +
          `the authored API — add it (uncontrolled-first) or mark this state ` +
          `\`exempt\` with a reason.`
      )
    }
  }
}

// ── Check 2: completeness guard ──────────────────────────────────────────────
// Every on*Change value-callback in meta must be covered by the registry.
for (const [component, entry] of Object.entries(components)) {
  const props = entry?.props
  if (!props) continue
  for (const propName of Object.keys(props)) {
    if (!isStateChangeCallback(propName)) continue
    if (!covered.has(`${component}::${propName}`)) {
      violations.push(
        `${component}.${propName}: unregistered state-change callback. Add a ` +
          `state entry to scripts/state-contract.mjs (with its \`default\` prop, ` +
          `or an \`exempt\` reason). The uncontrolled-first contract must ` +
          `account for every stateful component.`
      )
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (violations.length > 0) {
  console.error(
    `\n[validate-state] ✗ ${violations.length} state-contract violation(s):\n`
  )
  for (const v of violations) console.error(`  • ${v}`)
  console.error(
    '\nThe uncontrolled-first contract is documented in reference/state-contract.md.'
  )
  process.exit(1)
}

const stateCount = STATE_CONTRACT.reduce((n, e) => n + e.states.length, 0)
console.log(
  `[validate-state] ✓ ${STATE_CONTRACT.length} components / ${stateCount} states ` +
    `conform to the uncontrolled-first contract (every on*Change accounted for).`
)
