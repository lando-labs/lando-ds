'use client'

/**
 * useAnchoredPosition — the shared measurement lifecycle for anchored overlays (#331).
 *
 * SINGLE SOURCE OF TRUTH for the "measure a trigger + overlay and compute
 * fixed-position coordinates before paint" lifecycle that every portal/anchored
 * overlay in the DS needs. Before #331 this ~50-line dance was copy-pasted into
 * THREE hooks — `usePortalPosition` (Dropdown/Select/TagInput),
 * `useHorizontalTooltipPosition` (Tooltip), and `usePopoverPosition` (Popover) —
 * which differed only in their GEOMETRY and return shape. This centralizes the
 * lifecycle and leaves geometry pluggable via the `compute` callback.
 *
 * The lifecycle it owns (identical across all three former copies):
 *   - **No flash-at-(0,0)**: starts at the caller's `offscreen` value
 *     (`isReady: false`) until the first measurement succeeds.
 *   - **Robust mount measurement**: one synchronous attempt (covers a
 *     non-portaled overlay whose ref is already attached) followed by a
 *     `requestAnimationFrame` retry loop up to 10 frames (covers a `Portal`
 *     that attaches its mount node a commit later). This sync-first-then-rAF
 *     shape is `usePortalPosition`'s — a strict SUPERSET of the rAF-only shape
 *     Tooltip/Popover used (which at most measured one frame later), so folding
 *     them onto it never regresses and can only measure sooner.
 *   - **Responsive**: recomputes on capture-phase scroll (to catch ancestor
 *     overflow scrolls) and resize while open + ready.
 *   - **Reset on close**: returns to `offscreen` so the next open re-measures.
 *
 * `compute` receives the live trigger + overlay ELEMENTS (not rects) so callers
 * that delegate to `calculatePosition` — which takes elements — can pass them
 * straight through. It returns everything except `isReady`, which this hook adds.
 *
 * @example
 * const pos = useAnchoredPosition(triggerRef, overlayRef, isOpen,
 *   (t, o) => computePortalPosition(t, o, { align, offset }),
 *   OFFSCREEN)
 */

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'

/** The minimal shape every anchored-position result carries. */
export interface AnchoredReady {
  /**
   * False until the first measurement completes. Consumers hide the overlay
   * (e.g. `visibility: hidden`) while false to avoid a flash at the initial
   * off-screen coordinates.
   */
  isReady: boolean
}

/**
 * Run the measure → rAF-retry → scroll/resize lifecycle for an anchored overlay,
 * computing coordinates via `compute`. Returns `offscreen` (with
 * `isReady: false`) until both refs are mounted and the first measure succeeds.
 *
 * @typeParam T The full result shape, e.g. `{ top, left, placement, isReady }`.
 * @param triggerRef Ref to the anchor element.
 * @param overlayRef Ref to the overlay element (needed to measure its size).
 * @param isOpen Whether the overlay is open (gates measuring + listeners).
 * @param compute Pure-ish geometry: `(triggerEl, overlayEl) => T without isReady`.
 * @param offscreen Initial + reset value; carries `isReady: false`.
 */
export function useAnchoredPosition<T extends AnchoredReady>(
  triggerRef: React.RefObject<HTMLElement | null>,
  overlayRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  compute: (triggerEl: HTMLElement, overlayEl: HTMLElement) => Omit<T, 'isReady'>,
  offscreen: T
): T {
  const [position, setPosition] = useState<T>(offscreen)

  // Keep `compute` + `offscreen` fresh via refs so `updatePosition` stays stable
  // across renders (tight effect deps). This mirrors the per-hook `optionsRef`
  // pattern the three former copies each maintained.
  const computeRef = useRef(compute)
  computeRef.current = compute
  const offscreenRef = useRef(offscreen)
  offscreenRef.current = offscreen

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current
    const overlayEl = overlayRef.current
    if (!triggerEl || !overlayEl) return false

    const next = computeRef.current(triggerEl, overlayEl)
    setPosition({ ...next, isReady: true } as T)
    return true
  }, [triggerRef, overlayRef])

  // Reset to off-screen when closed so reopening starts in a measuring state.
  useEffect(() => {
    if (!isOpen) setPosition(offscreenRef.current)
  }, [isOpen])

  // Initial measurement: synchronous first try (useLayoutEffect, before paint)
  // then a rAF-retry loop up to 10 frames for portals that mount a commit later.
  useLayoutEffect(() => {
    if (!isOpen) return

    let rafId: number | null = null
    let cancelled = false
    let attempts = 0
    const maxAttempts = 10

    const tryMeasure = () => {
      if (cancelled) return
      if (updatePosition()) {
        rafId = null
        return
      }
      if (attempts < maxAttempts) {
        attempts++
        rafId = requestAnimationFrame(tryMeasure)
      }
    }

    tryMeasure()

    return () => {
      cancelled = true
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [isOpen, updatePosition])

  // Reposition on scroll (capture, to catch ancestor scroll) + resize while open.
  useEffect(() => {
    if (!isOpen || !position.isReady) return

    const handle = () => updatePosition()
    window.addEventListener('scroll', handle, true)
    window.addEventListener('resize', handle)

    return () => {
      window.removeEventListener('scroll', handle, true)
      window.removeEventListener('resize', handle)
    }
  }, [isOpen, position.isReady, updatePosition])

  return position
}
