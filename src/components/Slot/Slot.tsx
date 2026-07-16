'use client'

/**
 * Slot Component
 *
 * Minimal slot implementation for composable component APIs.
 * Enables `asChild` patterns — merges a component's props onto its
 * single React element child, rather than rendering a new DOM node.
 *
 * Compatible with the Radix UI Slot API surface but hand-rolled to
 * avoid the extra dependency.
 *
 * @example
 * // Inside a component:
 * const Comp = asChild ? Slot : 'button'
 * return <Comp className={styles.button} {...props}>{children}</Comp>
 *
 * // Consumer:
 * <Button asChild>
 *   <Link href="/foo">Go</Link>
 * </Button>
 * // Renders <a href="/foo" class="{...button styles}">Go</a>
 */

import React from 'react'

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}

export const Slot = React.forwardRef<HTMLElement, SlotProps>((props, forwardedRef) => {
  const { children, ...slotProps } = props

  if (!React.isValidElement(children)) {
    // If children is not a single valid element, render nothing.
    // Developer error — warn in dev.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Slot expects a single React element child. Received:',
        children
      )
    }
    return null
  }

  const child = children as React.ReactElement<Record<string, unknown>>
  // biome-ignore lint/suspicious/noExplicitAny: ref attached to child via React internals
  const childRef = (child as unknown as { ref?: React.Ref<HTMLElement> }).ref

  return React.cloneElement(child, {
    ...mergeProps(slotProps, child.props),
    ref: forwardedRef
      ? composeRefs(forwardedRef, childRef)
      : childRef,
  })
})

Slot.displayName = 'Slot'

/**
 * Merge props intelligently (Radix-Slot compatible) (#333).
 *
 * - Event handlers compose. BOTH run; child handler runs first, then slot
 *   handler. Neither return value gates the other — preventDefault is not
 *   honored because Slot doesn't introspect handler return values.
 * - `className` strings concatenate (slot first, then child).
 * - `style` objects merge; child wins on key conflict (child is spread last).
 * - All other props: CHILD wins. The rendered element's own props take
 *   precedence over the slot caller's. This is the asChild pattern's
 *   intent — you're handing off to a fully-formed element with its own
 *   contract.
 *
 * Caveat: state-bearing props (`aria-busy`, `aria-disabled`, `disabled`)
 * set on the SLOT caller can be silently overridden by the child element.
 * If you need caller-precedence for a state prop, don't set it on the
 * slotted child — let the caller be the single source of truth and omit
 * the prop from the child.
 */
function mergeProps(
  slotProps: Record<string, unknown>,
  childProps: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...slotProps }

  for (const key in childProps) {
    const slotValue = slotProps[key]
    const childValue = childProps[key]

    if (typeof slotValue === 'function' && typeof childValue === 'function' && /^on[A-Z]/.test(key)) {
      merged[key] = (...args: unknown[]) => {
        const result = (childValue as (...a: unknown[]) => unknown)(...args)
        ;(slotValue as (...a: unknown[]) => unknown)(...args)
        return result
      }
    } else if (key === 'className') {
      merged[key] = [slotValue, childValue].filter(Boolean).join(' ')
    } else if (key === 'style') {
      merged[key] = {
        ...(slotValue as React.CSSProperties),
        ...(childValue as React.CSSProperties),
      }
    } else {
      merged[key] = childValue
    }
  }

  return merged
}

function composeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref != null) {
        ;(ref as React.MutableRefObject<T | null>).current = node
      }
    })
  }
}
