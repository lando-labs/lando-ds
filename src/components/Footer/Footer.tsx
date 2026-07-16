/**
 * Footer Component
 *
 * A flexible footer with simple and rich variants.
 * Rich variant supports multi-column links, social media icons, and logo.
 *
 * @example
 * // Simple footer
 * <Footer copyright="© 2024 Lando Labs" variant="simple" />
 *
 * // Rich footer
 * <Footer
 *   logo={<Logo />}
 *   columns={[
 *     {
 *       title: 'Product',
 *       links: [
 *         { label: 'Features', href: '/features' },
 *         { label: 'Pricing', href: '/pricing' }
 *       ]
 *     }
 *   ]}
 *   social={[
 *     { icon: <TwitterIcon />, href: 'https://twitter.com', label: 'Twitter' }
 *   ]}
 *   copyright="© 2024 Lando Labs"
 *   variant="rich"
 * />
 */

import React from 'react'
import { safeHref, isExternalHref } from '../../utils/safeHref'
import styles from './Footer.module.css'

export interface FooterLink {
  label: string
  href: string
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

export interface FooterSocial {
  icon: React.ReactNode
  href: string
  label: string
}

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  /** Footer columns with links (rich variant) */
  columns?: FooterColumn[]
  /** Social media links */
  social?: FooterSocial[]
  /** Copyright text */
  copyright?: string
  /** Logo element */
  logo?: React.ReactNode
  /** Footer variant */
  variant?: 'simple' | 'rich'
  /**
   * Show the 2px brand → teal gradient ribbon on the footer's top edge.
   * Default: `true`. Sprint 10 (#59) — the ribbon is a brand signature
   * element called out in brand-foundation.md. Pass `accent={false}` to
   * suppress it entirely (useful for footers nested inside branded
   * chrome where the ribbon would double up).
   */
  accent?: boolean
  /** Additional CSS class merged onto the `<footer>` root. */
  className?: string
  /**
   * Inline styles merged onto the `<footer>` root.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  (
    {
      columns = [],
      social = [],
      copyright,
      logo,
      variant = 'simple',
      accent = true,
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
    const footerClasses = [
      styles.footer,
      styles[variant],
      accent ? styles.accent : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    if (variant === 'simple') {
      return (
        <footer ref={ref} {...rest} className={footerClasses} style={style}>
          <div className={styles.simpleContainer}>
            {logo && <div className={styles.simpleLogo}>{logo}</div>}
            {copyright && <p className={styles.copyright}>{copyright}</p>}
          </div>
        </footer>
      )
    }

    return (
      <footer ref={ref} {...rest} className={footerClasses} style={style}>
        <div className={styles.richContainer}>
          {/* Logo and Description */}
          {logo && (
            <div className={styles.brand}>
              <div className={styles.logo}>{logo}</div>
              {social.length > 0 && (
                <div className={styles.social}>
                  {social.map((item, index) => (
                    <a
                      key={index}
                      href={safeHref(item.href)}
                      className={styles.socialLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                    >
                      {item.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Link Columns */}
          {columns.length > 0 && (
            <div className={styles.columns}>
              {columns.map((column, index) => (
                <div key={index} className={styles.column}>
                  <h3 className={styles.columnTitle}>{column.title}</h3>
                  <ul className={styles.linkList}>
                    {column.links.map((link, linkIndex) => {
                      // #321 — external links (absolute http(s) / protocol-
                      // relative) open in a new tab with tabnabbing-safe rel;
                      // relative/internal links keep default behavior.
                      const external = isExternalHref(link.href)
                      return (
                        <li key={linkIndex}>
                          <a
                            href={safeHref(link.href)}
                            className={styles.link}
                            {...(external
                              ? { target: '_blank', rel: 'noopener noreferrer' }
                              : {})}
                          >
                            {link.label}
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Copyright */}
        {copyright && (
          <div className={styles.bottom}>
            <div className={styles.richContainer}>
              <p className={styles.copyright}>{copyright}</p>
            </div>
          </div>
        )}
      </footer>
    )
  }
)

Footer.displayName = 'Footer'
