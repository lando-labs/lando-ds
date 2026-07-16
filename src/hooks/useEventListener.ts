'use client'

/**
 * Event Listener Hook
 *
 * Subscribes to a DOM event on `window` (the default target), `document`, a raw
 * element, or a React ref — and keeps that subscription honest. The handler is
 * held in a ref, so an inline arrow function is fine: consumers never need
 * `useCallback`, and passing a fresh handler on every render does NOT detach and
 * re-attach the listener. The listener is re-attached only when the event `type`,
 * the `target`, or the VALUES of `options` change, and is always removed on
 * unmount.
 *
 * The target is resolved inside an effect, so nothing touches `window` during
 * render and the hook is safe to run on the server. An omitted `target` means
 * `window`; an explicit `null` means there is nothing to listen on, so no
 * listener is registered.
 *
 * Note that a ref is read when the listener is attached, so the ref must be
 * attached to its element by the time effects run — the ordinary case for an
 * element rendered alongside the hook.
 *
 * @category dom
 *
 * @example
 * // Defaults to `window`. No `useCallback` needed — the handler is ref-held.
 * useEventListener('keydown', (event) => {
 *   if (event.key === 'Escape') close()
 * })
 *
 * @example
 * // Pass the ref object itself, not `ref.current`.
 * const buttonRef = useRef<HTMLButtonElement>(null)
 * useEventListener('click', () => setCount((count) => count + 1), buttonRef)
 */

import { useEffect, useRef } from 'react'

/** A ref object is the only non-null target shape carrying a `current` field. */
function isRefObject(
  target: Window | Document | HTMLElement | React.RefObject<HTMLElement | null>
): target is React.RefObject<HTMLElement | null> {
  return 'current' in target
}

export function useEventListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  target?: Window | Document | HTMLElement | React.RefObject<HTMLElement | null> | null,
  options?: AddEventListenerOptions
): void {
  // The handler lives in a ref so a new inline function on every render never
  // churns the subscription: the registered listener always calls the latest one.
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  // Depend on the option VALUES, not the object's identity. An inline
  // `{ passive: true }` literal is a brand-new object on every render, so
  // depending on the object itself would tear down and re-attach the listener on
  // every single render.
  const capture = options?.capture
  const once = options?.once
  const passive = options?.passive
  const signal = options?.signal

  useEffect(() => {
    // Resolved here rather than during render: effects never run on the server,
    // so `window` is only ever touched in the browser.
    let resolved: Window | Document | HTMLElement | null
    if (target === undefined) resolved = window
    else if (target === null) resolved = null
    else resolved = isRefObject(target) ? target.current : target

    if (!resolved) return

    const listener: EventListener = (event) => {
      handlerRef.current(event as WindowEventMap[K])
    }

    // Rebuilt from the destructured values so an absent option stays absent
    // rather than being passed through as an explicit `undefined`.
    const listenerOptions: AddEventListenerOptions = {}
    if (capture !== undefined) listenerOptions.capture = capture
    if (once !== undefined) listenerOptions.once = once
    if (passive !== undefined) listenerOptions.passive = passive
    if (signal !== undefined) listenerOptions.signal = signal

    resolved.addEventListener(type, listener, listenerOptions)

    return () => {
      resolved.removeEventListener(type, listener, listenerOptions)
    }
  }, [type, target, capture, once, passive, signal])
}
