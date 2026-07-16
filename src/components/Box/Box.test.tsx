/**
 * Box Component Tests
 *
 * Smoke tests covering the v0.6.0 layout-shortcut additions:
 * `gap`, `direction`, `align`, `justify`. These props emit CSS
 * Module classes — since the class names are hashed at build time,
 * we assert on the unhashed substring (CSS Modules keep the source
 * name as a suffix) rather than exact matches.
 *
 * Note: As of #326 Box extends React.HTMLAttributes<HTMLElement> and
 * spreads `...rest`, so unknown HTML attributes (id, data-*, aria-*,
 * event handlers) pass through to the rendered root.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Box } from './Box'

function classAttr(el: ChildNode | null): string {
  if (!el || !(el instanceof HTMLElement)) return ''
  return el.getAttribute('class') ?? ''
}

describe('Box layout props', () => {
  it('renders with default display=block and no layout classes', () => {
    const { container } = render(<Box>content</Box>)
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/display-block/)
    expect(cls).not.toMatch(/gap-/)
    expect(cls).not.toMatch(/direction-/)
    expect(cls).not.toMatch(/align-/)
    expect(cls).not.toMatch(/justify-/)
  })

  it('applies gap class when display is flex', () => {
    const { container } = render(
      <Box display="flex" gap="md">
        content
      </Box>
    )
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/display-flex/)
    expect(cls).toMatch(/gap-md/)
  })

  it('applies gap class when display is grid', () => {
    const { container } = render(
      <Box display="grid" gap="sm">
        content
      </Box>
    )
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/display-grid/)
    expect(cls).toMatch(/gap-sm/)
  })

  it('ignores gap when display is block', () => {
    // #138 — also emits a dev-mode console.warn in this case; the
    // dedicated warning suite below asserts that. Silence it here so the
    // class-only assertion stays focused.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(<Box gap="lg">content</Box>)
    expect(classAttr(container.firstChild)).not.toMatch(/gap-/)
    warnSpy.mockRestore()
  })

  it('applies direction class only when display is flex', () => {
    const { container, rerender } = render(
      <Box display="flex" direction="column">
        c
      </Box>
    )
    expect(classAttr(container.firstChild)).toMatch(/direction-column/)

    rerender(
      <Box display="grid" direction="column">
        c
      </Box>
    )
    // direction is flex-only.
    expect(classAttr(container.firstChild)).not.toMatch(/direction-/)
  })

  it('applies align and justify when display is flex', () => {
    const { container } = render(
      <Box display="flex" align="center" justify="between">
        content
      </Box>
    )
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/align-center/)
    expect(cls).toMatch(/justify-between/)
  })

  it('still applies existing padding/margin tokens alongside layout props', () => {
    const { container } = render(
      <Box display="flex" direction="column" gap="md" padding="lg">
        content
      </Box>
    )
    const cls = classAttr(container.firstChild)
    expect(cls).toMatch(/padding-lg/)
    expect(cls).toMatch(/gap-md/)
    expect(cls).toMatch(/direction-column/)
  })
})

// #326 — Box extends HTMLAttributes<HTMLElement> and spreads `...rest` so
// consumers can attach aria-*, data-*, id, role, and event handlers.
describe('Box rest props pass-through (#326)', () => {
  it('forwards data-testid, aria-label, id, and role to the root', () => {
    render(
      <Box
        data-testid="probe"
        aria-label="my-label"
        id="my-id"
        role="region"
      >
        content
      </Box>
    )
    const el = screen.getByTestId('probe')
    expect(el).toHaveAttribute('aria-label', 'my-label')
    expect(el).toHaveAttribute('id', 'my-id')
    expect(el).toHaveAttribute('role', 'region')
  })

  it('forwards onClick to the root', () => {
    const handleClick = vi.fn()
    render(
      <Box data-testid="probe" onClick={handleClick}>
        content
      </Box>
    )
    fireEvent.click(screen.getByTestId('probe'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

// #137 — Intrinsic sizing props. Each prop accepts any CSS length string
// and is applied as an inline style verbatim (no token resolution).
describe('Box intrinsic sizing (#137)', () => {
  it('forwards aspectRatio as an inline style', () => {
    const { container } = render(<Box aspectRatio="16/9">content</Box>)
    const el = container.firstChild as HTMLElement
    // jsdom normalizes the shorthand `16/9` to `16 / 9` on readback.
    expect(el.style.aspectRatio.replace(/\s/g, '')).toBe('16/9')
  })

  it('forwards a clamp() expression on width verbatim', () => {
    const { container } = render(
      <Box width="clamp(16rem, 40vw, 32rem)">content</Box>,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('clamp(16rem, 40vw, 32rem)')
  })

  it('forwards viewport-relative height units', () => {
    const { container } = render(<Box minHeight="50vh">content</Box>)
    const el = container.firstChild as HTMLElement
    expect(el.style.minHeight).toBe('50vh')
  })

  it('forwards min-content / max-content keywords', () => {
    const { container } = render(
      <Box maxWidth="max-content" minWidth="min-content">
        content
      </Box>,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.maxWidth).toBe('max-content')
    expect(el.style.minWidth).toBe('min-content')
  })

  // #374 — explicit pin for the min-width / max-width pass-through that
  // ships today; future regressions would silently break consumers that
  // depend on the prop API.
  it('passes through token-style min-width / max-width values (#374)', () => {
    const { container } = render(
      <Box
        minWidth="var(--size-popover-min-width)"
        maxWidth="var(--size-popover-max-width)"
      >
        c
      </Box>,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.minWidth).toBe('var(--size-popover-min-width)')
    expect(el.style.maxWidth).toBe('var(--size-popover-max-width)')
  })

  it('does not set sizing styles when the props are omitted', () => {
    const { container } = render(<Box>content</Box>)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('')
    expect(el.style.aspectRatio).toBe('')
    expect(el.style.maxWidth).toBe('')
  })

  it('preserves other inline styles passed via the style prop', () => {
    const { container } = render(
      <Box width="200px" style={{ color: 'red' }}>
        content
      </Box>,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('200px')
    expect(el.style.color).toBe('red')
  })
})

// #374 — `grow` resolves to `flex: 1 1 auto` (boolean) or `flex: <n> 1 auto`
// (number). `false` / `0` / undefined / non-finite leave the property unset.
describe('Box grow prop (#374)', () => {
  it('emits flex: 1 1 auto when grow={true}', () => {
    const { container } = render(<Box grow>content</Box>)
    const el = container.firstChild as HTMLElement
    expect(el.style.flex).toBe('1 1 auto')
  })

  it('emits flex: <n> 1 auto when grow is a positive number', () => {
    const { container } = render(<Box grow={3}>content</Box>)
    const el = container.firstChild as HTMLElement
    expect(el.style.flex).toBe('3 1 auto')
  })

  it('does not emit flex when grow={false}', () => {
    const { container } = render(<Box grow={false}>content</Box>)
    const el = container.firstChild as HTMLElement
    expect(el.style.flex).toBe('')
  })

  it('does not emit flex when grow={0} (treated as no-op)', () => {
    const { container } = render(<Box grow={0}>content</Box>)
    const el = container.firstChild as HTMLElement
    expect(el.style.flex).toBe('')
  })

  it('does not emit flex when grow is omitted', () => {
    const { container } = render(<Box>content</Box>)
    const el = container.firstChild as HTMLElement
    expect(el.style.flex).toBe('')
  })

  it('ignores grow={-1} and non-finite values', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { container } = render(<Box grow={bad}>c</Box>)
      const el = container.firstChild as HTMLElement
      expect(el.style.flex).toBe('')
    }
  })

  it('composes alongside intrinsic sizing without clobbering it', () => {
    const { container } = render(
      <Box grow width="200px">
        c
      </Box>,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.flex).toBe('1 1 auto')
    expect(el.style.width).toBe('200px')
  })
})

// #138 — Dev-mode warning when layout-shortcut props are passed without
// display="flex" or display="grid". Production builds are silent.
describe('Box layout-shortcut dev warning (#138)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('warns when gap is passed with default display (block)', () => {
    render(<Box gap="md">content</Box>)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const firstArg = warnSpy.mock.calls[0]![0] // safe: toHaveBeenCalledTimes(1) asserted above
    expect(firstArg).toMatch(/\bgap\b/)
    expect(firstArg).toMatch(/display.*"block"/)
  })

  it('warns when align and justify are passed without flex/grid', () => {
    render(
      <Box align="center" justify="between">
        content
      </Box>,
    )
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const msg = warnSpy.mock.calls[0]![0] as string // safe: toHaveBeenCalledTimes(1) asserted above
    expect(msg).toMatch(/\balign\b/)
    expect(msg).toMatch(/\bjustify\b/)
  })

  it('does not warn when display is flex', () => {
    render(
      <Box display="flex" gap="md" align="center" justify="between" direction="column">
        content
      </Box>,
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn when display is grid', () => {
    render(
      <Box display="grid" gap="md" align="center">
        content
      </Box>,
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does not warn when no layout-shortcut props are passed', () => {
    render(<Box padding="md">content</Box>)
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
