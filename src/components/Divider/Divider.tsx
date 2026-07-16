/**
 * Divider Component
 *
 * Visual separator with optional label and brand-themed styling.
 * Supports horizontal and vertical orientations with various styles.
 *
 * @example
 * <Divider />
 * <Divider variant="dashed" spacing="lg" />
 *
 * // Labeled section-break (issue #22)
 * <Divider label="Or Continue With" />
 * <Divider label="Agents" labelPosition="start" />
 *
 * <Divider orientation="vertical" />
 *
 * // Layer-7 composition (#424) + full attribute passthrough (#423)
 * <Divider asChild><hr data-testid="rule" /></Divider>
 * <Divider style={{ borderColor: 'var(--color-primary)' }} data-testid="rule" />
 */

import React from 'react'
import { Slot } from '../Slot'
import styles from './Divider.module.css'

/**
 * Logical-first label positions. `start` / `end` are preferred; `left` /
 * `right` are retained as aliases for backward compatibility.
 */
export type DividerLabelPosition =
  | 'start'
  | 'center'
  | 'end'
  | 'left'
  | 'right'

export interface DividerProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Orientation of the divider */
  orientation?: 'horizontal' | 'vertical'
  /** Visual style variant */
  variant?: 'solid' | 'dashed' | 'dotted'
  /** Spacing around the divider */
  spacing?: 'sm' | 'md' | 'lg'
  /**
   * Optional label rendered inline with the divider to produce the
   * classic "line — label — line" section-break pattern (issue #22).
   *
   * Horizontal only. When `orientation="vertical"` the label is ignored.
   */
  label?: string | React.ReactNode
  /**
   * Position of the label along the divider.
   *
   * Prefer `start` / `center` / `end`. `left` / `right` are accepted as
   * aliases for backward compatibility.
   */
  labelPosition?: DividerLabelPosition
  /** Additional CSS class */
  className?: string
  /**
   * Render as the single child element, merging Divider styling onto it
   * (Layer-7 composition, #424). Pass a single element as `children`; the
   * `styles.divider` classes and the `role`/`aria-orientation` land on it.
   * Only supported for the unlabeled divider (vertical or plain horizontal);
   * the labeled section-break owns a fixed multi-node internal structure.
   */
  asChild?: boolean
  /**
   * Child element to render when `asChild` is true. Ignored otherwise — a
   * plain Divider renders no children (or its own label structure).
   */
  children?: React.ReactNode
}

/**
 * Normalize logical (start/end) to directional (left/right) so the CSS
 * Module class lookup stays simple and BC-compatible. Note: this only
 * applies to horizontal dividers, which are inherently LTR-oriented
 * for this pattern in the current codebase.
 */
const normalizeLabelPosition = (
  position: DividerLabelPosition
): 'left' | 'center' | 'right' => {
  if (position === 'start') return 'left'
  if (position === 'end') return 'right'
  return position
}

export const Divider = React.forwardRef<HTMLElement, DividerProps>(
  (
    {
      orientation = 'horizontal',
      variant = 'solid',
      spacing = 'md',
      label,
      labelPosition = 'center',
      asChild = false,
      className = '',
      style,
      children,
      ...rest
    },
    ref
  ) => {
    const normalizedPosition = normalizeLabelPosition(labelPosition)

    const dividerClasses = [
      styles.divider,
      styles[orientation],
      styles[variant],
      styles[`spacing-${spacing}`],
      label ? styles.withLabel : '',
      label ? styles[`label-${normalizedPosition}`] : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // For vertical dividers, ignore label (out of scope per issue #22).
    if (orientation === 'vertical') {
      // #423 — spread `{...rest}` (with merged `style`) on the visual root
      // BEFORE the internal role/aria so the semantic contract can't be
      // silently clobbered by a consumer prop. #424 — asChild swaps the
      // element for the caller's single child.
      if (asChild) {
        return (
          <Slot
            ref={ref as React.Ref<HTMLElement>}
            className={dividerClasses}
            style={style}
            {...rest}
            role="separator"
            aria-orientation="vertical"
          >
            {children}
          </Slot>
        )
      }
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          className={dividerClasses}
          style={style}
          {...rest}
          role="separator"
          aria-orientation="vertical"
        />
      )
    }

    // Horizontal divider without label — renders as a semantic <hr>.
    if (!label) {
      if (asChild) {
        return (
          <Slot
            ref={ref as React.Ref<HTMLElement>}
            className={dividerClasses}
            style={style}
            {...rest}
            role="separator"
            aria-orientation="horizontal"
          >
            {children}
          </Slot>
        )
      }
      return (
        <hr
          ref={ref as React.Ref<HTMLHRElement>}
          className={dividerClasses}
          style={style}
          {...rest}
          role="separator"
          aria-orientation="horizontal"
        />
      )
    }

    // Horizontal divider with label (section-break pattern). The labeled
    // divider owns a fixed 3-node internal structure, so `asChild` is not
    // supported here — attribute passthrough (#423) still applies.
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={dividerClasses}
        style={style}
        {...rest}
        role="separator"
        aria-orientation="horizontal"
      >
        <span className={styles.line} aria-hidden="true" />
        <span className={styles.label}>{label}</span>
        <span className={styles.line} aria-hidden="true" />
      </div>
    )
  }
)

Divider.displayName = 'Divider'
