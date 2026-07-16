'use client'

/**
 * Tabs Component
 *
 * A flexible tabbed interface with keyboard navigation and animated indicator.
 * Supports controlled and uncontrolled modes.
 *
 * @example
 * <Tabs defaultValue="profile">
 *   <TabList>
 *     <Tab value="profile">Profile</Tab>
 *     <Tab value="settings">Settings</Tab>
 *   </TabList>
 *   <TabPanel value="profile">Profile content</TabPanel>
 *   <TabPanel value="settings">Settings content</TabPanel>
 * </Tabs>
 */

import React, { createContext, useContext, useRef } from 'react'
import { useControllableState } from '../../hooks/useControllableState'
import styles from './Tabs.module.css'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (value: string) => void
  orientation: 'horizontal' | 'vertical'
  variant: 'line' | 'enclosed'
  registerTab: (value: string, ref: HTMLButtonElement) => void
  unregisterTab: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export const useTabsContext = () => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

export interface TabsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled active tab value */
  value?: string
  /** Default active tab (uncontrolled) */
  defaultValue?: string
  /** Callback when active tab changes */
  onChange?: (value: string) => void
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical'
  /** Visual variant */
  variant?: 'line' | 'enclosed'
  /** Children components */
  children: React.ReactNode
  /** Additional CSS class */
  className?: string
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onChange,
      orientation = 'horizontal',
      variant = 'line',
      children,
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
    // Uncontrolled-first state via the shared primitive (#508) — replaces the
    // hand-rolled isControlled/uncontrolledValue dance. Controlled when `value`
    // is passed; otherwise seeds from `defaultValue`.
    const [activeTab, setActiveTab] = useControllableState<string>({
      value: controlledValue,
      defaultValue: defaultValue || '',
      onChange,
    })
    const tabRefsMap = useRef<Map<string, HTMLButtonElement>>(new Map())

    const registerTab = (value: string, ref: HTMLButtonElement) => {
      tabRefsMap.current.set(value, ref)
    }

    const unregisterTab = (value: string) => {
      tabRefsMap.current.delete(value)
    }

    const containerClasses = [
      styles.container,
      styles[orientation],
      styles[variant],
      className,
    ].filter(Boolean).join(' ')

    return (
      <TabsContext.Provider
        value={{
          activeTab,
          setActiveTab,
          orientation,
          variant,
          registerTab,
          unregisterTab,
        }}
      >
        <div ref={ref} className={containerClasses} style={style} {...rest}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)

Tabs.displayName = 'Tabs'
