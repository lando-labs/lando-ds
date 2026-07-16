/**
 * StatusDot Component
 *
 * A small (~8–10px) semantic-colored circle for indicating status —
 * drift, session lifecycle, agent health, presence, etc. Decorative by
 * default; pass `aria-label` to expose the meaning to assistive tech.
 *
 * Surfaced in a design-system recomposition audit. Recurring pattern
 * previously hand-rolled as `.statusDot` in consumer apps and reproduced
 * ad-hoc in session lifecycle markers.
 *
 * **Why not `<Badge size="dot">`?** Badge is text-bearing and its API
 * contract is built around that. A textless dot-only variant would
 * complicate Badge for the common case to serve a niche one. StatusDot
 * is the dedicated primitive for the textless case.
 *
 * **Why a `label` prop (Sprint 20, #113)?** Every consumer site that
 * wants the canonical "dot + adjacent text" pattern was hand-rolling
 * the same `<Inline gap="xs"><StatusDot/><Text/></Inline>` wrapper.
 * `label` bundles that composition into a single call. When `label`
 * is provided, the dot becomes `aria-hidden="true"` because the label
 * carries the meaning natively.
 *
 * @example
 * // Shorthand — dot + label in one call (Sprint 20).
 * <StatusDot variant="success" label="Healthy" />
 *
 * @example
 * // Decorative — meaning is carried by accompanying text.
 * <Inline gap="xs" align="center">
 *   <StatusDot variant="success" />
 *   <Text>Healthy</Text>
 * </Inline>
 *
 * @example
 * // Standalone — give it an accessible label.
 * <StatusDot variant="warning" aria-label="Drifted" />
 *
 * @example
 * // Larger 10px variant.
 * <StatusDot variant="info" size="md" />
 */

import React from 'react'
import styles from './StatusDot.module.css'

export type StatusDotVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'info'

export type StatusDotSize = 'sm' | 'md'

export interface StatusDotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'role'> {
  /** Semantic color of the dot */
  variant?: StatusDotVariant
  /**
   * Visual size of the dot.
   * - `sm` (default) → 8px
   * - `md`           → 10px
   */
  size?: StatusDotSize
  /**
   * Accessible label. When provided (and `label` is not), the dot is
   * exposed to assistive tech with `role="img"` and the given label.
   * When omitted, the dot is treated as purely decorative
   * (`aria-hidden="true"`) — the surrounding text must carry the
   * meaning.
   */
  'aria-label'?: string
  /**
   * Optional override for `role` when `aria-label` is provided.
   * Defaults to `"img"`. Pass `"status"` for live-region announcements
   * when the dot's color/state changes dynamically.
   */
  role?: 'img' | 'status'
  /**
   * Optional adjacent text label. When provided, renders the canonical
   * dot-plus-text pattern (`<StatusDot/> <Text/>`) as a single inline
   * group. The dot is automatically marked `aria-hidden="true"` because
   * the label text carries the meaning natively. Use this instead of
   * hand-rolling the `<Inline><StatusDot/><Text/></Inline>` wrapper.
   */
  label?: string
}

export const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  (
    {
      variant = 'neutral',
      size = 'sm',
      'aria-label': ariaLabel,
      role,
      label,
      className = '',
      ...props
    },
    ref
  ) => {
    const dotClasses = [styles.dot, styles[variant], styles[size]]
      .filter(Boolean)
      .join(' ')

    // Labeled mode: render a wrapper span containing the dot + text.
    // The dot itself is decorative because the label text carries the
    // meaning natively for screen readers.
    if (label !== undefined) {
      const rootClasses = [styles.root, className].filter(Boolean).join(' ')
      return (
        <span ref={ref} className={rootClasses} {...props}>
          <span className={dotClasses} aria-hidden="true" />
          <span className={styles.label}>{label}</span>
        </span>
      )
    }

    // No-label mode (preserves v0.13.0 behavior exactly): bare dot.
    // When labeled via `aria-label`, expose to AT. When not, hide it —
    // the meaning is carried by sibling text and we don't want screen
    // readers to announce a bare "image" with no semantics.
    const a11yProps = ariaLabel
      ? { role: role ?? 'img', 'aria-label': ariaLabel }
      : { 'aria-hidden': true as const }

    const bareClasses = [dotClasses, className].filter(Boolean).join(' ')
    return <span ref={ref} className={bareClasses} {...a11yProps} {...props} />
  }
)

StatusDot.displayName = 'StatusDot'
