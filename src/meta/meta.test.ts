/**
 * Meta artifact tests (#418, #419).
 *
 * These tests run AGAINST THE EMITTED ARTIFACT (`dist/meta.json` and
 * `dist/meta.verbose.json`) — they intentionally assert on the shipped
 * shape, not the in-source TypeScript types. That's the contract: an
 * AI agent or build tool downloads the meta blob and grounds itself
 * in it. If it doesn't validate or doesn't look right after a build,
 * we want CI to scream.
 *
 * The build step is expected to have run before vitest. The repo's
 * `prepare` hook + `npm run build` both write these files, and the
 * existing test setup already depends on the dist being current.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import schema from './schema.json'
import { isMetaShape } from './validate'
import type { LightMeta, VerboseMeta } from './types'
import { themePresets } from '../tokens/themePresets'

const repoRoot = resolve(__dirname, '..', '..')
const lightPath = resolve(repoRoot, 'dist', 'meta.json')
const verbosePath = resolve(repoRoot, 'dist', 'meta.verbose.json')

let light: LightMeta
let verbose: VerboseMeta

beforeAll(() => {
  if (!existsSync(lightPath) || !existsSync(verbosePath)) {
    throw new Error(
      `Meta artifacts missing. Run 'npm run build' before 'npm test'. Looked for:\n  ${lightPath}\n  ${verbosePath}`
    )
  }
  light = JSON.parse(readFileSync(lightPath, 'utf8'))
  verbose = JSON.parse(readFileSync(verbosePath, 'utf8'))
})

describe('dist/meta.json (light)', () => {
  it('has the locked top-level shape', () => {
    expect(light.$schemaVersion).toBe('1.3')
    expect(light.package).toMatchObject({
      name: expect.stringContaining('lando-ds'),
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      homepage: expect.stringContaining('github.com'),
    })
    expect(typeof light.components).toBe('object')
    // hooks section added in schema 1.3 (#504).
    expect(typeof light.hooks).toBe('object')
    expect(typeof light.tokens).toBe('object')
    expect(typeof light.icons).toBe('object')
    expect(typeof light.exports).toBe('object')
    expect(typeof light.capabilities).toBe('object')
    expect(typeof light.themePresets).toBe('object')
  })

  it('passes isMetaShape', () => {
    expect(isMetaShape(light)).toBe(true)
  })

  it('passes Ajv schema validation', async () => {
    const { default: Ajv } = await import('ajv')
    const ajv = new Ajv({ allErrors: true })
    const validate = ajv.compile(schema)
    const ok = validate(light)
    if (!ok) {
      // Surface schema errors when they happen — these are usually the
      // fastest path to fixing a meta drift bug.

      console.error('Ajv errors (light):', JSON.stringify(validate.errors, null, 2))
    }
    expect(ok).toBe(true)
  })

  it('includes core components', () => {
    const core = [
      'Button',
      'Input',
      'Card',
      'Modal',
      'Box',
      'Stack',
      'Inline',
      'Heading',
      'Text',
      'Badge',
      'Avatar',
      'DatePicker',
      'Tabs',
      'Dropdown',
    ]
    for (const name of core) {
      expect(light.components[name]).toBeDefined()
    }
  })

  it('has a sensible component count (>=70)', () => {
    expect(Object.keys(light.components).length).toBeGreaterThanOrEqual(70)
  })

  it('Button has the expected shape', () => {
    const btn = light.components.Button
    if (!btn) throw new Error('Button component missing from meta')
    expect(btn.kind).toBe('component')
    expect(btn.category).toBe('Core & Form')
    expect(btn.platforms).toEqual(['web'])
    expect(btn.useClient).toBe(true)
    expect(btn.serverSafe).toBe(false)
    expect(btn.ref).toBe('HTMLButtonElement')
    expect(btn.subpath).toBe('./components/Button')
    expect(btn.props.variant).toBeDefined()
    expect(btn.props.variant?.type).toContain('primary')
    expect(btn.props.variant?.default).toMatch(/primary/)
    expect(btn.props.size).toBeDefined()
    expect(btn.deprecated).toBeNull()
    // extends chain (schema 1.2, #438): forwardRef'd <button> component.
    expect(btn.extends).toEqual([
      'HTMLAttributes<HTMLButtonElement>',
      'RefAttributes<HTMLButtonElement>',
    ])
  })

  it('Box props are present and DOM-trivial props are stripped', () => {
    const box = light.components.Box
    if (!box) throw new Error('Box component missing from meta')
    expect(box.serverSafe).toBe(true)
    expect(box.useClient).toBe(false)
    expect(box.polymorphic).toBe(true)
    expect(box.props.padding).toBeDefined()
    expect(box.props.gap).toBeDefined()
    // LIGHT drops children/className/style/key/ref props to stay near size target.
    expect(box.props.children).toBeUndefined()
    expect(box.props.className).toBeUndefined()
    expect(box.props.style).toBeUndefined()
  })

  it('Stack is server-safe and polymorphic', () => {
    const stack = light.components.Stack
    if (!stack) throw new Error('Stack component missing from meta')
    expect(stack.serverSafe).toBe(true)
    expect(stack.useClient).toBe(false)
    expect(stack.polymorphic).toBe(true)
    expect(stack.props.gap).toBeDefined()
    expect(stack.props.as).toBeDefined()
  })

  it('Modal / DatePicker / Dropdown are client-only', () => {
    expect(light.components.Modal?.useClient).toBe(true)
    expect(light.components.DatePicker?.useClient).toBe(true)
    expect(light.components.Dropdown?.useClient).toBe(true)
  })

  it('flags Toast as deprecated', () => {
    const t = light.components.Toast
    if (!t) throw new Error('Toast component missing from meta')
    expect(t.deprecated).not.toBeNull()
    expect(t.deprecated).toMatchObject({
      since: expect.stringMatching(/^0\.36/),
      replacedBy: expect.stringContaining('useToast'),
      removeAt: expect.stringMatching(/^\d+\.\d+\.\d+/),
    })
  })

  it('capability arrays are populated and consistent', () => {
    const c = light.capabilities
    expect(c.rscSafe.length).toBeGreaterThan(20)
    expect(c.clientOnly.length).toBeGreaterThan(20)
    expect(c.polymorphic.length).toBeGreaterThan(0)
    expect(c.withRef.length).toBeGreaterThan(40)

    // Cross-check: no component should appear in BOTH rscSafe and clientOnly.
    const both = c.rscSafe.filter((n) => c.clientOnly.includes(n))
    expect(both).toEqual([])

    // Spot-check: well-known server-safe components ARE in rscSafe.
    for (const n of ['Box', 'Stack', 'Inline', 'Container']) {
      expect(c.rscSafe).toContain(n)
    }

    // Spot-check: well-known client-only components ARE in clientOnly.
    for (const n of ['Modal', 'DatePicker', 'Combobox', 'Dropdown', 'Drawer']) {
      expect(c.clientOnly).toContain(n)
    }
  })

  it('tokens.colors has semantic + brand', () => {
    expect(light.tokens.colors.semantic).toBeDefined()
    expect(light.tokens.colors.brand).toBeDefined()
    // Status colors live in semantic.
    expect(Object.keys(light.tokens.colors.semantic)).toEqual(
      expect.arrayContaining(['success', 'warning', 'error', 'info'])
    )
    // Brand ramps live in brand.
    expect(Object.keys(light.tokens.colors.brand)).toEqual(
      expect.arrayContaining(['ocean', 'teal', 'neutral'])
    )
  })

  it('tokens has every required category', () => {
    expect(light.tokens.spacing).toBeDefined()
    expect(light.tokens.typography).toBeDefined()
    expect(light.tokens.radius).toBeDefined()
    expect(light.tokens.shadows).toBeDefined()
    expect(light.tokens.motion).toBeDefined()
  })

  it('icons registry is populated', () => {
    expect(light.icons.totalCount).toBeGreaterThan(50)
    expect(light.icons.registry).toBeDefined()
    expect(Object.keys(light.icons.registry)).toEqual(
      expect.arrayContaining(['search', 'check', 'menu', 'x'])
    )
    // Each entry has the canonical fields.
    const entry = light.icons.registry.search
    expect(entry).toMatchObject({
      name: 'search',
      lucideName: 'Search',
      category: expect.any(String),
    })
  })

  it('exports surface lists the public subpaths', () => {
    expect(light.exports.main).toContain('dist')
    expect(light.exports.subpaths).toEqual(
      expect.arrayContaining(['./tokens', './components', './icons'])
    )
  })

  it('round-trips: re-parse re-serialize is stable', () => {
    const a = JSON.stringify(light)
    const b = JSON.stringify(JSON.parse(a))
    expect(a).toEqual(b)
  })
})

/**
 * #437 — themePresets block (schema 1.1). The DS ships brand-neutral by
 * default (since v0.36.0); named presets (lando, midnight, …) are opt-in.
 * meta.json advertises the registry so agents can offer a theme picker
 * without scraping src/tokens/themePresets.ts.
 */
describe('#437 themePresets block (schema 1.1)', () => {
  it('light has default + presets shape', () => {
    expect(light.themePresets).toBeDefined()
    expect(typeof light.themePresets.default).toBe('string')
    expect(light.themePresets.default.length).toBeGreaterThan(0)
    expect(typeof light.themePresets.presets).toBe('object')
  })

  it('brand-neutral is the default preset', () => {
    // Since v0.36.0 the boot default is brand-neutral (no preset applied).
    expect(light.themePresets.default).toBe('brand-neutral')
    const neutral = light.themePresets.presets['brand-neutral']
    expect(neutral).toBeDefined()
    expect(neutral?.id).toBe('brand-neutral')
    expect(neutral?.isDefault).toBe(true)
  })

  it('carries the named opt-in presets, each with id + isDefault', () => {
    // These mirror the `themePresets` array in src/tokens/themePresets.ts.
    for (const id of ['lando', 'midnight', 'sunset', 'forest', 'rose', 'slate']) {
      const p = light.themePresets.presets[id]
      expect(p, `preset ${id} present`).toBeDefined()
      expect(p?.id).toBe(id)
      expect(p?.isDefault).toBe(false)
    }
  })

  it('excludes the legacy `ocean` alias (visual duplicate of lando)', () => {
    expect(light.themePresets.presets.ocean).toBeUndefined()
  })

  it('exactly one preset is flagged isDefault', () => {
    const defaults = Object.values(light.themePresets.presets).filter(
      (p) => p.isDefault
    )
    expect(defaults).toHaveLength(1)
    expect(defaults[0]?.id).toBe(light.themePresets.default)
  })

  it('light presets do NOT carry tokenOverrides (verbose-only field)', () => {
    for (const p of Object.values(light.themePresets.presets)) {
      expect('tokenOverrides' in p).toBe(false)
    }
  })

  it('verbose presets ADD tokenOverrides on top of the light shape', () => {
    // default id matches between light and verbose.
    expect(verbose.themePresets.default).toBe(light.themePresets.default)
    for (const [id, lp] of Object.entries(light.themePresets.presets)) {
      const vp = verbose.themePresets.presets[id]
      expect(vp, `verbose preset ${id} present`).toBeDefined()
      if (!vp) throw new Error(`verbose preset ${id} missing from meta`)
      // Every light field carried over.
      expect(vp.id).toBe(lp.id)
      expect(vp.isDefault).toBe(lp.isDefault)
      // Verbose-only field present.
      expect('tokenOverrides' in vp, `${id} has tokenOverrides`).toBe(true)
      expect(typeof vp.tokenOverrides).toBe('object')
    }
  })

  it('lando tokenOverrides carry the historical ocean+teal palette', () => {
    const lando = verbose.themePresets.presets.lando
    expect(lando?.tokenOverrides).toMatchObject({
      primary: '#1B7FA8',
      secondary: '#2DBFBF',
    })
  })

  it('brand-neutral has empty tokenOverrides (it IS the default)', () => {
    expect(verbose.themePresets.presets['brand-neutral']?.tokenOverrides).toEqual(
      {}
    )
  })

  it('verbose tokenOverrides match the SOURCE preset colors, not the emitter (#437)', () => {
    // Independent oracle: compare emitted overrides against the source of truth
    // (src/tokens/themePresets.ts), so an emitter that corrupts a non-lando
    // preset's colors is caught — a plain drift guard compares emit-to-itself.
    for (const preset of themePresets) {
      const vp = verbose.themePresets.presets[preset.id]
      expect(vp, `source preset '${preset.id}' is emitted`).toBeDefined()
      expect(
        vp?.tokenOverrides,
        `${preset.id} tokenOverrides equal source colors`
      ).toEqual(preset.colors)
    }
  })
})

/**
 * #438 — per-component `extends` chain (schema 1.2). Surfaces the inherited
 * React DOM interface chain in a canonical, deterministic, sorted form so
 * agents know which native attributes/ref a component accepts.
 */
describe('#438 component extends chain (schema 1.2)', () => {
  it('every component has an extends field (array | null)', () => {
    for (const [name, c] of Object.entries(light.components)) {
      expect('extends' in c, `${name} has extends field`).toBe(true)
      const ex = c.extends
      expect(ex === null || Array.isArray(ex), `${name} extends is array|null`).toBe(
        true
      )
    }
  })

  it('extends arrays are deduped + alphabetically sorted (deterministic)', () => {
    for (const [name, c] of Object.entries(light.components)) {
      if (!Array.isArray(c.extends)) continue
      const arr = c.extends
      // sorted
      expect(arr, `${name} sorted`).toEqual([...arr].sort())
      // deduped
      expect(new Set(arr).size, `${name} deduped`).toBe(arr.length)
    }
  })

  it('forwardRef DOM components carry HTMLAttributes<El> + RefAttributes<El>', () => {
    expect(light.components.Button?.extends).toEqual([
      'HTMLAttributes<HTMLButtonElement>',
      'RefAttributes<HTMLButtonElement>',
    ])
    expect(light.components.Modal?.extends).toEqual([
      'HTMLAttributes<HTMLDialogElement>',
      'RefAttributes<HTMLDialogElement>',
    ])
  })

  it('components declaring only own props have extends: null', () => {
    // Portal uses createPortal (no ref-able root); its props extend nothing.
    expect(light.components.Portal?.extends).toBeNull()
  })

  it('sub-components from shared files keep their own ref + element param (#438 resolution fix)', () => {
    // These have NO own <Name>.tsx — they're declared inside a shared
    // multi-component file. A source-resolution bug once pointed them at the
    // barrel index.ts re-export, dropping ref + element type-param (false
    // nulls / bare "HTMLAttributes"). Guard the corrected values.
    const timelineItem = light.components.TimelineItem
    if (!timelineItem) throw new Error('TimelineItem component missing from meta')
    expect(timelineItem.extends).toEqual([
      'HTMLAttributes<HTMLLIElement>',
      'RefAttributes<HTMLLIElement>',
    ])
    expect(timelineItem.ref).toBe('HTMLLIElement')
    const timelineGroup = light.components.TimelineGroup
    if (!timelineGroup) throw new Error('TimelineGroup component missing from meta')
    expect(timelineGroup.extends).toEqual([
      'HTMLAttributes<HTMLOListElement>',
      'RefAttributes<HTMLOListElement>',
    ])
    // NavTabsItemProps extends nothing but is forwardRef<HTMLElement> → ref only.
    const navTabsItem = light.components.NavTabsItem
    if (!navTabsItem) throw new Error('NavTabsItem component missing from meta')
    expect(navTabsItem.extends).toEqual(['RefAttributes<HTMLElement>'])
    expect(navTabsItem.ref).toBe('HTMLElement')
    // Plain-function sub-components: element param recovered, no ref.
    for (const n of ['CommandPaletteGroup', 'CommandPaletteItem', 'DataTableStatic']) {
      const c = light.components[n]
      if (!c) throw new Error(`${n} component missing from meta`)
      expect(c.extends, n).toEqual(['HTMLAttributes<HTMLDivElement>'])
      expect(c.ref, `${n} ref`).toBeNull()
    }
  })

  it('RefAttributes is present iff a concrete DOM ref target exists', () => {
    for (const [name, c] of Object.entries(light.components)) {
      const hasRefAttr =
        Array.isArray(c.extends) &&
        c.extends.some((s) => s.startsWith('RefAttributes<'))
      const hasDomRef = /^(?:HTML|SVG)[A-Za-z]*Element$/.test(String(c.ref))
      expect(hasRefAttr, `${name}: RefAttributes matches ref target`).toBe(hasDomRef)
    }
  })

  it('normalizes to the generic HTMLAttributes family (no element-specific)', () => {
    // e.g. Button extends ButtonHTMLAttributes in source, but we emit the
    // generic HTMLAttributes<HTMLButtonElement> form for stability.
    for (const c of Object.values(light.components)) {
      if (!Array.isArray(c.extends)) continue
      for (const entry of c.extends) {
        expect(entry).not.toMatch(/[A-Za-z]+HTMLAttributes/)
        expect(entry).not.toMatch(/[A-Za-z]+SVGAttributes/)
      }
    }
  })

  it('verbose carries the same extends chain as light', () => {
    for (const [name, lc] of Object.entries(light.components)) {
      expect(verbose.components[name]?.extends).toEqual(lc.extends)
    }
  })
})

describe('dist/meta.verbose.json', () => {
  it('is a strict superset of light meta (every light field present)', () => {
    // Top-level fields all match.
    expect(verbose.$schemaVersion).toBe(light.$schemaVersion)
    expect(verbose.package).toEqual(light.package)
    expect(verbose.tokens).toEqual(light.tokens)
    expect(verbose.icons).toEqual(light.icons)
    expect(verbose.exports).toEqual(light.exports)
    expect(verbose.capabilities).toEqual(light.capabilities)
    // themePresets: verbose is a superset (adds tokenOverrides) — the default
    // id and preset id-set match; the per-preset shape is asserted in the
    // #437 block above.
    expect(verbose.themePresets.default).toBe(light.themePresets.default)
    expect(Object.keys(verbose.themePresets.presets).sort()).toEqual(
      Object.keys(light.themePresets.presets).sort()
    )
    // Every light component is in verbose.
    for (const name of Object.keys(light.components)) {
      expect(verbose.components[name]).toBeDefined()
    }
  })

  it('adds description, examples, composes, appliesClassNames to each component', () => {
    for (const [name, c] of Object.entries(verbose.components)) {
      expect(typeof c.description).toBe('string')
      expect(Array.isArray(c.examples)).toBe(true)
      // composes / appliesClassNames may be null but the FIELD must exist.
      expect('composes' in c, `${name} should have composes field`).toBe(true)
      expect('appliesClassNames' in c, `${name} should have appliesClassNames field`).toBe(
        true
      )
    }
  })

  it('has composes populated for at least 10 components', () => {
    const withComposes = Object.values(verbose.components).filter((c) => c.composes != null)
    expect(withComposes.length).toBeGreaterThanOrEqual(10)
  })

  it('Button has curated examples', () => {
    const btn = verbose.components.Button
    if (!btn) throw new Error('Button component missing from verbose meta')
    expect(btn.examples.length).toBeGreaterThan(0)
    expect(btn.examples[0]).toMatchObject({
      name: expect.any(String),
      code: expect.stringContaining('<Button'),
    })
  })

  it('Button has composes for leftIcon and rightIcon', () => {
    const btn = verbose.components.Button
    if (!btn) throw new Error('Button component missing from verbose meta')
    expect(btn.composes).not.toBeNull()
    expect(btn.composes?.leftIcon).toMatchObject({ accepts: 'Icon', as: 'ReactNode' })
    expect(btn.composes?.rightIcon).toMatchObject({ accepts: 'Icon', as: 'ReactNode' })
  })

  it('component prop entries can carry descriptions in verbose', () => {
    // Verbose retains JSDoc descriptions; light does not.
    const btn = verbose.components.Button
    if (!btn) throw new Error('Button component missing from verbose meta')
    const lightBtn = light.components.Button
    if (!lightBtn) throw new Error('Button component missing from light meta')
    const propWithDescription = Object.values(btn.props).find((p) => p.description)
    expect(propWithDescription).toBeDefined()
    // The same prop in light should NOT have a description.
    const sameProp = Object.entries(btn.props).find(([_, p]) => p.description)
    if (sameProp) {
      const [propName] = sameProp
      expect(lightBtn.props[propName]?.description).toBeUndefined()
    }
  })

  it('passes Ajv schema validation', async () => {
    const { default: Ajv } = await import('ajv')
    const ajv = new Ajv({ allErrors: true })
    const validate = ajv.compile(schema)
    const ok = validate(verbose)
    if (!ok) {

      console.error('Ajv errors (verbose):', JSON.stringify(validate.errors, null, 2))
    }
    expect(ok).toBe(true)
  })

  it('round-trips: re-parse re-serialize is stable', () => {
    const a = JSON.stringify(verbose)
    const b = JSON.stringify(JSON.parse(a))
    expect(a).toEqual(b)
  })
})

/**
 * #451 — token families in meta must reflect the SHIPPED CSS
 * (src/styles/tokens.css), not the drifted TS token modules.
 *
 * Two concrete regressions this guards:
 *   1. shadows used to be emitted from shadows.ts (old OCEAN tints,
 *      rgba(27,127,168,*) / rgba(43,163,212,*)) while the CSS ships
 *      NEUTRAL slate (rgba(15,23,42,*) / rgba(100,116,139,*) — the #421
 *      change). meta advertised shadows the DS no longer renders.
 *   2. z-index was OMITTED from meta entirely; and zIndex.ts is itself
 *      drifted to the pre-#35 ordering (dropdown 100 < modal 400).
 *
 * These assertions cross-check the emitted artifact against tokens.css
 * read directly (same pattern as src/styles/tokens.test.ts).
 */
describe('#451 tokens mirror shipped CSS, not drifted TS', () => {
  const tokensCssPath = resolve(repoRoot, 'src', 'styles', 'tokens.css')
  const tokensCss = readFileSync(tokensCssPath, 'utf8')

  /** Read a numeric --z-index-<name> from tokens.css :root. */
  const cssZ = (name: string): number => {
    const m = tokensCss.match(new RegExp(`--z-index-${name}:\\s*(-?\\d+)`))
    if (!m) throw new Error(`--z-index-${name} not found in tokens.css`)
    return Number(m[1])
  }

  const flatColors = (arr: unknown): string =>
    (arr as Array<{ color: string }>).map((l) => l.color).join(' ')

  it('shadows.light is NEUTRAL slate, not ocean-tinted', () => {
    const light = light_shadows()
    // Every elevation rung uses the neutral slate triple from CSS.
    for (const rung of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner']) {
      const colors = flatColors(light[rung])
      expect(colors, `light.${rung}`).toContain('rgba(15, 23, 42')
      // No lingering ocean tint.
      expect(colors, `light.${rung}`).not.toContain('27, 127, 168')
      expect(colors, `light.${rung}`).not.toContain('43, 163, 212')
    }
    // outline uses the neutral slate-500 ring from CSS (rgba(100,116,139,0.5)).
    expect(flatColors(light.outline)).toContain('rgba(100, 116, 139, 0.5)')
  })

  it('shadows.light geometry matches CSS (xs = 0 1px 2px 0)', () => {
    const xs = (light_shadows().xs as Array<Record<string, number>>)[0]
    expect(xs).toMatchObject({ x: 0, y: 1, blur: 2, spread: 0 })
  })

  it('shadows.dark matches CSS dark block (black + neutral outline)', () => {
    const dark = (light.tokens.shadows as Record<string, any>).dark
    expect(flatColors(dark.md)).toContain('rgba(0, 0, 0')
    expect(flatColors(dark.outline)).toContain('rgba(100, 116, 139, 0.4)')
  })

  // #455 — colored (semantic hover glows) are authored in CSS as
  // `color-mix(in oklab, var(--color-<fam>[-base]), transparent 61%)`. emit-meta
  // must RESOLVE those against the default tokens, not fall back to the drifted
  // OCEAN TS snapshot (primary rgba(43,163,212), success rgba(45,191,191)).
  it('shadows.colored is resolved brand-neutral, not the old ocean tint (#455)', () => {
    const colored = (light.tokens.shadows as Record<string, any>).colored
    expect(colored, 'meta.tokens.shadows.colored must exist').toBeDefined()
    for (const fam of ['primary', 'success', 'warning', 'error']) {
      const colors = flatColors(colored[fam])
      // No lingering ocean tints from the pre-v0.36 default.
      expect(colors, `colored.${fam}`).not.toContain('43, 163, 212')
      expect(colors, `colored.${fam}`).not.toContain('45, 191, 191')
      // Fully resolved to a concrete rgba() (no unresolved color-mix/var left).
      expect(colors, `colored.${fam}`).toMatch(/rgba\(\d+, \d+, \d+, /)
    }
    // primary = neutral cool gray (--color-primary-base @ .39); success = emerald.
    expect(flatColors(colored.primary)).toContain('rgba(126, 134, 142, 0.39)')
    expect(flatColors(colored.success)).toContain('rgba(16, 185, 129, 0.39)')
    // warning/error were already correct (amber/red) and must stay put.
    expect(flatColors(colored.warning)).toContain('rgba(245, 158, 11, 0.39)')
    expect(flatColors(colored.error)).toContain('rgba(239, 68, 68, 0.39)')
  })

  it('tokens.zIndex is present and mirrors the CSS --z-index-* scale', () => {
    const z = (light.tokens as Record<string, any>).zIndex
    expect(z, 'meta.tokens.zIndex must exist (#451)').toBeDefined()
    // Every canonical tier from CSS is surfaced with the CSS value.
    for (const tier of [
      'base',
      'below',
      'content',
      'sticky',
      'fixed',
      'overlay',
      'modal',
      'drawer',
      'dropdown',
      'popover',
      'tooltip',
      'toast',
      'notification',
    ]) {
      expect(z[tier], `zIndex.${tier}`).toBe(cssZ(tier))
    }
  })

  it('tokens.zIndex carries the #35-correct ordering (overlays above modal)', () => {
    const z = (light.tokens as Record<string, any>).zIndex
    // This is the post-#35 contract, the OPPOSITE of the drifted zIndex.ts.
    expect(z.dropdown).toBeGreaterThan(z.modal)
    expect(z.popover).toBeGreaterThan(z.dropdown)
    expect(z.tooltip).toBeGreaterThan(z.popover)
    expect(z.toast).toBeGreaterThanOrEqual(z.tooltip)
  })

  it('verbose meta carries the same corrected tokens', () => {
    // Same emitter → identical token surface (already asserted deep-equal
    // above, but pin the two #451 fields explicitly for clarity).
    expect((verbose.tokens as Record<string, any>).zIndex).toEqual(
      (light.tokens as Record<string, any>).zIndex
    )
    expect(verbose.tokens.shadows).toEqual(light.tokens.shadows)
  })

  /** shadows.light accessor with a narrow local type. */
  function light_shadows(): Record<string, any> {
    return (light.tokens.shadows as Record<string, any>).light
  }
})

describe('smoke: meta subpath import (@lando-labs/lando-ds/meta)', () => {
  it('emitted dist/meta.json is loadable as JSON', () => {
    // Demonstrates the package-export contract: a consumer doing
    // `require('@lando-labs/lando-ds/meta')` gets a parsed JSON
    // blob conforming to `LightMeta`.
    const raw = readFileSync(lightPath, 'utf8')
    const parsed = JSON.parse(raw)
    expect(isMetaShape(parsed)).toBe(true)
  })
})
