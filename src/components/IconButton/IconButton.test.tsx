/**
 * IconButton Component Tests
 *
 * Sprint 19 (#110) — new component. Covers variants, sizes, click
 * forwarding, disabled-state click suppression, child rendering, and the
 * critical TypeScript-level assertion that `aria-label` is REQUIRED.
 *
 * Note: tests use a stub SVG for the icon child rather than importing
 * lucide — keeps the unit suite hermetic and import-graph-free.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { IconButton } from './IconButton'

// Stub icon — avoids pulling lucide into the unit-test import graph.
const TestIcon = () => <svg data-testid="test-icon" aria-hidden="true" />

describe('IconButton', () => {
  it('renders as a button with the provided aria-label', () => {
    render(
      <IconButton aria-label="Delete comment">
        <TestIcon />
      </IconButton>
    )
    const btn = screen.getByRole('button', { name: 'Delete comment' })
    expect(btn).toBeInTheDocument()
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveAttribute('aria-label', 'Delete comment')
  })

  it('renders the icon child inside the button', () => {
    render(
      <IconButton aria-label="Delete">
        <TestIcon />
      </IconButton>
    )
    const btn = screen.getByRole('button', { name: 'Delete' })
    // The stub icon should be rendered inside the button.
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    expect(btn).toContainElement(screen.getByTestId('test-icon'))
  })

  it('defaults to type="button" so it does not submit forms', () => {
    render(
      <IconButton aria-label="Action">
        <TestIcon />
      </IconButton>
    )
    expect(screen.getByRole('button', { name: 'Action' })).toHaveAttribute(
      'type',
      'button'
    )
  })

  it('applies a different class for each variant', () => {
    // IconButton.tsx: variant ∈ ghost | solid | outline
    const variants = ['ghost', 'solid', 'outline'] as const
    const seenClasses = new Set<string>()

    for (const variant of variants) {
      const { unmount } = render(
        <IconButton aria-label={variant} variant={variant}>
          <TestIcon />
        </IconButton>
      )
      const btn = screen.getByRole('button', { name: variant })
      // Variant classes are emitted as-is by the CSS-Modules import in
      // tests (no hashing in our jsdom config), so we can assert against
      // the literal variant name.
      expect(btn.className).toContain(variant)
      expect(btn).toHaveAttribute('data-variant', variant)
      seenClasses.add(btn.className)
      unmount()
    }

    // All three variants produced distinct className strings.
    expect(seenClasses.size).toBe(3)
  })

  it('applies a different class for each size', () => {
    // IconButton.tsx: size ∈ xs | sm | md
    const sizes = ['xs', 'sm', 'md'] as const
    const seenClasses = new Set<string>()

    for (const size of sizes) {
      const { unmount } = render(
        <IconButton aria-label={size} size={size}>
          <TestIcon />
        </IconButton>
      )
      const btn = screen.getByRole('button', { name: size })
      expect(btn.className).toContain(size)
      expect(btn).toHaveAttribute('data-size', size)
      seenClasses.add(btn.className)
      unmount()
    }

    expect(seenClasses.size).toBe(3)
  })

  it('fires onClick when clicked', () => {
    const handleClick = vi.fn()
    render(
      <IconButton aria-label="Click me" onClick={handleClick}>
        <TestIcon />
      </IconButton>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onClick when disabled', () => {
    const handleClick = vi.fn()
    render(
      <IconButton aria-label="Off" disabled onClick={handleClick}>
        <TestIcon />
      </IconButton>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Off' }))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('reflects the native disabled attribute', () => {
    render(
      <IconButton aria-label="Off" disabled>
        <TestIcon />
      </IconButton>
    )
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled()
  })

  it('forwards a ref to the underlying <button>', () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(
      <IconButton ref={ref} aria-label="Ref target">
        <TestIcon />
      </IconButton>
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('BUTTON')
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <div>
        <IconButton aria-label="Delete comment" variant="ghost">
          <TestIcon />
        </IconButton>
        <IconButton aria-label="Save" variant="solid">
          <TestIcon />
        </IconButton>
        <IconButton aria-label="Edit" variant="outline">
          <TestIcon />
        </IconButton>
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  // -------------------------------------------------------------------------
  // Loading state — Sprint 20 (#114). Mirrors `<Button>`'s `loading` prop:
  // swaps the icon child for a centered Spinner, sets the native disabled
  // attribute, sets aria-busy, and preserves aria-label.
  // -------------------------------------------------------------------------
  describe('loading', () => {
    it('renders spinner when loading=true', () => {
      const { container } = render(
        <IconButton aria-label="Save" loading>
          <TestIcon />
        </IconButton>
      )
      // The wrapper carries `aria-hidden="true"` (matching Button's pattern),
      // so we query by the Spinner's container DIV via aria-label="Loading"
      // rather than role — the Spinner element is still in the DOM.
      const spinnerContainer = container.querySelector('[aria-label="Loading"]')
      expect(spinnerContainer).not.toBeNull()
      // And the Spinner's <svg> is rendered.
      expect(spinnerContainer!.querySelector('svg')).not.toBeNull()
    })

    it('does NOT render the icon child when loading=true', () => {
      render(
        <IconButton aria-label="Save" loading>
          <TestIcon />
        </IconButton>
      )
      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument()
    })

    it('renders the icon child (and no spinner) when loading=false', () => {
      const { container } = render(
        <IconButton aria-label="Save" loading={false}>
          <TestIcon />
        </IconButton>
      )
      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
      expect(
        container.querySelector('[aria-label="Loading"]')
      ).toBeNull()
    })

    it('does NOT fire onClick when loading=true', () => {
      const handleClick = vi.fn()
      render(
        <IconButton aria-label="Save" loading onClick={handleClick}>
          <TestIcon />
        </IconButton>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('sets the native disabled attribute when loading=true', () => {
      render(
        <IconButton aria-label="Save" loading>
          <TestIcon />
        </IconButton>
      )
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    it('preserves aria-label when loading=true', () => {
      render(
        <IconButton aria-label="Save changes" loading>
          <TestIcon />
        </IconButton>
      )
      // Even with the icon swapped out, the button's accessible name still
      // comes from aria-label — the action stays announceable.
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toHaveAttribute('aria-label', 'Save changes')
    })

    it('sets aria-busy="true" when loading=true (mirrors Button)', () => {
      render(
        <IconButton aria-label="Save" loading>
          <TestIcon />
        </IconButton>
      )
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
        'aria-busy',
        'true'
      )
    })

    it('does NOT set aria-busy="true" when loading=false', () => {
      render(
        <IconButton aria-label="Save">
          <TestIcon />
        </IconButton>
      )
      const btn = screen.getByRole('button', { name: 'Save' })
      // React serializes aria-busy={false} to "false" — explicitly assert
      // it is NOT "true" so the busy state isn't announced when idle.
      expect(btn.getAttribute('aria-busy')).not.toBe('true')
    })

    it('spinner size matches the IconButton size', () => {
      // IconButton.tsx maps each size 1:1 to the same Spinner size.
      // CSS Modules in jsdom emit class names verbatim, so we can assert
      // the Spinner's size class is present on the rendered SVG.
      const sizes = ['xs', 'sm', 'md'] as const
      for (const size of sizes) {
        const { container, unmount } = render(
          <IconButton aria-label={`Save ${size}`} size={size} loading>
            <TestIcon />
          </IconButton>
        )
        const spinnerContainer = container.querySelector(
          '[aria-label="Loading"]'
        )
        expect(spinnerContainer).not.toBeNull()
        // Spinner's <svg> is the size-bearing element.
        const svg = spinnerContainer!.querySelector('svg')
        expect(svg).not.toBeNull()
        expect(svg!.getAttribute('class')).toContain(size)
        unmount()
      }
    })

    it('still applies variant/size classes when loading', () => {
      // Variant chrome (border, focus ring, background) must keep
      // rendering so the button doesn't visually disappear mid-action.
      render(
        <IconButton aria-label="Save" variant="solid" size="md" loading>
          <TestIcon />
        </IconButton>
      )
      const btn = screen.getByRole('button', { name: 'Save' })
      expect(btn.className).toContain('solid')
      expect(btn.className).toContain('md')
      expect(btn).toHaveAttribute('data-variant', 'solid')
      expect(btn).toHaveAttribute('data-size', 'md')
    })

    it('has no a11y violations while loading', async () => {
      const { container } = render(
        <IconButton aria-label="Save" loading>
          <TestIcon />
        </IconButton>
      )
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  // -------------------------------------------------------------------------
  // TypeScript-level test: aria-label MUST be a required prop.
  //
  // The whole rationale for shipping IconButton (vs. just `<Button variant="ghost">`)
  // is that the aria-label requirement is enforced at the type level — so
  // forgetting it is a compile error, not a runtime/a11y regression. This
  // assertion is checked by `npm run typecheck`. The block below isn't
  // executed at runtime; it exists so the typechecker can prove the
  // constraint holds. If `aria-label` ever becomes optional, the
  // `@ts-expect-error` directive will become a *type error itself* (it's
  // wrong to expect-error a line that has no error), and CI will fail.
  // -------------------------------------------------------------------------
  it('requires aria-label at the TypeScript level (compile-time check)', () => {
    // @ts-expect-error aria-label is required on IconButton
    const _missingAriaLabel = <IconButton><TestIcon /></IconButton>

    // Sanity baseline: the same call WITH aria-label must typecheck cleanly.
    const _withAriaLabel = (
      <IconButton aria-label="ok"><TestIcon /></IconButton>
    )

    // Reference the bindings so the linter doesn't strip them.
    expect(_missingAriaLabel).toBeDefined()
    expect(_withAriaLabel).toBeDefined()
  })
})
