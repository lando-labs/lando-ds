'use client'

/**
 * TaskCard Component
 *
 * A specialized card for displaying tasks with status, priority, assignee, and tags.
 * Features clickable interactions and visual status indicators.
 *
 * Deliberate standalone component (distinct markup/CSS), not a `Card` recipe —
 * the recipe-vs-component boundary is a recorded decision (#515), with
 * recipe-ification tracked for the future Recipes layer (#415).
 *
 * @example
 * <TaskCard
 *   title="Implement user authentication"
 *   description="Add JWT-based authentication with refresh tokens"
 *   status="in-progress"
 *   priority="high"
 *   assignee={{ name: "John Doe", initials: "JD" }}
 *   dueDate="2025-11-01"
 *   tags={["backend", "security"]}
 *   onClick={() => {}}
 * />
 */

import React from 'react'
import { Badge, type BadgeProps } from '../Badge'
import { Avatar } from '../Avatar'
import { Slot } from '../Slot'
import styles from './TaskCard.module.css'

export interface TaskCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Render through the single child element (Radix-style `asChild`),
   * merging TaskCard's root class + forwarded props onto it instead of
   * emitting the default `<div>` (#424). Use to make the whole task card
   * a semantic `<article>`, an `<a>`, etc. The `.taskCard` root class and
   * `status-*` variant always land on the rendered element either way.
   */
  asChild?: boolean
  /** Task title */
  title: string
  /** Task description */
  description?: string
  /** Task status */
  status?: 'todo' | 'in-progress' | 'done' | 'blocked'
  /** Task priority level */
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  /** Assignee information */
  assignee?: {
    name: string
    avatar?: string
    initials?: string
  }
  /** Due date (string or Date object) */
  dueDate?: string | Date
  /** Array of tag labels */
  tags?: string[]
  /** Action buttons or menu */
  actions?: React.ReactNode
  /** Make the card clickable */
  onClick?: () => void
}

export const TaskCard = React.forwardRef<HTMLDivElement, TaskCardProps>(
  (
    {
      title,
      description,
      status = 'todo',
      priority = 'medium',
      assignee,
      dueDate,
      tags = [],
      actions,
      onClick,
      asChild = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const cardClasses = [
      styles.taskCard,
      styles[`status-${status}`],
      onClick ? styles.clickable : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const handleClick = () => {
      if (onClick) {
        onClick()
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick()
      }
    }

    const formatDate = (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }

    const isOverdue = dueDate
      ? new Date(dueDate) < new Date() && status !== 'done'
      : false

    // Interaction attrs are applied to the visual root in both render paths.
    const interactionProps = {
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      role: onClick ? ('button' as const) : undefined,
      tabIndex: onClick ? 0 : undefined,
    }

    // Structured content shared by both the default and asChild render paths.
    const content = (
      <>
        {/* Status Indicator Bar */}
        <div className={`${styles.statusBar} ${styles[`bar-${status}`]}`} />

        <div className={styles.header}>
          <div className={styles.badges}>
            <Badge variant={getStatusVariant(status)} size="sm">
              {getStatusLabel(status)}
            </Badge>
            <Badge variant={getPriorityVariant(priority)} size="sm">
              {getPriorityLabel(priority)}
            </Badge>
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>

        <div className={styles.content}>
          <h3 className={styles.title}>{title}</h3>
          {description && (
            <p className={styles.description}>{description}</p>
          )}
        </div>

        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map((tag, index) => (
              <span key={index} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          {assignee && (
            <div className={styles.assignee}>
              <Avatar
                src={assignee.avatar}
                initials={assignee.initials}
                alt={assignee.name}
                size="sm"
              />
              <span className={styles.assigneeName}>{assignee.name}</span>
            </div>
          )}

          {dueDate && (
            <div
              className={`${styles.dueDate} ${isOverdue ? styles.overdue : ''}`}
            >
              <CalendarIcon />
              <span>{formatDate(dueDate)}</span>
            </div>
          )}
        </div>
      </>
    )

    // #424 — polymorphic root. When asChild, delegate the root element to the
    // consumer's single child: TaskCard's structured content is injected as
    // that child's content, and Slot merges `.taskCard` + status variant +
    // interaction attrs + forwarded props onto it. Default stays `<div>`.
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={cardClasses}
          {...interactionProps}
          {...props}
        >
          {React.cloneElement(child, undefined, content)}
        </Slot>
      )
    }

    return (
      <div
        ref={ref}
        className={cardClasses}
        {...interactionProps}
        {...props}
      >
        {content}
      </div>
    )
  }
)

TaskCard.displayName = 'TaskCard'

// Helper functions
type BadgeVariant = NonNullable<BadgeProps['variant']>

const getStatusVariant = (status: string): BadgeVariant => {
  const variants: Record<string, BadgeVariant> = {
    todo: 'default',
    'in-progress': 'info',
    done: 'success',
    blocked: 'danger',
  }
  return variants[status] || 'default'
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    done: 'Done',
    blocked: 'Blocked',
  }
  return labels[status] || status
}

const getPriorityVariant = (priority: string): BadgeVariant => {
  const variants: Record<string, BadgeVariant> = {
    low: 'default',
    medium: 'info',
    high: 'warning',
    urgent: 'danger',
  }
  return variants[priority] || 'default'
}

const getPriorityLabel = (priority: string) => {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

// Calendar Icon
const CalendarIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
