/**
 * ColorSwatch Component (#379)
 *
 * Small accessible color-preview block. Used to render brand/theme/semantic
 * colors with an optional caption — replaces the hand-rolled swatch divs
 * scattered through a consumer app's theme-lab pages.
 *
 * The swatch itself is decorative; the `aria-label` ("color preview")
 * carries the semantic. `label` is rendered visibly below the swatch
 * (caption-style) and is NOT an alternate label — it complements the
 * aria-label rather than replacing it.
 *
 * Color values are passed through verbatim to `background-color`. The
 * component does NOT resolve token paths (`primary.base`) — pass a CSS
 * value (`#1B7FA8`, `var(--color-primary)`, `oklch(…)`). If you need
 * a token path, resolve it with `resolveColorPath` from
 * `@lando-labs/lando-ds/tokens` first.
 *
 * @example
 * <ColorSwatch color="#1B7FA8" label="Primary" />
 *
 * @example
 * <ColorSwatch color="var(--color-success-base)" size="lg" shape="circle" />
 *
 * @example
 * // Without a caption (icon-only / inline use):
 * <ColorSwatch color={hex} size="sm" />
 */

import React from 'react'
import styles from './ColorSwatch.module.css'

export type ColorSwatchSize = 'sm' | 'md' | 'lg' | number
export type ColorSwatchShape = 'square' | 'circle'

export interface ColorSwatchProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  /**
   * The color to preview. Any CSS color value: hex (`#1B7FA8`),
   * rgb/rgba, hsl, oklch, or a CSS custom property
   * (`var(--color-primary)`). Pass `'transparent'` for an "unset"
   * placeholder.
   */
  color: string
  /**
   * Swatch size. Named sizes map to design-token pixel values:
   *   - `sm` → 16px
   *   - `md` → 24px (default)
   *   - `lg` → 40px
   * A number is treated as a literal pixel size for one-off cases
   * (theme-lab uses 60px swatches in its scale grid).
   */
  size?: ColorSwatchSize
  /**
   * Optional caption rendered below the swatch (small caption-style
   * text). Useful for swatch grids that label each chip. When set,
   * the rendered element becomes a column-flex stack of swatch + label.
   */
  label?: React.ReactNode
  /** Shape: `square` (default, with subtle radius) or `circle`. */
  shape?: ColorSwatchShape
  /**
   * Accessible label for the swatch chip itself. Defaults to
   * `"Color preview: <color>"` so the swatch is announced sensibly
   * to assistive tech without forcing the consumer to think about
   * a11y on every usage. Pass an empty string to suppress.
   */
  'aria-label'?: string
}

const NAMED_SIZE_PX: Record<Exclude<ColorSwatchSize, number>, number> = {
  sm: 16,
  md: 24,
  lg: 40,
}

export const ColorSwatch = React.forwardRef<HTMLDivElement, ColorSwatchProps>(
  (
    {
      color,
      size = 'md',
      label,
      shape = 'square',
      className = '',
      style,
      'aria-label': ariaLabelProp,
      ...props
    },
    ref,
  ) => {
    const pxSize = typeof size === 'number' ? size : NAMED_SIZE_PX[size]

    // Default aria-label. Consumer can override with empty string to opt out
    // (e.g. when the surrounding label is sufficient).
    const ariaLabel =
      ariaLabelProp === undefined
        ? `Color preview: ${color}`
        : ariaLabelProp

    const chipClasses = [styles.chip, styles[`shape-${shape}`]]
      .filter(Boolean)
      .join(' ')

    const chipStyle: React.CSSProperties = {
      width: pxSize,
      height: pxSize,
      backgroundColor: color,
    }

    const chip = (
      <span
        className={chipClasses}
        style={chipStyle}
        role={ariaLabel ? 'img' : undefined}
        aria-label={ariaLabel || undefined}
        data-color={color}
      />
    )

    // When a caption is supplied, render as a column stack: swatch + label.
    // The outer div is the consumer-controlled element (ref/style/className/data-*
    // all forward). Without a label, the outer div still wraps the chip so
    // a consumer-supplied className/data-* applies to a stable host.
    const rootClasses = [styles.root, label ? styles.withLabel : '', className]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={rootClasses} style={style} {...props}>
        {chip}
        {label && <span className={styles.label}>{label}</span>}
      </div>
    )
  },
)

ColorSwatch.displayName = 'ColorSwatch'
