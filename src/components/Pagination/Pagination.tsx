'use client'

/**
 * Pagination Component
 *
 * Navigation for paginated content with smart page range calculation.
 * Shows ellipsis for skipped pages and keyboard navigation support.
 *
 * @example
 * <Pagination
 *   currentPage={5}
 *   totalPages={10}
 *   onPageChange={(page) => console.log(page)}
 * />
 */

import React from 'react'
import styles from './Pagination.module.css'

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  /** Current active page (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Callback when page changes */
  onPageChange: (page: number) => void
  /** Number of pages to show around current page */
  siblingCount?: number
  /** Show first and last page buttons */
  showFirstLast?: boolean
  /** Show previous and next buttons */
  showPrevNext?: boolean
  /** Disable all interactions */
  disabled?: boolean
  /** Additional CSS class merged onto the `<nav>` root. */
  className?: string
  /**
   * Inline styles merged onto the `<nav>` root.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
  /**
   * Custom renderer for page number items. When provided, replaces the
   * default `<button onClick>` with whatever the consumer returns. Enables
   * URL-driven pagination (e.g., `<Link href={...}>`) with next/link or
   * react-router. The renderer receives the page number + a label + helpers
   * and should apply its result WITHIN the provided `<li>` wrapper (or
   * return the inner content and let Pagination wrap it).
   *
   * @example
   * import Link from 'next/link'
   * <Pagination
   *   currentPage={page}
   *   totalPages={10}
   *   onPageChange={() => {}}
   *   renderItem={(page, { isActive }) => (
   *     <Link href={`?page=${page}`} aria-current={isActive ? 'page' : undefined}>
   *       {page}
   *     </Link>
   *   )}
   * />
   */
  renderItem?: (
    page: number,
    ctx: { isActive: boolean; disabled: boolean }
  ) => React.ReactNode
}

/**
 * Generate smart page range with ellipsis
 * Example: [1, '...', 4, 5, 6, '...', 10]
 */
const generatePageRange = (
  currentPage: number,
  totalPages: number,
  siblingCount: number
): (number | string)[] => {
  // Total page numbers to show (current + siblings on each side + first + last + ellipsis)
  const totalNumbers = siblingCount * 2 + 5

  // If total pages is small, show all pages
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

  const showLeftEllipsis = leftSiblingIndex > 2
  const showRightEllipsis = rightSiblingIndex < totalPages - 1

  // Case 1: No ellipsis needed
  if (!showLeftEllipsis && !showRightEllipsis) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  // Case 2: Only right ellipsis
  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from(
      { length: 3 + 2 * siblingCount },
      (_, i) => i + 1
    )
    return [...leftRange, '...', totalPages]
  }

  // Case 3: Only left ellipsis
  if (showLeftEllipsis && !showRightEllipsis) {
    const rightRange = Array.from(
      { length: 3 + 2 * siblingCount },
      (_, i) => totalPages - (3 + 2 * siblingCount) + i + 1
    )
    return [1, '...', ...rightRange]
  }

  // Case 4: Both ellipsis
  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, i) => leftSiblingIndex + i
  )
  return [1, '...', ...middleRange, '...', totalPages]
}

export const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  (
    {
      currentPage,
      totalPages,
      onPageChange,
      siblingCount = 1,
      showFirstLast = true,
      showPrevNext = true,
      disabled = false,
      className = '',
      style,
      renderItem,
      ...rest
    },
    ref
  ) => {
  const pageRange = generatePageRange(currentPage, totalPages, siblingCount)

  const handlePageClick = (page: number) => {
    if (disabled || page === currentPage || page < 1 || page > totalPages) return
    onPageChange(page)
  }

  const handleKeyDown = (e: React.KeyboardEvent, page: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handlePageClick(page)
    }
  }

  const paginationClasses = [
    styles.pagination,
    disabled ? styles.disabled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const canGoPrevious = currentPage > 1 && !disabled
  const canGoNext = currentPage < totalPages && !disabled

  return (
    <nav
      ref={ref}
      // Consumer escape hatch spread BEFORE the internal role/aria-label so
      // the component's navigation landmark stays authoritative.
      {...rest}
      className={paginationClasses}
      style={style}
      role="navigation"
      aria-label="Pagination"
    >
      <ul className={styles.list}>
        {/* First Page Button */}
        {showFirstLast && (
          <li>
            <button
              className={[styles.button, styles.navButton].join(' ')}
              onClick={() => handlePageClick(1)}
              disabled={!canGoPrevious}
              aria-label="Go to first page"
              title="First page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
            </button>
          </li>
        )}

        {/* Previous Button */}
        {showPrevNext && (
          <li>
            <button
              className={[styles.button, styles.navButton].join(' ')}
              onClick={() => handlePageClick(currentPage - 1)}
              disabled={!canGoPrevious}
              aria-label="Go to previous page"
              title="Previous page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </li>
        )}

        {/* Page Numbers */}
        {pageRange.map((page, index) => {
          if (page === '...') {
            return (
              <li key={`ellipsis-${index}`}>
                <span className={styles.ellipsis} aria-hidden="true">
                  ...
                </span>
              </li>
            )
          }

          const pageNumber = page as number
          const isActive = pageNumber === currentPage

          // Custom renderer wins (for next/link integration, etc.)
          if (renderItem) {
            return (
              <li
                key={pageNumber}
                className={[
                  styles.button,
                  styles.pageButton,
                  isActive ? styles.active : '',
                ].join(' ')}
                data-active={isActive || undefined}
              >
                {renderItem(pageNumber, { isActive, disabled })}
              </li>
            )
          }

          return (
            <li key={pageNumber}>
              <button
                className={[
                  styles.button,
                  styles.pageButton,
                  isActive ? styles.active : '',
                ].join(' ')}
                onClick={() => handlePageClick(pageNumber)}
                onKeyDown={(e) => handleKeyDown(e, pageNumber)}
                disabled={disabled}
                aria-label={`Go to page ${pageNumber}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            </li>
          )
        })}

        {/* Next Button */}
        {showPrevNext && (
          <li>
            <button
              className={[styles.button, styles.navButton].join(' ')}
              onClick={() => handlePageClick(currentPage + 1)}
              disabled={!canGoNext}
              aria-label="Go to next page"
              title="Next page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </li>
        )}

        {/* Last Page Button */}
        {showFirstLast && (
          <li>
            <button
              className={[styles.button, styles.navButton].join(' ')}
              onClick={() => handlePageClick(totalPages)}
              disabled={!canGoNext}
              aria-label="Go to last page"
              title="Last page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
  }
)

Pagination.displayName = 'Pagination'
