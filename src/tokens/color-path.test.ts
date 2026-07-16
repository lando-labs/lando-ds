/**
 * Tests for the typed `ColorPath` type and `resolveColorPath` resolver
 * (issue #252).
 *
 * The audit caught `<Text color="ocean.500">` in production lab code that
 * silently rendered as `undefined` because the ocean palette has no numeric
 * scale. These tests cover:
 *  - compile-time rejection of invalid paths (via `@ts-expect-error`)
 *  - runtime resolution for representative paths across all palette regions
 *  - graceful `undefined` for paths that escape the type system (e.g.
 *    user-supplied strings cast to `ColorPath`)
 */
import { describe, it, expect } from 'vitest'

import { resolveColorPath, type ColorPath } from './colors'

describe('ColorPath (compile-time)', () => {
  it('accepts valid token paths', () => {
    // These assignments are the test: if any of them produced a TS error,
    // `npm run typecheck` would fail. The runtime assertion below is
    // ceremonial — vitest still runs the file.
    const ok1: ColorPath = 'ocean.base'
    const ok2: ColorPath = 'ocean.darkest'
    const ok3: ColorPath = 'teal.lightest'
    const ok4: ColorPath = 'neutral.500'
    const ok5: ColorPath = 'neutral.white'
    const ok6: ColorPath = 'semantic.success.lightest'
    const ok7: ColorPath = 'semantic.error.darkest'
    const ok8: ColorPath = 'dark.bg.elevated'
    const ok9: ColorPath = 'dark.text.primary'
    const ok10: ColorPath = 'dark.border.strong'

    expect([ok1, ok2, ok3, ok4, ok5, ok6, ok7, ok8, ok9, ok10]).toHaveLength(10)
  })

  it('rejects invalid token paths at compile time', () => {
    // @ts-expect-error — ocean palette has no numeric scale
    const bad1: ColorPath = 'ocean.500'
    // @ts-expect-error — typo
    const bad2: ColorPath = 'oceans.base'
    // @ts-expect-error — wrong nesting (success lives under semantic.*)
    const bad3: ColorPath = 'success.lightest'
    // @ts-expect-error — neutral has no 50000
    const bad4: ColorPath = 'neutral.50000'
    // @ts-expect-error — not a leaf
    const bad5: ColorPath = 'ocean'

    // Runtime assertions reference the variables to satisfy unused-var lint;
    // the real assertion is the `@ts-expect-error` directive above.
    expect([bad1, bad2, bad3, bad4, bad5]).toHaveLength(5)
  })
})

describe('resolveColorPath', () => {
  it('resolves top-level palette paths', () => {
    expect(resolveColorPath('ocean.base')).toBe('#2BA3D4')
    expect(resolveColorPath('ocean.medium')).toBe('#1B7FA8')
    expect(resolveColorPath('teal.lightest')).toBe('#E6F7F7')
    expect(resolveColorPath('teal.base')).toBe('#2DBFBF')
  })

  it('resolves neutral paths (mixed number + string keys)', () => {
    expect(resolveColorPath('neutral.500')).toBe('#90A4AE')
    expect(resolveColorPath('neutral.white')).toBe('#FFFFFF')
    expect(resolveColorPath('neutral.black')).toBe('#000000')
  })

  it('resolves semantic alias paths', () => {
    // v0.36.0 OSS-prep (#421): success → emerald-green, info → true blue.
    expect(resolveColorPath('semantic.success.base')).toBe('#10B981')
    expect(resolveColorPath('semantic.error.lightest')).toBe('#FEE2E2')
    expect(resolveColorPath('semantic.warning.darkest')).toBe('#92400E')
    expect(resolveColorPath('semantic.info.base')).toBe('#3B82F6')
  })

  it('resolves dark-mode paths', () => {
    expect(resolveColorPath('dark.bg.base')).toBe('#0A1929')
    expect(resolveColorPath('dark.bg.elevated')).toBe('#082A38')
    expect(resolveColorPath('dark.text.primary')).toBe('#F8FAFB')
    expect(resolveColorPath('dark.border.strong')).toBe('#2BA3D4')
  })

  it('returns undefined for paths that escape the type system', () => {
    // Runtime callers (e.g. user-supplied strings cast to ColorPath) may
    // pass invalid paths. The resolver should return undefined rather than
    // throw so consumers can fall through to a default.
    expect(resolveColorPath('ocean.500' as ColorPath)).toBeUndefined()
    expect(resolveColorPath('made.up.path' as ColorPath)).toBeUndefined()
    expect(resolveColorPath('' as ColorPath)).toBeUndefined()
  })
})
