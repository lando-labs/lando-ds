/**
 * ScrollArea Component
 *
 * Wraps content in a scroller with a brand-consistent custom scrollbar.
 * Built on **native** `overflow: auto` + styled `::-webkit-scrollbar-*` and
 * Firefox `scrollbar-width`/`scrollbar-color` — no JS overrides — so:
 *
 *   - Momentum + touch scrolling stay native (critical on iOS/Android)
 *   - Screen-reader and keyboard scrolling work without intervention
 *   - Zero bundle/runtime cost beyond the wrapping `<div>`
 *
 * The trade-off: cross-browser scrollbars are not pixel-identical. We use the
 * DS color tokens for thumb/track so the *brand* reads through consistently
 * (light/dark aware via the `[data-theme='dark']` cascade in tokens.css), and
 * the geometry stays close enough that consumers don't notice.
 *
 * Why no JS-driven custom scrollbar (Radix-style overlay):
 *   - Universally fragile on touch — breaks momentum, breaks pinch-zoom,
 *     breaks accessibility announcers that hook into the native scroll.
 *   - Wins 5% visual polish at the cost of 50% reliability. Not the right
 *     trade for a primitive consumers will compose into every surface.
 *
 * @example
 * <ScrollArea maxHeight={320}>
 *   <LongList />
 * </ScrollArea>
 *
 * @example
 * <ScrollArea
 *   maxHeight="50vh"
 *   orientation="both"
 *   scrollbarMode="inset"
 *   aria-label="Code preview"
 * >
 *   <pre>{longCode}</pre>
 * </ScrollArea>
 */

import React from 'react'
import styles from './ScrollArea.module.css'

export type ScrollAreaMode = 'overlay' | 'inset' | 'auto'
export type ScrollAreaVisibility = 'hover' | 'always' | 'scroll'
export type ScrollAreaOrientation = 'vertical' | 'horizontal' | 'both'

export interface ScrollAreaProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to render inside the scroller. */
  children: React.ReactNode

  /**
   * Maximum height of the scroller. **Required for vertical scrolling to
   * engage** — without a cap, the wrapper grows with its content and there is
   * nothing to scroll. Accepts a number (px) or any CSS length string
   * (`'50vh'`, `'320px'`, `'clamp(20rem, 50vh, 40rem)'`).
   */
  maxHeight?: string | number

  /**
   * Scrollbar layout behaviour.
   *
   * - `'overlay'` (default) — scrollbar floats on top of content (macOS-style).
   *   No layout shift; content can briefly sit under the bar.
   * - `'inset'` — scrollbar takes its own layout space (classic Windows).
   *   Content never sits under the bar; introduces a fixed scrollbar gutter.
   * - `'auto'` — `'overlay'` on touch / coarse-pointer devices, `'inset'`
   *   otherwise. Useful when content density makes overlap unacceptable on
   *   desktop but you still want clean mobile behaviour.
   */
  scrollbarMode?: ScrollAreaMode

  /**
   * When the scrollbar is visible.
   *
   * - `'hover'` (default) — fades in on container hover/focus.
   * - `'always'` — visible whenever the content overflows.
   * - `'scroll'` — visible while actively scrolling (browser default behaviour
   *   on macOS).
   *
   * NOTE: `'scroll'` defers to the browser's native auto-hide heuristics —
   * we don't try to JS-detect "is the user scrolling right now". Behaviour is
   * therefore browser-driven and may differ across OSes.
   */
  scrollbarVisibility?: ScrollAreaVisibility

  /**
   * Which axes scroll.
   *
   * - `'vertical'` (default) — overflow on the Y axis, hidden on X.
   * - `'horizontal'` — overflow on X, hidden on Y.
   * - `'both'` — overflow on both axes.
   */
  orientation?: ScrollAreaOrientation
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      children,
      maxHeight,
      scrollbarMode = 'overlay',
      scrollbarVisibility = 'hover',
      orientation = 'vertical',
      className = '',
      style,
      ...rest
    },
    ref,
  ) => {
    // If the consumer passes a label (`aria-label` / `aria-labelledby`), expose
    // the scroller as a landmark `region` so AT users can navigate to it by
    // name. Without a label we deliberately omit the role — an unnamed region
    // is announcement noise, per WAI-ARIA authoring practices.
    const hasAccessibleName =
      'aria-label' in rest || 'aria-labelledby' in rest
    const role = hasAccessibleName ? 'region' : undefined

    const classes = [
      styles.scrollArea,
      styles[`mode-${scrollbarMode}`],
      styles[`visibility-${scrollbarVisibility}`],
      styles[`orientation-${orientation}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // Translate numeric maxHeight to px. Strings (vh, calc(), clamp(), etc.)
    // pass through untouched so consumers can use any CSS length.
    const resolvedMaxHeight =
      typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight

    const inlineStyle: React.CSSProperties = {
      ...style,
      ...(resolvedMaxHeight !== undefined
        ? { maxHeight: resolvedMaxHeight }
        : {}),
    }

    return (
      <div
        ref={ref}
        // tabIndex=0 lets keyboard users focus the scroller and scroll with
        // arrow / Page / Home / End keys — without it, a wrapping focusable
        // ancestor is the only way to reach the content with the keyboard.
        tabIndex={0}
        role={role}
        data-scrollbar-mode={scrollbarMode}
        data-scrollbar-visibility={scrollbarVisibility}
        data-orientation={orientation}
        className={classes}
        style={inlineStyle}
        {...rest}
      >
        {children}
      </div>
    )
  },
)

ScrollArea.displayName = 'ScrollArea'
