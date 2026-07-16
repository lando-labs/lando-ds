'use client'

/**
 * Local Storage Hook
 *
 * A `useState`-like API backed by `localStorage`, returning
 * `[value, setValue, remove]`. SSR-safe: renders `defaultValue` on the server
 * and on the first client render, reading the persisted value only after mount
 * so hydration never mismatches. Values are JSON serialized/deserialized;
 * corrupt or unparseable data falls back to `defaultValue`. Reads and writes
 * tolerate `localStorage` throwing (Safari private mode, quota exceeded) without
 * crashing, and changes are synchronized across tabs via the `storage` event.
 *
 * @category state
 *
 * @example
 * const [theme, setTheme, clearTheme] = useLocalStorage('theme', 'system')
 * setTheme('dark')
 * setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Read + JSON-parse `key` from localStorage, returning `fallback` when storage
 * is unavailable (SSR / Safari private mode) or the stored value is not valid
 * JSON.
 */
function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** JSON-parse `raw`, falling back to `fallback` on invalid JSON. */
function parseOr<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // SSR-safe: the first render (server + client) is always `defaultValue`, so
  // hydration matches. The persisted value is read after mount, below.
  const [value, setValue] = useState<T>(defaultValue)

  // Latest `defaultValue` without re-subscribing effects when a consumer passes
  // a fresh inline default (which would otherwise loop for object/array values).
  const defaultRef = useRef(defaultValue)
  useEffect(() => {
    defaultRef.current = defaultValue
  }, [defaultValue])

  // Hydrate from storage after mount; re-read when `key` changes.
  useEffect(() => {
    setValue(readStorage(key, defaultRef.current))
  }, [key])

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      // Resolve functional updaters against the persisted value (the source of
      // truth) so rapid successive sets chain correctly.
      const prev = readStorage(key, defaultRef.current)
      const resolved =
        typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      setValue(resolved)
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // Write blocked (private mode / quota) — keep the in-memory value.
      }
    },
    [key]
  )

  const remove = useCallback(() => {
    setValue(defaultRef.current)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Ignore — nothing to clean up if storage is inaccessible.
    }
  }, [key])

  // Cross-tab sync: mirror writes to the same key from other documents.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      setValue(
        event.newValue === null
          ? defaultRef.current
          : parseOr(event.newValue, defaultRef.current)
      )
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
    }
  }, [key])

  return [value, set, remove]
}
