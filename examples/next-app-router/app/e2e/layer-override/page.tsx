/**
 * E2E fixture — `@layer app` / unlayered override proof (#13,
 * tests/e2e/layer-override.spec.ts).
 *
 * This is committed, permanent test infrastructure — NOT a demo/showcase
 * page (the library intentionally ships no in-repo showcase; see the root
 * CLAUDE.md). Playwright drives this page against the built package (this
 * example app consumes `@lando-labs/lando-ds` via a `file:` symlink) to
 * prove, in a real browser, that reference/css-layers.md's documented
 * override contract actually holds:
 *
 *   - a consumer's `@layer app { … }` rule beats the DS `<Button>` rule
 *     (which lives in `ll.components`), and
 *   - a consumer's plain unlayered rule beats it too.
 *
 * `src/test/css-layers.test.ts` (jsdom) already proves the CSS is SHAPED
 * correctly — the Button rule is emitted inside `@layer ll.components`, and
 * the DS stylesheet's order statement positions `app` above it. What jsdom
 * cannot prove is that a real browser's cascade actually RESOLVES that shape
 * the way the spec says it should, nor that a real consumer bundle preserves
 * the CSS load order the shape assumes (issue #13's root cause). This
 * fixture + spec is that proof.
 *
 * Keep this fixture's DOM stable (the three `data-testid`s below) — the spec
 * queries by them directly.
 */

import { Button } from '@lando-labs/lando-ds/components/Button/Button'
import './overrides.css'

export default function LayerOverrideFixture() {
  return (
    <main style={{ padding: '2rem', display: 'flex', gap: '1rem' }}>
      <Button data-testid="baseline" variant="primary">
        Baseline
      </Button>
      <Button data-testid="layer-app" variant="primary" className="layer-app-override">
        @layer app override
      </Button>
      <Button data-testid="unlayered" variant="primary" className="unlayered-override">
        Unlayered override
      </Button>
    </main>
  )
}
