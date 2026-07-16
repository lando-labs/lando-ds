'use client'

/**
 * useToast — re-exported from ToastProvider so the hook is also reachable
 * from `@lando-labs/lando-ds/Toast/useToast` paths.
 *
 * The canonical pattern is:
 *
 *     <ToastProvider position="bottom-right" maxToasts={3}>
 *       <App />
 *     </ToastProvider>
 *
 *     const { showToast, dismissToast } = useToast()
 *
 * See `./ToastProvider.tsx` for the full implementation, behaviour notes,
 * and `ToastConfig` shape.
 */

export { useToast } from './ToastProvider'
export type {
  UseToastReturn,
  ToastConfig,
  ToastVariant,
  ToastProviderPosition,
} from './ToastProvider'
