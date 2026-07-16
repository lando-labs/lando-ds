'use client'

/**
 * Header Component
 *
 * A responsive header with logo, navigation, and actions area.
 * Supports sticky positioning, transparent background, and mobile hamburger menu.
 *
 * @example
 * <Header
 *   logo={<Logo />}
 *   navigation={<Nav />}
 *   actions={<UserMenu />}
 *   sticky
 * />
 *
 * @example
 * // Full-bleed, in-app shell (removes the centered 1280px band)
 * <Header maxWidth="none" actions={<UserMenu />} />
 *
 * @example
 * // Custom content width inside full-bleed background
 * <Header maxWidth={1440} logo={<Logo />} actions={<UserMenu />} />
 */

import React, { useState, useEffect, useRef } from 'react'
import { safeHref } from '../../utils/safeHref'
import styles from './Header.module.css'

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Logo element (left side) */
  logo?: React.ReactNode
  /** Navigation elements (center) */
  navigation?: React.ReactNode
  /** Action elements (right side - search, notifications, user menu) */
  actions?: React.ReactNode
  /** Sticky header that stays at top on scroll */
  sticky?: boolean
  /** Transparent background (for hero sections) */
  transparent?: boolean
  /**
   * Visual variant.
   *
   * - `default`: subtle brand-foam → surface gradient on the left edge
   *   (new in Sprint 10 — gives the Header a faint Lando Labs warmth).
   * - `flat`: pure surface background, no gradient. Use this when you
   *   want the pre-Sprint-10 flat Header look or when the gradient
   *   conflicts with custom branding in the logo slot.
   *
   * The strong "hero" brand gradient is still available via the internal
   * `gradient` class (not exposed as a variant here — it's meant for
   * marketing layouts and applied through the className escape hatch).
   */
  variant?: 'default' | 'flat'
  /**
   * Maximum width of the inner content area.
   *
   * - Omitted (default): 1280px centered band — best for marketing sites.
   * - Number: applied as pixels (e.g. `1440` → `1440px`).
   * - String: applied as-is. Pass `"none"` or `"100%"` to make the
   *   Header full-bleed (best for in-app shells wider than 1280px).
   *
   * The outer `<header>` (sticky background) always spans the full viewport;
   * only the inner content container respects this value.
   */
  maxWidth?: string | number
  /**
   * Skip-link target (WCAG 2.4.1 "Bypass Blocks"). When provided, a visually
   * hidden "Skip to content" link is rendered as the first focusable element
   * in the header. Keyboard users pressing Tab land on it first and can jump
   * past the header/nav to the main content.
   *
   * Pass a fragment selector like `"#main"` pointing at your main landmark.
   * Omit to disable the skip link entirely.
   *
   * Trust boundary (#325): sanitized at render via `safeHref` — a `javascript:` /
   * `data:` value collapses to `#`. The intended shape is a `#fragment`.
   *
   * @example
   * <Header skipLinkHref="#main" logo={<Logo />} />
   * <main id="main" tabIndex={-1}>...</main>
   */
  skipLinkHref?: string
  /** Visible text for the skip link. Default: "Skip to content" */
  skipLinkLabel?: string
  /** Additional CSS class merged onto the outer `<header>` root. */
  className?: string
  /**
   * Inline styles applied to the outer `<header>` root. The component sets no
   * inline style on `<header>` (the `maxWidth` prop styles the inner content
   * container, not the root), so consumer keys apply directly.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

export const Header = React.forwardRef<HTMLElement, HeaderProps>(
  (
    {
      logo,
      navigation,
      actions,
      sticky = false,
      transparent = false,
      variant = 'default',
      maxWidth,
      skipLinkHref,
      skipLinkLabel = 'Skip to content',
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  // Merge forwarded ref with internal ref (needed for click-outside handler)
  const setHeaderRef = (node: HTMLElement | null) => {
    headerRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  // Track scroll for sticky header shadow
  useEffect(() => {
    if (!sticky) return

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Check initial state

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [sticky])

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!isMobileMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    // Add listener with slight delay
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMobileMenuOpen])

  // Close mobile menu on Escape
  useEffect(() => {
    if (!isMobileMenuOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileMenuOpen])

  const headerClasses = [
    styles.header,
    sticky ? styles.sticky : '',
    transparent ? styles.transparent : '',
    variant === 'flat' ? styles.flat : '',
    isScrolled ? styles.scrolled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // Resolve maxWidth to a valid CSS value (if provided)
  const resolvedMaxWidth =
    typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth

  // When maxWidth is explicitly overridden, also disable the default
  // centering margin so a value like "none" truly produces full-bleed.
  const containerStyle: React.CSSProperties | undefined =
    resolvedMaxWidth !== undefined
      ? {
          maxWidth: resolvedMaxWidth,
          marginLeft: resolvedMaxWidth === 'none' ? 0 : undefined,
          marginRight: resolvedMaxWidth === 'none' ? 0 : undefined,
        }
      : undefined

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Gate the mobile menu on actual navigation presence. When there is no
  // navigation slot there is no hamburger and no slide-down menu — so the
  // actions slot must remain visible at all viewports instead of being
  // hidden by the mobile CSS rule (which would lock consumers out below
  // 768px when only `actions` is provided). See issue #36.
  const hasNavigation = Boolean(navigation)
  const containerClasses = [
    styles.container,
    hasNavigation ? styles.hasNavigation : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <header
      ref={setHeaderRef}
      // Consumer escape hatch — `data-*`, `id`, event handlers, etc. Spread
      // BEFORE the component's own className/style so they win on conflict.
      {...rest}
      className={headerClasses}
      style={style}
    >
      {/*
        Skip link (WCAG 2.4.1). Rendered as the first focusable element so
        keyboard users pressing Tab on page load can jump past nav/actions
        straight to the main content. Visually hidden until focused.
      */}
      {skipLinkHref && (
        <a href={safeHref(skipLinkHref)} className={styles.skipLink}>
          {skipLinkLabel}
        </a>
      )}

      <div className={containerClasses} style={containerStyle}>
        {/* Logo Section */}
        {logo && <div className={styles.logo}>{logo}</div>}

        {/* Desktop Navigation */}
        {hasNavigation && (
          <nav className={styles.navigation}>{navigation}</nav>
        )}

        {/* Actions Section */}
        {actions && <div className={styles.actions}>{actions}</div>}

        {/* Mobile Menu Button — only when there is a navigation slot to hide */}
        {hasNavigation && (
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className={styles.hamburger}>
              <span className={styles.hamburgerLine}></span>
              <span className={styles.hamburgerLine}></span>
              <span className={styles.hamburgerLine}></span>
            </span>
          </button>
        )}
      </div>

      {/* Mobile Menu */}
      {hasNavigation && isMobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <nav className={styles.mobileNavigation}>{navigation}</nav>
          {actions && <div className={styles.mobileActions}>{actions}</div>}
        </div>
      )}
    </header>
  )
  }
)

Header.displayName = 'Header'
