/**
 * Toast Component Exports
 *
 * Public surface area:
 * - `<Toast>` — single-toast presentational component (**@deprecated** — see below)
 * - `<ToastContainer>` — manual container (**@deprecated** — legacy / advanced wiring)
 * - `<ToastProvider>` — canonical global provider (Sprint 16 / v0.10.0)
 * - `useToast()` — imperative hook returning `{ showToast, dismissToast }`
 *
 * Canonical pattern: wrap your app in `<ToastProvider>` and call
 * `useToast().showToast({ variant, title, description })`. Note the body field
 * is `description` (see `ToastConfig`); the presentational `<Toast>` now also
 * accepts `description` (with `message` kept as a deprecated alias, #332).
 *
 * @deprecated `Toast` and `ToastContainer` are deprecated as of v0.40.0 and
 * are slated for removal in the next major. They remain exported and fully
 * functional for now — migrate to `ToastProvider` + `useToast()` at your
 * convenience.
 */

// ---------------------------------------------------------------------------
// Deprecated (v0.40.0) — presentational Toast + manual container. Retained for
// backward-compat; prefer `ToastProvider` + `useToast()` below. Removal is
// planned for the next major. See #332.
// ---------------------------------------------------------------------------

/** @deprecated Prefer `ToastProvider` + `useToast()`. Removal planned for the next major. */
export { Toast } from './Toast'
export type { ToastProps } from './Toast'

/** @deprecated Prefer `ToastProvider` + `useToast()`. Removal planned for the next major. */
export { ToastContainer } from './ToastContainer'
export type { ToastContainerProps, ToastPosition } from './ToastContainer'

// ---------------------------------------------------------------------------
// Canonical global toast pattern (Sprint 16 / v0.10.0).
// ---------------------------------------------------------------------------

export { ToastProvider, useToast } from './ToastProvider'
export type {
  ToastProviderProps,
  ToastProviderPosition,
  ToastConfig,
  ToastVariant,
  UseToastReturn,
} from './ToastProvider'
