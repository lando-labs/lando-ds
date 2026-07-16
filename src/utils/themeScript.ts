/**
 * RSC-safe `themeScript` (#384).
 *
 * `themeScript()` is a pure string-producing utility — no React, no browser
 * APIs — but historically it lived in `ThemeProvider.tsx` which declares
 * `'use client'`. In Next.js App Router, importing a `'use client'` module
 * from a Server Component is fine for components, but *calling* a function
 * exported from such a module from the server throws:
 *
 *   > Attempted to call themeScript() from the server but themeScript is on
 *   > the client.
 *
 * That blocks the canonical anti-flash pattern of injecting the script via
 * `dangerouslySetInnerHTML` inside an RSC `<head>`. Moving the function (and
 * its private template body) into THIS module — which has NO `'use client'`
 * directive — makes it callable from both server and client without changing
 * the public API. `ThemeProvider.tsx` re-exports `themeScript` so existing
 * `import { themeScript } from '@lando-labs/lando-ds'` keeps working.
 */

// #440 — `getThemePreset` lives in a pure, RSC-safe data module (no
// `'use client'`, no browser imports), so importing it here keeps
// `themeScript` server-callable. `presetColorVars` (below) is the single
// source of truth for the preset-color → CSS-var mapping, shared by both the
// runtime `applyTheme` and the pre-hydration inline script.
import { getThemePreset } from '../tokens/themePresets'

/**
 * localStorage keys used by ThemeProvider for persistence. The pre-hydration
 * script (THEME_SCRIPT_BODY below) interpolates these by name so the script
 * and the runtime stay in lockstep on a single source of truth.
 */
export const STORAGE_KEY = 'lando-theme-mode'
export const PRODUCT_THEME_KEY = 'lando-product-theme'
export const THEME_PRESET_KEY = 'lando-theme-preset'

/**
 * Pure map of a theme preset's `--color-*` custom properties (#440, #337).
 *
 * A theme preset re-skins the palette by overriding a fixed set of `--color-*`
 * tokens. Historically that mapping lived as ~10 copy-pasted
 * `if (preset.colors.X) writeProperty('--color-…', …)` lines inside
 * `applyTheme` (the #337 duplication). This function is the ONE place the
 * `preset.colors.<key>` → `--color-<token>` correspondence is encoded; both
 * the runtime (`applyTheme` loops over the result) and the pre-hydration inline
 * script (`themeScript({ defaultPreset })` inlines the result) consume it, so
 * the two can never drift.
 *
 * Only keys that are actually present on the preset are emitted (mirroring the
 * old `if (preset.colors.X)` truthiness guards). Values are NOT injection-
 * screened here — screening is the caller's job (runtime: `isSafeTokenValue`;
 * inline script: the mirrored `safe()`), so this stays a pure name→value map.
 * Preset values are DS-controlled hex strings, but the screen is kept on both
 * paths as a defensive contract.
 *
 * Lives in this RSC-safe module (not the `'use client'` `ThemeProvider.tsx`)
 * so the server-callable `themeScript` can reach it.
 *
 * @param presetId Preset id (e.g. `'lando'`, `'midnight'`). Unknown ids → `{}`.
 * @returns `{ '--color-primary': '#…', … }` for the preset, or `{}`.
 */
export function presetColorVars(presetId: string): Record<string, string> {
  const preset = getThemePreset(presetId)
  if (!preset) return {}
  const { colors } = preset
  const vars: Record<string, string> = {}
  // Keep this correspondence identical to the runtime write set. Each entry is
  // `[preset.colors key, CSS custom-property name]`.
  if (colors.primary) vars['--color-primary'] = colors.primary
  if (colors.primaryHover) vars['--color-primary-hover'] = colors.primaryHover
  if (colors.primaryActive) vars['--color-primary-active'] = colors.primaryActive
  // v0.36.0 OSS-prep (#421): secondary brand base drives the --color-secondary-*
  // shade ramp + hover/active/disabled tints via the OKLCH derivation layer.
  if (colors.secondary) vars['--color-secondary'] = colors.secondary
  if (colors.accent) vars['--color-accent'] = colors.accent
  if (colors.accentLight) vars['--color-accent-light'] = colors.accentLight
  if (colors.accentDark) vars['--color-accent-dark'] = colors.accentDark
  if (colors.success) vars['--color-success-base'] = colors.success
  if (colors.warning) vars['--color-warning-base'] = colors.warning
  if (colors.error) vars['--color-error-base'] = colors.error
  if (colors.info) vars['--color-info-base'] = colors.info
  return vars
}

/**
 * The bare IIFE that prevents a theme flash on first paint. This is the script
 * *body* only (no `<script>` wrapper) so it can feed `dangerouslySetInnerHTML`
 * directly. `themeScript()` returns this; the wrapping tag is added by
 * `themeScript({ nonce })`.
 *
 * It sets `data-theme` / `data-theme-preset` / `data-product` attributes AND
 * (#371) replays the persisted product theme's `--color-*` custom properties
 * before hydration, so an app with a saved product theme paints the right
 * colors on first frame instead of the base palette → flash → product palette
 * sequence.
 *
 * Security: token VALUES are still screened by an inlined mirror of
 * `isSafeTokenValue` before being written via `style.setProperty(...)` — the
 * single write sink that the v0.28.0 sink invariant pins (#323). The screen
 * MUST stay in lockstep with the runtime `isSafeTokenValue`; a divergence
 * could either reject a legitimate value (cosmetic) or accept a hostile one
 * (security). Both must reject the same vectors.
 *
 * The inline injection screen mirrors `isSafeTokenValue`:
 *   - 500-char length cap (style-recalc DoS amplification)
 *   - substring deny-list for known CSS-break-out vectors.
 *
 * The keys (--color-*) come from DS-controlled category + key composition, so
 * only the VALUE is consumer-supplied and needs screening. Length stays well
 * under 1KB even with a dozen overridden color tokens — small enough to stay
 * inline in <head>.
 */
const THEME_SCRIPT_BODY = `
(function() {
  try {
    var mode = localStorage.getItem('${STORAGE_KEY}') || 'system';
    var theme = mode;

    if (mode === 'system') {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }

    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    // Inlined mirrors of isSafeTokenValue / isSafeTokenKey from ThemeProvider,
    // hoisted to the top so BOTH the default-preset block (#440) and the
    // product-theme replay (#371) screen through the same functions. Keep in
    // lockstep with isSafeTokenValue / isSafeTokenKey — the lockstep test pins
    // the INJECTION deny-list, the 500/100 caps, and the KEY_RE regex.
    var INJECTION = [';','{','}','url(','/*','*/','<','>','\\\\','expression(','@import','@'];
    function safe(v) {
      if (typeof v !== 'string' || v.length === 0 || v.length > 500) return false;
      var hay = v.toLowerCase();
      for (var i = 0; i < INJECTION.length; i++) {
        if (hay.indexOf(INJECTION[i]) !== -1) return false;
      }
      return true;
    }
    var KEY_RE = /^[a-z0-9_-]+$/i;
    function safeKey(k) {
      return typeof k === 'string' && k.length > 0 && k.length <= 100 && KEY_RE.test(k);
    }

    var themePreset = localStorage.getItem('${THEME_PRESET_KEY}');
    if (themePreset) {
      root.setAttribute('data-theme-preset', themePreset);
    }

    // #440 — default-preset zero-flash (first visit only). \`themeScript({
    // defaultPreset })\` replaces the placeholder below with an inlined
    // { id, vars } object for that preset (via presetColorVars). Applied ONLY
    // when the user has no persisted preset (\`themePreset\` is falsy), so a
    // persisted choice always wins after hydration. Each value is screened by
    // the same inline \`safe()\` mirror. When no defaultPreset is passed the
    // placeholder stays \`null\` and this whole block is a no-op.
    var defaultPreset = /*__DEFAULT_PRESET__*/null;
    if (defaultPreset && !themePreset) {
      root.setAttribute('data-theme-preset', defaultPreset.id);
      var dpVars = defaultPreset.vars || {};
      for (var dpKey in dpVars) {
        if (!Object.prototype.hasOwnProperty.call(dpVars, dpKey)) continue;
        var dpVal = dpVars[dpKey];
        if (safe(dpVal)) {
          root.style.setProperty(dpKey, dpVal);
        }
      }
    }

    var productTheme = localStorage.getItem('${PRODUCT_THEME_KEY}');
    if (productTheme) {
      try {
        var parsed = JSON.parse(productTheme);
        if (parsed && typeof parsed.name === 'string') {
          root.setAttribute('data-product', parsed.name);
        }
        // #371 — replay product --color-* vars before hydration, screened by
        // the hoisted safe()/safeKey() mirrors above.
        var tokens = parsed && parsed.tokens;
        if (tokens && typeof tokens === 'object') {
          for (var cat in tokens) {
            if (!Object.prototype.hasOwnProperty.call(tokens, cat)) continue;
            if (!safeKey(cat)) continue;
            var bucket = tokens[cat];
            if (!bucket || typeof bucket !== 'object') continue;
            for (var key in bucket) {
              if (!Object.prototype.hasOwnProperty.call(bucket, key)) continue;
              if (!safeKey(key)) continue;
              var val = bucket[key];
              // Unwrap mode-aware { light, dark } (#370). Recursion is not
              // supported — inner shape mirrors applyTheme.
              if (val && typeof val === 'object' && 'light' in val && 'dark' in val) {
                val = theme === 'dark' ? val.dark : val.light;
              }
              if (safe(val)) {
                root.style.setProperty('--' + cat + '-' + key, val);
              }
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
})();
`.trim()

/** Options for {@link themeScript}. */
export interface ThemeScriptOptions {
  /**
   * CSP nonce. When provided, `themeScript` returns a full
   * `<script nonce="…">…</script>` tag so the inline script satisfies a strict
   * `script-src 'nonce-…'` policy. The nonce is attribute-escaped. When omitted,
   * `themeScript` returns the bare script body for `dangerouslySetInnerHTML`.
   */
  nonce?: string

  /**
   * Default theme preset for the zero-flash first-visit case (#440).
   *
   * When provided, the emitted script inlines that preset's `--color-*` vars
   * (via {@link presetColorVars}) and applies them — plus the
   * `data-theme-preset` attribute — BEFORE first paint, but ONLY when the user
   * has no persisted preset in localStorage. A persisted user preset always
   * wins after hydration. This is the preset analog of how `initialMode` pairs
   * with `themeScript()` for the mode: it makes the default-brand paint correct
   * on the very first frame instead of flashing the brand-neutral palette →
   * preset.
   *
   * Pair with `<ThemeProvider preset="…">` using the SAME id so the pre-paint
   * and the React first render agree. Unknown ids are ignored (no-op).
   *
   * @example Zero-flash default brand (Next.js App Router)
   * ```tsx
   * <head dangerouslySetInnerHTML={{ __html: themeScript({ defaultPreset: 'lando' }) }} />
   * // …and, in the body:
   * <ThemeProvider preset="lando">{children}</ThemeProvider>
   * ```
   */
  defaultPreset?: string
}

/**
 * Anti-flash theme script for SSR (#323, #384).
 *
 * Returns the inline JS that sets the theme attributes before first paint,
 * eliminating the flash of incorrect theme on load.
 *
 * - `themeScript()` → the bare script body. Feed it to `dangerouslySetInnerHTML`
 *   (backward-compatible with the previous `themeScript` string export).
 * - `themeScript({ nonce })` → a complete `<script nonce="…">…</script>` tag,
 *   for emitting the script directly under a strict CSP that uses
 *   `script-src 'nonce-…'`. See `reference/csp.md`.
 * - `themeScript({ defaultPreset })` → the body with a default preset's
 *   `--color-*` vars inlined and applied on first visit only (no persisted
 *   preset). Zero-flash for the default-brand case (#440).
 *
 * This module has NO `'use client'` directive (#384) so the function is safe
 * to call from a React Server Component — the canonical anti-flash injection
 * point. `ThemeProvider.tsx` re-exports this function for backward compat.
 *
 * @example Body for dangerouslySetInnerHTML
 * ```tsx
 * <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
 * ```
 *
 * @example Full nonce'd tag (Next.js App Router)
 * ```tsx
 * <head dangerouslySetInnerHTML={{ __html: themeScript({ nonce }) }} />
 * ```
 *
 * @example Zero-flash default brand
 * ```tsx
 * <head dangerouslySetInnerHTML={{ __html: themeScript({ defaultPreset: 'lando' }) }} />
 * ```
 *
 * @param options Optional. Pass `{ nonce }` to emit a nonce'd `<script>` tag,
 *                and/or `{ defaultPreset }` to inline a first-visit preset.
 * @returns The script body, or a full `<script>` tag when `nonce` is provided.
 */
export function themeScript(options?: ThemeScriptOptions): string {
  const body = buildScriptBody(options?.defaultPreset)

  const nonce = options?.nonce
  if (nonce == null) return body

  // Attribute-escape the nonce so it cannot break out of the attribute or the
  // tag. A spec-valid base64 nonce contains none of these, but a consumer could
  // pass an arbitrary string and we must not emit malformed/injectable markup.
  const safeNonce = nonce
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return `<script nonce="${safeNonce}">${body}</script>`
}

/**
 * Placeholder token in {@link THEME_SCRIPT_BODY} that
 * {@link buildScriptBody} swaps for the inlined default-preset descriptor.
 * Kept as a comment-guarded `null` so the un-substituted body is valid JS and
 * the default-preset block is a no-op when no `defaultPreset` is requested.
 */
const DEFAULT_PRESET_PLACEHOLDER = '/*__DEFAULT_PRESET__*/null'

/**
 * Build the script body, optionally inlining a default preset's color vars.
 *
 * When `defaultPreset` resolves to a known preset with at least one color var,
 * the placeholder `/*__DEFAULT_PRESET__*\/null` is replaced with a JS object
 * literal `{ "id": "<id>", "vars": { "--color-…": "#…", … } }`. The inline
 * script applies it (attribute + screened `setProperty` writes) only on first
 * visit. Unknown ids or empty var maps leave the placeholder untouched (no-op).
 *
 * Security: the object literal is produced by `JSON.stringify` (valid JS syntax
 * for string values) and then `<` is escaped to `<` so an embedded
 * `</script>` / `<!--` can never terminate the surrounding `<script>` tag. Both
 * the id and the values are DS-controlled today, but the escape is defense in
 * depth and keeps the emitted markup well-formed regardless of preset content.
 */
function buildScriptBody(defaultPreset?: string): string {
  if (!defaultPreset) return THEME_SCRIPT_BODY

  const vars = presetColorVars(defaultPreset)
  const preset = getThemePreset(defaultPreset)
  // Nothing to inline (unknown id, or a preset with no color overrides) → emit
  // the base body unchanged so the block stays a no-op.
  if (!preset || Object.keys(vars).length === 0) return THEME_SCRIPT_BODY

  const descriptor = JSON.stringify({ id: preset.id, vars })
    // Prevent `</script>` / `<!--` breakout from the inlined literal. `<` never
    // appears in a spec-valid preset id or hex value, so this is a no-op for
    // real presets but pins the invariant.
    .replace(/</g, '\\u003c')

  return THEME_SCRIPT_BODY.replace(DEFAULT_PRESET_PLACEHOLDER, descriptor)
}

/**
 * Resolvable module specifier for the pre-built static anti-flash script
 * (#80, Option C).
 *
 * The DS build emits `dist/theme-init.js` — the exact `themeScript()` body as a
 * standalone file (see `scripts/emit-theme-init.mjs`) — and exposes it at this
 * export subpath. Reference it instead of hand-copying the script body into
 * your app: the copy can drift from DS internals, this artifact cannot.
 *
 * It is the WARNING-FREE integration for Next.js App Router + React 19: a real
 * `<script src>` (which warns once at hydration, never on client navigation)
 * beats inlining `themeScript()` via `dangerouslySetInnerHTML` (which fires
 * React's "script tag while rendering" warning on every nav). The inline
 * `themeScript()` / `themeScript({ nonce })` / `themeScript({ defaultPreset })`
 * exports remain for the CSP-nonce and first-visit-default-brand cases.
 *
 * Because Next.js App Router does not web-serve arbitrary `node_modules` files,
 * pair this with ONE of (see `reference/integrating-with-nextjs.md`):
 *   - a build-time copy into `public/` (`require.resolve(themeScriptPath)`), or
 *   - a `next.config` rewrite whose `destination` resolves this specifier.
 * Vite/Remix consumers can reference it via their static-asset pipeline.
 *
 * @example Resolve the on-disk path in a consumer copy step (Node ESM)
 * ```js
 * import { createRequire } from 'node:module'
 * import { themeScriptPath } from '@lando-labs/lando-ds'
 * const abs = createRequire(import.meta.url).resolve(themeScriptPath)
 * // → copy `abs` to ./public/lando-theme-init.js at build time
 * ```
 */
export const themeScriptPath = '@lando-labs/lando-ds/theme-init.js'
