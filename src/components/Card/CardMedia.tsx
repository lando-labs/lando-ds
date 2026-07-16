'use client'

/**
 * CardMedia Component
 *
 * Image / video media slot for Card composition. Eliminates the
 * `position: relative; overflow: hidden; border-radius;` + `<img>` +
 * `object-fit: cover` boilerplate that previously lived inside FeedItemCard,
 * feed/BaseCard, NewsItemCard, and newsroom/LeadStoryCard.
 *
 * Inherits Card's `border-radius` and clips children automatically. When
 * `position="left"` or `position="right"`, the parent Card flips to row
 * layout via a `:has()` rule in CardMedia.module.css so consumers don't
 * have to override Card's flex direction themselves.
 *
 * Sprint 17 (#86 / v0.11.0).
 *
 * @example
 * // Top-positioned media (default) — spans Card width.
 * <Card>
 *   <CardMedia aspectRatio="16/9">
 *     <img src="/hero.jpg" alt="Article hero" />
 *   </CardMedia>
 *   <CardBody>...</CardBody>
 * </Card>
 *
 * @example
 * // Side-positioned media — fixed-width column beside body.
 * <Card>
 *   <CardMedia aspectRatio="1/1" position="left" width={120}>
 *     <img src="/thumb.jpg" alt="" />
 *   </CardMedia>
 *   <CardBody>...</CardBody>
 * </Card>
 *
 * @example
 * // Loading + error slots.
 * <Card>
 *   <CardMedia
 *     aspectRatio="3/2"
 *     placeholder={<Skeleton />}
 *     fallback={<EmptyState>Image unavailable</EmptyState>}
 *   >
 *     <img src={maybeBrokenSrc} alt="..." />
 *   </CardMedia>
 *   <CardBody>...</CardBody>
 * </Card>
 *
 * @example
 * // Works with next/image — wrap as you would any other img.
 * <Card>
 *   <CardMedia aspectRatio="16/9">
 *     <Image src="/hero.jpg" alt="..." fill sizes="100vw" />
 *   </CardMedia>
 * </Card>
 */

import React from 'react'
import styles from './CardMedia.module.css'

export type CardMediaPosition = 'top' | 'left' | 'right'

export interface CardMediaProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * CSS `aspect-ratio` value for the media container, e.g. `"16/9"`,
   * `"1/1"`, `"4/3"`. Forwarded directly to the `aspect-ratio` CSS
   * property. When omitted, the container takes its intrinsic size from
   * its child media (or the consumer's own width/height styles).
   */
  aspectRatio?: string
  /**
   * Where the media sits inside the Card.
   *
   * - `top` (default): full-width strip above CardBody. Card stays
   *   column-flex.
   * - `left` / `right`: fixed-width column beside CardBody. The parent
   *   Card flips to row-flex via a `:has()` selector. Pair with `width`
   *   to control the media column size.
   */
  position?: CardMediaPosition
  /**
   * Pixel width for the media column. Only meaningful for
   * `position="left" | "right"`. Defaults to the natural size of the
   * media child when unset. Numeric values are emitted as `${width}px`.
   */
  width?: number | string
  /**
   * Slot rendered when `children` is `null`/`undefined`. Use this for
   * skeleton or shimmer states while the media URL is being resolved.
   * For img-loading state, prefer wrapping `children` in a Suspense
   * boundary or relying on `next/image`'s built-in loading behavior —
   * CardMedia intentionally does not detect img onLoad timing.
   */
  placeholder?: React.ReactNode
  /**
   * Slot rendered when the first media child errors out (`onError`).
   * Useful for graceful image-load failure messaging without coupling
   * the consumer to a custom error boundary.
   */
  fallback?: React.ReactNode
}

/**
 * Type guard — checks whether a React node is an `img`/`video`/`picture`
 * element (or a forwardRef component that ultimately renders one, like
 * next/image). We detect by checking `type === 'img' | 'video' | 'picture'`
 * for HTML elements; component children pass through unchanged and will
 * be cloned only if they accept an `onError` prop.
 */
function isMediaElement(node: React.ReactNode): node is React.ReactElement {
  return (
    React.isValidElement(node) &&
    (node.type === 'img' ||
      node.type === 'video' ||
      node.type === 'picture' ||
      typeof node.type === 'function' ||
      typeof node.type === 'object') // forwardRef / memo objects
  )
}

export const CardMedia = React.forwardRef<HTMLDivElement, CardMediaProps>(
  (
    {
      aspectRatio,
      position = 'top',
      width,
      placeholder,
      fallback,
      className = '',
      children,
      style,
      ...props
    },
    ref
  ) => {
    const [hasError, setHasError] = React.useState(false)

    const firstChild = React.Children.toArray(children)[0]

    // Derive a stable identity key for the current media source so we
    // can reset the error state when a consumer points at a new src
    // without firing the effect on every render. For non-img children
    // we fall back to the element type — error reset is a best-effort
    // convenience anyway; consumers can also force a remount via key.
    const mediaKey = React.useMemo(() => {
      if (!React.isValidElement(firstChild)) return null
      const props = (firstChild as React.ReactElement<Record<string, unknown>>)
        .props
      const src = props['src']
      if (typeof src === 'string') return src
      return String(firstChild.type)
    }, [firstChild])

    React.useEffect(() => {
      setHasError(false)
    }, [mediaKey])

    const classes = [styles.media, styles[`position-${position}`], className]
      .filter(Boolean)
      .join(' ')

    const isSidePositioned = position === 'left' || position === 'right'

    const mergedStyle: React.CSSProperties = {
      ...(aspectRatio && { aspectRatio }),
      ...(isSidePositioned && width !== undefined
        ? { width: typeof width === 'number' ? `${width}px` : width }
        : null),
      ...style,
    }

    const hasChildren =
      children !== null && children !== undefined && firstChild !== undefined

    // Decide what to render inside the wrapper:
    //
    //   1. No children → placeholder (if provided)
    //   2. Child errored → fallback (if provided), else nothing
    //   3. Otherwise → children, with onError forwarded to the first
    //      media-like child so we can flip to fallback if it 404s.
    let content: React.ReactNode

    if (!hasChildren) {
      content = placeholder ?? null
    } else if (hasError && fallback !== undefined) {
      content = fallback
    } else if (fallback !== undefined && isMediaElement(firstChild)) {
      // Clone the first child to attach our onError handler. Preserve
      // any consumer-supplied onError by chaining.
      const original = firstChild as React.ReactElement<{
        onError?: React.ReactEventHandler
      }>
      const consumerOnError = original.props.onError
      const cloned = React.cloneElement(original, {
        onError: (e: React.SyntheticEvent) => {
          consumerOnError?.(e)
          setHasError(true)
        },
      })

      const rest = React.Children.toArray(children).slice(1)
      content = (
        <>
          {cloned}
          {rest}
        </>
      )
    } else {
      content = children
    }

    return (
      <div
        ref={ref}
        className={classes}
        style={mergedStyle}
        data-card-media-position={position}
        {...props}
      >
        {content}
      </div>
    )
  }
)

CardMedia.displayName = 'CardMedia'
