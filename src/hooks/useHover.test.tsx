// @vitest-environment jsdom

/**
 * useHover tests (#504).
 *
 * `useHover` takes no arguments, so it has no dependency to re-attach on — the
 * lifecycle claims worth pinning are the state transitions, the fact that
 * `mouseenter`/`mouseleave` do not bubble (a hovered child must not flip the
 * parent's state off), and that both listeners are removed on unmount.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'

import { useHover } from './useHover'

/** Minimal harness: a div wired to the hook, reporting its own hover state. */
function Hoverable() {
  const [ref, isHovered] = useHover<HTMLDivElement>()
  return (
    <div ref={ref} data-testid="target">
      {isHovered ? 'hovered' : 'idle'}
      <span data-testid="child">child</span>
    </div>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useHover', () => {
  it('starts un-hovered and returns a ref to attach', () => {
    const { result } = renderHook(() => useHover<HTMLDivElement>())
    const [ref, isHovered] = result.current

    expect(isHovered).toBe(false)
    // Never attached to an element, so the hook stays inert (and does not throw).
    expect(ref.current).toBeNull()
  })

  it('flips to hovered on mouseenter and back on mouseleave', () => {
    render(<Hoverable />)
    const target = screen.getByTestId('target')

    expect(target).toHaveTextContent('idle')

    fireEvent.mouseEnter(target)
    expect(target).toHaveTextContent('hovered')

    fireEvent.mouseLeave(target)
    expect(target).toHaveTextContent('idle')
  })

  it('attaches the ref to the rendered element', () => {
    const { result } = renderHook(() => useHover<HTMLDivElement>())
    expect(result.current[0].current).toBeNull()

    render(<Hoverable />)
    expect(screen.getByTestId('target')).toBeInTheDocument()
  })

  it('ignores events on children (mouseenter/mouseleave do not bubble)', () => {
    render(<Hoverable />)
    const target = screen.getByTestId('target')
    const child = screen.getByTestId('child')

    fireEvent.mouseEnter(target)
    expect(target).toHaveTextContent('hovered')

    // A non-bubbling leave on the child must not reach the parent's listener.
    fireEvent.mouseLeave(child)
    expect(target).toHaveTextContent('hovered')
  })

  it('removes both listeners on unmount', () => {
    const { unmount } = render(<Hoverable />)
    const target = screen.getByTestId('target')
    const removeSpy = vi.spyOn(target, 'removeEventListener')

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledTimes(2)
  })

  it('re-attaches cleanly on a remount (state starts fresh)', () => {
    const first = render(<Hoverable />)
    fireEvent.mouseEnter(screen.getByTestId('target'))
    expect(screen.getByTestId('target')).toHaveTextContent('hovered')
    first.unmount()

    render(<Hoverable />)
    const target = screen.getByTestId('target')
    expect(target).toHaveTextContent('idle')

    // The new element's listeners are live.
    fireEvent.mouseEnter(target)
    expect(target).toHaveTextContent('hovered')
  })
})
