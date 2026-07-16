'use client'

/**
 * TabPanel Component
 *
 * Content container for each tab.
 */

import React from 'react'
import { useTabsContext } from './Tabs'
import styles from './Tabs.module.css'

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value matching the Tab's value */
  value: string
  /** Panel content */
  children: React.ReactNode
  /** Additional CSS class */
  className?: string
}

export const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(
  ({ value, children, className = '', style, ...rest }, ref) => {
    const { activeTab } = useTabsContext()

    if (activeTab !== value) return null

    const panelClasses = [
      styles.tabPanel,
      className,
    ].filter(Boolean).join(' ')

    return (
      <div
        ref={ref}
        className={panelClasses}
        style={style}
        // Consumer passthrough (#423). `{...rest}` spreads BEFORE the
        // `role="tabpanel"`/aria-labelledby contract so a consumer can't
        // clobber the tabpanel semantics.
        {...rest}
        role="tabpanel"
        aria-labelledby={`tab-${value}`}
      >
        {children}
      </div>
    )
  }
)

TabPanel.displayName = 'TabPanel'
