/**
 * PageHeader Component
 *
 * A page-level header primitive that absorbs the title + optional
 * subtitle + optional breadcrumbs + optional actions pattern that
 * consumer apps rebuild on every route. Renders a semantic `<header>`
 * element and composes the existing `Heading` + `Text` primitives.
 *
 * Default title size is `'2xl'` per #43 DS-MOD-1 — that's the app
 * page-title scale (~25px), NOT the marketing hero scale.
 *
 * Layout: two-column row — title column (left, flex-grow) with
 * breadcrumbs above and subtitle below the title, and an actions
 * slot on the right. Actions drop below the title on narrow viewports
 * (<640px).
 *
 * @example
 * <PageHeader title="Contacts" subtitle="Manage your contact list" />
 *
 * @example
 * <PageHeader
 *   title="Contacts"
 *   actions={<Button variant="primary">Add Contact</Button>}
 * />
 *
 * @example
 * // Escape hatch: raw children compose inside the <header> wrapper
 * <PageHeader>
 *   <MyCustomHeaderLayout />
 * </PageHeader>
 */

import React from 'react'
import { Heading } from '../Heading'
import { Text } from '../Text'
import styles from './PageHeader.module.css'

// Omit the HTML `title` attribute (the tooltip string) so we can repurpose
// `title` as the page-title slot accepting ReactNode (#255). Consumers who
// actually want an HTML tooltip on the wrapping <header> are not blocked —
// the standard DOM API still works at runtime.
export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /**
   * Main page title. Renders as `<h1>` by default (override with `titleAs`).
   * Accepts a string or a ReactNode — pass `<Inline>`/`<Badge>` etc. when
   * the title row needs inline adornments while keeping the structured
   * breadcrumbs/subtitle/actions slots intact (#255).
   */
  title?: React.ReactNode
  /** Optional subtitle rendered below the title. Accepts a string or ReactNode. */
  subtitle?: React.ReactNode
  /** Optional breadcrumbs slot rendered above the title. */
  breadcrumbs?: React.ReactNode
  /** Optional actions slot rendered to the right of the title (drops below on mobile). */
  actions?: React.ReactNode
  /** Semantic heading level for the title. Default `1`. */
  titleAs?: 1 | 2 | 3 | 4 | 5 | 6
  /**
   * Visual size for the title heading. Default `'2xl'` — the app
   * page-title scale per #43 DS-MOD-1. Matches the `Heading`
   * component's `size` prop.
   */
  titleSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /**
   * Escape hatch: when `children` is provided, the `title` /
   * `subtitle` / `breadcrumbs` / `actions` props are ignored and
   * `children` render inside the layout wrapper instead.
   */
  children?: React.ReactNode
}

export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  (
    {
      title,
      subtitle,
      breadcrumbs,
      actions,
      titleAs = 1,
      titleSize = '2xl',
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const headerClasses = [styles.pageHeader, className].filter(Boolean).join(' ')

    // Escape hatch: when children provided, structured props are bypassed.
    if (children) {
      return (
        <header ref={ref} className={headerClasses} {...rest}>
          {children}
        </header>
      )
    }

    return (
      <header ref={ref} className={headerClasses} {...rest}>
        <div className={styles.main}>
          <div className={styles.titleColumn}>
            {breadcrumbs && <div className={styles.breadcrumbs}>{breadcrumbs}</div>}
            {title && (
              <Heading level={titleAs} size={titleSize}>
                {title}
              </Heading>
            )}
            {subtitle && (
              <Text
                variant="body"
                color="var(--color-text-secondary)"
                className={styles.subtitle}
              >
                {subtitle}
              </Text>
            )}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
    )
  },
)

PageHeader.displayName = 'PageHeader'
