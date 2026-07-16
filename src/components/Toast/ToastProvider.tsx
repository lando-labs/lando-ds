'use client'

/**
 * ToastProvider + useToast hook
 *
 * Canonical global toast pattern for the Lando Labs Design System.
 *
 * Provides a single global container (rendered via Portal at
 * `var(--z-toast)`) and an imperative `useToast()` hook for showing /
 * dismissing toasts from anywhere in the tree.
 *
 * @example
 * // Wrap your app shell:
 * <ToastProvider position="bottom-right" maxToasts={3}>
 *   <App />
 * </ToastProvider>
 *
 * @example
 * // From anywhere inside the provider:
 * const { showToast, dismissToast } = useToast()
 * const id = showToast({
 *   variant: 'success',
 *   title: 'Item saved',
 *   description: 'Find it in your saved items.',
 *   duration: 5000,
 *   action: { label: 'Undo', onClick: handleUndo },
 *   dismissable: true,
 * })
 * dismissToast(id)
 *
 * Note: escalation logic ("show this only once per session", rate-limiting,
 * deduplication) lives in consumer code — not in the provider.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Portal } from '../Portal'
import providerStyles from './ToastProvider.module.css'
import toastStyles from './Toast.module.css'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export type ToastProviderPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/**
 * Configuration object accepted by `showToast()`.
 *
 * Mirrors the shape used by Mantine / Chakra / shadcn-sonner / Radix toast
 * primitives so DS adopters can swap implementations without rewriting call
 * sites.
 */
export interface ToastConfig {
  /** Visual + semantic variant (default: 'info') */
  variant?: ToastVariant
  /** Bold leading title (optional) */
  title?: string
  /** Secondary descriptive text rendered below the title (optional) */
  description?: string
  /**
   * Auto-dismiss duration in milliseconds. Pass `0` (or `Infinity`) to keep
   * the toast visible until dismissed programmatically. Default: 5000.
   */
  duration?: number
  /** Optional inline action button (e.g. an "Undo" affordance) */
  action?: {
    label: string
    onClick: () => void
  }
  /**
   * Whether to render an explicit close (×) button. Always keyboard-reachable.
   * Default: true.
   */
  dismissable?: boolean
}

/** Internal queue entry — `ToastConfig` plus runtime metadata. */
interface QueuedToast extends Required<Pick<ToastConfig, 'variant' | 'duration' | 'dismissable'>> {
  id: string
  title?: string
  description?: string
  action?: ToastConfig['action']
  /**
   * Wall-clock timestamp when the dismiss timer should fire. We persist this
   * so pause-on-hover can resume the timer with the correct remaining time
   * after a user moves their cursor away.
   */
  expiresAt: number | null
  /** Remaining ms when paused; `null` while running. */
  remaining: number | null
}

/**
 * Options accepted by the legacy convenience methods (`success`, `error`,
 * `warning`, `info`). Kept for backward-compat with the pre-v0.10.0
 * `useToast` shape — internally these delegate to `showToast`.
 */
export interface LegacyToastOptions {
  duration?: number
  title?: string
  action?: ToastConfig['action']
}

/** Return value of `useToast()`. */
export interface UseToastReturn {
  /**
   * Show a toast. Returns the generated id, which can be passed to
   * `dismissToast` for programmatic removal.
   */
  showToast: (config: ToastConfig) => string
  /** Programmatically dismiss a toast by id. No-op if the id is unknown. */
  dismissToast: (id: string) => void

  // ---- Backward-compat shims (pre-v0.10.0 useToast shape) ---------------
  // These delegate to `showToast` / `dismissToast`. Prefer the canonical
  // `showToast({ variant, title, ... })` form for new code. The legacy
  // shape is preserved so consumers that adopted the per-component
  // `useToast` from v0.x don't have to migrate atomically with the
  // v0.10.0 ToastProvider rollout.
  //
  // `toasts` returns an empty array under ToastProvider (toasts now
  // render via the global container, not via a per-component
  // <ToastContainer toasts={...} />). Existing call sites that fed the
  // array into a manual <ToastContainer> become a no-op — switch to
  // <ToastProvider> wrapping your shell to actually see toasts.

  /** @deprecated Use `showToast({ variant: 'success', title: message })`. */
  success: (message: string, options?: LegacyToastOptions) => string
  /** @deprecated Use `showToast({ variant: 'error', title: message })`. */
  error: (message: string, options?: LegacyToastOptions) => string
  /** @deprecated Use `showToast({ variant: 'warning', title: message })`. */
  warning: (message: string, options?: LegacyToastOptions) => string
  /** @deprecated Use `showToast({ variant: 'info', title: message })`. */
  info: (message: string, options?: LegacyToastOptions) => string
  /** @deprecated Use `dismissToast(id)`. */
  dismiss: (id: string) => void
  /** @deprecated Dismiss every active toast. Prefer per-id `dismissToast`. */
  dismissAll: () => void
  /**
   * @deprecated Always returns `[]` under `ToastProvider`. The provider
   * auto-renders the toast stack via Portal — feeding this array into a
   * manual `<ToastContainer toasts={...} />` is no longer needed.
   */
  toasts: never[]
}

interface ToastContextValue extends UseToastReturn {}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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

// CSS-module class lookups are typed `string | undefined` (the ambient module
// uses an index signature). The consumer filters falsy entries before joining,
// so `undefined` here is harmless.
const POSITION_CLASS: Record<ToastProviderPosition, string | undefined> = {
  'top-left': providerStyles.topLeft,
  'top-center': providerStyles.topCenter,
  'top-right': providerStyles.topRight,
  'bottom-left': providerStyles.bottomLeft,
  'bottom-center': providerStyles.bottomCenter,
  'bottom-right': providerStyles.bottomRight,
}

export interface ToastProviderProps {
  /** Children that should have access to `useToast()` */
  children: React.ReactNode
  /** Where to anchor the toast stack (default: `'bottom-right'`) */
  position?: ToastProviderPosition
  /**
   * Maximum number of toasts visible simultaneously. When the cap is hit,
   * the oldest toast is dropped to make room for the newest. Default: 5.
   */
  maxToasts?: number
  /** Default duration applied when a `showToast()` call omits `duration` */
  defaultDuration?: number
}

interface ToastItemProps {
  toast: QueuedToast
  onDismiss: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
}

function ToastItem({ toast, onDismiss, onPause, onResume }: ToastItemProps) {
  const handlePause = () => onPause(toast.id)
  const handleResume = () => onResume(toast.id)

  const classes = [
    toastStyles.toast,
    toastStyles[toast.variant],
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      onFocus={handlePause}
      onBlur={handleResume}
      tabIndex={0}
      data-toast-id={toast.id}
    >
      <div className={toastStyles.icon}>{VARIANT_ICONS[toast.variant]}</div>

      <div className={toastStyles.content}>
        {toast.title && <div className={toastStyles.title}>{toast.title}</div>}
        {toast.description && (
          <div className={toastStyles.message}>{toast.description}</div>
        )}
      </div>

      {toast.action && (
        <button
          type="button"
          className={toastStyles.action}
          onClick={() => {
            toast.action?.onClick()
            onDismiss(toast.id)
          }}
        >
          {toast.action.label}
        </button>
      )}

      {toast.dismissable && (
        <button
          type="button"
          className={toastStyles.closeButton}
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M12 4L4 12M4 4l8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * Global provider for the canonical toast pattern. Wrap your app shell once.
 * Children gain access to `useToast()` for imperative show/dismiss.
 */
export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
  defaultDuration = 5000,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<QueuedToast[]>([])
  // Map of toast id → active timeout handle. Stored in a ref so we can clear
  // on pause / unmount without re-rendering.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Per-provider id generation. Previously a module-scoped `let` counter (plus
  // `Date.now()`) generated ids — that shared mutable state leaked across every
  // provider instance and across `render()` calls in tests, and the timestamp
  // made ids non-deterministic (SSR-unfriendly). `useId()` gives a stable,
  // per-provider namespace; a ref counter makes each call within the provider
  // unique without triggering re-renders.
  const providerId = useId()
  const idCounterRef = useRef(0)

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const dismissToast = useCallback(
    (id: string) => {
      clearTimer(id)
      setToasts((prev) => prev.filter((t) => t.id !== id))
    },
    [clearTimer]
  )

  const scheduleDismiss = useCallback(
    (id: string, ms: number) => {
      clearTimer(id)
      if (ms <= 0 || !Number.isFinite(ms)) return
      const timer = setTimeout(() => {
        timersRef.current.delete(id)
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, ms)
      timersRef.current.set(id, timer)
    },
    [clearTimer]
  )

  const pauseToast = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t
          if (t.expiresAt === null) return t // already paused or no auto-dismiss
          clearTimer(id)
          const remaining = Math.max(0, t.expiresAt - Date.now())
          return { ...t, expiresAt: null, remaining }
        })
      )
    },
    [clearTimer]
  )

  const resumeToast = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t
          if (t.expiresAt !== null) return t // already running
          if (t.remaining === null || t.remaining <= 0) return t
          const expiresAt = Date.now() + t.remaining
          scheduleDismiss(id, t.remaining)
          return { ...t, expiresAt, remaining: null }
        })
      )
    },
    [scheduleDismiss]
  )

  const showToast = useCallback(
    (config: ToastConfig): string => {
      idCounterRef.current += 1
      const id = `toast-${providerId}-${idCounterRef.current}`
      const duration = config.duration ?? defaultDuration
      const dismissable = config.dismissable ?? true
      const variant: ToastVariant = config.variant ?? 'info'
      const expiresAt =
        duration > 0 && Number.isFinite(duration) ? Date.now() + duration : null

      const entry: QueuedToast = {
        id,
        variant,
        title: config.title,
        description: config.description,
        duration,
        action: config.action,
        dismissable,
        expiresAt,
        remaining: null,
      }

      setToasts((prev) => {
        const next = [...prev, entry]
        // Drop oldest if we exceeded the cap. Also clear its timer so it
        // doesn't fire after removal.
        if (next.length > maxToasts) {
          const overflow = next.slice(0, next.length - maxToasts)
          for (const t of overflow) clearTimer(t.id)
          return next.slice(next.length - maxToasts)
        }
        return next
      })

      if (expiresAt !== null) {
        scheduleDismiss(id, duration)
      }

      return id
    },
    [providerId, defaultDuration, maxToasts, clearTimer, scheduleDismiss]
  )

  // Clean up any pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  // Legacy shims (pre-v0.10.0 useToast shape). See `UseToastReturn` for the
  // deprecation path. These delegate to `showToast` / `dismissToast` so a
  // single call site sees consistent stack/dismiss behavior.
  const dismissAll = useCallback(() => {
    setToasts((prev) => {
      for (const t of prev) clearTimer(t.id)
      return []
    })
  }, [clearTimer])

  const showLegacy = useCallback(
    (variant: ToastVariant, message: string, options?: LegacyToastOptions) =>
      showToast({
        variant,
        // Pre-v0.10.0 callers passed `message` as the body; an explicit
        // `options.title` (when provided) became the bold lead. Mirror
        // that mapping so legacy call sites render identically.
        title: options?.title ?? message,
        description: options?.title ? message : undefined,
        duration: options?.duration,
        action: options?.action,
      }),
    [showToast]
  )

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      // Backward-compat shims
      success: (message, options) => showLegacy('success', message, options),
      error: (message, options) => showLegacy('error', message, options),
      warning: (message, options) => showLegacy('warning', message, options),
      info: (message, options) => showLegacy('info', message, options),
      dismiss: dismissToast,
      dismissAll,
      toasts: [] as never[],
    }),
    [showToast, dismissToast, showLegacy, dismissAll]
  )

  const containerClasses = [providerStyles.container, POSITION_CLASS[position]]
    .filter(Boolean)
    .join(' ')

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Portal>
        <div
          className={containerClasses}
          aria-live="polite"
          aria-atomic="false"
          data-toast-position={position}
        >
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
              onPause={pauseToast}
              onResume={resumeToast}
            />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  )
}

ToastProvider.displayName = 'ToastProvider'

/**
 * Imperative handle for showing / dismissing toasts. Must be called inside a
 * `<ToastProvider>` — throws a descriptive error otherwise.
 */
export function useToast(): UseToastReturn {
  const ctx = useContext(ToastContext)
  if (ctx === null) {
    throw new Error(
      'useToast must be called inside ToastProvider — make sure your app shell wraps children in <ToastProvider>'
    )
  }
  return ctx
}
