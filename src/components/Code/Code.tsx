/**
 * Code Component (inline variant)
 *
 * Renders an inline `<code>` element styled with the design system's mono
 * font and a subtle background tint. For multi-line / syntax-highlighted
 * blocks, use `<CodeBlock>` instead.
 *
 * @example
 * <Text>Run <Code>npm install</Code> to get started.</Text>
 *
 * @example
 * // Layer-7 composition (#424): render as your own element, keeping the
 * // Code styling. Useful when the child carries its own semantics.
 * <Code asChild><a href="/api">GET /api</a></Code>
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './Code.module.css'

export interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Render as the single child element, merging Code styling onto it
   * (Layer-7 composition, #424). The mono/tint `styles.code` class lands
   * on the rendered child.
   */
  asChild?: boolean
  /** Inline code content. */
  children: React.ReactNode
}

export const Code = React.forwardRef<HTMLElement, CodeProps>(
  ({ asChild = false, className = '', children, ...props }, ref) => {
    const combined = [styles.code, className].filter(Boolean).join(' ')
    const Comp = asChild ? Slot : 'code'
    return (
      <Comp ref={ref} className={combined} {...props}>
        {children}
      </Comp>
    )
  },
)

Code.displayName = 'Code'
