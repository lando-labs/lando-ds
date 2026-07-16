'use client'

/**
 * Portal Component
 *
 * Renders children into a DOM node that exists outside the parent component's DOM hierarchy.
 * Essential for modals, toasts, dropdowns, and tooltips to avoid z-index and overflow issues.
 *
 * @example
 * <Portal>
 *   <Modal>Content</Modal>
 * </Portal>
 *
 * <Portal container={customElement}>
 *   <Tooltip>Tooltip content</Tooltip>
 * </Portal>
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PortalProps {
  /** Content to render in the portal */
  children: React.ReactNode
  /** Container element to render into (defaults to document.body) */
  container?: Element | null
}

/**
 * Portal has no ref-able root element — `createPortal` returns the children
 * directly. Implemented as a plain function component so there is nothing to
 * forward a ref to (see Sprint 8 Lane 1 decision).
 */
export function Portal({ children, container }: PortalProps) {
  const [mountNode, setMountNode] = useState<Element | null>(null)

  useEffect(() => {
    setMountNode(container || document.body)
  }, [container])

  if (!mountNode) return null

  return createPortal(children, mountNode)
}

Portal.displayName = 'Portal'
