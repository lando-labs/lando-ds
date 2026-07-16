/**
 * Toast Container Component
 *
 * @deprecated Since v0.40.0 (removal planned for the next major). Prefer the
 * canonical global pattern — wrap your app in `<ToastProvider>` and drive it
 * with `useToast()`. `<ToastProvider>` renders and positions its own stack via
 * Portal, so this manual container (which requires you to own the `toasts`
 * array and each toast's `onDismiss`) is no longer needed. Migration: replace
 * `<ToastContainer toasts={…} />` with a single `<ToastProvider>` around your
 * app shell and call `showToast()` from `useToast()`. Nothing is removed yet —
 * existing usage keeps working.
 *
 * Manages the display and positioning of multiple toasts.
 * Renders toasts via Portal outside the main DOM hierarchy.
 *
 * @example
 * // Deprecated — prefer <ToastProvider>. Legacy manual wiring:
 * <ToastContainer position="top-right" toasts={toasts} />
 */

import React from 'react'
import { Portal } from '../Portal'
import { Toast, ToastProps } from './Toast'
import styles from './ToastContainer.module.css'

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/**
 * Props for the legacy manual `<ToastContainer>`.
 *
 * @deprecated Since v0.40.0 (removal planned for the next major). Prefer
 * `ToastProvider` + `useToast()`, which owns the toast stack internally.
 */
export interface ToastContainerProps {
  /** Position of the toast container */
  position?: ToastPosition
  /** Maximum number of visible toasts */
  maxToasts?: number
  /** Array of active toasts */
  toasts?: ToastProps[]
}

export const ToastContainer = React.forwardRef<HTMLDivElement, ToastContainerProps>(
  function ToastContainer(
    {
      position = 'top-right',
      maxToasts = 5,
      toasts = [],
    },
    ref
  ) {
    // Limit number of visible toasts
    const visibleToasts = toasts.slice(0, maxToasts)

    const containerClasses = [
      styles.container,
      styles[position.replace('-', '')], // Convert 'top-right' to 'topright'
    ].filter(Boolean).join(' ')

    return (
      <Portal>
        <div ref={ref} className={containerClasses} aria-live="polite" aria-atomic="false">
          {visibleToasts.map((toast) => (
            <Toast key={toast.id} {...toast} />
          ))}
        </div>
      </Portal>
    )
  }
)

ToastContainer.displayName = 'ToastContainer'
