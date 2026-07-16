/**
 * CardBody Component
 *
 * Main content section for Card component.
 *
 * Accepts optional layout shortcut props (`stack`, `inline`, `gap`,
 * `align`, `justify`) so consumers can express basic card-body
 * layout without reaching for inline flex CSS or nesting a Stack/
 * Inline inside the card.
 *
 * When neither `stack` nor `inline` is set, CardBody renders as a
 * plain block — identical to its pre-v0.6.0 behavior. `gap` alone
 * (without `stack` or `inline`) has no visual effect and is
 * intentionally a no-op: we don't implicitly enable flex to avoid
 * surprising consumers.
 *
 * @example
 * <CardBody>
 *   <p>Card content goes here</p>
 * </CardBody>
 *
 * @example
 * <CardBody stack gap="sm">
 *   <Heading level={3}>Title</Heading>
 *   <Text>Body content</Text>
 * </CardBody>
 *
 * @example
 * <CardBody inline align="center" justify="between" gap="md">
 *   <Text>Label</Text>
 *   <Badge>New</Badge>
 * </CardBody>
 */

import React from 'react'
import styles from './Card.module.css'

/**
 * Semantic spacing tokens. Matches the Stack/Inline `gap` union so
 * CardBody reads the same as the dedicated layout primitives.
 */
export type CardBodySpacingToken =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'

export type CardBodyAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'

export type CardBodyJustify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly'

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Gap between children. Only takes effect when `stack` or `inline`
   * is true (or when the consumer manually sets `display: flex`/
   * `grid` via `style`/`className`). Maps to a CSS variable —
   * `gap="sm"` becomes `var(--spacing-sm)`.
   *
   * For custom pixel gaps, pass `style={{ gap: '42px' }}` instead.
   */
  gap?: CardBodySpacingToken

  /**
   * Render the body as a vertical flex column. Mutually exclusive
   * with `inline`; if both are set, `stack` wins.
   */
  stack?: boolean

  /**
   * Render the body as a horizontal flex row. Mutually exclusive
   * with `stack`.
   */
  inline?: boolean

  /**
   * Cross-axis alignment. Applied only when `stack` or `inline`
   * is true.
   */
  align?: CardBodyAlign

  /**
   * Main-axis alignment. Applied only when `stack` or `inline`
   * is true.
   */
  justify?: CardBodyJustify
}

const alignMap: Record<CardBodyAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
}

const justifyMap: Record<CardBodyJustify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  (
    {
      className = '',
      children,
      gap,
      stack = false,
      inline = false,
      align,
      justify,
      style,
      ...props
    },
    ref
  ) => {
    // `stack` wins over `inline` if both are accidentally set.
    const useStack = stack
    const useInline = !stack && inline
    const useFlex = useStack || useInline

    const layoutStyle: React.CSSProperties = {
      ...(useFlex && { display: 'flex' }),
      ...(useStack && { flexDirection: 'column' }),
      ...(useInline && { flexDirection: 'row' }),
      // Only emit `gap` when flex is active. `gap` without flex is
      // a no-op in plain block layout; don't set it to avoid
      // leaking through to any future consumer who sets their own
      // display via style/className.
      ...(useFlex && gap && { gap: `var(--spacing-${gap})` }),
      ...(useFlex && align && { alignItems: alignMap[align] }),
      ...(useFlex && justify && { justifyContent: justifyMap[justify] }),
      ...style,
    }

    return (
      <div
        ref={ref}
        className={`${styles.cardBody} ${className}`.trim()}
        style={layoutStyle}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardBody.displayName = 'CardBody'
