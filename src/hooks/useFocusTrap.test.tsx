/**
 * useFocusTrap Tests
 *
 * Covers the focusable-element coverage expanded in #337 (contenteditable,
 * media with controls, details>summary, iframe) plus the core Tab-wrap
 * behavior the trap has always provided (used by Modal / Dropdown / Sidebar).
 */

import { useRef } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useFocusTrap, FOCUSABLE_ELEMENTS } from './useFocusTrap'

/** Minimal harness: traps focus inside a div rendering the given children. */
function Trap({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true)
  return <div ref={ref}>{children}</div>
}

describe('useFocusTrap', () => {
  describe('FOCUSABLE_ELEMENTS selector (#337)', () => {
    it('matches the newly-added focusable element types', () => {
      const host = document.createElement('div')
      host.innerHTML = `
        <div contenteditable="true" data-t="ce"></div>
        <div contenteditable="false" data-t="ce-false"></div>
        <audio controls data-t="audio"></audio>
        <video controls data-t="video"></video>
        <details><summary data-t="summary">s</summary>body</details>
        <iframe data-t="iframe" title="frame"></iframe>
      `
      const matched = new Set(
        Array.from(host.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS)).map(
          (el) => el.getAttribute('data-t')
        )
      )

      expect(matched.has('ce')).toBe(true)
      // contenteditable="false" is explicitly NOT focusable.
      expect(matched.has('ce-false')).toBe(false)
      expect(matched.has('audio')).toBe(true)
      expect(matched.has('video')).toBe(true)
      expect(matched.has('summary')).toBe(true)
      expect(matched.has('iframe')).toBe(true)
    })

    it('still matches the original focusable elements (regression guard)', () => {
      const host = document.createElement('div')
      host.innerHTML = `
        <a href="#" data-t="a">a</a>
        <button data-t="btn">b</button>
        <input data-t="input" />
        <div tabindex="-1" data-t="skip"></div>
      `
      const matched = new Set(
        Array.from(host.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS)).map(
          (el) => el.getAttribute('data-t')
        )
      )
      expect(matched.has('a')).toBe(true)
      expect(matched.has('btn')).toBe(true)
      expect(matched.has('input')).toBe(true)
      // tabindex="-1" must remain excluded.
      expect(matched.has('skip')).toBe(false)
    })
  })

  describe('initial focus picks up newly-recognized elements', () => {
    it('focuses a details > summary as the first focusable', () => {
      render(
        <Trap>
          <details>
            <summary data-testid="sum">Summary</summary>
            body
          </details>
        </Trap>
      )
      expect(document.activeElement).toBe(screen.getByTestId('sum'))
    })

    it('focuses an iframe as the first focusable', () => {
      render(
        <Trap>
          <iframe data-testid="frame" title="frame" />
        </Trap>
      )
      expect(document.activeElement).toBe(screen.getByTestId('frame'))
    })
  })

  describe('Tab wrapping (Modal / Dropdown / Sidebar contract)', () => {
    it('wraps forward Tab from the last focusable back to the first', () => {
      render(
        <Trap>
          <button data-testid="first">first</button>
          <button data-testid="last">last</button>
        </Trap>
      )
      const first = screen.getByTestId('first')
      const last = screen.getByTestId('last')
      // Hook focuses the first focusable on mount.
      expect(document.activeElement).toBe(first)

      last.focus()
      fireEvent.keyDown(last, { key: 'Tab' })
      expect(document.activeElement).toBe(first)
    })

    it('wraps Shift+Tab from the first focusable to the last (a newly-recognized summary)', () => {
      render(
        <Trap>
          <button data-testid="first">first</button>
          <details>
            <summary data-testid="sum">Summary</summary>
            body
          </details>
        </Trap>
      )
      const first = screen.getByTestId('first')
      const sum = screen.getByTestId('sum')
      expect(document.activeElement).toBe(first)

      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
      // The summary is the last focusable, so Shift+Tab from the first wraps to it.
      expect(document.activeElement).toBe(sum)
    })
  })
})
