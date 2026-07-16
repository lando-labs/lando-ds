'use client'

/**
 * SegmentedControl Component
 *
 * A button group for switching between modes/views with subtle animations.
 * Features smooth transitions and keyboard navigation.
 *
 * @example
 * <SegmentedControl
 *   options={[
 *     { value: 'list', label: 'List', icon: <ListIcon /> },
 *     { value: 'grid', label: 'Grid', icon: <GridIcon /> }
 *   ]}
 *   value={view}
 *   onChange={setView}
 * />
 */

import React, { useRef, useEffect, useState } from 'react'
import { useControllableState } from '../../hooks/useControllableState'
import styles from './SegmentedControl.module.css'

export interface SegmentedControlOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export interface SegmentedControlProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Array of options to display */
  options: SegmentedControlOption[]
  /**
   * Currently selected value (controlled). When provided, the component is
   * controlled and the consumer owns the selection via {@link SegmentedControlProps.onChange}.
   */
  value?: string
  /**
   * Initial selected value for uncontrolled usage. Ignored when `value` is
   * provided. Omit both to start with no selection.
   */
  defaultValue?: string
  /**
   * Callback when selection changes. Fires in both controlled and uncontrolled
   * modes (in uncontrolled mode it is an optional observer).
   */
  onChange?: (value: string) => void
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Make control take full width */
  fullWidth?: boolean
  /** Disable all options */
  disabled?: boolean
  /**
   * Additional CSS class on the visual root (the `role="tablist"` control).
   *
   * #422 — `className` now lands on the tablist control element (the visual
   * root carrying the border, padding, and size styles), not the outer
   * `.sizer` container-query wrapper. To style the outer wrapper (margin,
   * grid placement, positioning) use {@link SegmentedControlProps.wrapperClassName}.
   */
  className?: string
  /**
   * Escape hatch: extra class on the OUTER `.sizer` wrapper (#270). The
   * wrapper is a full-width (`width: 100%`), unstyled container-query host that
   * fills the parent's inline size (#463); target it for layout overrides
   * (margin, positioning, grid placement)
   * that previously rode on `className`.
   */
  wrapperClassName?: string
  /** Escape hatch: inline style on the outer `.sizer` wrapper. */
  wrapperStyle?: React.CSSProperties
}

export const SegmentedControl = React.forwardRef<HTMLDivElement, SegmentedControlProps>(
  (props, forwardedRef) => {
    const {
      options,
      value: valueProp,
      defaultValue,
      onChange,
      size = 'md',
      fullWidth = false,
      disabled = false,
      className = '',
      wrapperClassName = '',
      wrapperStyle,
      style,
      ...rest
    } = props
    // Controlled-ness by prop presence, not value (so `value={undefined}` stays
    // controlled rather than falling back to internal state).
    const [value, setValue] = useControllableState<string>({
      value: valueProp,
      defaultValue,
      onChange,
      controlled: 'value' in props,
    })
    const containerRef = useRef<HTMLDivElement>(null)
    const activeButtonRef = useRef<HTMLButtonElement>(null)
    const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({})

    // Merge forwarded ref with internal ref (needed for indicator positioning).
    const setContainerRef = (node: HTMLDivElement | null) => {
      containerRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

  // Update indicator position when active option changes
  useEffect(() => {
    if (activeButtonRef.current && containerRef.current) {
      const container = containerRef.current
      const button = activeButtonRef.current
      const containerRect = container.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()

      setIndicatorStyle({
        width: buttonRect.width,
        transform: `translateX(${buttonRect.left - containerRect.left}px)`,
      })
    }
  }, [value, options])

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (disabled) return

    let nextIndex = index

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        nextIndex = index > 0 ? index - 1 : options.length - 1
        break
      case 'ArrowRight':
        e.preventDefault()
        nextIndex = index < options.length - 1 ? index + 1 : 0
        break
      case 'Home':
        e.preventDefault()
        nextIndex = 0
        break
      case 'End':
        e.preventDefault()
        nextIndex = options.length - 1
        break
      default:
        return
    }

    const nextOption = options[nextIndex]
    if (nextOption) setValue(nextOption.value)
  }

  // #422 — the consumer's `className` / `style` / `...rest` now ride on the
  // VISUAL ROOT (the `role="tablist"` control), which carries the border,
  // padding, and size styles. This is the element a consumer expects to skin.
  const containerClasses = [
    styles.container,
    styles[size],
    fullWidth ? styles.fullWidth : '',
    disabled ? styles.disabled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // #270/#463 — `.sizer` is a full-width, unstyled container-query wrapper (see
  // SegmentedControl.module.css). It stays load-bearing (the container-query
  // host that lets the control fill its slot when narrow, and — via its own
  // `width: 100%` — that CANNOT collapse to 0 when it is a flex/grid item, the
  // #463 fix), so we keep it but expose it via the
  // `wrapperClassName` / `wrapperStyle` escape hatch for
  // layout overrides (margin, positioning, grid placement) that previously
  // rode on `className`. The forwarded ref still points at the
  // `role="tablist"` element so indicator measurement + a11y are unchanged.
  const sizerClasses = [styles.sizer, wrapperClassName].filter(Boolean).join(' ')

  return (
    <div className={sizerClasses} style={wrapperStyle}>
      <div
        ref={setContainerRef}
        className={containerClasses}
        style={style}
        aria-label="Segmented control"
        {...rest}
        role="tablist"
      >
        <div className={styles.indicator} style={indicatorStyle} aria-hidden="true" />
        {options.map((option, index) => {
        const isActive = option.value === value

        return (
          <button
            key={option.value}
            ref={isActive ? activeButtonRef : null}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.option} ${isActive ? styles.active : ''}`}
            onClick={() => !disabled && setValue(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={disabled}
            tabIndex={isActive ? 0 : -1}
          >
            {option.icon && (
              <span className={styles.icon} aria-hidden="true">
                {option.icon}
              </span>
            )}
            <span className={styles.label}>{option.label}</span>
          </button>
        )
        })}
      </div>
    </div>
  )
  }
)

SegmentedControl.displayName = 'SegmentedControl'
