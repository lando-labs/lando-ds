/**
 * StepProgress Component
 *
 * Stepped/discrete progress tracker — distinct from `<Progress>`'s
 * indeterminate loading patterns. Renders a list of named steps with
 * per-step status (completed | active | upcoming | error), connecting
 * lines between adjacent steps, and animated transitions when the
 * active index advances.
 *
 * Two API shapes via discriminated union:
 *
 *   1. Explicit per-step status objects:
 *      <StepProgress steps={[{ label, status }, ...]} />
 *
 *   2. Plain string labels + currentStep index (computed statuses):
 *      <StepProgress steps={['One', 'Two']} currentStep={1} />
 *
 * Indices below `currentStep` resolve to `completed`; the index equal to
 * `currentStep` becomes `active`; indices above `currentStep` are
 * `upcoming`.
 *
 * @example
 * <StepProgress
 *   steps={[
 *     { label: 'Analyzing items', status: 'completed' },
 *     { label: 'Finding patterns', status: 'completed' },
 *     { label: 'Generating insights', status: 'active' },
 *     { label: 'Synthesizing', status: 'upcoming' },
 *   ]}
 *   variant="labeled"
 * />
 *
 * @example
 * <StepProgress
 *   steps={['Sign up', 'Add interests', 'Choose blends', 'Done']}
 *   currentStep={2}
 *   variant="numbered"
 * />
 */

import React from 'react'
import styles from './StepProgress.module.css'

export type StepStatus = 'completed' | 'active' | 'upcoming' | 'error'

export interface StepProgressStep {
  /** Step label text */
  label: string
  /**
   * Per-step status. When provided via the object overload, the
   * consumer is fully in charge; `currentStep` is unavailable.
   */
  status?: StepStatus
}

export type StepProgressOrientation = 'horizontal' | 'vertical'
export type StepProgressVariant = 'dots' | 'labeled' | 'numbered'

interface StepProgressBaseProps
  extends Omit<React.HTMLAttributes<HTMLOListElement>, 'children'> {
  /** Layout direction */
  orientation?: StepProgressOrientation
  /** Visual variant */
  variant?: StepProgressVariant
  /**
   * Accessible label for the underlying list. Defaults to `'Progress'`.
   * Pass via `aria-label` to override.
   *
   * Inherited from `React.HTMLAttributes` — declared here only to document
   * the default. Consumers may also pass any other native `<ol>` attribute
   * (`id`, `data-*`, `style`, event handlers, …) and it lands on the root.
   */
  'aria-label'?: string
  /** Additional CSS class on the root */
  className?: string
}

/**
 * Discriminated overloads. The two shapes are intentionally exclusive:
 * - object overload: `steps: StepProgressStep[]`, no `currentStep`
 * - string overload: `steps: string[]`, **required** `currentStep: number`
 *
 * Passing both `step.status` and `currentStep` is a TS compile error.
 */
export type StepProgressProps = StepProgressBaseProps &
  (
    | {
        steps: StepProgressStep[]
        currentStep?: never
      }
    | {
        steps: string[]
        currentStep: number
      }
  )

const isStringSteps = (
  steps: StepProgressStep[] | string[]
): steps is string[] => steps.length === 0 || typeof steps[0] === 'string'

const resolveSteps = (props: StepProgressProps): StepProgressStep[] => {
  // Object overload — pass through, defaulting missing statuses to 'upcoming'.
  if (!isStringSteps(props.steps)) {
    return props.steps.map((s) => ({
      label: s.label,
      status: s.status ?? 'upcoming',
    }))
  }

  // String overload — derive status from currentStep index.
  const current = props.currentStep ?? 0
  return props.steps.map((label, idx) => ({
    label,
    status:
      idx < current ? 'completed' : idx === current ? 'active' : 'upcoming',
  }))
}

export const StepProgress = React.forwardRef<HTMLOListElement, StepProgressProps>(
  (props, ref) => {
    const {
      orientation = 'horizontal',
      variant = 'dots',
      'aria-label': ariaLabel = 'Progress',
      className = '',
      style,
      ...restProps
    } = props

    // `steps` / `currentStep` are consumed by `resolveSteps(props)` — strip
    // them out of the rest so neither leaks onto the DOM `<ol>`. Destructuring
    // them into throwaway locals trips `noUnusedLocals`, so omit by key
    // instead. Any other passthrough attr (`id`, `data-*`, handlers) survives.
    const {
      steps: _omitSteps,
      currentStep: _omitCurrentStep,
      ...rest
    } = restProps as typeof restProps & {
      steps?: unknown
      currentStep?: unknown
    }
    void _omitSteps
    void _omitCurrentStep

    const resolved = resolveSteps(props)
    const total = resolved.length

    const rootClasses = [
      styles.root,
      styles[`orientation-${orientation}`],
      styles[`variant-${variant}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <ol
        {...rest}
        ref={ref}
        role="list"
        aria-label={ariaLabel}
        className={rootClasses}
        style={style}
        data-orientation={orientation}
        data-variant={variant}
      >
        {resolved.map((step, idx) => {
          const status: StepStatus = step.status ?? 'upcoming'
          const isLast = idx === total - 1
          const next = resolved[idx + 1]
          // Connector is "filled" when this step is completed (the line
          // links a finished step to whatever comes next). We keep the
          // line muted when the *next* step is upcoming and this step
          // is active, matching the typical wizard look.
          const connectorState: 'filled' | 'muted' | 'error' =
            status === 'error'
              ? 'error'
              : status === 'completed'
                ? 'filled'
                : 'muted'

          return (
            <li
              key={`${idx}-${step.label}`}
              className={[styles.step, styles[`status-${status}`]]
                .filter(Boolean)
                .join(' ')}
              aria-current={status === 'active' ? 'step' : undefined}
              data-status={status}
            >
              <div className={styles.markerWrap}>
                <span
                  className={styles.marker}
                  data-status={status}
                  aria-hidden="true"
                >
                  {variant === 'numbered' ? (
                    status === 'completed' ? (
                      // Inline checkmark — keeps bundle clean (no Icon dep).
                      <svg
                        viewBox="0 0 16 16"
                        className={styles.checkIcon}
                        focusable="false"
                      >
                        <path
                          d="M3.5 8.5l3 3 6-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <span className={styles.markerNumber}>{idx + 1}</span>
                    )
                  ) : null}
                </span>

                {/* Connector line to the NEXT step. Skip for the last step. */}
                {!isLast && (
                  <span
                    className={styles.connector}
                    data-state={connectorState}
                    data-next-status={next?.status ?? 'upcoming'}
                    aria-hidden="true"
                  />
                )}
              </div>

              {variant !== 'dots' && (
                <span className={styles.label}>{step.label}</span>
              )}

              {/*
               * Dots variant has no visible label, but screen readers still
               * need to hear each step. Render the label as visually hidden
               * text so the role="list" announces something meaningful.
               */}
              {variant === 'dots' && (
                <span className={styles.srOnly}>{step.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    )
  }
)

StepProgress.displayName = 'StepProgress'
