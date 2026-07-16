/**
 * Lando Labs Design System — Meta Schema Types (#418, #419)
 *
 * Self-describing metadata for the entire DS, emitted at build time to
 * `dist/meta.json` (LIGHT) and `dist/meta.verbose.json` (VERBOSE).
 *
 * These types are the single source of truth for the meta shape; the
 * JSON Schema in `./schema.json` is the runtime validator twin. Both are
 * exported from the `/meta-schema` subpath so AI agents (Cursor, Claude
 * Code, Copilot) can ground themselves in one JSON blob instead of
 * scraping HTML docs.
 *
 * LIGHT vs VERBOSE: every field present on `LightComponentMeta` is also
 * on `VerboseComponentMeta`. Verbose adds `description`, `examples`,
 * `composes`, and `appliesClassNames` for richer agent grounding.
 *
 * The schema version is bumped any time the shape changes in a way that
 * a downstream JSON-schema validator can detect (added required field,
 * narrowed type, dropped field). v1.0 is the initial OSS-prep shape;
 * future v1.x bumps are additive and backwards-compatible by convention.
 *
 * Version history:
 *   1.0 — initial OSS-prep shape (#418, #419).
 *   1.1 — added `themePresets` block (#437).
 *   1.2 — added per-component `extends` chain (#438).
 */

/** Shape version. Bump on breaking changes; additive changes stay 1.x. */
export type MetaSchemaVersion = '1.0' | '1.1' | '1.2' | '1.3'

/** Package identification block. */
export interface PackageMeta {
  /** npm-style package name. */
  name: string
  /** Semver string from package.json. */
  version: string
  /** Homepage URL — typically the GitHub repo. */
  homepage: string
}

/**
 * A single prop on a component.
 *
 * `type` is the raw TS type string as react-docgen-typescript reports it
 * (e.g. `'primary' | 'secondary'` or `string` or `(value: number) => void`).
 * Agents consuming this can treat it as a literal for prompt context;
 * structured parsing of unions is intentionally NOT done here — keep the
 * schema simple, push parsing to consumers if needed.
 */
export interface PropMeta {
  /** Raw TS type string. */
  type: string
  /** Whether the prop is required (no `?` on the TS interface field). */
  required: boolean
  /**
   * Default value as it appears in TS source / docgen output. `null` if
   * no default. Strings are quoted (e.g. `"'primary'"`); numbers/booleans
   * are unquoted ("42", "true").
   */
  default: string | null
  /** JSDoc description if one was authored on the prop. Empty otherwise. */
  description?: string
}

/** Deprecation marker shared between light and verbose. */
export type DeprecationMeta = null | {
  /** Version this was deprecated in (e.g. "0.36.0"). */
  since: string
  /** Replacement API hint (free-form, e.g. "useToast()"). */
  replacedBy: string
  /** Version this will be removed in (e.g. "1.0.0"). */
  removeAt: string
}

/**
 * Composition relationship: which other components naturally pair with
 * a prop on this component. Populated for the OBVIOUS cases in v0.36
 * (Button.leftIcon → Icon, Card → CardHeader/Body/Footer, etc.).
 * Verbose only.
 */
export interface ComposesMeta {
  /** PascalCase name of the component that's expected. */
  accepts: string
  /** Prop shape that holds it (e.g. "ReactNode", "ReactElement"). */
  as: string
}

/**
 * Per-component metadata in its LIGHT form. Always present in both
 * meta.json and meta.verbose.json.
 */
export interface LightComponentMeta {
  /** Always "component" for now; future-proofing for "hook" / "util". */
  kind: 'component'
  /** Logical grouping — mirrors the CLAUDE.md / sync-docs groupings. */
  category: string
  /** Platforms this component targets. Web for now; "rn" reserved. */
  platforms: Array<'web' | 'rn'>
  /** True if the component's source has no `'use client'` directive. */
  serverSafe: boolean
  /** Inverse of serverSafe — convenience flag, easier to scan in agents. */
  useClient: boolean
  /** True if the component accepts an `as` / `asChild` prop. */
  polymorphic: boolean
  /** The element type the ref forwards to (e.g. "HTMLButtonElement") or null. */
  ref: string | null
  /** Subpath import path under the package, e.g. "./components/Button". */
  subpath: string
  /** Prop registry keyed by prop name. */
  props: Record<string, PropMeta>
  /**
   * Inherited interface chain the component's props extend, in a
   * synthesized canonical form (schema 1.2, #438). Populated from the
   * react-docgen-typescript `parent` info plus the forwardRef target,
   * then normalized to a deterministic, alphabetically-sorted set.
   *
   * Examples:
   *   - `["HTMLAttributes<HTMLDivElement>", "RefAttributes<HTMLDivElement>"]`
   *     (a forwardRef'd component spreading DOM props on a `<div>`)
   *   - `["HTMLAttributes"]` (spreads DOM props but no concrete element /
   *     not forwardRef'd — e.g. a polymorphic default element)
   *   - `null` when the component declares only its own props (no React
   *     DOM attributes inherited).
   *
   * Granularity is intentionally the generic `HTMLAttributes` /
   * `SVGAttributes` family rather than element-specific interfaces
   * (`ButtonHTMLAttributes`, …) — docgen's element-specific attribution
   * is noisy (shared props like `type`/`value`/`form` cross-contaminate),
   * so we normalize to the stable generic form keyed by the ref element.
   */
  extends: string[] | null
  /** Deprecation status. Null when not deprecated. */
  deprecated: DeprecationMeta
}

/**
 * Verbose superset of `LightComponentMeta`. Adds the heavier fields
 * AI agents want for code-gen grounding but consumers paying bundle
 * weight may not want.
 */
export interface VerboseComponentMeta extends LightComponentMeta {
  /** First non-empty line of the component's JSDoc, or "". */
  description: string
  /** Curated examples — short, copy-pasteable. May be empty in v0.36. */
  examples: Array<{ name: string; code: string }>
  /**
   * Composition hints keyed by prop name. Only the obvious relationships
   * are populated in v0.36; others stay absent.
   */
  composes: Record<string, ComposesMeta> | null
  /**
   * Internal class-name application map keyed by variant prop.
   * Populated only for components where the maintainer wants to expose
   * this for theming / overriding. Free-form — may be `null`.
   */
  appliesClassNames: Record<string, Record<string, string>> | null
}

/**
 * Token registry — verbatim mirror of `src/tokens/index.ts` exports,
 * shaped for easy agent consumption. Each subgroup is the typed-as-JSON
 * snapshot of the corresponding token module.
 */
export interface TokensMeta {
  colors: {
    /** Flat semantic anchor hexes — primary/secondary/success/warning/error/info. */
    semantic: Record<string, unknown>
    /** Full brand ramps — ocean / teal / neutral / status. */
    brand: Record<string, unknown>
  }
  spacing: Record<string, unknown>
  typography: Record<string, unknown>
  radius: Record<string, unknown>
  shadows: Record<string, unknown>
  motion: Record<string, unknown>
  /**
   * Numeric z-index scale, sourced from the shipped `tokens.css`
   * `--z-index-*` block (#451). Keyed by tier (base/below/content/sticky/
   * fixed/overlay/modal/drawer/dropdown/popover/tooltip/toast/notification).
   */
  zIndex: Record<string, number>
}

/** Single icon registry entry. */
export interface IconRegistryEntry {
  /** Canonical kebab-case name. */
  name: string
  /** PascalCase lucide-react component name. */
  lucideName: string
  /** Category bucket — e.g. "navigation", "actions". */
  category: string
}

/** Icon registry block. */
export interface IconsMeta {
  /** Total number of registry entries (including aliases). */
  totalCount: number
  /** Icon entries keyed by canonical kebab-case name. */
  registry: Record<string, IconRegistryEntry>
}

/** Package exports surface, for agent path-resolution. */
export interface ExportsMeta {
  /** Main entry path under the package. */
  main: string
  /** Sub-path entries declared in package.json `exports`. */
  subpaths: string[]
}

/**
 * Capability arrays — names that fit each capability. Lets agents grep
 * for "what's server-safe" or "what supports polymorphism" without
 * walking every component.
 */
export interface CapabilitiesMeta {
  /** Components with NO `'use client'` directive — safe in RSC. */
  rscSafe: string[]
  /** Components with `'use client'` directive — must be client-rendered. */
  clientOnly: string[]
  /** Components that expose an `as` / `asChild` prop. */
  polymorphic: string[]
  /** Components that wrap with `React.forwardRef`. */
  withRef: string[]
}

/**
 * A single theme preset in its LIGHT form (schema 1.1, #437). Mirrors an
 * entry from `src/tokens/themePresets.ts` — the opt-in palettes layered
 * over the brand-neutral default via `<ThemeProvider preset="<id>">`.
 */
export interface ThemePresetMeta {
  /** Preset id — the value passed to `preset="…"` (e.g. "lando"). */
  id: string
  /**
   * True for the preset applied by default at boot. Since v0.36.0 the DS
   * ships brand-neutral (no preset), so the synthetic `brand-neutral`
   * entry carries this flag and the named presets are all `false`.
   */
  isDefault: boolean
  /** Short human description, sourced from the preset's `description`. */
  description?: string
}

/**
 * Verbose theme preset — superset of {@link ThemePresetMeta} that also
 * carries the raw token overrides the preset applies. Keyed by the
 * preset's color-token names (primary, secondary, accent, success, …);
 * the brand-neutral default has an empty override map.
 */
export interface VerboseThemePresetMeta extends ThemePresetMeta {
  /** Raw token overrides this preset applies (from `preset.colors`). */
  tokenOverrides: Record<string, unknown>
}

/**
 * Theme presets block (schema 1.1, #437). `default` is the id of the
 * boot preset (the `brand-neutral` sentinel since v0.36.0); `presets`
 * maps every known preset id to its metadata.
 */
export interface ThemePresetsMeta<
  TPreset extends ThemePresetMeta = ThemePresetMeta,
> {
  /** Id of the preset applied by default (e.g. "brand-neutral"). */
  default: string
  /** Preset registry keyed by preset id. */
  presets: Record<string, TPreset>
}

/**
 * A public hook's metadata (schema 1.3, #504). Hooks are headless and
 * client-only, so they carry a signature/description rather than a prop table.
 */
export interface HookMeta {
  /** Always "hook". */
  kind: 'hook'
  /** Logical grouping, e.g. "state" | "dom" | "browser" | "a11y". */
  category: string
  /** Always false — a React hook requires client runtime state. */
  serverSafe: boolean
  /** Whether the hook's module carries the `'use client'` directive. */
  useClient: boolean
  /** Subpath import path, e.g. "@lando-labs/lando-ds/hooks". */
  subpath: string
  /** One-line prose description (leading JSDoc, before the first `@tag`). */
  description: string
  /**
   * Canonical TypeScript call signature, e.g.
   * `useKeyPress(targetKeys: string | string[], callback: (key: string, event: KeyboardEvent) => void, isActive?: boolean): void`.
   * Omitted only when the emitted declaration is unavailable.
   */
  signature?: string
  /** The hook's return type, e.g. "void" | "boolean". */
  returns?: string | null
}

/** Top-level meta shape — both LIGHT and VERBOSE. */
export interface Meta<
  TComponent extends LightComponentMeta = LightComponentMeta,
  TPreset extends ThemePresetMeta = ThemePresetMeta,
> {
  $schemaVersion: MetaSchemaVersion
  package: PackageMeta
  components: Record<string, TComponent>
  /** Public hooks surface, keyed by hook name (schema 1.3, #504). */
  hooks: Record<string, HookMeta>
  tokens: TokensMeta
  icons: IconsMeta
  exports: ExportsMeta
  capabilities: CapabilitiesMeta
  /** Theme presets — opt-in palettes over the brand-neutral default (1.1). */
  themePresets: ThemePresetsMeta<TPreset>
}

/** Specializations — easier to type-narrow than passing a generic. */
export type LightMeta = Meta<LightComponentMeta, ThemePresetMeta>
export type VerboseMeta = Meta<VerboseComponentMeta, VerboseThemePresetMeta>
