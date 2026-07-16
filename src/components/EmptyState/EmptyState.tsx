/**
 * EmptyState Component
 *
 * A centered empty state display with icon, title, description, and actions.
 * Provides visual feedback when content is unavailable or actions are needed.
 *
 * @example
 * <EmptyState
 *   variant="no-data"
 *   title="No tasks found"
 *   description="Create your first task to get started"
 *   action={{ label: "Create Task", onClick: () => {} }}
 * />
 */

import React from 'react'
import { Button } from '../Button'
import { Slot } from '../Slot'
import styles from './EmptyState.module.css'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Render through the single child element (Radix-style `asChild`),
   * merging EmptyState's root class + forwarded props onto it instead of
   * emitting the default outer `<div>` (#424). The child becomes the
   * container-query host (`.sizer`); the inner `.emptyState` stays a
   * descendant so the `@container` rules still match.
   */
  asChild?: boolean
  /** Variant determines default icon and styling */
  variant?: 'no-data' | 'error' | 'search' | 'create'
  /** Custom icon to display */
  icon?: React.ReactNode
  /** Main title text */
  title: string
  /** Optional description text */
  description?: string
  /** Primary action button */
  action?: {
    label: string
    onClick: () => void
  }
  /** Secondary action button */
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      variant = 'no-data',
      icon,
      title,
      description,
      action,
      secondaryAction,
      asChild = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // #281 — the OUTER element is both the container-query host (`.sizer`) and the
    // public root: it keeps the forwarded `ref`, the consumer `className`, and the
    // spread `{...props}` (style / id / onClick / data-* / aria-*), so the
    // outermost element a consumer measures / styles / wires events to is
    // unchanged from before the wrapper existed. The INNER `.emptyState` is a
    // DESCENDANT of the host, so the `@container empty-state` rules match without
    // a self-rule no-op.
    const outerClasses = [styles.sizer, className].filter(Boolean).join(' ')

    const defaultIcon = icon || getDefaultIcon(variant)

    // The inner `.emptyState` element is the container-query descendant and is
    // shared by both render paths.
    const inner = (
      <div className={styles.emptyState}>
        <div className={styles.iconWrapper}>{defaultIcon}</div>

        <div className={styles.content}>
          <h3 className={styles.title}>{title}</h3>
          {description && <p className={styles.description}>{description}</p>}
        </div>

        {(action || secondaryAction) && (
          <div className={styles.actions}>
            {action && (
              <Button variant="primary" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    )

    // #424 — polymorphic root. When asChild, delegate the `.sizer` host to the
    // consumer's single child: the inner `.emptyState` block is injected as
    // that child's content, and Slot merges the host class + forwarded props
    // onto it (the child becomes the container-query host). Default `<div>`.
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement
      return (
        <Slot ref={ref as React.Ref<HTMLElement>} className={outerClasses} {...props}>
          {React.cloneElement(child, undefined, inner)}
        </Slot>
      )
    }

    return (
      <div ref={ref} className={outerClasses} {...props}>
        {inner}
      </div>
    )
  }
)

EmptyState.displayName = 'EmptyState'

// Default icons for each variant
const getDefaultIcon = (variant: string) => {
  switch (variant) {
    case 'no-data':
      return <NoDataIcon />
    case 'error':
      return <ErrorIcon />
    case 'search':
      return <SearchIcon />
    case 'create':
      return <CreateIcon />
    default:
      return <NoDataIcon />
  }
}

// Icon Components
const NoDataIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const ErrorIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const SearchIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const CreateIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
)
