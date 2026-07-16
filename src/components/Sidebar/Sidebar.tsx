'use client'

/**
 * Sidebar Component
 *
 * A responsive sidebar navigation with robust collapse behavior, a collapsed
 * rail slot, and mobile overlay drawer. Designed to compose with <AppShell>
 * but fully usable standalone.
 *
 * API surface:
 * - Controlled: pass `collapsed` + `onCollapsedChange`
 * - Uncontrolled: pass `defaultCollapsed` (component owns the state)
 * - Persisted: pass `persistKey` to sync collapsed state to localStorage
 * - Collapsed rail: pass `collapsedContent` to show a narrower icon-only view
 * - Mobile overlay: automatically activated under 768px viewport with focus trap
 *
 * @example Controlled usage
 * const [collapsed, setCollapsed] = useState(false)
 * <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed}>
 *   <Nav />
 * </Sidebar>
 *
 * @example Uncontrolled + persisted
 * <Sidebar defaultCollapsed={false} persistKey="app-sidebar-collapsed">
 *   <Nav />
 * </Sidebar>
 *
 * @example Collapsed rail with icons
 * <Sidebar collapsedContent={<IconRail />}>
 *   <FullNav />
 * </Sidebar>
 */

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useKeyPress } from '../../hooks/useKeyPress'
import { breakpoints } from '../../tokens/breakpoints'
import styles from './Sidebar.module.css'

// Derived from the breakpoint source of truth (#454) — do not hardcode.
const BREAKPOINT_MOBILE = breakpoints.px.md // 768 — below this = mobile
const BREAKPOINT_DESKTOP = breakpoints.px.lg // 1024 — at/above this = desktop

/**
 * Context published by <Sidebar> to its descendants (#391).
 *
 * Lets nav-item primitives (e.g. <SidebarNavItem>) read the live collapsed
 * state without consumers having to thread it through manually — which was
 * effectively impossible when the Sidebar owned the state internally
 * (`collapsible` + `persistKey`). Position is included so future descendants
 * (rail-edge tooltips, drawer chrome) can flip placement without prop drilling.
 *
 * Context value is `null` when read outside a <Sidebar> — descendants must
 * treat that as "no Sidebar parent, use my own props/defaults" (do NOT throw),
 * because <SidebarNavItem> is documented as standalone-usable too.
 */
export interface SidebarContextValue {
  collapsed: boolean
  position: 'left' | 'right'
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

/**
 * Read the live Sidebar context. Returns `null` when called outside a
 * <Sidebar> parent — see {@link SidebarContextValue}.
 */
export function useSidebarContext(): SidebarContextValue | null {
  return useContext(SidebarContext)
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  /** Position of the sidebar */
  position?: 'left' | 'right'
  /** Width when expanded (CSS length or number in px). Default: 16rem */
  width?: string | number
  /** Width when collapsed (CSS length or number in px). Default: 3.5rem (56px) */
  collapsedWidth?: string | number
  /** Enable the built-in collapse toggle button. Default: true */
  collapsible?: boolean
  /**
   * Visual variant (#372 — API parity with Header).
   *
   * - `default`: subtle brand-foam gradient tint on the base surface (the
   *   Sprint 10 brand-by-default behavior — gives every Sidebar a faint
   *   themed warmth).
   * - `flat`: pure surface background, no gradient. Use this when a custom
   *   product theme makes the brand-tinted default read as a mismatched
   *   patch, or when you want the pre-Sprint-10 plain look.
   *
   * The strong "branded rail" gradient is still available via the
   * internal `gradient` class (not exposed as a variant — applied through
   * the `className` escape hatch for marketing layouts).
   */
  variant?: 'default' | 'flat'
  /** Controlled collapsed state. Provide with `onCollapsedChange`. */
  collapsed?: boolean
  /** Callback fired when collapsed state changes. */
  onCollapsedChange?: (collapsed: boolean) => void
  /** Initial collapsed state for uncontrolled usage. Default: false */
  defaultCollapsed?: boolean
  /**
   * When provided, the collapsed state is persisted to localStorage under this key.
   * Only applies to uncontrolled usage (ignored if `collapsed` is provided).
   */
  persistKey?: string
  /**
   * Content rendered when the sidebar is collapsed (icon rail, compact nav, etc.).
   * If omitted, the sidebar collapses its width but keeps rendering `children`
   * (consumers can use CSS to hide labels, etc.).
   */
  collapsedContent?: React.ReactNode
  /** Controlled mobile-drawer open state (for <768px viewports). */
  mobileOpen?: boolean
  /** Callback fired when mobile open state changes. */
  onMobileOpenChange?: (open: boolean) => void
  /** Show a scrim/backdrop behind the mobile drawer. Default: true */
  overlay?: boolean
  /** Explicit id (for aria-controls wiring). Auto-generated if omitted. */
  id?: string
  /**
   * Accessible label for the navigation landmark. Uses the native
   * `aria-label` attribute (inherited from `HTMLAttributes`) — matches the
   * React-Aria / Radix convention. Default: "Sidebar navigation".
   */
  'aria-label'?: string
  /** Sidebar content (primary navigation, etc.). */
  children: React.ReactNode
  /** Additional CSS class on the outer `<aside>`. */
  className?: string
  /**
   * Inline styles merged onto the outer `<aside>`. The component sets
   * `width` and the `--sidebar-width` custom property on that element to
   * drive the collapse animation; those two keys win over the consumer's
   * `style` so the width contract stays intact. Every other style key
   * (background, position, border, etc.) passes straight through.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

type SidebarForwardRefComponent = React.ForwardRefExoticComponent<
  SidebarProps & React.RefAttributes<HTMLElement>
>

interface SidebarComponent extends SidebarForwardRefComponent {
  /** Default mobile breakpoint in px (below this, mobile drawer mode is active). */
  readonly mobileBreakpoint: number
  /** Default desktop breakpoint in px (above this, expanded mode is preferred). */
  readonly desktopBreakpoint: number
}

/**
 * Read the persisted collapsed state from localStorage, returning `null`
 * when no value is stored (so callers can distinguish "user has a stored
 * preference" from "fall back to SSR-safe default").
 *
 * MUST only be called from a client-side context (`useEffect`, event
 * handler, etc.) — calling this during render would make the first client
 * render diverge from SSR, triggering a React 19 hydration warning.
 */
function readPersistedRaw(key: string | undefined): boolean | null {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    return raw === '1' || raw === 'true'
  } catch {
    return null
  }
}

function writePersisted(key: string | undefined, value: boolean): void {
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* ignore storage errors (quota, disabled, etc.) */
  }
}

function toCssLength(value: string | number | undefined, fallback: string): string {
  if (value == null) return fallback
  return typeof value === 'number' ? `${value}px` : value
}

/**
 * Figure out the responsive mode for the current viewport.
 * - 'mobile'  (<768px): drawer behavior, hidden by default
 * - 'tablet'  (768-1024px): collapsed rail by default
 * - 'desktop' (>=1024px): expanded by default
 *
 * IMPORTANT: this reads `window.innerWidth` and is therefore client-only.
 * Never call it during the first render pass — it's safe inside `useEffect`
 * (which runs only on the client) but using it for `useState` initializers
 * causes SSR/CSR hydration mismatches. See `SSR_SAFE_DEFAULT_VIEWPORT` and
 * the post-hydration sync effect inside the component.
 */
type ViewportMode = 'mobile' | 'tablet' | 'desktop'
function resolveViewportMode(): ViewportMode {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < BREAKPOINT_MOBILE) return 'mobile'
  if (w < BREAKPOINT_DESKTOP) return 'tablet'
  return 'desktop'
}

// SSR-safe default for the FIRST render (server + first client paint).
// `useEffect` then syncs to the actual viewport, which may flip the class
// on the next paint. This is the only way to keep server-rendered HTML
// identical to the first client render and avoid React 19 hydration warnings.
// See issue #100.
const SSR_SAFE_DEFAULT_VIEWPORT: ViewportMode = 'desktop'

const SidebarBase = React.forwardRef<HTMLElement, SidebarProps>(
  function Sidebar(
    {
      position = 'left',
      width = '16rem',
      collapsedWidth = '3.5rem',
      collapsible = true,
      variant = 'default',
      collapsed,
      onCollapsedChange,
      defaultCollapsed,
      persistKey,
      collapsedContent,
      mobileOpen,
      onMobileOpenChange,
      overlay = true,
      id,
      'aria-label': ariaLabel = 'Sidebar navigation',
      children,
      className = '',
      style,
      ...rest
    },
    forwardedRef
  ) {
    const sidebarRef = useRef<HTMLElement>(null)
    const autoId = useId()
    const sidebarId = id ?? `sidebar-${autoId}`

    // Merge forwarded ref with internal ref (needed for focus trap).
    const setSidebarRef = (node: HTMLElement | null) => {
      sidebarRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    // Track whether consumer provided an explicit default so we can apply a
    // responsive tablet-default on first mount without clobbering intent.
    const hasExplicitDefault = defaultCollapsed !== undefined
    const isControlled = collapsed !== undefined
    // SSR-safe initial value: never read localStorage during render — that
    // would diverge from the server-rendered HTML and trigger a hydration
    // mismatch in Next.js App Router consumers (issue #100). The persisted
    // value is applied below in a `useEffect` that runs only on the client.
    const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState<boolean>(
      defaultCollapsed ?? false
    )
    const currentCollapsed = isControlled ? (collapsed as boolean) : uncontrolledCollapsed

    const setCollapsedState = useCallback(
      (next: boolean) => {
        if (!isControlled) {
          setUncontrolledCollapsed(next)
          writePersisted(persistKey, next)
        }
        onCollapsedChange?.(next)
      },
      [isControlled, onCollapsedChange, persistKey]
    )

    // One-shot post-hydration sync. Runs once after mount on the client.
    // Reconciles the SSR-safe default (defaultCollapsed ?? false) with two
    // client-only signals that we deliberately did NOT read at first render:
    //
    //   1. Persisted state in localStorage (per `persistKey`) — takes priority
    //      over the responsive default if a value exists.
    //   2. Responsive tablet default — when the consumer hasn't expressed an
    //      opinion (not controlled, no `defaultCollapsed`, no persisted value)
    //      and the viewport is tablet, start in rail mode.
    //
    // Keeping these client-only reads in `useEffect` (instead of useState
    // initializers) is what guarantees SSR + first client render produce
    // identical HTML — see issue #100.
    const hasAppliedResponsiveDefault = useRef(false)
    useEffect(() => {
      if (hasAppliedResponsiveDefault.current) return
      hasAppliedResponsiveDefault.current = true
      if (isControlled) return

      // 1. Persisted state wins if present.
      const persisted = readPersistedRaw(persistKey)
      if (persisted !== null) {
        setUncontrolledCollapsed(persisted)
        return
      }

      // 2. Otherwise, apply the responsive tablet default — but only if the
      //    consumer didn't pin an explicit `defaultCollapsed`.
      if (hasExplicitDefault) return
      const mode = resolveViewportMode()
      if (mode === 'tablet') {
        setUncontrolledCollapsed(true)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const [internalMobileOpen, setInternalMobileOpen] = useState(false)
    const isMobileOpen = mobileOpen !== undefined ? mobileOpen : internalMobileOpen
    const setIsMobileOpen = useCallback(
      (open: boolean) => {
        if (onMobileOpenChange) onMobileOpenChange(open)
        else setInternalMobileOpen(open)
      },
      [onMobileOpenChange]
    )

    // SSR-safe initial value (`'desktop'`) — see SSR_SAFE_DEFAULT_VIEWPORT.
    // The post-mount effect immediately syncs to the real viewport, which
    // may flip the `mobile` class on the next paint. This keeps the very
    // first client render identical to the server-rendered HTML, which is
    // what React 19 expects (issue #100).
    const [viewport, setViewport] = useState<ViewportMode>(SSR_SAFE_DEFAULT_VIEWPORT)
    useEffect(() => {
      if (typeof window === 'undefined') return

      let rafId: number | null = null
      const update = () => {
        rafId = null
        setViewport(resolveViewportMode())
      }
      const onResize = () => {
        if (rafId != null) return
        rafId = window.requestAnimationFrame(update)
      }

      window.addEventListener('resize', onResize)
      // Sync to the real viewport on the next paint after hydration. This
      // is the deliberate flip from the SSR-safe default — accept the brief
      // mobile-vs-desktop visual flash to keep hydration warning-free.
      update()

      return () => {
        window.removeEventListener('resize', onResize)
        if (rafId != null) window.cancelAnimationFrame(rafId)
      }
    }, [])

    const isMobile = viewport === 'mobile'

    useFocusTrap(sidebarRef, isMobile && isMobileOpen)

    useKeyPress(
      'Escape',
      () => {
        if (isMobile) setIsMobileOpen(false)
      },
      isMobile && isMobileOpen
    )

    useEffect(() => {
      if (!(isMobile && isMobileOpen && overlay)) return
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }, [isMobile, isMobileOpen, overlay])

    const toggleCollapsed = useCallback(() => {
      setCollapsedState(!currentCollapsed)
    }, [currentCollapsed, setCollapsedState])

    const expandedWidth = toCssLength(width, '16rem')
    const collapsedWidthCss = toCssLength(collapsedWidth, '3.5rem')
    const effectiveWidth = currentCollapsed && !isMobile ? collapsedWidthCss : expandedWidth

    const showCollapsedRail = currentCollapsed && !isMobile && collapsedContent != null

    const isRailMode = currentCollapsed && !isMobile
    const sidebarClasses = [
      styles.sidebar,
      styles[position],
      isRailMode ? styles.collapsed : '',
      isMobile ? styles.mobile : '',
      isMobile && isMobileOpen ? styles.mobileOpen : '',
      // #372 — flat opt-out for the Sprint 10 brand-foam gradient default.
      // Mirrors Header's `variant="flat"` API.
      variant === 'flat' ? styles.flat : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // On mobile, if not open, the aside is visually hidden but remains in the
    // DOM so transitions work. aria-hidden reflects this for AT.
    const hiddenOnMobile = isMobile && !isMobileOpen

    // #391 — publish the live collapsed (+ position) state to descendants
    // so SidebarNavItem can render in icon-rail mode without consumer wiring.
    // Memoize to keep referential stability across renders (avoids cascading
    // re-renders in deeply nested nav trees).
    const contextValue = useMemo<SidebarContextValue>(
      () => ({ collapsed: isRailMode, position }),
      [isRailMode, position],
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        {/* Mobile backdrop / scrim */}
        {isMobile && isMobileOpen && overlay && (
          <div
            className={styles.overlay}
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
            data-sidebar-overlay
          />
        )}

        {/* Sidebar landmark */}
        <aside
          ref={setSidebarRef}
          // Consumer escape hatch — `data-*`, event handlers, etc. Spread
          // BEFORE the component's own attributes so id, role, aria-*, the
          // data-* state flags, className, and style win on conflict.
          {...rest}
          id={sidebarId}
          className={sidebarClasses}
          role="navigation"
          aria-label={ariaLabel}
          aria-hidden={hiddenOnMobile || undefined}
          aria-modal={isMobile && isMobileOpen ? 'true' : undefined}
          data-collapsed={isRailMode ? 'true' : 'false'}
          data-mobile={isMobile ? 'true' : 'false'}
          data-mobile-open={isMobile && isMobileOpen ? 'true' : 'false'}
          style={{
            // Consumer style first; the width contract is layered on top so
            // `width` + `--sidebar-width` (which drive the collapse animation)
            // always win. Other consumer keys pass through.
            ...style,
            width: effectiveWidth,
            // expose width as a custom property so <AppShell> / consumers can
            // coordinate main content reflow without prop drilling
            ['--sidebar-width' as string]: effectiveWidth,
          }}
        >
          <div className={styles.content}>
            {showCollapsedRail ? collapsedContent : children}
          </div>

          {collapsible && !isMobile && (
            <button
              type="button"
              className={styles.collapseButton}
              onClick={toggleCollapsed}
              aria-label={currentCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!currentCollapsed}
              aria-controls={sidebarId}
              data-sidebar-toggle
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d={
                    position === 'left'
                      ? currentCollapsed
                        ? 'M8 5l5 5-5 5'
                        : 'M12 5l-5 5 5 5'
                      : currentCollapsed
                      ? 'M12 5l-5 5 5 5'
                      : 'M8 5l5 5-5 5'
                  }
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </aside>
      </SidebarContext.Provider>
    )
  }
)

export const Sidebar: SidebarComponent = Object.assign(SidebarBase, {
  mobileBreakpoint: BREAKPOINT_MOBILE,
  desktopBreakpoint: BREAKPOINT_DESKTOP,
} as const)

// Set AFTER Object.assign so the compound attachment can't drop it.
Sidebar.displayName = 'Sidebar'
