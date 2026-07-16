/**
 * ArticleCard Component
 *
 * Newspaper-style editorial surface — a sibling of <Card>, NOT a Card
 * variant. Built for newsroom layouts (lead story, supporting story,
 * sidebar brief) that deliberately diverge from the DS sans-serif
 * aesthetic in favor of serif typography.
 *
 * Renders as a semantic <article> element. All typography uses the
 * editorial token set (--font-family-editorial, --color-editorial-ink-*,
 * --font-size-editorial-*) so dark mode and consumer themes propagate
 * without forking.
 *
 * Three scales control headline size:
 *   - `lead`        → 2.5rem (front-page lead story)
 *   - `supporting`  → 1.5rem (secondary story below the fold) — DEFAULT
 *   - `brief`       → 1.125rem (sidebar brief / digest item)
 *
 * Composes Byline / Lede / PullQuote internally when the corresponding
 * props are passed; all three primitives are also exported standalone for
 * use in custom editorial layouts.
 *
 * @example
 * <ArticleCard
 *   headline="The morning headline"
 *   scale="lead"
 *   byline="Claude Opus 4.7"
 *   date="April 26, 2026"
 *   hero={<img src="..." alt="..." />}
 *   pullQuote="The most striking thing..."
 *   href="/articles/the-morning-headline"
 * >
 *   Article body content (rendered after the lede block).
 * </ArticleCard>
 */

import React from 'react'
import { safeHref } from '../../utils/safeHref'
import { Slot } from '../Slot'
import styles from './ArticleCard.module.css'
import { Byline } from './Byline'
import { Lede } from './Lede'
import { PullQuote } from './PullQuote'

export type ArticleCardScale = 'lead' | 'supporting' | 'brief'
export type ArticleCardHeadingLevel = 'h1' | 'h2' | 'h3'

export interface ArticleCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Headline text — rendered as a heading element. */
  headline: string
  /**
   * Scale variant controlling headline size.
   * - `lead`: front-page lead story (2.5rem)
   * - `supporting`: standard story (1.5rem) — default
   * - `brief`: sidebar brief (1.125rem)
   * @default 'supporting'
   */
  scale?: ArticleCardScale
  /**
   * Heading level for the headline.
   * @default 'h2'
   */
  headlineAs?: ArticleCardHeadingLevel
  /** Optional author name. Renders a Byline above the headline when set. */
  byline?: string
  /** Optional publication date. Pairs with byline. */
  date?: string
  /**
   * Optional hero image element. Sits above the headline with stable
   * aspect-ratio framing (object-fit: cover).
   */
  hero?: React.ReactNode
  /**
   * Optional lede paragraph. When set, renders before children using the
   * Lede primitive. Pass plain string or richer React content.
   */
  lede?: React.ReactNode
  /** Optional pull-quote rendered between the lede and body content. */
  pullQuote?: React.ReactNode
  /**
   * Optional URL — when provided, the entire card surface becomes a
   * single clickable anchor. (Note: nesting links inside `children` will
   * be flagged by browsers — keep article body link-free when using href,
   * or omit href and let consumers wrap manually.)
   */
  href?: string
  /**
   * Article body content — rendered after the lede / pull-quote block.
   */
  children?: React.ReactNode
  /**
   * Render through the single child element (Radix-style `asChild`),
   * merging ArticleCard's root class + forwarded props onto it instead of
   * emitting the default `<article>` (#424). The `.article` root class and
   * `scale-*` variant always land on the rendered element either way.
   *
   * Note: when combined with `href`, the internal whole-card `<a>` still
   * renders inside the (now delegated) root — keep the child element a
   * non-interactive container to avoid nested-anchor issues.
   */
  asChild?: boolean
}

export const ArticleCard = React.forwardRef<HTMLElement, ArticleCardProps>(
  (
    {
      headline,
      scale = 'supporting',
      headlineAs = 'h2',
      byline,
      date,
      hero,
      lede,
      pullQuote,
      href,
      asChild = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const articleClasses = [
      styles.article,
      styles[`scale-${scale}`],
      href ? styles.linked : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const HeadlineTag = headlineAs

    const headlineClasses = [styles.headline, styles[`headline-${scale}`]]
      .filter(Boolean)
      .join(' ')

    // In the default render path `children` is the article body. Under
    // `asChild` (below), `children` is repurposed as the delegation wrapper
    // element, so the body-from-children block is omitted there.
    const inner = (
      <>
        {hero && <div className={styles.hero}>{hero}</div>}
        <div className={styles.body}>
          {byline && <Byline name={byline} date={date} />}
          <HeadlineTag className={headlineClasses}>{headline}</HeadlineTag>
          {lede && <Lede>{lede}</Lede>}
          {pullQuote && <PullQuote>{pullQuote}</PullQuote>}
          {!asChild && children && (
            <div className={styles.content}>{children}</div>
          )}
        </div>
      </>
    )

    // The root's rendered content — an `<a>`-wrapped inner when `href` is set,
    // otherwise the bare inner. Shared by both render paths.
    const rootContent = href ? (
      // Whole-card anchor pattern — `<a>` wraps the article semantics.
      // Consumers should keep `children` link-free; nested anchors are
      // an HTML spec violation. Mirrors the Card clickable pattern but
      // uses a real anchor (not a button) since editorial cards almost
      // always navigate.
      // #320 — sanitize the whole-card href (javascript:/data:/etc.).
      <a className={styles.anchor} href={safeHref(href)}>
        <span className={styles.anchorInner}>{inner}</span>
      </a>
    ) : (
      inner
    )

    // #424 — polymorphic root. When asChild, delegate the root element to the
    // consumer's single child: the article content is injected as that child's
    // content, and Slot merges `.article` + scale variant + forwarded props
    // onto it. Default stays semantic `<article>`.
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement
      return (
        <Slot ref={ref} className={articleClasses} {...props}>
          {React.cloneElement(child, undefined, rootContent)}
        </Slot>
      )
    }

    return (
      <article ref={ref} className={articleClasses} {...props}>
        {rootContent}
      </article>
    )
  }
)

ArticleCard.displayName = 'ArticleCard'
