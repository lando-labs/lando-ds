'use client'

/**
 * Hover Hook
 *
 * Tracks whether the pointer is over an element, via `mouseenter`/`mouseleave`.
 * Returns a ref to attach to the element and the current hovered state — useful
 * for hover-revealed affordances (row actions, card overlays, copy buttons)
 * where a CSS `:hover` rule cannot express the change, because it has to drive
 * React state rather than styling.
 *
 * The listeners are attached in an effect (never during render, so the hook is
 * server-safe) and removed on unmount. `mouseenter`/`mouseleave` do not bubble,
 * so nested children never flip the state — unlike `mouseover`/`mouseout`.
 *
 * @category dom
 *
 * @example
 * const [ref, isHovered] = useHover<HTMLDivElement>()
 * return (
 *   <div ref={ref}>
 *     <Text>Card</Text>
 *     {isHovered && <IconButton aria-label="Delete" icon={<TrashIcon />} />}
 *   </div>
 * )
 */

import { useEffect, useRef, useState } from 'react'

export function useHover<T extends HTMLElement = HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T>(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    // Copied to a local so the cleanup detaches from the element we attached to,
    // not from whatever `ref.current` happens to be at teardown.
    const element = ref.current
    if (!element) return

    const handleEnter = () => setIsHovered(true)
    const handleLeave = () => setIsHovered(false)

    element.addEventListener('mouseenter', handleEnter)
    element.addEventListener('mouseleave', handleLeave)

    return () => {
      element.removeEventListener('mouseenter', handleEnter)
      element.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  return [ref, isHovered]
}
