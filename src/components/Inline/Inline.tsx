/**
 * Inline Component
 *
 * Horizontal flex layout primitive with consistent spacing.
 * Provides clean, declarative horizontal layouts using design tokens.
 */

import React from 'react'
import styles from './Inline.module.css'

/** Keyword (token-backed) gap sizes that emit a CSS Module class. */
export type InlineGapKeyword =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'

const INLINE_GAP_KEYWORDS: ReadonlySet<string> = new Set([
  'none',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
])

export interface InlineProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * Spacing between children. Accepts EITHER a token keyword (preferred,
   * stays on the design-token rhythm) or a raw CSS-length value:
   *
   * - `'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'` → token class
   * - `number` → emitted verbatim as `<n>px` inline style
   * - `string` (e.g. `'0.5rem'`, `'var(--spacing-3)'`) → emitted verbatim
   *
   * Numeric/string escape hatch added in #374 — see StackProps.gap.
   *
   * @default 'md'
   */
  gap?: InlineGapKeyword | (string & {}) | number

  /**
   * Vertical alignment of children
   * @default 'center'
   */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'

  /**
   * Horizontal alignment/distribution of children
   * @default 'start'
   */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'

  /**
   * Allow children to wrap to next line
   * @default false
   */
  wrap?: boolean

  /**
   * Grow to fill remaining space when this Inline is itself a flex item of
   * a parent flex container (#374).
   *
   * - `true` → `flex: 1 1 auto`
   * - `<number>` → `flex: <n> 1 auto`
   */
  grow?: boolean | number

  /**
   * HTML element to render as
   * @default 'div'
   */
  as?: 'div' | 'span' | 'section' | 'nav'

  /**
   * Child elements to render in horizontal layout
   */
  children: React.ReactNode

  /**
   * Additional CSS class names
   */
  className?: string

  /**
   * Inline styles
   */
  style?: React.CSSProperties
}

/**
 * Inline - Horizontal flex layout primitive
 *
 * @example
 * ```tsx
 * <Inline gap="sm" align="center" justify="between">
 *   <Text>Label</Text>
 *   <Badge>New</Badge>
 * </Inline>
 * ```
 */
export const Inline = React.forwardRef<HTMLDivElement, InlineProps>(
  (
    {
      gap = 'md',
      align = 'center',
      justify = 'start',
      wrap = false,
      grow,
      as: Component = 'div',
      children,
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
    // Resolve `gap`. See Stack for the same shape.
    const isKeywordGap =
      typeof gap === 'string' && INLINE_GAP_KEYWORDS.has(gap)
    const gapClass = isKeywordGap ? styles[`gap-${gap}`] : ''

    let inlineGap: string | undefined
    if (!isKeywordGap) {
      if (typeof gap === 'number') {
        inlineGap = `${gap}px`
      } else if (typeof gap === 'string') {
        inlineGap = gap
      }
    }

    // Resolve `grow`. See Box for the same shape.
    let flexValue: string | undefined
    if (grow === true) {
      flexValue = '1 1 auto'
    } else if (typeof grow === 'number' && grow > 0 && Number.isFinite(grow)) {
      flexValue = `${grow} 1 auto`
    }

    const classNames = [
      styles.inline,
      gapClass,
      styles[`align-${align}`],
      styles[`justify-${justify}`],
      wrap && styles.wrap,
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const mergedStyle: React.CSSProperties = {
      ...style,
      ...(inlineGap !== undefined ? { gap: inlineGap } : {}),
      ...(flexValue !== undefined ? { flex: flexValue } : {}),
    }

    return (
      <Component
        ref={ref as React.Ref<HTMLDivElement>}
        className={classNames}
        style={mergedStyle}
        {...rest}
      >
        {children}
      </Component>
    )
  }
)

Inline.displayName = 'Inline'
