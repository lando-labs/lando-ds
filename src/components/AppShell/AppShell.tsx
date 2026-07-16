'use client'

/**
 * AppShell Component
 *
 * Composable application shell: header + optional sidebar + main + optional footer.
 *
 * Layout contract:
 * - CSS grid, 3 rows (header / body / footer) and 2 columns (sidebar / main)
 * - Header is sticky to the top of the body row
 * - Footer sits at the bottom of the shell
 * - Sidebar is a column that reflows when collapsed (width change is smooth)
 * - On mobile (<768px) the sidebar upgrades to an overlay drawer
 *
 * Consumers can override layout CSS via these custom properties on the outer element:
 *   --app-shell-header-height
 *   --app-shell-footer-height
 *   --app-shell-max-width
 *   --app-shell-gap
 *   --app-shell-content-padding
 *   --app-shell-content-max-width
 *
 * The `contentPadding` and `contentMaxWidth` props set the last two vars
 * inline on the shell element, so consumers can lean on props, CSS overrides,
 * or both. Prop wins at the React layer; CSS class overrides win at the
 * cascade layer.
 *
 * Keyboard shortcuts:
 *   Cmd/Ctrl + B  → toggle sidebar collapsed state (configurable via `sidebarShortcut`)
 *
 * @example Basic usage
 * <AppShell
 *   header={<Header logo={<Logo />} />}
 *   sidebar={<Nav />}
 *   footer={<Footer copyright="© 2026 Lando Labs" />}
 * >
 *   <h1>Dashboard</h1>
 * </AppShell>
 *
 * @example Controlled sidebar
 * const [collapsed, setCollapsed] = useState(false)
 * <AppShell
 *   header={<Header />}
 *   sidebar={<Nav />}
 *   sidebarCollapsed={collapsed}
 *   onSidebarCollapsedChange={setCollapsed}
 * >
 *   <main>Content</main>
 * </AppShell>
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { Sidebar } from '../Sidebar'
import styles from './AppShell.module.css'

export type AppShellSpacingToken =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'

export type AppShellMaxWidth =
  | 'none'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | (string & {})

const CONTENT_PADDING_MAP: Record<AppShellSpacingToken, string> = {
  none: '0',
  xs: 'var(--spacing-xs)',
  sm: 'var(--spacing-sm)',
  md: 'var(--spacing-md)',
  lg: 'var(--spacing-lg)',
  xl: 'var(--spacing-xl)',
  '2xl': 'var(--spacing-2xl)',
}

const CONTENT_MAX_WIDTH_MAP: Record<
  Exclude<AppShellMaxWidth, string & {}>,
  string
> = {
  none: 'none',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1440px',
}

/**
 * The set of semantic-token keys we treat as "known". Anything else is
 * assumed to be a raw CSS length and passed through unchanged.
 */
const KNOWN_MAX_WIDTH_TOKENS = new Set<string>([
  'none',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
])

function resolveContentPadding(value: AppShellSpacingToken): string {
  return CONTENT_PADDING_MAP[value]
}

function resolveContentMaxWidth(value: AppShellMaxWidth): string {
  if (KNOWN_MAX_WIDTH_TOKENS.has(value)) {
    return CONTENT_MAX_WIDTH_MAP[value as Exclude<AppShellMaxWidth, string & {}>]
  }
  return value as string
}

/**
 * Native attributes accepted on the outer shell `<div>`. `children` is
 * redefined below as the required main-content node; `style` is restated for
 * docs (it merges with the component's `--app-shell-*` custom properties).
 */
type AppShellRootAttributes = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
>

export interface AppShellProps extends AppShellRootAttributes {
  /** Content for the top header row (typically <Header>). */
  header?: React.ReactNode
  /**
   * Sidebar content. Accepts either:
   *  - A <Sidebar> element (AppShell will clone it and wire collapse props), OR
   *  - Any other node (rendered inside a default Sidebar with collapse wiring)
   */
  sidebar?: React.ReactNode
  /** Content for the bottom footer row (typically <Footer>). */
  footer?: React.ReactNode
  /** Main content — rendered inside the <main> element. */
  children: React.ReactNode
  /**
   * Controlled sidebar collapsed state. Forwarded to Sidebar.
   * If omitted, AppShell uses its own internal state (starting uncollapsed).
   */
  sidebarCollapsed?: boolean
  /** Callback fired when sidebar collapsed state changes. */
  onSidebarCollapsedChange?: (collapsed: boolean) => void
  /** Default collapsed state for uncontrolled usage. Default: false */
  defaultSidebarCollapsed?: boolean
  /**
   * Persist collapsed state to localStorage under this key (uncontrolled only).
   */
  sidebarPersistKey?: string
  /**
   * Keyboard shortcut for toggling sidebar. Format: "meta+b" / "ctrl+b" / etc.
   * Set to `false` to disable. Default: "meta+b" (also binds Ctrl+B for non-Mac).
   */
  sidebarShortcut?: string | false
  /** Controlled mobile drawer open state. */
  mobileSidebarOpen?: boolean
  /** Callback fired when mobile drawer state changes. */
  onMobileSidebarOpenChange?: (open: boolean) => void
  /** Extra class on the outer shell element. */
  className?: string
  /**
   * Inline styles merged onto the outer shell `<div>`. Merged AFTER the
   * component's own `--app-shell-content-padding` / `--app-shell-content-max-width`
   * custom properties, so a consumer can override those vars inline if needed.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
  /**
   * Accessible label for the main landmark. Default: "Main content".
   */
  mainAriaLabel?: string
  /** Additional props passed to the <main> element (e.g. id, data-*). */
  mainProps?: React.HTMLAttributes<HTMLElement>
  /**
   * Padding applied to the main content area. Accepts a semantic spacing
   * token or `'none'`. Can also be overridden at runtime via the
   * `--app-shell-content-padding` CSS variable on the shell element.
   *
   * Leave unset to use the CSS default (`var(--spacing-md)`) — this is
   * the behavior we want most consumers to inherit so they can delete
   * their own `.app-content { padding: … }` blocks.
   *
   * @default (CSS fallback: `var(--spacing-md)`)
   */
  contentPadding?: AppShellSpacingToken
  /**
   * Max width applied to the main content area. `'none'` preserves the
   * original full-width behavior. Semantic tokens map to breakpoint-aligned
   * widths:
   *
   * - `'sm'` → 640px
   * - `'md'` → 768px
   * - `'lg'` → 1024px
   * - `'xl'` → 1280px
   * - `'2xl'` → 1440px
   *
   * Any other string is used as a raw CSS length (e.g. `"800px"`, `"75ch"`).
   * Can also be overridden at runtime via `--app-shell-content-max-width`.
   *
   * When set (not `'none'`), the main content centers horizontally
   * inside the body row.
   *
   * @default 'none'
   */
  contentMaxWidth?: AppShellMaxWidth
}

interface ParsedShortcut {
  meta: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
  key: string
}

function parseShortcut(shortcut: string): ParsedShortcut | null {
  const parts = shortcut.toLowerCase().split('+').map((p) => p.trim())
  if (parts.length === 0) return null
  const key = parts.pop()!
  return {
    meta: parts.includes('meta') || parts.includes('cmd'),
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    alt: parts.includes('alt') || parts.includes('option'),
    shift: parts.includes('shift'),
    key,
  }
}

function matchesShortcut(e: KeyboardEvent, s: ParsedShortcut): boolean {
  const key = e.key.toLowerCase()
  if (key !== s.key) return false
  // meta OR ctrl — we treat them as interchangeable for cross-platform ergonomics.
  if (s.meta || s.ctrl) {
    if (!(e.metaKey || e.ctrlKey)) return false
  } else {
    if (e.metaKey || e.ctrlKey) return false
  }
  if (s.alt !== e.altKey) return false
  if (s.shift !== e.shiftKey) return false
  return true
}

/**
 * Detect whether a node is a <Sidebar> element we should clone with wiring.
 * Uses React's element.type check — works in both dev and prod builds.
 */
function isSidebarElement(
  node: React.ReactNode
): node is React.ReactElement<React.ComponentProps<typeof Sidebar>> {
  return (
    React.isValidElement(node) &&
    (node.type as unknown) === (Sidebar as unknown)
  )
}

export const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  (
    {
      header,
      sidebar,
      footer,
      children,
      sidebarCollapsed,
      onSidebarCollapsedChange,
      defaultSidebarCollapsed = false,
      sidebarPersistKey,
      sidebarShortcut = 'meta+b',
      mobileSidebarOpen,
      onMobileSidebarOpenChange,
      className = '',
      style,
      mainAriaLabel = 'Main content',
      mainProps,
      contentPadding,
      contentMaxWidth,
      ...rest
    },
    ref
  ) => {
  const isControlled = sidebarCollapsed !== undefined
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState<boolean>(
    () => {
      if (isControlled) return defaultSidebarCollapsed
      // Mirror Sidebar's persistence for consistent initial state.
      if (sidebarPersistKey && typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(sidebarPersistKey)
          if (raw !== null) return raw === '1' || raw === 'true'
        } catch {
          /* ignore */
        }
      }
      return defaultSidebarCollapsed
    }
  )
  const currentCollapsed = isControlled
    ? (sidebarCollapsed as boolean)
    : uncontrolledCollapsed

  const setCollapsed = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledCollapsed(next)
        if (sidebarPersistKey && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(sidebarPersistKey, next ? '1' : '0')
          } catch {
            /* ignore */
          }
        }
      }
      onSidebarCollapsedChange?.(next)
    },
    [isControlled, onSidebarCollapsedChange, sidebarPersistKey]
  )

  const [internalMobileOpen, setInternalMobileOpen] = useState(false)
  const currentMobileOpen =
    mobileSidebarOpen !== undefined ? mobileSidebarOpen : internalMobileOpen
  const setMobileOpen = useCallback(
    (open: boolean) => {
      if (onMobileSidebarOpenChange) onMobileSidebarOpenChange(open)
      else setInternalMobileOpen(open)
    },
    [onMobileSidebarOpenChange]
  )

  const parsedShortcut = useMemo(
    () => (sidebarShortcut === false ? null : parseShortcut(sidebarShortcut)),
    [sidebarShortcut]
  )

  useEffect(() => {
    if (!parsedShortcut || typeof window === 'undefined') return

    const handler = (e: KeyboardEvent) => {
      if (!matchesShortcut(e, parsedShortcut)) return
      // Skip if user is typing in a form field.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return
        }
      }
      e.preventDefault()
      setCollapsed(!currentCollapsed)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [parsedShortcut, currentCollapsed, setCollapsed])

  const autoSidebarId = useId()
  const sidebarId = `app-shell-sidebar-${autoSidebarId}`

  const wiredSidebar = useMemo(() => {
    if (sidebar == null) return null

    if (isSidebarElement(sidebar)) {
      // Caller passed a <Sidebar>; merge our controlled props onto theirs.
      const existing = sidebar.props
      return React.cloneElement(sidebar, {
        id: existing.id ?? sidebarId,
        collapsed:
          existing.collapsed !== undefined ? existing.collapsed : currentCollapsed,
        onCollapsedChange: (next: boolean) => {
          existing.onCollapsedChange?.(next)
          setCollapsed(next)
        },
        mobileOpen:
          existing.mobileOpen !== undefined
            ? existing.mobileOpen
            : currentMobileOpen,
        onMobileOpenChange: (open: boolean) => {
          existing.onMobileOpenChange?.(open)
          setMobileOpen(open)
        },
      })
    }

    // Arbitrary sidebar content: wrap in default <Sidebar>.
    return (
      <Sidebar
        id={sidebarId}
        collapsed={currentCollapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={currentMobileOpen}
        onMobileOpenChange={setMobileOpen}
      >
        {sidebar}
      </Sidebar>
    )
  }, [sidebar, sidebarId, currentCollapsed, setCollapsed, currentMobileOpen, setMobileOpen])

  const shellClasses = [
    styles.shell,
    wiredSidebar ? styles.hasSidebar : styles.noSidebar,
    currentCollapsed ? styles.sidebarCollapsed : '',
    contentMaxWidth !== undefined && contentMaxWidth !== 'none'
      ? styles.hasContentMaxWidth
      : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const shellStyle = {
    // Consumer style first; the component's own custom-property vars are
    // layered on top so an explicit `contentPadding` / `contentMaxWidth`
    // prop wins over a same-named inline var (the prop is the first-class
    // API; the inline var is the escape hatch). Any other consumer style
    // key — width, background, position, etc. — passes straight through.
    ...style,
    ...(contentPadding !== undefined && {
      '--app-shell-content-padding': resolveContentPadding(contentPadding),
    }),
    ...(contentMaxWidth !== undefined && {
      '--app-shell-content-max-width': resolveContentMaxWidth(contentMaxWidth),
    }),
  } as React.CSSProperties

  return (
    <div
      ref={ref}
      // Consumer escape hatch — `data-*`, `id`, event handlers, etc. Spread
      // BEFORE the component's own attributes so AppShell's structural props
      // (className, data-sidebar-collapsed, style) win on conflict.
      {...rest}
      className={shellClasses}
      data-sidebar-collapsed={currentCollapsed ? 'true' : 'false'}
      style={shellStyle}
    >
      {header && (
        <div className={styles.header} role="banner">
          {header}
        </div>
      )}

      <div className={styles.body}>
        {wiredSidebar}
        <main
          className={styles.main}
          aria-label={mainAriaLabel}
          {...mainProps}
        >
          {children}
        </main>
      </div>

      {footer && (
        <div className={styles.footer} role="contentinfo">
          {footer}
        </div>
      )}
    </div>
  )
  }
)

AppShell.displayName = 'AppShell'
