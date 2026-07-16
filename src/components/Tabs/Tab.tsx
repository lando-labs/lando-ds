'use client'

/**
 * Tab Component
 *
 * Individual tab button with keyboard navigation support.
 */

import React, { useRef, useEffect } from 'react'
import { useTabsContext } from './Tabs'
import styles from './Tabs.module.css'

export interface TabProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** Unique value for the tab */
  value: string
  /** Tab label */
  children: React.ReactNode
  /** Disable the tab */
  disabled?: boolean
  /** Optional icon */
  icon?: React.ReactNode
  /** Optional badge (e.g., notification count) */
  badge?: React.ReactNode
  /** Additional CSS class */
  className?: string
}

export const Tab = React.forwardRef<HTMLButtonElement, TabProps>(
  (
    {
      value,
      children,
      disabled = false,
      icon,
      badge,
      className = '',
      style,
      ...rest
    },
    forwardedRef
  ) => {
    const { activeTab, setActiveTab, registerTab, unregisterTab } = useTabsContext()
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Merge forwarded ref with internal ref (needed for keyboard nav + registration).
    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    const isActive = activeTab === value

    useEffect(() => {
      if (buttonRef.current) {
        registerTab(value, buttonRef.current)
      }
      return () => {
        unregisterTab(value)
      }
      // registerTab / unregisterTab are context-provided and intentionally
      // stable for the lifetime of the parent Tabs. Including them would
      // cause re-registration on every render and defeat the stable-ref map.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

  const handleClick = () => {
    if (!disabled) {
      setActiveTab(value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const tabList = buttonRef.current?.parentElement
    if (!tabList) return

    const tabs = Array.from(
      tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    )
    const currentIndex = tabs.indexOf(buttonRef.current!)

    let nextTab: HTMLButtonElement | null = null

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        nextTab = tabs[currentIndex + 1] || tabs[0] || null
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        nextTab = tabs[currentIndex - 1] || tabs[tabs.length - 1] || null
        break
      case 'Home':
        e.preventDefault()
        nextTab = tabs[0] || null
        break
      case 'End':
        e.preventDefault()
        nextTab = tabs[tabs.length - 1] || null
        break
    }

    if (nextTab) {
      nextTab.focus()
      const nextValue = nextTab.getAttribute('data-value')
      if (nextValue) {
        setActiveTab(nextValue)
      }
    }
  }

  const tabClasses = [
    styles.tab,
    isActive ? styles.active : '',
    disabled ? styles.disabled : '',
    className,
  ].filter(Boolean).join(' ')

    return (
      <button
        ref={setButtonRef}
        type="button"
        className={tabClasses}
        style={style}
        // Consumer passthrough (#423). `{...rest}` spreads BEFORE the
        // `role="tab"`/data-value/aria/disabled/tabIndex contract and the
        // behavioral handlers so a consumer can't clobber tab selection,
        // keyboard nav, or the roving-tabindex a11y contract.
        {...rest}
        role="tab"
        data-value={value}
        aria-selected={isActive}
        aria-disabled={disabled}
        disabled={disabled}
        tabIndex={isActive ? 0 : -1}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {icon && <span className={styles.tabIcon}>{icon}</span>}
        <span className={styles.tabLabel}>{children}</span>
        {badge && <span className={styles.tabBadge}>{badge}</span>}
      </button>
    )
  }
)

Tab.displayName = 'Tab'
