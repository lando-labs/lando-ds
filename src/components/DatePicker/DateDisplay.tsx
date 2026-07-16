/**
 * DateDisplay — read-only formatted date.
 *
 * Server-safe leaf. Renders a date as text inside a semantic `<time>` element
 * (or `<span>` when the consumer opts in) with a machine-readable `dateTime`
 * attribute in ISO `yyyy-mm-dd` form. Zero client JS, zero hooks, zero browser
 * globals — passes the `'use client'` boundary guard and the RSC smoke test
 * naturally.
 *
 * Sprint 55 (#312) — Lane B of v0.34.0.
 *
 * Format defaults
 * ---------------
 * Without a `format` prop we call `date.toLocaleDateString()` — same as the
 * platform default for `<time>` text. Consumers who want a specific format
 * pass a function (e.g. `(d) => d.toISOString().slice(0, 10)` for ISO, or any
 * `Intl.DateTimeFormat` configuration they prefer).
 *
 * The `dateTime` attribute is ALWAYS ISO `yyyy-mm-dd` regardless of the
 * visible format — that's the machine-readable contract assistive tech and
 * web crawlers depend on.
 *
 * @example Default locale formatting
 *   <DateDisplay value="2026-06-29" />
 *   // <time datetime="2026-06-29">6/29/2026</time>
 *
 * @example Custom format
 *   <DateDisplay
 *     value={new Date()}
 *     format={(d) => d.toLocaleDateString('en-US', { dateStyle: 'long' })}
 *   />
 */

import React from 'react'
import { toDate, toISODateString, isValidDate } from './dateUtils'

export type DateValue = Date | string

export interface DateDisplayProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The date to render. String form must be ISO `yyyy-mm-dd`. */
  value: DateValue
  /**
   * Visible-text formatter. Receives the parsed Date and returns the text to
   * render. Defaults to `(d) => d.toLocaleDateString()`.
   */
  format?: (date: Date) => string
  /**
   * Semantic element. `time` is the right default for actual dates; `span` is
   * an escape hatch for editorial uses where `<time>` is too strong a claim
   * (e.g. when the date is fictional or part of prose).
   *
   * @default 'time'
   */
  as?: 'time' | 'span'
  /** Extra class on the rendered element (the visual root). */
  className?: string
}

/**
 * Server-safe (no 'use client' directive — renders identically in Node + browser).
 */
export const DateDisplay = React.forwardRef<HTMLElement, DateDisplayProps>(
  function DateDisplay(
    { value, format, as = 'time', className, style, ...rest },
    forwardedRef
  ) {
    const date = toDate(value)

    // Invalid input → render the raw string (best-effort), no `dateTime`, no
    // throw. Keeps consumers safe if a backend ships a bad string.
    if (!isValidDate(date)) {
      const text = typeof value === 'string' ? value : String(value)
      const Tag = as
      return (
        <Tag ref={forwardedRef as never} className={className} style={style} {...rest}>
          {text}
        </Tag>
      )
    }

    const text = format ? format(date) : date.toLocaleDateString()
    const iso = toISODateString(date)

    if (as === 'span') {
      return (
        <span
          ref={forwardedRef as React.Ref<HTMLSpanElement>}
          className={className}
          style={style}
          {...rest}
        >
          {text}
        </span>
      )
    }

    return (
      <time
        ref={forwardedRef as React.Ref<HTMLTimeElement>}
        dateTime={iso}
        className={className}
        style={style}
        {...rest}
      >
        {text}
      </time>
    )
  }
)

DateDisplay.displayName = 'DateDisplay'
