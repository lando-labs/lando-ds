/**
 * Kbd Component Tests
 * TODO: Implement comprehensive test suite
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Kbd } from './Kbd'
import { parseShortcut } from './shortcut-parser'

describe('Kbd', () => {
  it('renders children verbatim when provided', () => {
    render(<Kbd>⌘K</Kbd>)
    expect(screen.getByText('⌘K')).toBeInTheDocument()
  })

  it('renders a semantic <kbd> element', () => {
    const { container } = render(<Kbd>X</Kbd>)
    expect(container.querySelector('kbd')).not.toBeNull()
  })

  it('renders non-Mac labels on server / pre-hydration when shortcut is set', () => {
    // jsdom environment does not match the Mac regex in isMac() by default,
    // so pre-hydration + first paint should both yield the non-Mac "Ctrl+K" label.
    render(<Kbd shortcut="meta+k" />)
    expect(screen.getByText(/Ctrl\+K/i)).toBeInTheDocument()
  })

  // #424 — Layer-7 polymorphism via asChild.
  it('asChild renders the child element carrying the Kbd root class + forwarded className/style', () => {
    render(
      <Kbd asChild className="extra" style={{ color: 'rgb(1, 2, 3)' }}>
        <span data-testid="x">⌘K</span>
      </Kbd>,
    )
    const el = screen.getByTestId('x')
    expect(el.tagName).toBe('SPAN')
    expect(el.textContent).toBe('⌘K')
    expect(el.className).toMatch(/kbd/)
    expect(el.className).toMatch(/extra/)
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    // No standalone <kbd> element should be emitted.
    expect(document.querySelector('kbd')).toBeNull()
  })
})

describe('parseShortcut', () => {
  it('produces Mac symbols when platformIsMac=true', () => {
    expect(parseShortcut('meta+k', true)).toBe('⌘K')
    expect(parseShortcut('shift+alt+f', true)).toBe('⇧⌥F')
  })

  it('produces non-Mac labels when platformIsMac=false', () => {
    expect(parseShortcut('meta+k', false)).toBe('Ctrl+K')
    expect(parseShortcut('shift+alt+f', false)).toBe('Shift+Alt+F')
  })

  it('handles special keys like enter / escape', () => {
    expect(parseShortcut('enter', true)).toBe('↵')
    expect(parseShortcut('escape', false)).toBe('Esc')
  })
})
