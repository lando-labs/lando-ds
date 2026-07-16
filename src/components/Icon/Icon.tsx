/**
 * Icon Component
 *
 * Renders icons with consistent sizing and styling. Three input shapes are
 * supported — pick whichever matches the calling context:
 *
 *   1. Children — pass any Lucide icon (or other SVG) as a child element:
 *        <Icon size="md"><Search /></Icon>
 *
 *   2. `icon` prop — pass the component reference directly. Useful for
 *      polymorphism over icon vars without JSX gymnastics:
 *        <Icon size="md" icon={Search} />
 *
 *   3. `name` prop (#376) — pass a string key from the curated registry.
 *      Lets serialized nav/menu/command-palette configs reference icons by
 *      string without consumers needing to import lucide:
 *        <Icon size="md" name="search" />
 *      Unknown names render `null` and warn once in dev.
 *
 * @see https://lucide.dev for available icons (use children or `icon` prop)
 * @see ./registry.ts for the curated `name` map
 */

import React from 'react'
import { getIcon, type CuratedIconName } from './registry'
import styles from './Icon.module.css'

// `LucideIcon` is structurally a forward-ref component — we don't need to
// import the type to accept it as a prop; `React.ComponentType<…>` covers it
// and keeps this module free of a lucide-react TYPE dependency at runtime.
type IconLike = React.ComponentType<{
  size?: number | string
  strokeWidth?: number
  color?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Icon component instance (e.g. <Search /> from lucide-react) */
  children?: React.ReactNode
  /**
   * Icon component reference. Equivalent to passing the component as a
   * single child but more ergonomic when you already have a component
   * variable: `<Icon icon={iconVar} />`.
   *
   * Resolution order: `name` > `icon` > `children`. Whichever wins, the
   * other two are ignored.
   */
  icon?: IconLike
  /**
   * String name resolved against the curated `ICON_REGISTRY`. Useful for
   * nav/menu/command-palette configs that serialize icons as plain
   * strings. Unknown names render `null` (no fallback chip) and warn once
   * in dev. Accepts canonical kebab-case (`"message-square"`) and the
   * lucide PascalCase spelling (`"MessageSquare"`).
   *
   * Type-safety: `name` accepts the literal union `CuratedIconName | string`
   * so typed configs get autocomplete + compile-time misspelling errors,
   * while untyped string values (e.g. from JSON.parse) still compile.
   */
  name?: CuratedIconName | (string & {})
  /** Icon size - maps to design token pixel values */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Color - CSS variable or color value */
  color?: string
  /** Stroke width (default: 2) */
  strokeWidth?: number
  /** Accessible label for screen readers */
  'aria-label'?: string
  /** Additional class names */
  className?: string
  /** Enable spinning animation (for loaders) */
  spinning?: boolean
  /** Enable subtle pulse animation */
  pulsing?: boolean
  /** Click handler */
  onClick?: React.MouseEventHandler<HTMLSpanElement>
  /** Inline styles */
  style?: React.CSSProperties
}

const sizeMap: Record<string, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
}

export const Icon = React.forwardRef<HTMLSpanElement, IconProps>(
  (
    {
      children,
      icon,
      name,
      size = 'md',
      color,
      strokeWidth = 2,
      className = '',
      'aria-label': ariaLabel,
      spinning = false,
      pulsing = false,
      onClick,
      style,
      ...rest
    },
    ref
  ) => {
    const iconSize = sizeMap[size]

    // Resolution priority: name > icon > children. Picking `name` first
    // means consumers can override via the typed string API even when the
    // surrounding code passes a generic `icon` fallback prop.
    let resolvedChild: React.ReactNode = children
    if (name) {
      const Component = getIcon(name)
      if (Component) {
        resolvedChild = <Component />
      } else {
        // Unknown name — `getIcon` already warned in dev. Render nothing
        // for the icon slot but keep the wrapper so onClick handlers /
        // layout stay attached.
        resolvedChild = null
      }
    } else if (icon) {
      const Component = icon
      resolvedChild = <Component />
    }

    const wrapperClasses = [
      styles.icon,
      spinning ? styles.spinning : '',
      pulsing ? styles.pulsing : '',
      onClick ? styles.interactive : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const wrapperStyle: React.CSSProperties = {
      width: iconSize,
      height: iconSize,
      ...(color ? { color } : {}),
      ...style,
    }

    // Clone child to inject size/strokeWidth/color if it's a valid React element
    // (Lucide icons accept these as props)
    const iconChild = React.isValidElement(resolvedChild)
      ? React.cloneElement(
          resolvedChild as React.ReactElement<Record<string, unknown>>,
          {
            size: iconSize,
            strokeWidth,
            ...(color ? { color } : {}),
            'aria-hidden': ariaLabel ? undefined : true,
          },
        )
      : resolvedChild

    return (
      <span
        ref={ref}
        // Consumer escape hatch spread BEFORE the internal role / aria-label /
        // onClick so the component's dedicated props stay authoritative.
        {...rest}
        className={wrapperClasses}
        style={wrapperStyle}
        role={ariaLabel ? 'img' : undefined}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {iconChild}
      </span>
    )
  }
)

Icon.displayName = 'Icon'

// ---------------------------------------------------------------------------
// Legacy IconName type - kept for reference during migration only
// @deprecated Use lucide-react named imports directly
// ---------------------------------------------------------------------------

/** @deprecated Import icons from 'lucide-react' directly instead */
export type IconName = string
