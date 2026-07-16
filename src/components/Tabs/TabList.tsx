'use client'

/**
 * TabList Component
 *
 * Container for Tab buttons with animated indicator.
 */

import React, { useRef, useEffect, useState } from 'react'
import { useTabsContext } from './Tabs'
import styles from './Tabs.module.css'

export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tab buttons */
  children: React.ReactNode
  /** Additional CSS class */
  className?: string
}

export const TabList = React.forwardRef<HTMLDivElement, TabListProps>(
  ({ children, className = '', style, ...rest }, forwardedRef) => {
    const { activeTab, orientation } = useTabsContext()
    const listRef = useRef<HTMLDivElement>(null)
    const [indicatorStyle, setIndicatorStyle] = useState({
      width: 0,
      height: 0,
      left: 0,
      top: 0,
    })

    // Merge forwarded ref with internal ref (needed for indicator positioning).
    const setListRef = (node: HTMLDivElement | null) => {
      listRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    useEffect(() => {
      if (!listRef.current) return

      const activeButton = listRef.current.querySelector(
        `[data-value="${activeTab}"]`
      ) as HTMLButtonElement

      if (!activeButton) return

      const listRect = listRef.current.getBoundingClientRect()
      const buttonRect = activeButton.getBoundingClientRect()

      if (orientation === 'horizontal') {
        setIndicatorStyle({
          width: buttonRect.width,
          height: 2,
          left: buttonRect.left - listRect.left,
          top: buttonRect.height - 2,
        })
      } else {
        setIndicatorStyle({
          width: 2,
          height: buttonRect.height,
          left: 0,
          top: buttonRect.top - listRect.top,
        })
      }
    }, [activeTab, orientation, children])

    const listClasses = [
      styles.tabList,
      className,
    ].filter(Boolean).join(' ')

    return (
      <div
        ref={setListRef}
        className={listClasses}
        style={style}
        // Consumer passthrough (#423). `{...rest}` spreads BEFORE the
        // `role="tablist"`/`aria-orientation` contract so a consumer can't
        // clobber the tablist semantics.
        {...rest}
        role="tablist"
        aria-orientation={orientation}
      >
        {children}
        <div
          className={styles.indicator}
          style={indicatorStyle}
          aria-hidden="true"
        />
      </div>
    )
  }
)

TabList.displayName = 'TabList'
