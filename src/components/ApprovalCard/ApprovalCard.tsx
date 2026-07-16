'use client'

/**
 * ApprovalCard Component
 *
 * Rich card for approval workflows with status indicators and action buttons.
 * Combines Card, Badge, and Button components for approval interfaces.
 *
 * Deliberate standalone component (distinct markup/CSS; composes `Card`), not a
 * `Card` recipe — the recipe-vs-component boundary is a recorded decision
 * (#515), with recipe-ification tracked for the future Recipes layer (#415).
 *
 * Two action modes:
 *
 * 1. **Binary mode** (default) — Pass `onApprove` / `onReject` to render
 *    side-by-side primary/outline buttons. Used for simple yes/no approvals
 *    (default `status: 'pending' | 'approved' | 'rejected'`).
 *
 * 2. **Workflow mode** — Pass a `workflow` prop with N transitions to render
 *    a single "Take action ▼" dropdown menu (DS `<Dropdown>`) listing each
 *    transition. Used for multi-state editorial / review flows where the
 *    next status depends on the current one.
 *
 *    `workflow` is mutually exclusive with `onApprove` / `onReject` — when
 *    provided, the binary buttons do NOT render. (In dev, a console.warn
 *    fires if both are passed simultaneously so consumers can pick one.)
 *
 * @example
 * // Binary
 * <ApprovalCard
 *   title="Budget Request #1234"
 *   description="Q4 marketing campaign budget increase"
 *   status="pending"
 *   priority="high"
 *   metadata={[
 *     { label: 'Amount', value: '$50,000' },
 *     { label: 'Submitted', value: '2 days ago' }
 *   ]}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 * />
 *
 * @example
 * // Workflow (N-way transitions)
 * <ApprovalCard
 *   title="The morning investigation"
 *   description="Lead story for tomorrow's edition"
 *   status="pending"
 *   workflow={{
 *     transitions: [
 *       { value: 'revision',      label: 'Send back for revision', description: 'Author will revise' },
 *       { value: 'second_review', label: 'Promote to second review', description: 'Senior editor will review' },
 *       { value: 'killed',        label: 'Kill the story',           description: 'Will not publish', variant: 'danger' },
 *     ],
 *     onTransition: (value) => handleTransition(value),
 *   }}
 * />
 */

import React from 'react'
import { Card, CardBody } from '../Card'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { Dropdown, DropdownItem } from '../Dropdown'
import styles from './ApprovalCard.module.css'

export interface ApprovalMetadata {
  label: string
  value: string
  icon?: React.ReactNode
}

/**
 * A single transition in workflow mode. Rendered as a `<DropdownItem>`.
 */
export interface WorkflowTransition {
  /** Stable identifier passed to `onTransition` when this option is chosen. */
  value: string
  /** Primary label rendered as the menu item's main text. */
  label: string
  /** Optional secondary line rendered beneath the label in muted text. */
  description?: string
  /**
   * Visual treatment for the menu item.
   * - `default` (default): standard text color
   * - `danger`: destructive styling (red text, via DropdownItem `destructive`)
   */
  variant?: 'default' | 'danger'
}

/**
 * Configuration for workflow mode. Replaces the binary approve/reject
 * buttons with a single "Take action ▼" dropdown menu.
 */
export interface WorkflowConfig {
  /** N transitions to offer the user. */
  transitions: WorkflowTransition[]
  /** Called with `transition.value` when the user picks a menu item. */
  onTransition: (value: string) => void
  /** Override the trigger button label. Default `'Take action'`. */
  triggerLabel?: string
}

export interface ApprovalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card title */
  title: string
  /** Optional description */
  description?: string
  /** Approval status */
  status?: 'pending' | 'approved' | 'rejected'
  /** Priority level */
  priority?: 'low' | 'medium' | 'high'
  /** Array of metadata items */
  metadata?: ApprovalMetadata[]
  /** Approve button callback (binary mode). */
  onApprove?: () => void
  /** Reject button callback (binary mode). */
  onReject?: () => void
  /** Custom approve button label */
  approveLabel?: string
  /** Custom reject button label */
  rejectLabel?: string
  /** Disable all interactions */
  disabled?: boolean
  /**
   * Workflow mode — when provided, replaces the binary approve/reject
   * buttons with a "Take action ▼" dropdown menu of N transitions.
   * Mutually exclusive with `onApprove` / `onReject` (workflow wins).
   */
  workflow?: WorkflowConfig
  /**
   * Render through the single child element (Radix-style `asChild`),
   * merging ApprovalCard's root class + forwarded props onto it instead of
   * emitting the default `<div>` (#424). The ApprovalCard's structured
   * content (header / metadata / actions) renders INSIDE the provided child
   * element, letting consumers pick the root element (e.g. `<article>`,
   * `<li>`) while keeping the card content and styling.
   */
  asChild?: boolean
  /** Additional CSS class */
  className?: string
}

/**
 * Inline chevron-down icon for the workflow dropdown trigger. Inlined to
 * avoid adding a lucide-react import to ApprovalCard's bundle entry. Same
 * rendering pattern Table uses internally.
 */
const ChevronDownIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export const ApprovalCard = React.forwardRef<HTMLDivElement, ApprovalCardProps>((
  {
    title,
    description,
    status = 'pending',
    priority,
    metadata = [],
    onApprove,
    onReject,
    approveLabel = 'Approve',
    rejectLabel = 'Reject',
    disabled = false,
    workflow,
    asChild = false,
    className = '',
    style,
    children,
    ...rest
  },
  ref
) => {
  // Dev-only warning: workflow + binary handlers were both passed. Workflow
  // takes precedence; the binary buttons will not render. We don't throw —
  // it's a soft signal so consumers can clean up the call site.
  if (
    process.env.NODE_ENV !== 'production' &&
    workflow &&
    (onApprove || onReject)
  ) {
    console.warn(
      '[ApprovalCard] `workflow` is mutually exclusive with `onApprove` / `onReject`. ' +
        'The binary buttons will not render. Remove one to silence this warning.'
    )
  }

  const getStatusBadge = () => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="success" size="sm">
            Approved
          </Badge>
        )
      case 'rejected':
        return (
          <Badge variant="danger" size="sm">
            Rejected
          </Badge>
        )
      case 'pending':
      default:
        return (
          <Badge variant="warning" size="sm">
            Pending
          </Badge>
        )
    }
  }

  const getPriorityBadge = () => {
    if (!priority) return null

    switch (priority) {
      case 'high':
        return (
          <Badge variant="danger" size="sm" dot>
            High Priority
          </Badge>
        )
      case 'medium':
        return (
          <Badge variant="warning" size="sm" dot>
            Medium Priority
          </Badge>
        )
      case 'low':
        return (
          <Badge variant="info" size="sm" dot>
            Low Priority
          </Badge>
        )
      default:
        return null
    }
  }

  // Workflow mode wins over binary mode whenever it's supplied. Binary buttons
  // only render when status === 'pending' AND a handler is provided AND no
  // workflow was supplied.
  const showWorkflow = !!workflow
  const showBinaryActions =
    !showWorkflow && status === 'pending' && (onApprove || onReject)

  const triggerLabel = workflow?.triggerLabel ?? 'Take action'
  const triggerAriaLabel = title
    ? `${triggerLabel} on '${title}'`
    : triggerLabel

  const fireTransitionOnce = React.useCallback(
    (value: string) => {
      if (!workflow) return
      workflow.onTransition(value)
    },
    [workflow]
  )

  // Structured content shared by both the default and asChild render paths.
  const body = (
    <CardBody>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
          <div className={styles.badges}>
            {getStatusBadge()}
            {getPriorityBadge()}
          </div>
        </div>

        {/* Description */}
        {description && <p className={styles.description}>{description}</p>}

        {/* Metadata Grid */}
        {metadata.length > 0 && (
          <div className={styles.metadata}>
            {metadata.map((item, index) => (
              <div key={index} className={styles.metadataItem}>
                {item.icon && <span className={styles.metadataIcon}>{item.icon}</span>}
                <div className={styles.metadataContent}>
                  <span className={styles.metadataLabel}>{item.label}</span>
                  <span className={styles.metadataValue}>{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workflow dropdown — N-way transitions */}
        {showWorkflow && workflow && (
          <div className={styles.actions}>
            <Dropdown
              align="right"
              trigger={
                <Button
                  variant="primary"
                  size="sm"
                  disabled={disabled}
                  fullWidth
                  aria-label={triggerAriaLabel}
                  rightIcon={<ChevronDownIcon />}
                  className={styles.workflowTrigger}
                >
                  {triggerLabel}
                </Button>
              }
            >
              {workflow.transitions.map((transition) => (
                <DropdownItem
                  key={transition.value}
                  destructive={transition.variant === 'danger'}
                  disabled={disabled}
                  onClick={() => fireTransitionOnce(transition.value)}
                  className={styles.workflowItem}
                >
                  <span className={styles.workflowItemLabel}>
                    {transition.label}
                  </span>
                  {transition.description && (
                    <span className={styles.workflowItemDescription}>
                      {transition.description}
                    </span>
                  )}
                </DropdownItem>
              ))}
            </Dropdown>
          </div>
        )}

        {/* Binary action buttons — only when no workflow and pending */}
        {showBinaryActions && (
          <div className={styles.actions}>
            {onReject && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReject}
                disabled={disabled}
                fullWidth
              >
                {rejectLabel}
              </Button>
            )}
            {onApprove && (
              <Button
                variant="primary"
                size="sm"
                onClick={onApprove}
                disabled={disabled}
                fullWidth
              >
                {approveLabel}
              </Button>
            )}
          </div>
        )}
      </CardBody>
  )

  const cardClassName = `${styles.card} ${className}`

  // #424 — polymorphic root. When asChild, delegate the card surface to the
  // consumer's single child element: the ApprovalCard's structured content is
  // injected as that child's content, and Card's asChild path merges the
  // `.card` + ApprovalCard classes onto it. The consumer picks the root
  // element (e.g. <article>, <li>) while keeping the card content + styling.
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement
    const childWithBody = React.cloneElement(child, undefined, body)
    return (
      <Card
        {...rest}
        ref={ref}
        asChild
        variant="elevated"
        className={cardClassName}
        style={style}
      >
        {childWithBody}
      </Card>
    )
  }

  return (
    <Card
      {...rest}
      ref={ref}
      variant="elevated"
      className={cardClassName}
      style={style}
    >
      {body}
    </Card>
  )
})

ApprovalCard.displayName = 'ApprovalCard'
