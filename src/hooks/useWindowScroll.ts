'use client'

/**
 * Window Scroll Hook
 *
 * Tracks the window's scroll offset as `{ x, y }` — the input for a header that
 * condenses, a reading-progress bar, a back-to-top button, or parallax.
 *
 * Scroll fires far faster than React can usefully re-render, so updates are
 * coalesced with `requestAnimationFrame`: a burst of scroll events inside one
 * frame produces exactly one state update, and an offset that has not actually
 * moved returns the SAME object, so it cannot trigger a re-render. Any pending
 * frame is cancelled and the listener removed on unmount.
 *
 * Server-safe: the offset starts at `{ x: 0, y: 0 }` — the value the server
 * renders and the client hydrates with, so there is no hydration mismatch — and
 * is synced to the real position in an effect, which also picks up a scroll
 * position restored by the browser or a `#hash` jump that landed before mount.
 *
 * @category dom
 *
 * @example
 * const { y } = useWindowScroll()
 * return <Header condensed={y > 64} />
 */

import { useEffect, useState } from 'react'

export function useWindowScroll(): { x: number; y: number } {
  // Deliberately NOT a lazy initializer reading `window`: the server has no
  // window, and seeding from the client would disagree with the server's HTML
  // and break hydration. The effect below syncs the real position after mount.
  const [scroll, setScroll] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    let frame: number | null = null

    const read = () => {
      frame = null
      // Read outside the updater so the updater stays pure.
      const x = window.scrollX
      const y = window.scrollY
      setScroll((prev) => (prev.x === x && prev.y === y ? prev : { x, y }))
    }

    const handleScroll = () => {
      // Already scheduled for this frame — coalesce into the pending read.
      if (frame !== null) return
      frame = requestAnimationFrame(read)
    }

    // Sync once on mount: the page may already be scrolled.
    read()

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return scroll
}
