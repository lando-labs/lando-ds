/**
 * Heading Component
 *
 * Semantic heading component with independent control over semantic level and visual size.
 * Ensures accessibility through proper HTML heading hierarchy while allowing design flexibility.
 *
 * **Page title sizing (DS-MOD-1)**: For app-chrome contexts (dashboards,
 * settings, detail pages), use `size="lg"` (31px) or `size="xl"` (39px).
 * Reserve `size="2xl"` (49px) for marketing hero blocks on landing pages —
 * it will feel oversized against a Header/Sidebar layout. See
 * `reference/components.md` → "Typography: semantic HTML + page-title sizing"
 * for the full decision tree.
 *
 * @example
 * // App page title
 * <Heading level={1} size="lg">Account Settings</Heading>
 * // Section header within a page
 * <Heading level={2} size="md">Billing</Heading>
 * // Small-uppercase section label (no inline textTransform needed)
 * <Heading level={3} variant="section">Account</Heading>
 * // Marketing hero (landing page only)
 * <Heading level={1} size="2xl">Tools for Intentional Living</Heading>
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './Heading.module.css'

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Semantic heading level (h1-h6) for accessibility and document structure */
  level?: 1 | 2 | 3 | 4 | 5 | 6
  /**
   * Visual treatment, independent of the semantic level.
   * - `default` — standard display heading sized by `size`.
   * - `section` — small, uppercase, letter-spaced "section header"
   *   label. Use instead of hand-rolling `textTransform: 'uppercase'`
   *   on a Heading. `size` is ignored when `variant="section"`.
   */
  variant?: 'default' | 'section'
  /**
   * Visual size, independent of the semantic level.
   * Ignored when `variant="section"` (the section variant is
   * intentionally a fixed small size).
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Font weight */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  /** Text color (CSS custom property or color value) */
  color?: string
  /** Additional CSS class name */
  className?: string
  /**
   * Render as the single child element, merging the Heading's visual
   * styling onto it (Layer-7 composition, #424). `asChild` is additive and
   * independent of `level`: the child element replaces the `h{level}` tag,
   * so choose an element with the semantics you want. The `styles.heading`
   * + size/weight classes and merged `style` land on the rendered child.
   */
  asChild?: boolean
  /** Heading content */
  children: React.ReactNode
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  (
    {
      level = 2,
      variant = 'default',
      size,
      weight = 'semibold',
      color,
      className = '',
      asChild = false,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const Tag = asChild
      ? Slot
      : (`h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6')

    // Smart defaults: map semantic level to sensible visual size if not specified
    const defaultSizeMap = {
      1: '2xl',
      2: 'xl',
      3: 'lg',
      4: 'md',
      5: 'sm',
      6: 'xs',
    } as const

    const isSection = variant === 'section'
    const finalSize = size || defaultSizeMap[level]

    // The section variant carries its own fixed (small) sizing — skip the
    // size-* class so it does not compete with the variant's font-size.
    const headingClasses = [
      styles.heading,
      isSection ? styles['variant-section'] : styles[`size-${finalSize}`],
      styles[`weight-${weight}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const headingStyle = {
      ...style,
      ...(color ? { color } : {}),
    }

    return (
      <Tag
        ref={ref}
        className={headingClasses}
        style={headingStyle}
        {...props}
      >
        {children}
      </Tag>
    )
  }
)

Heading.displayName = 'Heading'
