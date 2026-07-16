'use client'

/**
 * Button Component
 *
 * A versatile button component with multiple variants, sizes, and states.
 * Features subtle ripple effects and smooth animations.
 *
 * When `asChild` is true, the button delegates rendering to a single
 * React element child (e.g. `<Link>`), merging button styling onto it.
 * This enables `next/link` and other routing libs to integrate without
 * invalid `<a><button>` nesting.
 *
 * @example
 * <Button variant="primary" size="md">Click me</Button>
 * <Button variant="outline" leftIcon={<Search />}>With Icon</Button>
 * <Button loading>Loading...</Button>
 *
 * @example
 * // With next/link
 * import Link from 'next/link'
 * <Button asChild variant="primary">
 *   <Link href="/dashboard">Go to Dashboard</Link>
 * </Button>
 */

import React, { useEffect, useRef, useState } from 'react'
import { Slot } from '../Slot'
import styles from './Button.module.css'

/** A single active ripple, tracked in React state (see handleClick). */
interface Ripple {
  id: number
  /** left offset in px, relative to the button box */
  x: number
  /** top offset in px, relative to the button box */
  y: number
  /** diameter in px (square; the CSS `.ripple` rounds it to a circle) */
  size: number
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link'
  /** Size of the button */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Show loading spinner and disable interactions */
  loading?: boolean
  /** Icon to display before the button text */
  leftIcon?: React.ReactNode
  /** Icon to display after the button text */
  rightIcon?: React.ReactNode
  /** Make button take full width of container */
  fullWidth?: boolean
  /**
   * Render as the single child element, merging button props onto it.
   * Useful for integrating with routing libraries like next/link.
   *
   * `leftIcon` / `rightIcon` ARE supported when `asChild=true` (#380):
   * the Button composes them with the child's own content so a
   * link-button like `<Button asChild leftIcon={<Arrow />}><Link>Go</Link></Button>`
   * renders `<a class="…btn"><Arrow />Go</a>`.
   *
   * `loading` is still ignored under `asChild` — a routing element has
   * no sensible "loading" semantic; if you need the spinner, render the
   * real `<Button>` (no `asChild`) and handle navigation in `onClick`.
   */
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      asChild = false,
      className = '',
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Ripples live in React state (not hand-appended DOM nodes) so React owns
    // their lifecycle. The old imperative version did
    // `document.createElement('span')` + `setTimeout(remove, 600)`, which
    // leaked a detached node + a pending timer if the button unmounted
    // mid-animation. Here each ripple is a rendered element removed by a timer
    // that is itself cleared on unmount. (#337)
    const [ripples, setRipples] = useState<Ripple[]>([])
    const rippleIdRef = useRef(0)
    const rippleTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

    useEffect(() => {
      const timers = rippleTimersRef.current
      return () => {
        for (const t of timers) clearTimeout(t)
        timers.clear()
      }
    }, [])

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) {
        // In the asChild path the child (e.g. `<a href>`) is not natively
        // disabled, so also cancel its default action (navigation). Slot runs
        // the child's handler first, then this one, but preventDefault still
        // suppresses the browser default that fires after all handlers. The
        // non-asChild `<button>` is natively disabled, so this never runs there.
        e.preventDefault()
        return
      }

      const button = e.currentTarget
      const rect = button.getBoundingClientRect()
      const diameter = Math.max(rect.width, rect.height)
      const x = e.clientX - rect.left - diameter / 2
      const y = e.clientY - rect.top - diameter / 2
      const id = (rippleIdRef.current += 1)

      setRipples((prev) => [...prev, { id, x, y, size: diameter }])

      // Remove this ripple once its 0.6s CSS animation has finished. The timer
      // handle is tracked so the unmount effect above can clear it.
      const timer = setTimeout(() => {
        rippleTimersRef.current.delete(timer)
        setRipples((prev) => prev.filter((r) => r.id !== id))
      }, 600)
      rippleTimersRef.current.add(timer)

      if (props.onClick) {
        props.onClick(e)
      }
    }

    // Rendered ripple <span>s — geometry inline, animation from the CSS class.
    const rippleElements = ripples.map((r) => (
      <span
        key={r.id}
        className={styles.ripple}
        style={{ width: r.size, height: r.size, left: r.x, top: r.y }}
      />
    ))

    const buttonClasses = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth ? styles.fullWidth : '',
      loading ? styles.loading : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    if (asChild) {
      const { onClick: _, ...restProps } = props

      // #380 — compose `leftIcon` / `rightIcon` INTO the single child so a
      // routing link-button like
      //   <Button asChild leftIcon={<X/>}><a>Go</a></Button>
      // renders <a class="…btn"><span>X</span>Go</a> rather than dropping
      // the icon (which the v0.27.x docs noted as a known limitation).
      //
      // We deliberately do NOT spread an icon when `loading=true` — under
      // asChild there is no spinner to swap for (the routing element has
      // no "loading" semantic), so icons stay visible. This matches the
      // non-asChild branch's icon mirroring rules for the non-loading case.
      // Compose when there are icons OR active ripples (post-click). With
      // neither, the child passes through verbatim (preserves the #380
      // "verbatim child" contract). When only ripples are present, the child's
      // own content is rendered unwrapped and the ripple spans are appended.
      const hasIcons = !!(leftIcon || rightIcon)
      let composedChildren: React.ReactNode = children
      if (
        (hasIcons || ripples.length > 0) &&
        React.isValidElement(children)
      ) {
        const onlyChild = children as React.ReactElement<{
          children?: React.ReactNode
        }>
        composedChildren = React.cloneElement(onlyChild, undefined, (
          <>
            {leftIcon && (
              <span className={styles.leftIcon} aria-hidden="true">
                {leftIcon}
              </span>
            )}
            {hasIcons ? (
              <span className={styles.content}>{onlyChild.props.children}</span>
            ) : (
              onlyChild.props.children
            )}
            {rightIcon && (
              <span className={styles.rightIcon} aria-hidden="true">
                {rightIcon}
              </span>
            )}
            {rippleElements}
          </>
        ))
      }

      return (
        <Slot
          ref={ref as unknown as React.Ref<HTMLElement>}
          className={buttonClasses}
          data-variant={variant}
          data-size={size}
          aria-busy={loading}
          // #509 — forward the disabled state to the slotted child. Native
          // `disabled` isn't valid on `<a>`/custom elements, so `aria-disabled`
          // is the element-agnostic, a11y-correct signal (paired with the
          // preventDefault in handleClick that actually blocks the action).
          aria-disabled={disabled || loading || undefined}
          onClick={handleClick as unknown as React.MouseEventHandler<HTMLElement>}
          {...restProps}
        >
          {composedChildren}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
        onClick={handleClick}
      >
        {loading && (
          <span className={styles.spinnerWrapper} aria-hidden="true">
            <span className={styles.spinner}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </span>
          </span>
        )}
        {!loading && leftIcon && (
          <span className={styles.leftIcon} aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className={styles.content}>{children}</span>
        {!loading && rightIcon && (
          <span className={styles.rightIcon} aria-hidden="true">
            {rightIcon}
          </span>
        )}
        {rippleElements}
      </button>
    )
  }
)

Button.displayName = 'Button'
