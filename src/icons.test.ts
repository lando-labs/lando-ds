/**
 * `/icons` subpath barrel tests (#383).
 *
 * Sanity check that the curated lucide-react re-exports listed in `src/icons.ts`
 * resolve to real component values at the JS-module level. Importing the
 * subpath barrel directly (rather than via the package's `./icons` exports
 * field) is the closest unit-test equivalent to a consumer's
 * `import { Save } from '@lando-labs/lando-ds/icons'`.
 *
 * The exhaustive resolver behavior (kebab/PascalCase, unknown-name warn,
 * null-input handling) is covered in `./components/Icon/registry.test.ts` —
 * this file is the cross-check that the BARREL stays in sync with the
 * registry.
 */

import { describe, it, expect } from 'vitest'
import * as icons from './icons'

describe('@lando-labs/lando-ds/icons — barrel re-exports', () => {
  it('exposes the 4 must-add UI affordances (#383) as named PascalCase exports', () => {
    expect(icons.MoreHorizontal).toBeTruthy()
    expect(icons.MoreVertical).toBeTruthy()
    expect(icons.Filter).toBeTruthy()
    expect(icons.Save).toBeTruthy()
  })

  it('exposes the 8 generic app-shell affordances (#383) as named PascalCase exports', () => {
    expect(icons.LayoutDashboard).toBeTruthy()
    expect(icons.BarChart3).toBeTruthy()
    expect(icons.BookOpen).toBeTruthy()
    expect(icons.GitBranch).toBeTruthy()
    expect(icons.Sparkles).toBeTruthy()
    expect(icons.Wrench).toBeTruthy()
    expect(icons.Puzzle).toBeTruthy()
    expect(icons.CheckSquare).toBeTruthy()
  })

  it('still exposes the original #376 editorial icons (no regression)', () => {
    expect(icons.Compass).toBeTruthy()
    expect(icons.Coffee).toBeTruthy()
    expect(icons.MessageSquare).toBeTruthy()
    expect(icons.Quote).toBeTruthy()
  })

  it('also exposes the `Icon` component + `getIcon` resolver from the same subpath', () => {
    // Single-import-line DX claim from the barrel's JSDoc.
    expect(icons.Icon).toBeTruthy()
    expect(typeof icons.getIcon).toBe('function')
    expect(icons.ICON_REGISTRY).toBeTruthy()
  })

  it('barrel-resolved + registry-resolved components are the SAME reference', () => {
    // Catch a silent drift where icons.ts and registry.ts both re-import from
    // lucide-react but accidentally pick different identifiers.
    expect(icons.getIcon('more-horizontal')).toBe(icons.MoreHorizontal)
    expect(icons.getIcon('save')).toBe(icons.Save)
    expect(icons.getIcon('layout-dashboard')).toBe(icons.LayoutDashboard)
    expect(icons.getIcon('check-square')).toBe(icons.CheckSquare)
  })
})
