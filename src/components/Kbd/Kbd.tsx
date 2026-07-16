'use client'

/**
 * Kbd Component
 *
 * A platform-aware keyboard-shortcut pill. Accepts either raw children
 * (escape hatch) or a semantic `shortcut` prop ("meta+k") that is
 * rendered as ⌘K on macOS or Ctrl+K elsewhere.
 *
 * SSR-safe: renders the non-Mac version on the server, upgrades to the
 * detected platform after mount.
 *
 * @example
 * <Kbd>⌘K</Kbd>
 * <Kbd shortcut="meta+k" />
 * <Kbd shortcut="shift+alt+f" size="md" />
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './Kbd.module.css'
import { parseShortcut, isMac } from './shortcut-parser'

export interface KbdProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Raw display content (escape hatch — takes precedence over `shortcut`). */
  children?: React.ReactNode
  /** Semantic shortcut like "meta+k" — auto-rendered with platform-aware glyphs. */
  shortcut?: string
  /** Visual size. Default 'sm'. */
  size?: 'xs' | 'sm' | 'md'
  /**
   * Render as the single child element, merging Kbd styling onto it
   * (Layer-7 composition, #424). Pass a single element as `children`; the
   * `styles.kbd` class lands on it. `shortcut` is not auto-rendered under
   * `asChild` — supply the display content yourself.
   */
  asChild?: boolean
}

export const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ children, shortcut, size = 'sm', asChild = false, className, ...rest }, ref) => {
    // SSR-safe platform detection: render non-Mac on server, upgrade after mount.
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true), [])
    const platformIsMac = mounted ? isMac() : false

    const display =
      children ?? (shortcut ? parseShortcut(shortcut, platformIsMac) : null)

    const sizeClass = styles[`size-${size}`] ?? styles['size-sm']
    const combined = [styles.kbd, sizeClass, className].filter(Boolean).join(' ')

    const Comp = asChild ? Slot : 'kbd'
    return (
      <Comp ref={ref} className={combined} {...rest}>
        {display}
      </Comp>
    )
  },
)

Kbd.displayName = 'Kbd'
