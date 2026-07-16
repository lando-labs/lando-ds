import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Slot } from './Slot'

describe('Slot — prop-merge contract (#333)', () => {
  it('event handlers compose: child runs first, then slot, both fire', () => {
    const calls: string[] = []
    const { container } = render(
      <Slot onClick={() => calls.push('slot')}>
        <button onClick={() => calls.push('child')}>x</button>
      </Slot>,
    )
    const button = container.querySelector('button')!
    button.click()
    expect(calls).toEqual(['child', 'slot'])
  })

  it('className concatenates: slot first then child', () => {
    const { container } = render(
      <Slot className="from-slot">
        <button className="from-child">x</button>
      </Slot>,
    )
    expect(container.querySelector('button')!.className).toBe('from-slot from-child')
  })

  it('style merges: child wins on key conflict', () => {
    const { container } = render(
      <Slot style={{ color: 'red', padding: 4 }}>
        <button style={{ color: 'blue' }}>x</button>
      </Slot>,
    )
    const style = container.querySelector('button')!.style
    expect(style.color).toBe('blue')
    expect(style.padding).toBe('4px')
  })

  it('non-event props: child wins (Radix asChild semantics) — see Slot docstring caveat about aria-busy ownership', () => {
    const { container } = render(
      <Slot aria-busy data-from="slot">
        <button aria-busy={false} data-from="child">x</button>
      </Slot>,
    )
    const button = container.querySelector('button')!
    expect(button.getAttribute('aria-busy')).toBe('false')
    expect(button.getAttribute('data-from')).toBe('child')
  })

  it('non-overlapping props pass through from both sides', () => {
    const { container } = render(
      <Slot id="from-slot">
        <button type="submit">x</button>
      </Slot>,
    )
    const button = container.querySelector('button')!
    expect(button.id).toBe('from-slot')
    expect(button.type).toBe('submit')
  })

  it('forwards ref to the child element', () => {
    let captured: HTMLButtonElement | null = null
    render(
      <Slot ref={(el: HTMLElement | null) => { captured = el as HTMLButtonElement | null }}>
        <button>x</button>
      </Slot>,
    )
    expect(captured).toBeInstanceOf(HTMLButtonElement)
  })

  it('warns and renders nothing when child is not a valid element', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(<Slot>{'plain text'}</Slot>)
    expect(container.firstChild).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
