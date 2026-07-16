'use client'

/**
 * Toast Component
 *
 * @deprecated Since v0.40.0 (removal planned for the next major). Prefer the
 * canonical global pattern — wrap your app in `<ToastProvider>` and call
 * `useToast().showToast({ variant, title, description })`. The provider owns
 * stacking, positioning, pause-on-hover, and dismissal; this presentational
 * `<Toast>` requires you to wire all of that by hand. Migration: replace
 * `<Toast message="…" />` with `showToast({ description: '…' })`. Nothing is
 * removed yet — existing usage keeps working.
 *
 * Individual toast notification with auto-dismiss and progress bar.
 *
 * Field naming (#332): `description` is the canonical body field (matching
 * `ToastConfig.description` on the provider). The original `message` prop is
 * kept as a `@deprecated` alias so existing call sites keep working — the
 * component renders `description ?? message`.
 *
 * Exit animation contract (#274): the toast keeps its closed state in a CSS
 * `exiting` class and waits for the slide-out `transitionend` before firing
 * `onDismiss(id)`. The legacy `setTimeout(300)` JS hack that matched the CSS
 * duration by hand is gone — the browser tells us when it's done.
 *
 * Why a class flip and not the Popover API: Toasts are stacked inside the
 * single ToastContainer flex column. Promoting each toast to its own popover
 * would lose the column stacking order against its siblings (top-layer
 * ordering is per-element, not per-document-position). A class-driven exit
 * keeps the stack intact AND gets us pure-CSS animation via the existing
 * `@keyframes toastSlideOut` (no JS duration mirroring).
 *
 * Reduced-motion safeguard: under `prefers-reduced-motion: reduce` the
 * central token cascade in tokens.css collapses all `--duration-*` to 0ms.
 * The toast's exit animation references those tokens via `--motion-overlay-
 * exit-duration`, so the slide collapses to instantaneous — `transitionend`
 * may not fire. We schedule a small fallback timeout (matched to the longest
 * possible exit duration) so the dismissal still progresses. Idempotent via
 * a `dismissed` flag so the listener and the fallback don't both call
 * onDismiss.
 *
 * @example
 * <Toast
 *   id="toast-1"
 *   variant="success"
 *   description="Profile updated successfully!"
 *   onDismiss={handleDismiss}
 * />
 */

import React, { useEffect, useRef, useState } from 'react'
import styles from './Toast.module.css'

/**
 * Props for the presentational `<Toast>` component.
 *
 * @deprecated Since v0.40.0 (removal planned for the next major). Prefer
 * `ToastProvider` + `useToast()`; the config passed to `showToast()` is typed
 * by `ToastConfig`, which already uses `description` for the body text.
 */
export interface ToastProps {
  /** Unique identifier for the toast */
  id: string
  /** Visual variant */
  variant?: 'success' | 'error' | 'warning' | 'info'
  /** Optional title */
  title?: string
  /**
   * Secondary descriptive text (the toast body). Canonical body field as of
   * #332 — mirrors `ToastConfig.description` on the provider.
   */
  description?: string
  /**
   * @deprecated Use {@link ToastProps.description} instead. Retained as a
   * non-breaking alias so existing `message`-only call sites keep working;
   * when both are set, `description` wins. Slated for removal in the next
   * major alongside the rest of this presentational component.
   */
  message?: string
  /** Duration in milliseconds (0 for no auto-dismiss) */
  duration?: number
  /** Optional action button */
  action?: {
    label: string
    onClick: () => void
  }
  /** Callback when toast is dismissed */
  onDismiss: (id: string) => void
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(function Toast(
  {
    id,
    variant = 'info',
    title,
    description,
    message,
    duration = 5000,
    action,
    onDismiss,
  },
  ref
) {
  // `description` is canonical (#332); `message` is the deprecated alias.
  // Prefer `description` when both are supplied. Dev-only nudges keep the
  // runtime silent in production while steering call sites during migration.
  if (process.env.NODE_ENV !== 'production') {
    if (description !== undefined && message !== undefined) {
      console.warn(
        '[Toast] Both `description` and `message` were provided. ' +
          '`description` takes precedence; drop `message` (deprecated) to silence this warning.'
      )
    } else if (description === undefined && message === undefined) {
      console.warn(
        '[Toast] No `description` provided. The `message` prop is deprecated — ' +
          'pass `description` (the toast body) instead.'
      )
    }
  }
  const body = description ?? message

  const [progress, setProgress] = useState(100)
  const [isExiting, setIsExiting] = useState(false)
  const innerRef = useRef<HTMLDivElement>(null)

  // Merge external + internal refs so we can listen for `transitionend` on the
  // toast element while still honouring the consumer's ref.
  const setMergedRef = (node: HTMLDivElement | null) => {
    innerRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  useEffect(() => {
    if (duration === 0) return

    const startTime = Date.now()
    const interval = 50 // Update every 50ms

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)

      if (remaining === 0) {
        clearInterval(timer)
        handleDismiss()
      }
    }, interval)

    return () => clearInterval(timer)
    // Effect intentionally keyed on `duration` only. `handleDismiss` is just
    // `setIsExiting(true)` (React state setters are stable) and the timer's
    // job is to fire once after `duration` elapses — re-running the effect on
    // every render would restart the countdown and break the progress bar.
  }, [duration])

  // Wait for the slide-out transition before unmounting (#274). Listening on
  // `transitionend` is the platform-native replacement for the setTimeout(300)
  // hack that hand-matched the CSS duration. We filter on `transform` because
  // the exit animates BOTH opacity and transform — otherwise onDismiss would
  // fire twice.
  //
  // The fallback timeout exists for two reasons:
  //   1. Under reduced-motion the duration collapses to 0ms; transitionend
  //      may not fire at all.
  //   2. jsdom doesn't run real CSS transitions; the test environment relies
  //      on the fallback to advance state. The fallback is sized to match the
  //      longest exit-duration the CSS can use (300ms), preserving the
  //      pre-existing test contract that asserts the 300ms delay.
  useEffect(() => {
    if (!isExiting) return
    const el = innerRef.current

    let dismissed = false
    const fire = () => {
      if (dismissed) return
      dismissed = true
      onDismiss(id)
    }

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return
      fire()
    }

    el?.addEventListener('transitionend', handleTransitionEnd)
    const fallback = setTimeout(fire, 300)

    return () => {
      el?.removeEventListener('transitionend', handleTransitionEnd)
      clearTimeout(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExiting])

  const handleDismiss = () => {
    setIsExiting(true)
  }

  const icons = {
    success: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M16.667 5L7.5 14.167L3.333 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 6.667V10m0 3.333h.008M18.333 10a8.333 8.333 0 11-16.666 0 8.333 8.333 0 0116.666 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 6.667V10m0 3.333h.008M8.574 3.125l-6.666 11.667A1.667 1.667 0 003.333 17.5h13.334a1.667 1.667 0 001.425-2.708L11.426 3.125a1.667 1.667 0 00-2.852 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 13.333V10m0-3.333h.008M18.333 10a8.333 8.333 0 11-16.666 0 8.333 8.333 0 0116.666 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  }

  const toastClasses = [
    styles.toast,
    styles[variant],
    isExiting ? styles.exiting : '',
  ].filter(Boolean).join(' ')

  return (
    <div ref={setMergedRef} className={toastClasses} role="alert" aria-live="polite">
      <div className={styles.icon}>{icons[variant]}</div>

      <div className={styles.content}>
        {title && <div className={styles.title}>{title}</div>}
        <div className={styles.message}>{body}</div>
      </div>

      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}

      <button
        type="button"
        className={styles.closeButton}
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M12 4L4 12M4 4l8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {duration > 0 && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
})

Toast.displayName = 'Toast'
