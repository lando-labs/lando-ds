/**
 * ThemeScope tests (#395)
 *
 * Pin the scoped-theming contract:
 *
 *  - Tokens / attributes land on the WRAPPER element, NOT on `:root`.
 *  - Multiple scopes can coexist with independent themes.
 *  - Swapping the `theme` prop runs the per-scope cleanup ref (no leak).
 *  - Nesting an inner scope inside an outer scope overrides for its subtree.
 *  - ThemeScope mounted INSIDE a ThemeProvider does not touch the global
 *    cleanup ref / `:root` — the regression that motivated the issue.
 *  - ThemeScope mounted WITHOUT a ThemeProvider still works (standalone).
 *  - The sink invariant is preserved (only `setProperty` is used).
 *  - Mode override applies a per-subtree mode independent of the surrounding
 *    provider.
 */

import React, { act } from 'react'
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { ProductTheme } from '../../tokens'
import { ThemeProvider, useTheme } from '../../utils/ThemeProvider'
import { ThemeScope } from './ThemeScope'

beforeAll(() => {
  // jsdom does not implement matchMedia; ThemeProvider reads it for system theme.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }
})

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-product')
  document.documentElement.removeAttribute('data-theme-preset')
  document.documentElement.removeAttribute('data-tint-chrome')
  localStorage.clear()
})

const THEME_A: ProductTheme = {
  name: 'scoped-a',
  tokens: {
    color: {
      'brand-x': '#FF0000',
      'brand-y': '#0000FF',
    },
  },
}

const THEME_B: ProductTheme = {
  name: 'scoped-b',
  tokens: {
    color: {
      'brand-y': '#00FF00', // overlaps with THEME_A — should update on swap
      'brand-z': '#FF00FF',
    },
  },
}

describe('ThemeScope — basic scoped application', () => {
  it('writes tokens to the wrapper element, not `:root`', () => {
    render(
      <ThemeScope theme={THEME_A} data-testid="scope">
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    expect(wrapper.style.getPropertyValue('--color-brand-y')).toBe('#0000FF')

    // The global :root MUST NOT carry the scoped tokens. This is the whole
    // point of the component.
    expect(document.documentElement.style.getPropertyValue('--color-brand-x')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--color-brand-y')).toBe('')
  })

  it('sets data-theme attribute on the wrapper element', () => {
    render(
      <ThemeScope theme={THEME_A} mode="dark" data-testid="scope">
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.getAttribute('data-theme')).toBe('dark')
    // Global :root is untouched
    expect(document.documentElement.getAttribute('data-theme')).toBe(null)
  })

  it('sets data-product attribute on the wrapper element', () => {
    render(
      <ThemeScope theme={THEME_A} data-testid="scope">
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.getAttribute('data-product')).toBe('scoped-a')
    expect(document.documentElement.getAttribute('data-product')).toBe(null)
  })

  it('forwards extra props (className, id, style) to the wrapper', () => {
    render(
      <ThemeScope
        theme={THEME_A}
        data-testid="scope"
        className="my-class"
        id="hero-scope"
      >
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope')
    expect(wrapper.className).toBe('my-class')
    expect(wrapper.id).toBe('hero-scope')
  })
})

describe('ThemeScope — scoped ramp/state re-derivation (#11)', () => {
  it('a scoped --color-primary override propagates to --color-primary-hover within the scope', () => {
    render(
      <ThemeScope
        theme={{ name: 'violet', tokens: { color: { primary: '#7C3AED' } } }}
        mode="light"
        data-testid="scope"
      >
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    // The base override lands as expected.
    expect(wrapper.style.getPropertyValue('--color-primary')).toBe('#7C3AED')
    // The DERIVED hover/active/ramp tokens must be re-declared on the scope
    // as color-mix() formulas referencing THIS element's --color-primary —
    // not left absent (and therefore silently inherited from :root's
    // default primary) as they were before #11.
    expect(wrapper.style.getPropertyValue('--color-primary-hover')).toBe(
      'color-mix(in oklab, var(--color-primary), white 22%)',
    )
    expect(wrapper.style.getPropertyValue('--color-primary-active')).toBe(
      'color-mix(in oklab, var(--color-primary), black 18%)',
    )
    expect(wrapper.style.getPropertyValue('--color-primary-lightest')).toBe(
      'color-mix(in oklab, var(--color-primary), white 90%)',
    )
    expect(wrapper.style.getPropertyValue('--color-primary-darkest')).toBe(
      'color-mix(in oklab, var(--color-primary), black 52.5%)',
    )
  })

  it('re-derives the secondary and error/danger state tints too', () => {
    render(
      <ThemeScope
        theme={{
          name: 'custom',
          tokens: { color: { secondary: '#059669', error: '#DC2626' } },
        }}
        mode="light"
        data-testid="scope"
      >
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.style.getPropertyValue('--color-secondary-hover')).toBe(
      'color-mix(in oklab, var(--color-secondary), white 18%)',
    )
    expect(wrapper.style.getPropertyValue('--color-error-active')).toBe(
      'color-mix(in oklab, var(--color-error), black 38%)',
    )
    // danger mirrors error via a same-element var() reference.
    expect(wrapper.style.getPropertyValue('--color-danger-active')).toBe(
      'var(--color-error-active)',
    )
  })

  it('uses the dark-mode-tuned --color-primary-base formula when the scope mode is dark', () => {
    render(
      <ThemeScope theme={THEME_A} mode="dark" data-testid="scope">
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    // Mirrors the [data-theme="dark"] override in tokens.css (#73) — heavier
    // white-mix than the light-mode formula — so a dark ThemeScope island
    // doesn't regress the WCAG-AA fix that selector already gave it via
    // ordinary cascade (data-theme is a plain attribute selector, not
    // :root-scoped, so it already matched the wrapper before this fix).
    expect(wrapper.style.getPropertyValue('--color-primary-base')).toBe(
      'color-mix(in oklab, var(--color-primary), white 30%)',
    )
  })

  it('a scope with no theme prop still carries the (identity-preserving) derived formulas', () => {
    // No base override at all: the formulas resolve via var(--color-primary)
    // inheriting :root's value, same as before — proves emitting them
    // unconditionally is a no-op when nothing is themed.
    render(
      <ThemeScope mode="light" data-testid="scope">
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.style.getPropertyValue('--color-primary-hover')).toBe(
      'color-mix(in oklab, var(--color-primary), white 22%)',
    )
  })
})

describe('ThemeScope — multi-scope coexistence', () => {
  it('two sibling scopes apply different themes independently', () => {
    render(
      <>
        <ThemeScope theme={THEME_A} data-testid="scope-a">
          <div>a</div>
        </ThemeScope>
        <ThemeScope theme={THEME_B} data-testid="scope-b">
          <div>b</div>
        </ThemeScope>
      </>,
    )

    const a = screen.getByTestId('scope-a') as HTMLDivElement
    const b = screen.getByTestId('scope-b') as HTMLDivElement

    // Each scope owns its own tokens; no cross-contamination.
    expect(a.style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    expect(a.style.getPropertyValue('--color-brand-z')).toBe('') // only in B
    expect(b.style.getPropertyValue('--color-brand-z')).toBe('#FF00FF')
    expect(b.style.getPropertyValue('--color-brand-x')).toBe('') // only in A
  })
})

describe('ThemeScope — nesting overrides', () => {
  it('an inner ThemeScope overrides the outer for its subtree', () => {
    render(
      <ThemeScope theme={THEME_A} data-testid="outer">
        <ThemeScope theme={THEME_B} data-testid="inner">
          <div>nested</div>
        </ThemeScope>
      </ThemeScope>,
    )

    const outer = screen.getByTestId('outer') as HTMLDivElement
    const inner = screen.getByTestId('inner') as HTMLDivElement

    expect(outer.style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    // Inner sets its own value of `brand-y`; cascade-overrides outer's
    // for descendants inside `inner`.
    expect(inner.style.getPropertyValue('--color-brand-y')).toBe('#00FF00')
    expect(inner.style.getPropertyValue('--color-brand-z')).toBe('#FF00FF')
  })
})

describe('ThemeScope — swap cleanup (per-scope ref)', () => {
  function Swapper(): React.JSX.Element {
    const [theme, setTheme] = React.useState<ProductTheme>(THEME_A)
    return (
      <>
        <button onClick={() => setTheme(THEME_B)}>swap</button>
        <button onClick={() => setTheme(THEME_A)}>reset</button>
        <ThemeScope theme={theme} data-testid="scope">
          <div>child</div>
        </ThemeScope>
      </>
    )
  }

  it('removes stale keys when the theme prop swaps A → B', () => {
    render(<Swapper />)

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    // Sanity — A is applied.
    expect(wrapper.style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    expect(wrapper.style.getPropertyValue('--color-brand-y')).toBe('#0000FF')

    fireEvent.click(screen.getByText('swap'))

    // The unique-to-A key MUST be gone — this is the per-scope cleanup ref
    // doing its job, mirroring the ThemeProvider cleanup contract.
    expect(wrapper.style.getPropertyValue('--color-brand-x')).toBe('')
    // Overlapping key is rewritten to B's value, not leaked.
    expect(wrapper.style.getPropertyValue('--color-brand-y')).toBe('#00FF00')
    expect(wrapper.style.getPropertyValue('--color-brand-z')).toBe('#FF00FF')
  })

  it('updates data-product attribute when theme prop changes', () => {
    render(<Swapper />)

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.getAttribute('data-product')).toBe('scoped-a')

    fireEvent.click(screen.getByText('swap'))
    expect(wrapper.getAttribute('data-product')).toBe('scoped-b')
  })
})

describe('ThemeScope — scope/global isolation (the regression that motivated #395)', () => {
  it('ThemeScope inside ThemeProvider does NOT touch :root tokens written by the provider', () => {
    const GLOBAL_THEME: ProductTheme = {
      name: 'global',
      tokens: {
        color: {
          'global-only': '#AAAAAA',
        },
      },
    }

    render(
      <ThemeProvider disableStorage defaultProductTheme={GLOBAL_THEME}>
        <ThemeScope theme={THEME_A} data-testid="scope">
          <div>child</div>
        </ThemeScope>
      </ThemeProvider>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    const rootStyle = document.documentElement.style

    // The global theme stays on :root.
    expect(rootStyle.getPropertyValue('--color-global-only')).toBe('#AAAAAA')
    // The scoped theme stays on the wrapper.
    expect(wrapper.style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    // Cross-contamination must NOT happen.
    expect(rootStyle.getPropertyValue('--color-brand-x')).toBe('')
    expect(wrapper.style.getPropertyValue('--color-global-only')).toBe('')
  })

  it('unmounting a scope does not strip :root tokens (cleanup refs are independent)', () => {
    const GLOBAL_THEME: ProductTheme = {
      name: 'global',
      tokens: { color: { 'global-only': '#AAAAAA' } },
    }

    function Wrapper(): React.JSX.Element {
      const [showScope, setShowScope] = React.useState(true)
      return (
        <ThemeProvider disableStorage defaultProductTheme={GLOBAL_THEME}>
          <button onClick={() => setShowScope(false)}>hide</button>
          {showScope ? (
            <ThemeScope theme={THEME_A} data-testid="scope">
              <div>child</div>
            </ThemeScope>
          ) : null}
        </ThemeProvider>
      )
    }

    render(<Wrapper />)

    // Sanity — global theme is on :root.
    expect(document.documentElement.style.getPropertyValue('--color-global-only')).toBe(
      '#AAAAAA',
    )

    fireEvent.click(screen.getByText('hide'))

    // After scope unmount, the global :root tokens MUST still be intact —
    // the scope's per-scope cleanup ref must not have touched them.
    expect(document.documentElement.style.getPropertyValue('--color-global-only')).toBe(
      '#AAAAAA',
    )
  })
})

describe('ThemeScope — standalone (no ThemeProvider)', () => {
  it('works without a surrounding ThemeProvider', () => {
    // No useTheme()-throws-when-missing behavior should leak here.
    render(
      <ThemeScope theme={THEME_A} data-testid="scope">
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.style.getPropertyValue('--color-brand-x')).toBe('#FF0000')
    // Defaults to 'light' when no surrounding provider's mode is available.
    expect(wrapper.getAttribute('data-theme')).toBe('light')
  })
})

describe('ThemeScope — mode override', () => {
  it('renders a dark island inside a light global app', () => {
    render(
      <ThemeProvider disableStorage forcedTheme="light">
        <ThemeScope mode="dark" data-testid="dark-island">
          <div>child</div>
        </ThemeScope>
      </ThemeProvider>,
    )

    const wrapper = screen.getByTestId('dark-island') as HTMLDivElement
    expect(wrapper.getAttribute('data-theme')).toBe('dark')
    // Global :root stays light.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('mode-aware token values resolve against the scope mode, not the global mode', () => {
    const MODE_AWARE: ProductTheme = {
      name: 'mode-aware-scoped',
      tokens: {
        color: {
          // light side and dark side differ — pick the side matching scope.mode
          background: { light: '#FFFFFF', dark: '#011219' },
        },
      },
    }

    render(
      <ThemeProvider disableStorage forcedTheme="light">
        <ThemeScope theme={MODE_AWARE} mode="dark" data-testid="scope">
          <div>child</div>
        </ThemeScope>
      </ThemeProvider>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    // Scope is in dark mode, so the dark-side value applies INSIDE the scope.
    expect(wrapper.style.getPropertyValue('--color-background')).toBe('#011219')
  })
})

describe('ThemeScope — sink invariant regression (#323, #384, #395)', () => {
  it('ThemeScope.tsx does not introduce a re-parsing CSS sink', () => {
    // Mirrors `src/test/no-reparsing-style-sink.test.ts` for the new module.
    // The scope path inherits the existing `applyTheme` chokepoint, so the
    // forbidden vectors must remain absent from this file too.
    const path = resolve(
      dirname(fileURLToPath(import.meta.url)),
      './ThemeScope.tsx',
    )
    const src = readFileSync(path, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')

    const forbidden: Array<[RegExp, string]> = [
      [/\.cssText\s*=/, 'style.cssText assignment'],
      [/\.insertRule\s*\(/, 'CSSStyleSheet.insertRule'],
      [/\.innerHTML\s*=/, 'innerHTML assignment'],
      [/document\.write\s*\(/, 'document.write'],
    ]
    const hits = forbidden
      .filter(([re]) => re.test(src))
      .map(([, hint]) => hint)
    expect(
      hits,
      `ThemeScope.tsx must not route token values through a re-parsing sink:\n  ${hits.join('\n  ')}`,
    ).toEqual([])
  })
})

describe('ThemeScope — inheritance from surrounding ThemeProvider', () => {
  it('inherits the surrounding provider mode when no `mode` prop is given', () => {
    render(
      <ThemeProvider disableStorage forcedTheme="dark">
        <ThemeScope theme={THEME_A} data-testid="scope">
          <div>child</div>
        </ThemeScope>
      </ThemeProvider>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    // Inherits 'dark' from the provider.
    expect(wrapper.getAttribute('data-theme')).toBe('dark')
  })

  it('global useTheme still works inside a ThemeScope subtree', () => {
    // Belt-and-suspenders: ThemeScope wraps with a <div> and renders its
    // children directly — it does not introduce a new ThemeContext.Provider.
    // A descendant calling `useTheme()` must still see the OUTER provider.
    let observedTheme: string | null = null
    function Probe(): React.JSX.Element {
      const ctx = useTheme()
      observedTheme = ctx.theme
      return <div>probe</div>
    }

    render(
      <ThemeProvider disableStorage forcedTheme="dark">
        <ThemeScope theme={THEME_A}>
          <Probe />
        </ThemeScope>
      </ThemeProvider>,
    )

    expect(observedTheme).toBe('dark')
  })
})

describe('ThemeScope — preset application', () => {
  it('writes the preset attribute and preset color overrides on the wrapper', () => {
    render(
      <ThemeScope preset="midnight" data-testid="scope">
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.getAttribute('data-theme-preset')).toBe('midnight')
    // The preset writes --color-primary onto the wrapper (cascade only).
    expect(wrapper.style.getPropertyValue('--color-primary')).not.toBe('')
    // Global :root is untouched.
    expect(document.documentElement.getAttribute('data-theme-preset')).toBe(null)
  })
})

describe('ThemeScope — security parity with ThemeProvider (#323)', () => {
  it('rejects an unsafe token value (semicolon breakout) per the global screen', () => {
    const malicious: ProductTheme = {
      name: 'evil-scoped',
      tokens: {
        color: {
          x: 'red; background: url(http://evil/?leak)',
        },
      },
    }

    render(
      <ThemeScope theme={malicious} data-testid="scope">
        <div>child</div>
      </ThemeScope>,
    )

    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    // Just like the global ThemeProvider — unsafe value never lands.
    expect(wrapper.style.getPropertyValue('--color-x')).toBe('')
  })
})

/* ------------------------------------------------------------------ *
 *  Issue #428 — ThemeScope server-renders the scope (kill SSR flash)
 *
 *  Before the fix, ThemeScope applied its theme in a client `useEffect`, so
 *  the server-rendered HTML was a bare `<div>` with no `data-theme` and no
 *  `--*` vars → a forced-mode island flashed the surrounding page's theme
 *  until hydration. The fix computes the scope during RENDER and emits it
 *  inline, so it is present + correct in the SSR string.
 *
 *  These tests render via `react-dom/server` (a REAL server render — no DOM,
 *  no effects). jsdom's `render` runs effects, so it can NOT prove SSR
 *  correctness; that's why we assert on the static-markup string here.
 * ------------------------------------------------------------------ */

describe('ThemeScope — SSR output carries the scope (#428)', () => {
  it('static markup includes data-theme and the scoped --color-* var', () => {
    const html = renderToStaticMarkup(
      <ThemeScope mode="light" theme={THEME_A}>
        <div>child</div>
      </ThemeScope>,
    )

    // The scope attribute must be in the SERVER HTML (not applied post-mount).
    expect(html).toContain('data-theme="light"')
    // data-product from the theme.
    expect(html).toContain('data-product="scoped-a"')
    // The scoped tokens must be inlined into the style attribute on the server.
    expect(html).toContain('--color-brand-x:#FF0000')
    expect(html).toContain('--color-brand-y:#0000FF')
    // color-scheme is emitted too (native form controls paint correctly).
    expect(html).toContain('color-scheme:light')
  })

  it('server-renders a dark island regardless of any provider (mode prop wins)', () => {
    const html = renderToStaticMarkup(
      <ThemeScope mode="dark">
        <div>promo</div>
      </ThemeScope>,
    )
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('color-scheme:dark')
  })

  it('server-renders preset attribute + preset color vars inline', () => {
    const html = renderToStaticMarkup(
      <ThemeScope mode="light" preset="midnight">
        <div>child</div>
      </ThemeScope>,
    )
    expect(html).toContain('data-theme-preset="midnight"')
    // midnight preset overrides --color-primary (#6366F1).
    expect(html).toContain('--color-primary:#6366F1')
  })

  it('spreads {...rest} BEFORE the scope attrs so a consumer cannot clobber data-theme', () => {
    // ORDERING CONTRACT: a hostile/mistaken consumer data-theme must lose to
    // the scope's own. This is verifiable purely from the SSR string.
    const html = renderToStaticMarkup(
      // `data-theme` is a valid data-* attribute type-wise; the point is that
      // the scope's own value wins at runtime regardless of what a consumer
      // passes via {...rest}.
      <ThemeScope mode="dark" data-theme="light">
        <div>child</div>
      </ThemeScope>,
    )
    expect(html).toContain('data-theme="dark"')
    expect(html).not.toContain('data-theme="light"')
  })

  it('forwards a consumer className into the SSR output alongside the scope', () => {
    const html = renderToStaticMarkup(
      <ThemeScope mode="light" className="hero-scope" theme={THEME_A}>
        <div>child</div>
      </ThemeScope>,
    )
    expect(html).toContain('class="hero-scope"')
    expect(html).toContain('data-theme="light"')
  })
})

describe('ThemeScope — hydration parity (#428)', () => {
  it('hydrates SSR markup with no mismatch (server + client render agree)', () => {
    const tree = (
      <ThemeScope mode="dark" theme={THEME_A} data-testid="scope">
        <div>child</div>
      </ThemeScope>
    )

    // 1. Server render to an HTML string (no effects, no DOM).
    const html = renderToString(tree)

    // 2. Put it in a container and hydrate. A hydration mismatch surfaces as a
    //    recoverable error — spy on it. If the inline SSR attributes/vars did
    //    NOT match the client render, React would report a mismatch here.
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    // React 19 splits hydration reporting by mismatch class: *structural /
    // content* divergence reaches `onRecoverableError`, but *attribute-only*
    // divergence — the exact class this #428 fix targets (a scope's
    // `data-theme` / `data-theme-preset` / `--color-*` differing server vs
    // client) — is reported via `console.error`, NOT the callback. Spy on both
    // so an attribute-level hydration regression can't slip past this test.
    const onRecoverableError = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot>
    act(() => {
      root = hydrateRoot(container, tree, { onRecoverableError })
    })

    // Capture + restore BEFORE asserting so a failure can't leave console.error
    // mocked for later tests.
    const hydrationWarnings = consoleError.mock.calls.filter(
      ([msg]) =>
        typeof msg === 'string' &&
        /hydrat|did not match|didn't match|server render|server html/i.test(msg),
    )
    consoleError.mockRestore()

    expect(onRecoverableError).not.toHaveBeenCalled()
    // No attribute-level hydration-mismatch warning was logged.
    expect(hydrationWarnings).toEqual([])

    // The hydrated wrapper carries the scope from the very first (server) paint.
    const wrapper = container.querySelector('[data-testid="scope"]') as HTMLDivElement
    expect(wrapper.getAttribute('data-theme')).toBe('dark')
    expect(wrapper.style.getPropertyValue('--color-brand-x')).toBe('#FF0000')

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})

/* ------------------------------------------------------------------ *
 *  #428 — prop swaps drop stale vars via the React-controlled style object
 *
 *  With inline rendering (no effect + no cleanup ref), React replaces the
 *  whole style object every render, so a `--*` var absent from the new render
 *  is removed automatically. Pin it for mode, preset, and theme swaps.
 * ------------------------------------------------------------------ */

describe('ThemeScope — prop-swap drops stale vars (inline render, #428)', () => {
  it('swapping the preset prop drops the previous preset color vars', () => {
    function PresetSwapper(): React.JSX.Element {
      const [preset, setPreset] = React.useState('sunset')
      return (
        <>
          <button onClick={() => setPreset('forest')}>swap</button>
          <ThemeScope preset={preset} data-testid="scope">
            <div>child</div>
          </ThemeScope>
        </>
      )
    }

    render(<PresetSwapper />)
    const wrapper = screen.getByTestId('scope') as HTMLDivElement

    // sunset overrides --color-warning-base (#FBBF24); forest does not, so it
    // must be dropped after the swap.
    expect(wrapper.style.getPropertyValue('--color-warning-base')).toBe('#FBBF24')
    expect(wrapper.getAttribute('data-theme-preset')).toBe('sunset')

    fireEvent.click(screen.getByText('swap'))

    expect(wrapper.getAttribute('data-theme-preset')).toBe('forest')
    // Stale sunset-only var is gone.
    expect(wrapper.style.getPropertyValue('--color-warning-base')).toBe('')
    // forest's --color-success-base (#10B981) is present.
    expect(wrapper.style.getPropertyValue('--color-success-base')).toBe('#10B981')
  })

  it('swapping the mode prop updates data-theme and color-scheme', () => {
    function ModeSwapper(): React.JSX.Element {
      const [mode, setMode] = React.useState<'light' | 'dark'>('light')
      return (
        <>
          <button onClick={() => setMode('dark')}>dark</button>
          <ThemeScope mode={mode} data-testid="scope">
            <div>child</div>
          </ThemeScope>
        </>
      )
    }

    render(<ModeSwapper />)
    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.getAttribute('data-theme')).toBe('light')
    expect(wrapper.style.colorScheme).toBe('light')

    fireEvent.click(screen.getByText('dark'))

    expect(wrapper.getAttribute('data-theme')).toBe('dark')
    expect(wrapper.style.colorScheme).toBe('dark')
  })

  it('removing the theme prop drops the product data-attr and its vars', () => {
    function Remover(): React.JSX.Element {
      const [on, setOn] = React.useState(true)
      return (
        <>
          <button onClick={() => setOn(false)}>clear</button>
          <ThemeScope theme={on ? THEME_A : undefined} data-testid="scope">
            <div>child</div>
          </ThemeScope>
        </>
      )
    }

    render(<Remover />)
    const wrapper = screen.getByTestId('scope') as HTMLDivElement
    expect(wrapper.getAttribute('data-product')).toBe('scoped-a')
    expect(wrapper.style.getPropertyValue('--color-brand-x')).toBe('#FF0000')

    fireEvent.click(screen.getByText('clear'))

    // Product attribute + its vars are dropped once the theme prop clears.
    expect(wrapper.getAttribute('data-product')).toBe(null)
    expect(wrapper.style.getPropertyValue('--color-brand-x')).toBe('')
  })
})
