/**
 * CardTitle Component
 *
 * A small semantic heading sized for card widget titles (16px / weight 600).
 * Wraps the design system `Heading` so it remains an accessible h-element
 * while matching the standard widget-title visual rhythm.
 *
 * @example
 * <CardTitle>Tasks</CardTitle>
 * <CardTitle as={2}>Dashboard</CardTitle>
 */

import React from 'react'
import { Heading } from '../Heading'

export interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading semantic level — h1..h6. Default h3. */
  as?: 1 | 2 | 3 | 4 | 5 | 6
  /** Optional extra class name */
  className?: string
  /** Optional inline style override */
  style?: React.CSSProperties
  /** Heading content */
  children?: React.ReactNode
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as = 3, className, style, children, ...rest }, ref) => {
    // Heading does not expose a 'base' (16px) size, so we inline the
    // token to match the existing consumer boilerplate
    // (fontWeight: 600, fontSize: var(--font-size-base)).
    const mergedStyle: React.CSSProperties = {
      fontSize: 'var(--font-size-base)',
      lineHeight: 'var(--line-height-snug)',
      ...style,
    }

    // #423 — forward the rest of the HTML attributes (id / data-* / aria-* /
    // onClick / etc.) onto the rendered heading so consumers can wire the
    // widget title without hand-rolling a raw <h*>. `...rest` is spread
    // BEFORE the internal `className` / `style` so those keep precedence.
    return (
      <Heading
        {...rest}
        ref={ref}
        level={as}
        weight="semibold"
        className={className}
        style={mergedStyle}
      >
        {children}
      </Heading>
    )
  },
)

CardTitle.displayName = 'CardTitle'
