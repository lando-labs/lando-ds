/**
 * Box Component
 *
 * Generic container primitive with common styling props and optional
 * flex/grid layout shortcuts (`direction`, `gap`, `align`, `justify`).
 *
 * Layout shortcuts only take effect when `display` is `'flex'` or
 * `'grid'`. When `display` is anything else (the default `'block'`,
 * `'inline'`, etc.), the layout props are silently ignored — matching
 * CSS semantics and avoiding any implicit flex behavior.
 */

import React from 'react'
import styles from './Box.module.css'

export type BoxSpacingToken =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'

export type BoxFlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'

export type BoxFlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'

export type BoxFlexJustify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly'

export interface BoxProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  /**
   * Padding around content using design token scale
   * @default undefined
   */
  padding?: BoxSpacingToken

  /**
   * Padding for specific sides using design token scale
   * @default undefined
   */
  paddingTop?: BoxSpacingToken
  paddingRight?: BoxSpacingToken
  paddingBottom?: BoxSpacingToken
  paddingLeft?: BoxSpacingToken

  /**
   * Margin around box using design token scale
   * @default undefined
   */
  margin?: BoxSpacingToken

  /**
   * Margin for specific sides using design token scale
   * @default undefined
   */
  marginTop?: BoxSpacingToken
  marginRight?: BoxSpacingToken
  marginBottom?: BoxSpacingToken
  marginLeft?: BoxSpacingToken

  /**
   * Border radius using design token scale
   * @default undefined
   */
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full'

  /**
   * Background color (CSS color value or design token variable)
   * @example 'var(--color-bg-subtle)' or '#f0f0f0'
   * @default undefined
   */
  background?: string

  /**
   * Add default border
   * @default false
   */
  border?: boolean

  /**
   * Display mode
   * @default 'block'
   */
  display?: 'block' | 'inline' | 'inline-block' | 'flex' | 'grid' | 'none'

  /**
   * Gap between children. Only applies when `display` is `'flex'`
   * or `'grid'`. Maps to a semantic spacing token
   * (`gap="sm"` → `var(--spacing-sm)`).
   */
  gap?: BoxSpacingToken

  /**
   * Flex direction. Only applies when `display="flex"`.
   * @default 'row' (inherited from flex default)
   */
  direction?: BoxFlexDirection

  /**
   * Cross-axis alignment. Only applies when `display` is `'flex'`
   * or `'grid'`.
   */
  align?: BoxFlexAlign

  /**
   * Main-axis alignment. Only applies when `display` is `'flex'`
   * or `'grid'`.
   */
  justify?: BoxFlexJustify

  /**
   * Intrinsic sizing (#137). Each prop accepts any CSS length string —
   * `clamp(...)`, viewport units (`vw`/`vh`/`svh`/`dvh`), `ch`, `em`,
   * `%`, `min-content`/`max-content`/`fit-content`, plain pixels, etc.
   * Passed through verbatim as an inline style; no token resolution.
   *
   * @example
   * <Box width="clamp(16rem, 40vw, 32rem)" aspectRatio="16/9" />
   */
  aspectRatio?: string
  width?: string
  height?: string
  minWidth?: string
  maxWidth?: string
  minHeight?: string
  maxHeight?: string

  /**
   * Grow to fill remaining space along the parent flex/grid main axis (#374).
   *
   * - `true` → `flex: 1 1 auto` (the conventional "fill the gap" preset)
   * - `<number>` → `flex: <n> 1 auto` (proportional growth between siblings)
   * - `false` / omitted → no flex declaration emitted
   *
   * Only takes effect when the Box is itself a child of a `display: flex`
   * (or `display: grid` with `grid-auto-flow: row`) parent. Without that
   * parent context the property is harmless — the browser ignores `flex`
   * on a non-flex-item — but you probably wanted `width: 100%`.
   */
  grow?: boolean | number

  /**
   * HTML element to render as
   * @default 'div'
   */
  as?: React.ElementType

  /**
   * Child elements to render inside box
   */
  children?: React.ReactNode

  /**
   * Additional CSS class names
   */
  className?: string

  /**
   * Inline styles (merged with component styles)
   */
  style?: React.CSSProperties
}

/**
 * Box - Generic styling wrapper primitive
 *
 * @example
 * ```tsx
 * <Box padding="md" borderRadius="md" background="var(--color-bg-subtle)">
 *   <Text>Card content</Text>
 * </Box>
 * ```
 *
 * @example
 * ```tsx
 * <Box as="section" padding="lg" border>
 *   <Heading level={2}>Section Title</Heading>
 * </Box>
 * ```
 *
 * @example Flex layout
 * ```tsx
 * <Box display="flex" direction="column" gap="md" align="start">
 *   <Heading level={3}>Title</Heading>
 *   <Text>Body</Text>
 * </Box>
 * ```
 */
export const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  (
    {
      padding,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      margin,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      borderRadius,
      background,
      border = false,
      display = 'block',
      gap,
      direction,
      align,
      justify,
      aspectRatio,
      width,
      height,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      grow,
      as: Component = 'div',
      children,
      className = '',
      style = {},
      ...rest
    },
    ref
  ) => {
    const useFlex = display === 'flex'
    const useGrid = display === 'grid'
    const useFlexOrGrid = useFlex || useGrid

    if (process.env.NODE_ENV !== 'production' && !useFlexOrGrid) {
      const offending: string[] = []
      if (gap !== undefined) offending.push('gap')
      if (direction !== undefined) offending.push('direction')
      if (align !== undefined) offending.push('align')
      if (justify !== undefined) offending.push('justify')
      if (offending.length > 0) {
        console.warn(
          `[Box] ${offending.join(', ')} ${
            offending.length === 1 ? 'is' : 'are'
          } only applied when \`display\` is \`"flex"\` or \`"grid"\` (got \`"${display}"\`). Set \`display="flex"\` to use these layout shortcuts.`,
        )
      }
    }

    const classNames = [
      styles.box,
      padding && styles[`padding-${padding}`],
      paddingTop && styles[`padding-top-${paddingTop}`],
      paddingRight && styles[`padding-right-${paddingRight}`],
      paddingBottom && styles[`padding-bottom-${paddingBottom}`],
      paddingLeft && styles[`padding-left-${paddingLeft}`],
      margin && styles[`margin-${margin}`],
      marginTop && styles[`margin-top-${marginTop}`],
      marginRight && styles[`margin-right-${marginRight}`],
      marginBottom && styles[`margin-bottom-${marginBottom}`],
      marginLeft && styles[`margin-left-${marginLeft}`],
      borderRadius && styles[`radius-${borderRadius}`],
      border && styles.border,
      styles[`display-${display}`],
      useFlexOrGrid && gap && styles[`gap-${gap}`],
      useFlex && direction && styles[`direction-${direction}`],
      useFlexOrGrid && align && styles[`align-${align}`],
      useFlexOrGrid && justify && styles[`justify-${justify}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // `grow` resolves to a `flex` shorthand. The boolean form is the
    // conventional `1 1 auto` preset; numeric form scales the grow factor.
    // `0` / `false` / undefined leave `flex` unset (no inline style emitted).
    let flexValue: string | undefined
    if (grow === true) {
      flexValue = '1 1 auto'
    } else if (typeof grow === 'number' && grow > 0 && Number.isFinite(grow)) {
      flexValue = `${grow} 1 auto`
    }

    const inlineStyles: React.CSSProperties = {
      ...style,
      ...(background ? { backgroundColor: background } : {}),
      ...(aspectRatio !== undefined ? { aspectRatio } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(minWidth !== undefined ? { minWidth } : {}),
      ...(maxWidth !== undefined ? { maxWidth } : {}),
      ...(minHeight !== undefined ? { minHeight } : {}),
      ...(maxHeight !== undefined ? { maxHeight } : {}),
      ...(flexValue !== undefined ? { flex: flexValue } : {}),
    }

    return (
      <Component
        ref={ref as React.Ref<HTMLDivElement>}
        className={classNames}
        style={inlineStyles}
        {...rest}
      >
        {children}
      </Component>
    )
  }
)

Box.displayName = 'Box'
