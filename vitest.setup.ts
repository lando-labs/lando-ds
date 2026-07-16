/**
 * Vitest setup — jest-axe a11y matcher.
 *
 * Extends Vitest's `expect` with `toHaveNoViolations` from jest-axe so
 * component tests can assert WCAG-style a11y compliance via:
 *
 *     const { container } = render(<MyComponent />)
 *     expect(await axe(container)).toHaveNoViolations()
 *
 * Used alongside the existing `src/test/setup.ts` which wires
 * `@testing-library/jest-dom` matchers. Both setup files are loaded by
 * `vitest.config.ts`.
 */

import { expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)
