'use client'

/**
 * DetailCard Component
 *
 * Generic detailed information card with structured fields.
 * More flexible than TaskCard or ApprovalCard - can represent any detailed entity.
 *
 * Deliberate standalone component (distinct markup/CSS; composes `Card`), not a
 * `Card` recipe — the recipe-vs-component boundary is a recorded decision
 * (#515), with recipe-ification tracked for the future Recipes layer (#415).
 *
 * @example
 * <DetailCard
 *   title="Project Milestone"
 *   subtitle="Q4 2024 Release"
 *   icon={<ProjectIcon />}
 *   badges={[<Badge variant="success">Active</Badge>]}
 *   description="Complete feature development and testing phase"
 *   fields={[
 *     { label: 'Owner', value: 'Sarah Chen', icon: <UserIcon /> },
 *     { label: 'Budget', value: '$125,000', icon: <DollarIcon /> },
 *     { label: 'Status', value: 'On Track', variant: 'highlight' }
 *   ]}
 *   date={{
 *     label: 'Due Date',
 *     value: 'Dec 15, 2024',
 *     icon: <CalendarIcon />
 *   }}
 *   actions={
 *     <>
 *       <Button variant="outline" size="sm">View Details</Button>
 *       <Button variant="primary" size="sm">Edit</Button>
 *     </>
 *   }
 * />
 */

import React from 'react'
import { Card, CardBody } from '../Card'
import styles from './DetailCard.module.css'

export interface DetailField {
  /** Field label */
  label: string
  /** Field value - can be text or custom React node */
  value: string | React.ReactNode
  /** Optional icon before field */
  icon?: React.ReactNode
  /** Visual emphasis variant */
  variant?: 'default' | 'secondary' | 'highlight'
}

export interface DetailDate {
  /** Date field label */
  label: string
  /** Date value (formatted string or React node) */
  value: string | React.ReactNode
  /** Optional icon before date */
  icon?: React.ReactNode
}

export interface DetailCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> {
  /** Card title */
  title: string
  /** Optional subtitle below title */
  subtitle?: string
  /** Optional icon in header */
  icon?: React.ReactNode
  /** Optional badges in header */
  badges?: React.ReactNode[]
  /** Optional description paragraph */
  description?: string
  /** Array of structured fields (label/value pairs) */
  fields?: DetailField[]
  /** Prominent date field */
  date?: DetailDate
  /** Action buttons in footer */
  actions?: React.ReactNode
  /** Custom footer content (overrides actions) */
  footer?: React.ReactNode
  /** Card variant */
  variant?: 'default' | 'elevated' | 'outlined'
  /** Card size - scales all internal spacing, fonts, and margins */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Make the entire card clickable */
  onClick?: () => void
  /** Show clickable state */
  clickable?: boolean
  /**
   * Render through the single child element (Radix-style `asChild`),
   * merging DetailCard's root class + forwarded props onto it instead of
   * emitting the default `<div>` (#424). The DetailCard's structured
   * content (header / fields / date / footer) renders INSIDE the provided
   * child element, letting consumers pick the root element (e.g.
   * `<article>`, `<li>`) while keeping the card content and styling.
   */
  asChild?: boolean
  /** Additional CSS class */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
}

export const DetailCard = React.forwardRef<HTMLDivElement, DetailCardProps>((
  {
    title,
    subtitle,
    icon,
    badges = [],
    description,
    fields = [],
    date,
    actions,
    footer,
    variant = 'elevated',
    size = 'md',
    onClick,
    clickable = false,
    asChild = false,
    className = '',
    style,
    children,
    ...rest
  },
  ref
) => {
  const isClickable = clickable || !!onClick

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

  const sizeClass = styles[`size-${size}`]

  // Structured content shared by both the default and asChild render paths.
  const body = (
    <CardBody>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            {icon && <span className={styles.icon}>{icon}</span>}
            <div className={styles.headerText}>
              <h3 className={styles.title}>{title}</h3>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          </div>
          {badges.length > 0 && (
            <div className={styles.badges}>
              {badges.map((badge, index) => (
                <span key={index}>{badge}</span>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        {description && <p className={styles.description}>{description}</p>}

        {/* Fields */}
        {fields.length > 0 && (
          <div className={styles.fields}>
            {fields.map((field, index) => (
              <div
                key={index}
                className={`${styles.field} ${
                  field.variant ? styles[`field--${field.variant}`] : ''
                }`}
              >
                {field.icon && <span className={styles.fieldIcon}>{field.icon}</span>}
                <div className={styles.fieldContent}>
                  <span className={styles.fieldLabel}>{field.label}</span>
                  <div className={styles.fieldValue}>
                    {typeof field.value === 'string' ? (
                      <span>{field.value}</span>
                    ) : (
                      field.value
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Prominent Date Field */}
        {date && (
          <div className={styles.dateSection}>
            {date.icon && <span className={styles.dateIcon}>{date.icon}</span>}
            <div className={styles.dateContent}>
              <span className={styles.dateLabel}>{date.label}</span>
              <div className={styles.dateValue}>
                {typeof date.value === 'string' ? <span>{date.value}</span> : date.value}
              </div>
            </div>
          </div>
        )}

        {/* Footer with Actions or Custom Content */}
        {(footer || actions) && (
          <div className={styles.footer}>
            {footer || <div className={styles.actions}>{actions}</div>}
          </div>
        )}
      </CardBody>
  )

  const cardClassName = `${styles.card} ${
    isClickable ? styles.clickable : ''
  } ${sizeClass} ${className}`

  const interactionProps = isClickable
    ? {
        onClick: handleClick,
        tabIndex: 0,
        onKeyDown: handleKeyDown,
        role: 'button' as const,
      }
    : {}

  // #424 — polymorphic root. When asChild, delegate the card surface to the
  // consumer's single child element: the DetailCard's structured content is
  // injected as that child's content, and Card's asChild path merges the
  // `.card` + DetailCard classes onto it. The consumer picks the root element
  // (e.g. <article>, <li>) while keeping the card content + styling.
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement
    const childWithBody = React.cloneElement(child, undefined, body)
    return (
      <Card
        ref={ref}
        asChild
        variant={variant}
        clickable={isClickable}
        className={cardClassName}
        style={style}
        {...interactionProps}
        {...(rest as React.HTMLAttributes<HTMLElement>)}
      >
        {childWithBody}
      </Card>
    )
  }

  return (
    <Card
      ref={ref}
      variant={variant}
      /*
       * #75 — Pass `clickable` through to Card when DetailCard was given an
       * onClick. Card drops onClick from its rendered element unless its own
       * `clickable` prop is true (the prop switches the root from <div> to
       * <button>). Previously mouse clicks on a DetailCard with onClick did
       * nothing; keyboard worked because onKeyDown flowed through the
       * ...rest spread and called onClick from closure.
       */
      clickable={isClickable}
      className={cardClassName}
      style={style}
      {...interactionProps}
      {...(rest as React.HTMLAttributes<HTMLElement>)}
    >
      {body}
    </Card>
  )
})

DetailCard.displayName = 'DetailCard'
