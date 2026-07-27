import { test, expect, type Locator, type ElementHandle } from '@playwright/test'

/**
 * Real-browser regression coverage for #92 / #93 — ThemeScope's scoped
 * mode-dependent BASE token re-derivation.
 *
 * Why this exists: the bug is fundamentally about real CSS cascade — an
 * ancestor `[data-theme='dark']` descendant-selector match (a real selector,
 * not something jsdom's cascade engine implements) combined with custom-
 * property INHERITANCE resolving at the nearest declaring ancestor. jsdom
 * (`npm test`) can prove `ThemeScope` writes the right literal `--*` values
 * as inline styles (`ThemeScope.test.tsx`), but it cannot prove a real
 * browser actually RESOLVES the cascade the way the fix assumes. See the
 * "Mode-dependent BASE token re-derivation (#92)" doc block in
 * `src/components/ThemeScope/ThemeScope.tsx` for the full diagnosis.
 *
 * Fixture: examples/next-app-router/app/e2e/themescope-mode-tokens — two
 * ambient-mode sections (a plain `<div data-theme="dark">` / the default
 * light page), each nesting a ThemeScope of the OPPOSITE mode around an
 * Accordion (expanded), a Switch, and a DetailCard, plus two bare "control"
 * elements (no ThemeScope) that paint the ground-truth light/dark value of
 * `--color-surface-elevated` / `--color-border-emphasis` via a REAL CSS
 * property (`background-color` / `border-color`) for comparison. Colors are
 * compared via a lightness extractor rather than raw string content —
 * Chromium is free to serialize a resolved color as `rgb(...)` or in its
 * originally-declared color-function notation (`oklch(...)`) depending on
 * the property/context, so this suite normalizes to an approximate 0–1
 * lightness before comparing instead of depending on either format.
 */

const FIXTURE_URL = '/e2e/themescope-mode-tokens'

/** Structural union: both `Locator` and `ElementHandle` expose a compatible
 * `.evaluate()`, so a single helper can accept either. */
type EvalTarget = Locator | ElementHandle<Element>

async function backgroundColorOf(target: EvalTarget): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).backgroundColor)
}

async function borderTopColorOf(target: EvalTarget): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).borderTopColor)
}

async function textColorOf(target: EvalTarget): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).color)
}

/**
 * Approximate 0 (black) .. 1 (white) lightness from either `rgb(a)(...)` or
 * `oklch(...)` computed-style serialization — good enough to distinguish
 * "clearly the light-mode token" from "clearly the dark-mode token" (the
 * token pairs this suite checks are always > 0.3 lightness apart), without
 * depending on which notation a given Chromium version chooses to emit.
 */
function approxLightness(color: string): number {
  const oklch = /oklch\(\s*([\d.]+)/.exec(color)
  if (oklch) return Number(oklch[1])
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (rgb) {
    const [, r, g, b] = rgb
    return (Number(r) + Number(g) + Number(b)) / 3 / 255
  }
  throw new Error(`Unrecognized computed color format: ${color}`)
}

/**
 * Walk up from a text-bearing element to the nearest ancestor with a
 * non-transparent `background-color` — i.e. DetailCard's `.field` row,
 * without depending on the CSS-module-hashed class name or the exact DOM
 * nesting depth (which the accessibility tree — and therefore a naive
 * `xpath=../..` traversal — can collapse non-semantic wrapper `<div>`s out
 * of).
 */
async function fieldRowOf(labelLocator: Locator): Promise<ElementHandle<Element>> {
  const handle = await labelLocator.evaluateHandle((el) => {
    let node: Element | null = el
    while (node && node !== document.body) {
      const bg = getComputedStyle(node).backgroundColor
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return node
      node = node.parentElement
    }
    return null
  })
  const element = handle.asElement()
  if (!element) throw new Error('Could not find an ancestor with a non-transparent background')
  return element as ElementHandle<Element>
}

test.describe('ThemeScope scoped mode-dependent BASE tokens (#92)', () => {
  test('a LIGHT scope nested inside an ambient DARK page renders Accordion/Switch chrome with LIGHT tokens', async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL)

    const lightControl = page.getByTestId('control-light-ambient')
    const darkControl = page.getByTestId('control-dark-ambient')
    const lightElevatedL = approxLightness(await backgroundColorOf(lightControl))
    const darkElevatedL = approxLightness(await backgroundColorOf(darkControl))
    const lightEmphasisL = approxLightness(await borderTopColorOf(lightControl))
    const darkEmphasisL = approxLightness(await borderTopColorOf(darkControl))
    // Sanity — the two controls must actually differ, or this test proves
    // nothing.
    expect(Math.abs(lightElevatedL - darkElevatedL)).toBeGreaterThan(0.1)

    const scope = page.getByTestId('light-in-dark')
    await expect(scope).toHaveAttribute('data-theme', 'light')

    const trigger = scope.getByTestId('accordion-item').locator('button')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const triggerElevatedL = approxLightness(await backgroundColorOf(trigger))
    expect(
      Math.abs(triggerElevatedL - lightElevatedL),
      `expected the trigger's --color-surface-elevated to match the LIGHT control (light=${lightElevatedL}, dark=${darkElevatedL}, trigger=${triggerElevatedL})`,
    ).toBeLessThan(0.02)
    expect(Math.abs(triggerElevatedL - darkElevatedL)).toBeGreaterThan(0.1)

    const track = scope.getByTestId('switch-wrapper').locator('span[aria-hidden="true"]')
    const trackEmphasisL = approxLightness(await backgroundColorOf(track))
    expect(
      Math.abs(trackEmphasisL - lightEmphasisL),
      `expected the track's --color-border-emphasis to match the LIGHT control (light=${lightEmphasisL}, dark=${darkEmphasisL}, track=${trackEmphasisL})`,
    ).toBeLessThan(0.02)
  })

  test('a DARK scope nested inside the default light page renders Accordion/Switch chrome with DARK tokens', async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL)

    const lightControl = page.getByTestId('control-light-ambient')
    const darkControl = page.getByTestId('control-dark-ambient')
    const lightElevatedL = approxLightness(await backgroundColorOf(lightControl))
    const darkElevatedL = approxLightness(await backgroundColorOf(darkControl))

    const scope = page.getByTestId('dark-in-light')
    await expect(scope).toHaveAttribute('data-theme', 'dark')

    const trigger = scope.getByTestId('accordion-item').locator('button')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const triggerElevatedL = approxLightness(await backgroundColorOf(trigger))
    expect(
      Math.abs(triggerElevatedL - darkElevatedL),
      `expected the trigger's --color-surface-elevated to match the DARK control (light=${lightElevatedL}, dark=${darkElevatedL}, trigger=${triggerElevatedL})`,
    ).toBeLessThan(0.02)
    expect(Math.abs(triggerElevatedL - lightElevatedL)).toBeGreaterThan(0.1)
  })

  test('DetailCard default field row is legible inside a DARK scope nested in a light page (#93)', async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL)

    const scope = page.getByTestId('dark-in-light')
    const label = scope.getByText('Owner', { exact: true })
    const fieldRow = await fieldRowOf(label)

    // Real legibility proof: the resolved background must be DARK (low
    // lightness), not the near-white value #93 reported (which stayed light
    // because --color-surface-tertiary silently inherited the ambient
    // page's mode instead of the scope's).
    const bgL = approxLightness(await backgroundColorOf(fieldRow))
    expect(bgL, 'expected a dark field-row background').toBeLessThan(0.5)

    // And the text sitting on it must still be light (unchanged — text was
    // never the broken half of #93), so the pairing is genuinely legible,
    // not just "both happen to be mid-tone."
    const textL = approxLightness(await textColorOf(label))
    expect(textL, 'expected light field-label text').toBeGreaterThan(0.5)
  })

  test('a LIGHT scope nested inside an ambient DARK page also keeps DetailCard legible (non-regression)', async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL)

    const scope = page.getByTestId('light-in-dark')
    const label = scope.getByText('Owner', { exact: true })
    const fieldRow = await fieldRowOf(label)

    const bgL = approxLightness(await backgroundColorOf(fieldRow))
    expect(bgL, 'expected a light field-row background').toBeGreaterThan(0.5)
  })
})
