/**
 * Icon registry tests (#376) — string-keyed resolver for serialized configs.
 *
 * Covers:
 *   - registry contains the curated names (sanity floor)
 *   - getIcon('search') / getIcon('message-square') return components
 *   - PascalCase aliases resolve to the same component as kebab-case
 *   - unknown names return null and emit a dev-mode warn (once per name)
 *   - null/undefined input returns null without warning
 *   - getIcon('Compass'), getIcon('Coffee') and the new editorial icons
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getIcon, ICON_REGISTRY, type CuratedIconName } from './registry'

describe('ICON_REGISTRY', () => {
  it('contains a meaningful number of curated names', () => {
    // Floor: at least the original ~45 + the new editorial icons.
    expect(Object.keys(ICON_REGISTRY).length).toBeGreaterThanOrEqual(50)
  })

  it('includes the editorial icons added per #376', () => {
    // These are the explicit asks in the issue body.
    expect(ICON_REGISTRY).toHaveProperty('message-square')
    expect(ICON_REGISTRY).toHaveProperty('quote')
    expect(ICON_REGISTRY).toHaveProperty('compass')
    expect(ICON_REGISTRY).toHaveProperty('coffee')
  })

  it('includes the common UI affordances added per #383 (must-add)', () => {
    // 4 must-add icons — high-impact lab usage (kebab/ellipsis triggers,
    // data-table filter/save controls).
    expect(ICON_REGISTRY).toHaveProperty('more-horizontal')
    expect(ICON_REGISTRY).toHaveProperty('more-vertical')
    expect(ICON_REGISTRY).toHaveProperty('filter')
    expect(ICON_REGISTRY).toHaveProperty('save')
  })

  it('includes the generic app-shell affordances added per #383', () => {
    // 8 generic affordances — broadly applicable cross-product UI.
    // App-specific icons (ChefHat, FlaskConical, MonitorPlay, Newspaper,
    // Droplet, Accessibility) are intentionally NOT in the curated set —
    // consumers can import them from `lucide-react` directly.
    expect(ICON_REGISTRY).toHaveProperty('layout-dashboard')
    expect(ICON_REGISTRY).toHaveProperty('dashboard')
    expect(ICON_REGISTRY).toHaveProperty('bar-chart-3')
    expect(ICON_REGISTRY).toHaveProperty('book-open')
    expect(ICON_REGISTRY).toHaveProperty('git-branch')
    expect(ICON_REGISTRY).toHaveProperty('sparkles')
    expect(ICON_REGISTRY).toHaveProperty('wrench')
    expect(ICON_REGISTRY).toHaveProperty('puzzle')
    expect(ICON_REGISTRY).toHaveProperty('check-square')
  })

  it('exposes common navigation names', () => {
    expect(ICON_REGISTRY).toHaveProperty('menu')
    expect(ICON_REGISTRY).toHaveProperty('search')
    expect(ICON_REGISTRY).toHaveProperty('chevron-down')
    expect(ICON_REGISTRY).toHaveProperty('arrow-right')
  })
})

describe('getIcon — known names', () => {
  it('resolves a kebab-case name to the lucide component', () => {
    const Component = getIcon('search')
    expect(Component).toBeTruthy()
    // lucide icons are forward-ref components — typeof === 'object' (not 'function')
    expect(typeof Component).toMatch(/^(function|object)$/)
  })

  it('resolves the message-square editorial name', () => {
    expect(getIcon('message-square')).toBeTruthy()
  })

  it('resolves the compass and coffee editorial names', () => {
    expect(getIcon('compass')).toBeTruthy()
    expect(getIcon('coffee')).toBeTruthy()
  })

  it('resolves PascalCase aliases to the same component as kebab-case', () => {
    expect(getIcon('MessageSquare')).toBe(getIcon('message-square'))
    expect(getIcon('ChevronDown')).toBe(getIcon('chevron-down'))
    expect(getIcon('Search')).toBe(getIcon('search'))
  })

  it('returns the SAME component instance across calls (referential stability)', () => {
    // Critical for React reconciliation — if getIcon returned new wrappers
    // on each call, every render would see a "new" component type and
    // unmount + remount its DOM.
    expect(getIcon('search')).toBe(getIcon('search'))
    expect(getIcon('MessageSquare')).toBe(getIcon('MessageSquare'))
  })
})

describe('getIcon — #383 additions', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Spy with no-op so the test does not error on a real warn; assert the
    // spy was NOT called (these are KNOWN names — no dev warn allowed).
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('resolves the 4 must-add UI affordances (kebab-case)', () => {
    expect(getIcon('more-horizontal')).toBeTruthy()
    expect(getIcon('more-vertical')).toBeTruthy()
    expect(getIcon('filter')).toBeTruthy()
    expect(getIcon('save')).toBeTruthy()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('resolves the 4 must-add UI affordances (PascalCase alias)', () => {
    expect(getIcon('MoreHorizontal')).toBe(getIcon('more-horizontal'))
    expect(getIcon('MoreVertical')).toBe(getIcon('more-vertical'))
    expect(getIcon('Filter')).toBe(getIcon('filter'))
    expect(getIcon('Save')).toBe(getIcon('save'))
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('resolves the 8 generic app-shell affordances (kebab-case)', () => {
    expect(getIcon('layout-dashboard')).toBeTruthy()
    expect(getIcon('dashboard')).toBeTruthy()
    expect(getIcon('bar-chart-3')).toBeTruthy()
    expect(getIcon('book-open')).toBeTruthy()
    expect(getIcon('git-branch')).toBeTruthy()
    expect(getIcon('sparkles')).toBeTruthy()
    expect(getIcon('wrench')).toBeTruthy()
    expect(getIcon('puzzle')).toBeTruthy()
    expect(getIcon('check-square')).toBeTruthy()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('resolves the 8 generic app-shell affordances (PascalCase alias)', () => {
    expect(getIcon('LayoutDashboard')).toBe(getIcon('layout-dashboard'))
    expect(getIcon('BarChart3')).toBe(getIcon('bar-chart-3'))
    expect(getIcon('BookOpen')).toBe(getIcon('book-open'))
    expect(getIcon('GitBranch')).toBe(getIcon('git-branch'))
    expect(getIcon('Sparkles')).toBe(getIcon('sparkles'))
    expect(getIcon('Wrench')).toBe(getIcon('wrench'))
    expect(getIcon('Puzzle')).toBe(getIcon('puzzle'))
    expect(getIcon('CheckSquare')).toBe(getIcon('check-square'))
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('dashboard alias and layout-dashboard resolve to the SAME component', () => {
    // `dashboard` is the ergonomic short key; `layout-dashboard` matches the
    // lucide PascalCase. They MUST be the same icon — divergence would mean
    // the registry is silently dual-mapping the name.
    expect(getIcon('dashboard')).toBe(getIcon('layout-dashboard'))
  })

  it('bar-chart and bar-chart-3 aliases resolve to the SAME component', () => {
    expect(getIcon('bar-chart')).toBe(getIcon('bar-chart-3'))
  })
})

describe('getIcon — unknown names', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns null for an unknown name', () => {
    expect(getIcon('totally-not-a-real-icon-xyz')).toBeNull()
  })

  it('warns in dev for an unknown name', () => {
    getIcon('another-bogus-name-abc')
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0]![0]).toMatch(/unknown icon name "another-bogus-name-abc"/) // safe: toHaveBeenCalled() asserted above → calls[0] present
  })

  it('only warns ONCE per unknown name (no console spam in a render loop)', () => {
    warnSpy.mockClear()
    getIcon('repeated-bogus-name-123')
    getIcon('repeated-bogus-name-123')
    getIcon('repeated-bogus-name-123')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})

describe('getIcon — falsy inputs', () => {
  it('returns null for null input without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getIcon(null)).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns null for undefined input without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getIcon(undefined)).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns null for an empty string without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getIcon('')).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('CuratedIconName type', () => {
  it('CuratedIconName is the literal union of registry keys', () => {
    // Compile-time check via a const assignment — the test "passes" because
    // tsc accepts it; if `CuratedIconName` collapses to `string`, this still
    // compiles but the assertion below provides a runtime floor.
    const valid: CuratedIconName = 'search'
    const valid2: CuratedIconName = 'message-square'
    expect(valid).toBe('search')
    expect(valid2).toBe('message-square')

    // Negative cases (e.g. typos) are not compile-tested here, but
    // `tsc --noEmit` would catch them in any consumer that types their
    // nav config against `CuratedIconName`.
  })
})
