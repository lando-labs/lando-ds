import { test, expect } from '@playwright/test'

/**
 * Real-browser regression coverage for #13 — see playwright.config.ts for
 * why this harness exists and how to run it.
 *
 * reference/css-layers.md documents that a consumer's `@layer app { … }` rule
 * (and, unconditionally, any unlayered rule) beats a DS component's own
 * `ll.components` rule with no `!important`. The structural jsdom test
 * (`src/test/css-layers.test.ts`) proves the built CSS is *shaped* to make
 * that true — the DS order statement positions `app` after `ll.utilities`,
 * and Button's rule lives inside `ll.components`. It cannot prove the
 * cascade actually *resolves* that way: jsdom's CSSOM does not implement
 * `@layer` precedence, and a real bundler's CSS chunk order can diverge from
 * what a source-order reading of the imports would suggest (the exact
 * failure mode #13 reported). This spec drives a real Chromium against the
 * built package (via `examples/next-app-router/app/e2e/layer-override`,
 * consumed through the same `file:`-symlinked `dist/` as every other e2e
 * fixture) and reads `getComputedStyle`, which is the only way to prove the
 * cascade — not just the CSS shape — actually behaves as documented.
 */

const FIXTURE_URL = '/e2e/layer-override'

test.describe('@layer app / unlayered overrides beat DS component styles (#13)', () => {
  test('a @layer app rule overrides the DS Button background', async ({ page }) => {
    await page.goto(FIXTURE_URL)

    const baseline = page.getByTestId('baseline')
    const layerApp = page.getByTestId('layer-app')

    const baselineColor = await baseline.evaluate((el) => getComputedStyle(el).backgroundColor)
    const layerAppColor = await layerApp.evaluate((el) => getComputedStyle(el).backgroundColor)

    // The override rule sets rgb(255, 0, 0) — assert the exact win, not just
    // "different from baseline", so a regression that resolves to some OTHER
    // (wrong) rule doesn't accidentally pass.
    expect(layerAppColor).toBe('rgb(255, 0, 0)')
    expect(layerAppColor).not.toBe(baselineColor)
  })

  test('an unlayered rule overrides the DS Button background', async ({ page }) => {
    await page.goto(FIXTURE_URL)

    const baseline = page.getByTestId('baseline')
    const unlayered = page.getByTestId('unlayered')

    const baselineColor = await baseline.evaluate((el) => getComputedStyle(el).backgroundColor)
    const unlayeredColor = await unlayered.evaluate((el) => getComputedStyle(el).backgroundColor)

    expect(unlayeredColor).toBe('rgb(0, 128, 0)')
    expect(unlayeredColor).not.toBe(baselineColor)
  })
})
