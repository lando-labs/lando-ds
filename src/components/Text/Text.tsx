/**
 * Text Component
 *
 * Polymorphic text component for body copy, captions, and supporting text.
 * Provides consistent typography across the application with flexible rendering.
 *
 * For a tappable/clickable text affordance use `variant="link"`. Render it
 * as an `<a>` (`as="a"`) when it navigates to an `href`, or as a `<button>`
 * (`as="button"`) when it triggers an in-page action via `onClick`. The
 * variant supplies the link color, underline-on-hover, and a visible
 * `:focus-visible` ring; the element you pick supplies the semantics.
 *
 * @example
 * <Text variant="body">This is body text</Text>
 * <Text variant="caption" size="sm">Small caption text</Text>
 * <Text as="span" weight="bold" color="var(--color-primary)">Bold inline text</Text>
 * <Text variant="overline">Overline Text</Text>
 * <Text as="a" variant="link" href="/pricing">View pricing</Text>
 * <Text as="button" variant="link" onClick={handleUndo}>Undo</Text>
 */

import React from 'react'
import { safeHref } from '../../utils/safeHref'
import styles from './Text.module.css'

type TextElement = 'p' | 'span' | 'div' | 'label' | 'a' | 'button'

type TextOwnProps<E extends TextElement = 'p'> = {
  /** HTML element to render as */
  as?: E
  /**
   * Text variant style.
   * - `body` / `caption` / `small` / `overline` — typographic styles.
   * - `link` — tappable/clickable text affordance (link color,
   *   underline-on-hover, focus ring). Pair with `as="a"` + `href`
   *   for navigation, or `as="button"` + `onClick` for an action.
   * - `mono` — monospace family for code/identifiers/debug values
   *   inline in body copy (#379). Uses `--font-family-mono`
   *   (JetBrains Mono) with the body line-height so it composes
   *   into running text without visually disrupting the baseline.
   */
  variant?: 'body' | 'caption' | 'small' | 'overline' | 'link' | 'mono'
  /** Text size */
  size?: 'sm' | 'md' | 'lg'
  /** Font weight */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  /** Text color (CSS custom property or color value) */
  color?: string
  /** Additional CSS class name */
  className?: string
  /** Text content */
  children: React.ReactNode
}

export type TextProps<E extends TextElement = 'p'> = TextOwnProps<E> &
  Omit<React.ComponentPropsWithoutRef<E>, keyof TextOwnProps<E>>

type PolymorphicRef<E extends React.ElementType> = React.ComponentPropsWithRef<E>['ref']

type PolymorphicText = <E extends TextElement = 'p'>(
  props: TextProps<E> & { ref?: PolymorphicRef<E> }
) => React.ReactElement | null

export const Text: PolymorphicText = React.forwardRef(
  <E extends TextElement = 'p'>(
    {
      variant = 'body',
      size = 'md',
      weight = 'normal',
      color,
      as,
      className = '',
      children,
      style,
      ...props
    }: TextProps<E>,
    ref: PolymorphicRef<E>
  ) => {
    const Tag = (as || 'p') as React.ElementType

    const textClasses = [
      styles.text,
      styles[`variant-${variant}`],
      styles[`size-${size}`],
      styles[`weight-${weight}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const textStyle = {
      ...style,
      ...(color ? { color } : {}),
    }

    // Default native <button> elements to type="button" so a button-like
    // link (e.g. `<Text as="button" variant="link">`) never accidentally
    // submits a surrounding form. A consumer can still override via the
    // spread `props` below.
    let elementProps =
      as === 'button'
        ? { type: 'button' as const, ...props }
        : props

    // #320 — Text is polymorphic; `<Text as="a" href={…}>` renders a real
    // anchor, so a consumer-supplied href must be sanitized against
    // javascript:/data:/etc. just like the dedicated anchor components.
    if (as === 'a' && elementProps && 'href' in elementProps) {
      elementProps = {
        ...elementProps,
        href: safeHref((elementProps as { href?: string | null }).href),
      } as typeof elementProps
    }

    return (
      <Tag
        ref={ref}
        className={textClasses}
        style={textStyle}
        {...elementProps}
      >
        {children}
      </Tag>
    )
  }
) as PolymorphicText
;(Text as { displayName?: string }).displayName = 'Text'
