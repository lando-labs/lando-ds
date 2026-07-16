/**
 * Lando Labs Design System — Hooks
 *
 * A headless, dependency-free (React-only), SSR-safe hooks library. Every hook
 * is client-side (`'use client'`), documented in `reference/hooks.md`, and
 * queryable from `meta.json`'s `hooks` section (schema 1.3+) — so both humans
 * and AI agents can discover them (#504).
 *
 * Importable from the package root or the `@lando-labs/lando-ds/hooks`
 * subpath.
 */

// ── state ────────────────────────────────────────────────────────────────
export { useDisclosure } from './useDisclosure'
export type { UseDisclosureHandlers } from './useDisclosure'
export { useToggle } from './useToggle'
export { useDebouncedValue } from './useDebouncedValue'
export { useLocalStorage } from './useLocalStorage'

// ── timing ───────────────────────────────────────────────────────────────
export { useInterval } from './useInterval'
export { useTimeout } from './useTimeout'

// ── dom ──────────────────────────────────────────────────────────────────
export { useEventListener } from './useEventListener'
export { useClickOutside } from './useClickOutside'
export { useHover } from './useHover'
export { useIntersection } from './useIntersection'
export { useResizeObserver } from './useResizeObserver'
export { useWindowScroll } from './useWindowScroll'

// ── browser ──────────────────────────────────────────────────────────────
export { useMediaQuery } from './useMediaQuery'
export { useViewportSize } from './useViewportSize'
export { useClipboard } from './useClipboard'

// ── lifecycle ────────────────────────────────────────────────────────────
export { useMounted } from './useMounted'

// ── a11y ─────────────────────────────────────────────────────────────────
export { useFocusTrap } from './useFocusTrap'

// ── keyboard ─────────────────────────────────────────────────────────────
export { useKeyPress } from './useKeyPress'

// ── layout ───────────────────────────────────────────────────────────────
export { usePortalPosition } from './usePortalPosition'
export type { UsePortalPositionOptions, PortalPosition } from './usePortalPosition'
