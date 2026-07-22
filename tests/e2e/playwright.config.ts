import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const exampleAppDir = path.resolve(__dirname, '../../examples/next-app-router')

/**
 * Real-browser regression harness (#14 v2/v3).
 *
 * Why this exists: overlay behavior this sprint (overlay popups genuinely
 * interactive inside a Modal, not just painted above it; click-trigger
 * toggle not double-firing open/close) depends on browser behavior jsdom
 * does not implement at all — e.g. a `<dialog>` opened via `showModal()`
 * marks everything outside its own subtree `inert`, which blocks pointer
 * events regardless of paint/top-layer order. vitest+jsdom (`npm test`) can
 * verify DOM shape and attribute presence, but it CANNOT verify that a real
 * click or hover actually reaches an element — which is exactly the class of
 * bug that shipped broken in the v1 attempt at #14. See the long comment at
 * the top of `src/components/Modal/Modal.tsx`.
 *
 * This is a MINIMAL, deliberately separate harness from `npm test` — it
 * drives a full Next.js dev server consuming the built `dist/` (via the
 * `file:` symlink in `examples/next-app-router`), which is slower and has
 * different flake characteristics than the jsdom suite, so it stays a
 * dedicated `npm run test:e2e` rather than folding into vitest. It IS wired
 * into the CI PR gate as its own job (`e2e-overlays` in `.github/workflows/test.yml`)
 * so it can't regress silently between manual runs.
 *
 * Run locally from the repo root:
 *   npm run build                        # dist/ must be fresh — the example
 *                                         # app consumes it via a `file:`
 *                                         # symlink, so a stale dist/ tests
 *                                         # yesterday's fix, not this one
 *   npx playwright install chromium      # one-time browser download
 *   npm run test:e2e
 *
 * The `webServer` block below starts the already-built Next.js example app
 * automatically — no separate terminal needed. It does NOT run `npm run
 * build` itself (a full library build on every e2e run is slow and belongs
 * under the developer's control, not implicit in the test harness).
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: exampleAppDir,
    url: 'http://localhost:3000/e2e/overlays-in-modal',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
