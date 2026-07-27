/**
 * E2E fixture — ThemeScope scoped mode-dependent BASE token re-derivation
 * (#92, #93; tests/e2e/themescope-mode-tokens.spec.ts).
 *
 * This is committed, permanent test infrastructure — NOT a demo/showcase
 * page (the library intentionally ships no in-repo showcase; see the root
 * CLAUDE.md). Playwright drives this page against the built package (this
 * example app consumes `@lando-labs/lando-ds` via a `file:` symlink) to
 * prove, in a REAL browser, that a nested `ThemeScope` whose `mode` differs
 * from the ambient page mode renders mode-dependent chrome with ITS OWN
 * mode's tokens — not the ambient page's. jsdom cannot prove this:
 * `src/components/ThemeScope/ThemeScope.test.tsx` pins the same contract at
 * the inline-style level, but this bug is fundamentally about real cascade
 * (a real browser resolving `[data-theme='dark'] .foo` ancestor-selector
 * matches + real custom-property inheritance), which jsdom does not
 * implement.
 *
 * "Ambient page mode" is simulated with a plain `<div data-theme="…">`
 * wrapper rather than a real `<ThemeProvider mode>` — `tokens.css`'s
 * `[data-theme="dark"]` rule is a plain attribute selector (not
 * `:root[data-theme="dark"]`), so it matches ANY element carrying the
 * attribute, exactly the mechanism the #92 issue diagnosis describes. This
 * also sidesteps two independent `ThemeProvider`s fighting over the single
 * global `document.documentElement` on one page.
 *
 * Two directions, both proven:
 *   - `light-in-dark`: `<ThemeScope mode="light">` nested inside an ambient
 *     DARK page — the #92 headline symptom (Accordion trigger / Switch
 *     track rendering with dark-mode chrome inside an otherwise-correct
 *     light scope).
 *   - `dark-in-light`: `<ThemeScope mode="dark">` nested inside the
 *     (default) light page — the #93 symptom (DetailCard's default field
 *     row staying near-white in an otherwise-correct dark scope, because its
 *     `--color-surface-secondary` / `-tertiary` alias tokens were never
 *     re-declared on the scope).
 *
 * `control-light-ambient` / `control-dark-ambient` are bare, UN-scoped `<div>`
 * elements (no `ThemeScope`) sitting directly in the light-page root / the
 * dark `data-theme` div respectively, with an inline `style` that paints
 * `background-color: var(--color-surface-elevated)` and `border-color:
 * var(--color-border-emphasis)`. The spec compares the scope's REAL,
 * resolved `background-color` / `border-*-color` (an actual CSS property —
 * always fully resolved to a used color value, unlike reading a `--custom-
 * property` directly via `getComputedStyle().getPropertyValue()`, whose
 * serialized notation Chromium is free to vary) against these controls'
 * ground-truth light/dark values, rather than hardcoding a literal color
 * string.
 *
 * Keep this fixture's DOM stable (the `data-testid`s below) — the spec
 * queries it directly.
 */

import { Accordion, AccordionItem, Switch, DetailCard, ThemeScope } from '@lando-labs/lando-ds'

const controlStyle = {
  display: 'inline-block',
  width: 8,
  height: 8,
  backgroundColor: 'var(--color-surface-elevated)',
  borderStyle: 'solid',
  borderWidth: 4,
  borderColor: 'var(--color-border-emphasis)',
} as const

function ModeProbe() {
  return (
    <>
      <Accordion type="single" defaultValue="item-1">
        <AccordionItem value="item-1" title="Expanded item" data-testid="accordion-item">
          Content
        </AccordionItem>
      </Accordion>

      <div data-testid="switch-wrapper">
        <Switch label="A switch" />
      </div>

      <DetailCard
        title="Probe"
        fields={[{ label: 'Owner', value: 'Sarah Chen' }]}
      />
    </>
  )
}

export default function ThemeScopeModeTokensFixture() {
  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Ground-truth light value — bare, no ThemeScope, ambient page :root. */}
      <div data-testid="control-light-ambient" style={controlStyle} />

      {/* #92 headline case: a LIGHT scope nested inside an ambient DARK page. */}
      <div data-theme="dark" style={{ padding: '1rem' }}>
        <p>Ambient page mode: dark</p>
        {/* Ground-truth dark value — bare, no ThemeScope, just the dark div. */}
        <div data-testid="control-dark-ambient" style={controlStyle} />
        <ThemeScope mode="light" data-testid="light-in-dark">
          <ModeProbe />
        </ThemeScope>
      </div>

      {/* #93 case: a DARK scope nested inside the (default) light page. */}
      <div style={{ padding: '1rem' }}>
        <p>Ambient page mode: light (default)</p>
        <ThemeScope mode="dark" data-testid="dark-in-light">
          <ModeProbe />
        </ThemeScope>
      </div>
    </main>
  )
}
