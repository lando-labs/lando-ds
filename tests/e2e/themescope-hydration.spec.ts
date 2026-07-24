import { test, expect, type Page } from '@playwright/test'

/**
 * Real-browser regression coverage for #501 — ThemeScope's inherited-
 * `system`-mode SSR guard.
 *
 * Why this exists: jsdom's `window` always exists, so it cannot model a
 * true window-undefined server render — only a real browser hydrating real
 * SSR HTML can prove (a) React logs zero hydration-mismatch console errors,
 * and (b) the settled DOM after hydration is a genuine repatch to the real
 * client `matchMedia` preference, not a "same value the mismatched hydration
 * pass already recorded" no-op that leaves the DOM stuck. See the
 * "Inherited-mode SSR guard (#501)" doc block at the top of
 * `src/components/ThemeScope/ThemeScope.tsx` for the full diagnosis and the
 * jsdom-level companion test in `ThemeScope.test.tsx`.
 *
 * Fixture: examples/next-app-router/app/e2e/themescope-hydration — a
 * `system`-mode root `<ThemeProvider>` (the default from the root layout's
 * `<Providers>`) wrapping a no-`mode` `ThemeScope` (the previously-broken
 * case) and a `mode="dark"` `ThemeScope` (the non-regression guard).
 */

const FIXTURE_URL = '/e2e/themescope-hydration'

const HYDRATION_ERROR_PATTERN = /hydrat|did not match|didn't match|server render|server html/i

async function collectHydrationErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && HYDRATION_ERROR_PATTERN.test(msg.text())) {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => {
    if (HYDRATION_ERROR_PATTERN.test(err.message)) {
      errors.push(err.message)
    }
  })
  return errors
}

test.describe('ThemeScope inherited system-mode SSR guard (#501)', () => {
  test('dark OS preference: zero hydration-mismatch errors, and the inherited scope settles to dark (not stuck on light)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    const hydrationErrors = await collectHydrationErrors(page)

    await page.goto(FIXTURE_URL)
    await page.waitForLoadState('networkidle')

    expect(hydrationErrors).toEqual([])

    const inherited = page.getByTestId('inherited-scope')
    await expect(inherited).toHaveAttribute('data-theme', 'dark')

    const primaryBase = await inherited.evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--color-primary-base'),
    )
    // #11's dark-mode-tuned formula (30% white-mix) — proves the settled
    // correction re-derives the ramp/state tokens too, not just data-theme.
    expect(primaryBase).toContain('30%')

    const colorScheme = await inherited.evaluate((el) => getComputedStyle(el).colorScheme)
    expect(colorScheme).toBe('dark')

    // Non-regression guard: the explicit mode="dark" scope was never at
    // risk (SSR-stable from first paint) — still correct, still no warning.
    const explicitDark = page.getByTestId('explicit-dark-scope')
    await expect(explicitDark).toHaveAttribute('data-theme', 'dark')
  })

  test('light OS preference: zero hydration-mismatch errors, and the inherited scope settles to light', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    const hydrationErrors = await collectHydrationErrors(page)

    await page.goto(FIXTURE_URL)
    await page.waitForLoadState('networkidle')

    expect(hydrationErrors).toEqual([])

    const inherited = page.getByTestId('inherited-scope')
    await expect(inherited).toHaveAttribute('data-theme', 'light')

    const primaryBase = await inherited.evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--color-primary-base'),
    )
    expect(primaryBase).toContain('23%')

    const explicitDark = page.getByTestId('explicit-dark-scope')
    await expect(explicitDark).toHaveAttribute('data-theme', 'dark')
  })
})
