# Hooks

> The headless hooks library. Published in `meta.json`'s `hooks` section (schema 1.3+)
> and enforced by `validate:hooks` + `sync-docs:check`.

## Why this document exists

The design system shipped four exported, fully-typed hooks that appeared in **no
meta section and no doc**. They were importable, but invisible. A consumer app
that imports the DS in **77 files** still hand-rolled its own **116-line
`useFocusTrap`** — because it had no way to discover that ours existed (#504).

A hook that isn't in `meta.json` does not exist as far as the MCP server, or any
AI agent grounding itself on that artifact, is concerned. So: every hook is now
emitted into meta with its canonical signature, listed in `CLAUDE.md`, and
documented here — and CI blocks any hook that skips those steps.

## The contract

- **Client-only.** Every hook needs React client runtime state, so `serverSafe`
  is `false` for all of them and each module carries `'use client'`.
- **SSR-safe.** No hook touches `window` / `document` / `localStorage` /
  `navigator` during render. Environment-dependent hooks return a stable,
  server-renderable value on the first render (`useMediaQuery` → `defaultValue`,
  `useViewportSize` → `{width: 0, height: 0}`, `useMounted` → `false`) and the
  real value after mount, so hydration never mismatches.
- **No runtime dependencies** beyond React.
- **No leaks.** Every listener, timer, and observer is torn down on unmount and
  re-attached when its inputs change.

## Importing

```tsx
// From the package root:
import { useDisclosure, useMediaQuery } from '@lando-labs/lando-ds'

// …or from the subpath (tree-shakes to just the hooks):
import { useDisclosure } from '@lando-labs/lando-ds/hooks'
```

---

## state

### `useDisclosure(initial?: boolean)`
The canonical open/close/toggle. All handlers are referentially stable, so they
can be handed to memoized children.
```tsx
const [opened, { open, close, toggle, set }] = useDisclosure(false)
<Button onClick={open}>Open</Button>
<Modal isOpen={opened} onClose={close} />
```

### `useToggle<T>(values?: readonly T[])`
Cycles through a list of values. Defaults to `[false, true]`.
```tsx
const [value, toggle] = useToggle(['light', 'dark'] as const)
toggle()          // advances to the next value
toggle('dark')    // jumps to a specific value
```

### `useDebouncedValue<T>(value: T, delay: number)`
Returns the value once it has been stable for `delay` ms — for search inputs and
anything that shouldn't fire on every keystroke.
```tsx
const [query, setQuery] = useState('')
const debounced = useDebouncedValue(query, 300)
useEffect(() => { search(debounced) }, [debounced])
```

### `useLocalStorage<T>(key: string, defaultValue: T)`
SSR-safe persisted state. JSON-serialized, synced across tabs via the `storage`
event, and tolerant of corrupt JSON and of `localStorage` throwing (Safari
private mode, quota).
```tsx
const [theme, setTheme, removeTheme] = useLocalStorage('theme', 'light')
```

## timing

### `useInterval(callback: () => void, delay: number | null)`
The self-correcting interval: the callback is kept in a ref, so a re-render never
restarts a running timer and the latest closure is always used. `delay: null`
pauses it.
```tsx
useInterval(() => refetch(), isPolling ? 5000 : null)
```

### `useTimeout(callback: () => void, delay: number | null)`
Same pattern, once. `delay: null` cancels.
```tsx
useTimeout(() => setShowHint(true), 3000)
```

## dom

### `useEventListener(type, handler, target?, options?)`
Adds a listener with correct cleanup and a ref'd handler, so consumers never need
`useCallback`. `target` defaults to `window` and accepts an element or a ref.
```tsx
useEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
useEventListener('click', onClick, buttonRef)
```

### `useClickOutside(ref, callback, isActive?, ignoreRefs?)`
Fires when a click or touch lands outside the referenced element. Used by the
DS's own overlays. `ignoreRefs` (default `[]`) excludes additional elements —
e.g. a toggle trigger — from counting as "outside," so a trigger's own click
isn't double-counted as both a dismissal and a re-open (Dropdown, click-mode
Popover).

### `useHover<T>()`
```tsx
const [ref, isHovered] = useHover<HTMLDivElement>()
<div ref={ref}>{isHovered ? 'Hi' : 'Hover me'}</div>
```

### `useIntersection<T>(options?)`
Wraps `IntersectionObserver` — lazy-loading, infinite scroll, reveal-on-scroll.
```tsx
const [ref, entry] = useIntersection<HTMLDivElement>({ threshold: 0.5 })
const visible = entry?.isIntersecting ?? false
```

### `useResizeObserver<T>()`
```tsx
const [ref, { width, height }] = useResizeObserver<HTMLDivElement>()
```

### `useWindowScroll()`
Scroll position, coalesced with `requestAnimationFrame` so it doesn't thrash.
```tsx
const { x, y } = useWindowScroll()
const scrolled = y > 100
```

## browser

### `useMediaQuery(query: string, defaultValue?: boolean)`
SSR-safe media queries. Returns `defaultValue` on the server and on the first
client render, then the real result — so hydration never mismatches.
```tsx
const isMobile = useMediaQuery('(max-width: 768px)')
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
```

### `useViewportSize()`
```tsx
const { width, height } = useViewportSize()
```

### `useClipboard(timeout?: number)`
Copy-to-clipboard with a `copied` flag that auto-resets. Never throws at the
consumer — a denied or unavailable clipboard surfaces as `error`.
```tsx
const { copy, copied, error, reset } = useClipboard()
<Button onClick={() => copy(token)}>{copied ? 'Copied!' : 'Copy'}</Button>
```

## lifecycle

### `useMounted()`
`false` on the server and on the first client render, `true` after mount. The
canonical Next.js hydration guard for client-only content.
```tsx
const mounted = useMounted()
if (!mounted) return null // avoids a hydration mismatch
```

## a11y

### `useFocusTrap(ref, isActive?)`
Traps focus within a container (modals, drawers, dropdowns): moves focus in on
open, cycles Tab / Shift+Tab, and restores focus to the trigger on cleanup.
```tsx
const dialogRef = useRef<HTMLDivElement>(null)
useFocusTrap(dialogRef, isOpen)
```

## keyboard

### `useKeyPress(targetKeys, callback, isActive?)`
Global key handling — Escape-to-close, arrow navigation, shortcuts. **Reach for
this instead of hand-wiring `document.addEventListener('keydown', …)`.**
```tsx
useKeyPress('Escape', () => close())
useKeyPress(['ArrowUp', 'ArrowDown'], (key) => navigate(key))
```

## layout

### `usePortalPosition(triggerRef, isOpen, options)`
Positions a portal-rendered overlay against a trigger: no flash at (0,0),
reliable mount measurement, flip-on-overflow, and scroll/resize tracking. The
shared primitive behind Dropdown / Select / TagInput / Tooltip / Popover.
