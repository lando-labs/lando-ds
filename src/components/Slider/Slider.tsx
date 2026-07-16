'use client'

/**
 * Slider Component
 *
 * A range input slider with single-value or dual-thumb (range) mode.
 * Built on a custom thumb with role="slider" (not native <input type="range">)
 * so we can support range mode and consistent token-driven styling across
 * browsers.
 *
 * Modes are inferred from the value shape:
 *   - `value` / `defaultValue` is a number → single-thumb mode
 *   - `value` / `defaultValue` is `[min, max]` tuple → range (two-thumb) mode
 *
 * @example Single
 * <Slider defaultValue={50} min={0} max={100} step={1} label="Volume" />
 *
 * @example Range
 * <Slider defaultValue={[20, 80]} label="Price range" showValue />
 *
 * @example Controlled
 * <Slider value={volume} onChange={setVolume} />
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import styles from './Slider.module.css'

export type SliderValue = number | [number, number]

export interface SliderProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'defaultValue' | 'children'
  > {
  /** Controlled value. Pass a `[min, max]` tuple to render range mode. */
  value?: SliderValue
  /** Uncontrolled initial value. Pass a tuple for range mode. */
  defaultValue?: SliderValue
  /** Fires on every committed value change. Signature matches the mode. */
  onChange?: (value: SliderValue) => void
  /** Inclusive lower bound. Default: 0. */
  min?: number
  /** Inclusive upper bound. Default: 100. */
  max?: number
  /** Step increment. Default: 1. */
  step?: number
  /** Disable all interaction. */
  disabled?: boolean
  /** Accessible label (also rendered visually above the track). */
  label?: string
  /** Render the current value as a tooltip on the active thumb. */
  showValue?: boolean
  /** Format the displayed value (used for tooltip + aria-valuetext). */
  formatValue?: (value: number) => string
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg'
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

/** Clamp a number into [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** Snap n to the nearest multiple of step within [min, max]. */
function snapToStep(n: number, min: number, max: number, step: number): number {
  if (step <= 0) return clamp(n, min, max)
  const steps = Math.round((n - min) / step)
  const snapped = min + steps * step
  // Avoid float drift like 0.30000000000000004 — round to step precision.
  const decimals = (step.toString().split('.')[1] ?? '').length
  const rounded = decimals > 0 ? Number(snapped.toFixed(decimals)) : snapped
  return clamp(rounded, min, max)
}

/** Convert a value to a 0–100 percentage along [min, max]. */
function valueToPercent(value: number, min: number, max: number): number {
  if (max === min) return 0
  return ((value - min) / (max - min)) * 100
}

/** Detect range mode from the active value (controlled or uncontrolled). */
function isRange(v: SliderValue | undefined): v is [number, number] {
  return Array.isArray(v)
}

/** Normalize a [number, number] so element 0 is always ≤ element 1. */
function sortRange(v: [number, number]): [number, number] {
  return v[0] <= v[1] ? v : [v[1], v[0]]
}

// -----------------------------------------------------------------------------
// component
// -----------------------------------------------------------------------------

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      label,
      showValue = false,
      formatValue,
      size = 'md',
      className = '',
      id,
      ...rest
    },
    forwardedRef,
  ) => {
    const generatedId = useId()
    const sliderId = id ?? generatedId
    const labelId = `${sliderId}-label`

    // Mode is locked in by the FIRST defined value we see. We can't flip modes
    // mid-life (it would change the onChange signature contract), so this just
    // checks whichever of controlled/defaultValue is provided.
    const range = isRange(controlledValue ?? defaultValue)

    // Build the initial uncontrolled state. If neither controlled nor default,
    // a single slider sits at `min`; a range… well, can't happen — `range` is
    // only true when an array was passed. Defaulting to [min, max] here keeps
    // TS happy and gives a sensible value if a consumer passes `[]` somehow.
    const initial: SliderValue = (() => {
      if (controlledValue !== undefined) return controlledValue
      if (defaultValue !== undefined) return defaultValue
      return range ? [min, max] : min
    })()

    const [uncontrolledValue, setUncontrolledValue] = useState<SliderValue>(initial)
    const currentValue = controlledValue ?? uncontrolledValue

    // Normalize tuple ordering for downstream math without mutating the input.
    const normalized: SliderValue = isRange(currentValue)
      ? sortRange(currentValue)
      : clamp(currentValue, min, max)

    // Track which thumb has keyboard/pointer focus in range mode. We can't
    // rely on document.activeElement alone because pointer drag temporarily
    // moves focus around.
    const [activeThumb, setActiveThumb] = useState<0 | 1>(0)

    const trackRef = useRef<HTMLDivElement>(null)
    const thumb0Ref = useRef<HTMLDivElement>(null)
    const thumb1Ref = useRef<HTMLDivElement>(null)

    // ---------------------------------------------------------------------
    // value commit — handles controlled/uncontrolled + onChange dispatch.
    // The "next" arg is the partial change (a single number or the tuple).
    // ---------------------------------------------------------------------
    const commit = useCallback(
      (next: SliderValue) => {
        // For range mode, re-sort and re-clamp every commit so thumb crossings
        // are normalized on the way out.
        const cleaned: SliderValue = isRange(next)
          ? sortRange([
              clamp(next[0], min, max),
              clamp(next[1], min, max),
            ])
          : clamp(next, min, max)

        if (controlledValue === undefined) {
          setUncontrolledValue(cleaned)
        }
        onChange?.(cleaned)
      },
      [controlledValue, max, min, onChange],
    )

    // Update a single thumb in range mode while keeping the other fixed.
    // Cross-the-aisle behavior: if thumb 0 is dragged past thumb 1 (or vice
    // versa), we CLAMP rather than swap — the active thumb stays the active
    // thumb, just pinned at the boundary. This is the WAI-ARIA "two thumb
    // slider" guidance (cross-clamping prevents the dragged thumb from
    // "magically" becoming the other thumb mid-drag, which is disorienting
    // for keyboard + AT users).
    const commitRangeThumb = useCallback(
      (index: 0 | 1, nextValue: number) => {
        if (!isRange(normalized)) return
        const [a, b] = normalized
        const clamped = clamp(nextValue, min, max)
        const next: [number, number] =
          index === 0
            ? [Math.min(clamped, b), b]
            : [a, Math.max(clamped, a)]
        commit(next)
      },
      [commit, max, min, normalized],
    )

    // ---------------------------------------------------------------------
    // keyboard
    // ---------------------------------------------------------------------
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent, thumbIndex: 0 | 1) => {
        if (disabled) return

        const bigStep = Math.max(step, (max - min) / 10)
        const current = isRange(normalized) ? normalized[thumbIndex] : normalized

        let next: number | null = null
        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowUp':
            next = snapToStep(current + step, min, max, step)
            break
          case 'ArrowLeft':
          case 'ArrowDown':
            next = snapToStep(current - step, min, max, step)
            break
          case 'PageUp':
            next = snapToStep(current + bigStep, min, max, step)
            break
          case 'PageDown':
            next = snapToStep(current - bigStep, min, max, step)
            break
          case 'Home':
            next = min
            break
          case 'End':
            next = max
            break
          default:
            return
        }

        event.preventDefault()
        if (isRange(normalized)) {
          commitRangeThumb(thumbIndex, next)
        } else {
          commit(next)
        }
      },
      [commit, commitRangeThumb, disabled, max, min, normalized, step],
    )

    // ---------------------------------------------------------------------
    // pointer drag (works for both mouse + touch via pointer events)
    // ---------------------------------------------------------------------

    /** Map a clientX coordinate to a snapped value inside the track. */
    const xToValue = useCallback(
      (clientX: number): number => {
        const track = trackRef.current
        if (!track) return min
        const rect = track.getBoundingClientRect()
        if (rect.width === 0) return min
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
        const raw = min + ratio * (max - min)
        return snapToStep(raw, min, max, step)
      },
      [max, min, step],
    )

    /**
     * Pick which thumb should respond to a pointer at clientX. The CLOSER
     * thumb wins; on a tie we prefer thumb 0 (the lower one) so dragging
     * from the dead-center of the track has predictable behavior.
     */
    const closestThumb = useCallback(
      (clientX: number): 0 | 1 => {
        if (!isRange(normalized)) return 0
        const target = xToValue(clientX)
        const d0 = Math.abs(target - normalized[0])
        const d1 = Math.abs(target - normalized[1])
        return d0 <= d1 ? 0 : 1
      },
      [normalized, xToValue],
    )

    const draggingRef = useRef<0 | 1 | null>(null)

    const handleThumbPointerDown = useCallback(
      (event: React.PointerEvent, thumbIndex: 0 | 1) => {
        if (disabled) return
        event.preventDefault()
        // jsdom (used by Vitest) doesn't fully implement the Pointer Events
        // API, so setPointerCapture can be missing on the element. Guard
        // every call so unit tests don't blow up and real browsers still get
        // capture semantics (drag continues even if the cursor exits the thumb).
        const targetEl = event.target as HTMLElement
        if (typeof targetEl.setPointerCapture === 'function') {
          targetEl.setPointerCapture(event.pointerId)
        }
        draggingRef.current = thumbIndex
        setActiveThumb(thumbIndex)
        // Move focus to the thumb being dragged so subsequent keyboard
        // arrows continue the gesture from the same thumb.
        const focusTarget = thumbIndex === 0 ? thumb0Ref.current : thumb1Ref.current
        focusTarget?.focus()
      },
      [disabled],
    )

    const handleThumbPointerMove = useCallback(
      (event: React.PointerEvent) => {
        if (disabled || draggingRef.current === null) return
        const thumbIndex = draggingRef.current
        const next = xToValue(event.clientX)
        if (isRange(normalized)) {
          commitRangeThumb(thumbIndex, next)
        } else {
          commit(next)
        }
      },
      [commit, commitRangeThumb, disabled, normalized, xToValue],
    )

    const handleThumbPointerUp = useCallback(
      (event: React.PointerEvent) => {
        if (draggingRef.current === null) return
        const targetEl = event.target as HTMLElement
        if (typeof targetEl.releasePointerCapture === 'function') {
          // jsdom may not implement this either — guard symmetrically with
          // setPointerCapture above.
          targetEl.releasePointerCapture(event.pointerId)
        }
        draggingRef.current = null
      },
      [],
    )

    /**
     * Track click — jump the nearest thumb to the click position and start
     * a drag from there. This is the "iOS / Material" affordance most users
     * expect from a slider.
     */
    const handleTrackPointerDown = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) return
        // If the down event already targets a thumb, defer to the thumb's
        // own handler — don't double-process.
        const targetEl = event.target as HTMLElement
        if (targetEl.closest(`.${styles.thumb}`)) return

        const thumbIndex = closestThumb(event.clientX)
        const nextValue = xToValue(event.clientX)

        if (isRange(normalized)) {
          commitRangeThumb(thumbIndex, nextValue)
        } else {
          commit(nextValue)
        }

        // Hand the gesture off to the targeted thumb so the user can
        // continue dragging without lifting their finger/mouse.
        const focusTarget = thumbIndex === 0 ? thumb0Ref.current : thumb1Ref.current
        focusTarget?.focus()
        setActiveThumb(thumbIndex)

        if (focusTarget) {
          if (typeof focusTarget.setPointerCapture === 'function') {
            // Guard for jsdom — same rationale as handleThumbPointerDown.
            focusTarget.setPointerCapture(event.pointerId)
          }
          draggingRef.current = thumbIndex
        }
      },
      [closestThumb, commit, commitRangeThumb, disabled, normalized, xToValue],
    )

    // Belt-and-suspenders cleanup: if the component unmounts mid-drag, drop
    // any pending capture so the pointer-events ref stays consistent.
    useEffect(() => {
      return () => {
        draggingRef.current = null
      }
    }, [])

    // ---------------------------------------------------------------------
    // render math
    // ---------------------------------------------------------------------
    const v0 = isRange(normalized) ? normalized[0] : 0
    const v1 = isRange(normalized) ? normalized[1] : normalized
    const v0Percent = isRange(normalized) ? valueToPercent(v0, min, max) : 0
    const v1Percent = valueToPercent(v1, min, max)
    const fillStart = isRange(normalized) ? v0Percent : 0
    const fillEnd = v1Percent

    const fmt = (n: number): string => (formatValue ? formatValue(n) : String(n))

    const wrapperClasses = [
      styles.wrapper,
      styles[size],
      disabled ? styles.disabled : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    // Renders one thumb. Centralized to avoid copy-paste between the single
    // and range branches.
    const renderThumb = (
      thumbIndex: 0 | 1,
      value: number,
      percent: number,
      thumbLabel: string,
    ) => {
      const thumbRef = thumbIndex === 0 ? thumb0Ref : thumb1Ref
      const isActive = activeThumb === thumbIndex
      return (
        <div
          ref={thumbRef}
          key={thumbIndex}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-orientation="horizontal"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formatValue ? fmt(value) : undefined}
          aria-label={thumbLabel}
          aria-disabled={disabled || undefined}
          className={[
            styles.thumb,
            isActive ? styles.thumbActive : '',
          ].filter(Boolean).join(' ')}
          style={{ left: `${percent}%` }}
          onKeyDown={(e) => handleKeyDown(e, thumbIndex)}
          onPointerDown={(e) => handleThumbPointerDown(e, thumbIndex)}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={handleThumbPointerUp}
          onFocus={() => setActiveThumb(thumbIndex)}
          data-testid={isRange(normalized) ? `slider-thumb-${thumbIndex}` : 'slider-thumb'}
        >
          {showValue && (
            <span className={styles.tooltip} aria-hidden="true">
              {fmt(value)}
            </span>
          )}
        </div>
      )
    }

    // Compose the visible thumb label for screen readers. In range mode the
    // two thumbs need to be distinguishable; we tag them as Minimum/Maximum.
    // In single mode we just forward the consumer's label.
    const baseLabel = label ?? 'Slider'
    const thumb0Label = isRange(normalized) ? `${baseLabel} minimum value` : baseLabel
    const thumb1Label = isRange(normalized) ? `${baseLabel} maximum value` : baseLabel

    return (
      <div
        ref={forwardedRef}
        id={sliderId}
        className={wrapperClasses}
        {...rest}
      >
        {label && (
          <label id={labelId} htmlFor={sliderId} className={styles.label}>
            {label}
          </label>
        )}
        <div
          ref={trackRef}
          className={styles.track}
          onPointerDown={handleTrackPointerDown}
          data-testid="slider-track"
        >
          <div
            className={styles.fill}
            style={{
              left: `${fillStart}%`,
              width: `${fillEnd - fillStart}%`,
            }}
            aria-hidden="true"
          />
          {isRange(normalized)
            ? [
                renderThumb(0, v0, v0Percent, thumb0Label),
                renderThumb(1, v1, v1Percent, thumb1Label),
              ]
            : renderThumb(0, v1, v1Percent, thumb1Label)}
        </div>
      </div>
    )
  },
)

Slider.displayName = 'Slider'
