'use client'

/**
 * Mounted Hook
 *
 * Returns `false` on the server and during the first client render, then `true`
 * after the component has mounted. This is the canonical Next.js hydration
 * guard: gate client-only UI (portals, or any value that differs between server
 * and client) behind it so the first client render matches the server markup
 * and hydration never mismatches.
 *
 * @category lifecycle
 *
 * @example
 * const mounted = useMounted()
 * if (!mounted) return null
 * return <Portal>{children}</Portal>
 */

import { useEffect, useState } from 'react'

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
}
