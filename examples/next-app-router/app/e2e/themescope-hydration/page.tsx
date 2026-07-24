/**
 * E2E fixture — ThemeScope inherited-`system`-mode SSR guard (#501,
 * tests/e2e/themescope-hydration.spec.ts).
 *
 * This is committed, permanent test infrastructure — NOT a demo/showcase
 * page (the library intentionally ships no in-repo showcase; see the root
 * CLAUDE.md). Playwright drives this page against the built package (this
 * example app consumes `@lando-labs/lando-ds` via a `file:` symlink) to
 * prove real-browser hydration behavior that jsdom cannot: whether React
 * actually emits a hydration-mismatch console error, and whether the
 * settled DOM after hydration matches the real client `matchMedia`
 * preference (jsdom's `window` always exists, so it can't fully stand in
 * for a true window-less server render — see ThemeScope.test.tsx's
 * "inherited-mode SSR guard (#501)" block for the closest jsdom proxy).
 *
 * The root layout's `<Providers>` (app/providers.tsx) wraps every page in a
 * `<ThemeProvider>` with no props — i.e. `defaultMode="system"`, the exact
 * "system-mode root" shape #501 is about. This fixture just needs to render
 * ThemeScopes under it:
 *
 *  - `inherited-scope`: no `mode` prop — the case that was hydration-
 *    mismatched (and stuck on `light` forever) before the fix.
 *  - `explicit-dark-scope`: `mode="dark"` — a warning-free non-regression
 *    guard proving the #428 correct-from-first-paint path is untouched.
 *  - `inherited-preset-scope`: no `mode` prop, WITH `preset="forest"` — the
 *    same inherited-mode shape as `inherited-scope`, but exercised via
 *    `preset` (the primary way ThemeScope is used in practice) rather than
 *    a bare scope. Closes a coverage hole flagged during #501 review: the
 *    original suite only ever exercised a bare scope and an explicit-`mode`
 *    scope, never `preset`.
 *
 * Keep this fixture's DOM stable (ids, testids) — the spec queries it
 * directly, and unrelated page-content changes will break the e2e suite for
 * no reason.
 */

import { ThemeScope } from '@lando-labs/lando-ds'

export default function ThemeScopeHydrationFixture() {
  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <ThemeScope data-testid="inherited-scope">
        <p>Inherited mode (no explicit `mode` prop)</p>
      </ThemeScope>
      <ThemeScope mode="dark" data-testid="explicit-dark-scope">
        <p>Explicit dark mode</p>
      </ThemeScope>
      <ThemeScope preset="forest" data-testid="inherited-preset-scope">
        <p>Inherited mode, preset applied</p>
      </ThemeScope>
    </main>
  )
}
