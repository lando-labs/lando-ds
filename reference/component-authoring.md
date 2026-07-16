# Component Authoring Template

Canonical patterns for components in `@lando-labs/lando-ds`. Every new
component must follow one of the templates below. The linter enforces the
standards (`@typescript-eslint/no-explicit-any: error` on `src/components/**`)
and lanes 1-3 of Sprint 8 brought every existing component onto this baseline.

If you can't express what you need with one of these templates, open an issue
rather than reaching for `any` or `React.FC`.

---

## Rules

1. **Every component uses `React.forwardRef`** — no `React.FC`, no bare
   function components for anything with a ref-able root DOM element.
2. **Every component has a `displayName`** — named after the exported binding,
   enables React DevTools clarity and snapshot-test readability.
3. **Every props interface is exported** — consumers must be able to compose
   our props; never inline anonymous prop types on a public export.
4. **Zero `as any`** — use `as unknown as T` only when truly required and
   leave a one-line comment explaining why. Prefer typed narrowing
   (`React.isValidElement<T>`) for `cloneElement` patterns.
5. **`as` prop for polymorphism** — use the generic polymorphic pattern in
   Template 2 below; do not re-invent per-component.
6. **`'use client'` banner** — components that use hooks/effects/refs must
   have `'use client'` at the top of the file so they are safe to import
   from a React Server Component context.

The lint rule firing any `any` is in `eslint.config.js` under the
`src/components/**` override:

```js
{
  files: ['src/components/**/*.{ts,tsx}'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
}
```

---

## Template 1: Standard component

A single-root component that renders a known HTML element. This is the
common case — Alert, Badge, Card, Input, Button, Heading, etc.

Reference: `src/components/Alert/Alert.tsx`, `src/components/Button/Button.tsx`.

```tsx
'use client'

import React from 'react'
import styles from './Alert.module.css'

export interface AlertProps {
  /** Visual style variant matching semantic meaning */
  variant?: 'info' | 'success' | 'warning' | 'error'
  /** Optional title displayed prominently */
  title?: string
  /** Show close button */
  closable?: boolean
  /** Callback when close button is clicked */
  onClose?: () => void
  /** Custom icon (default icons provided per variant) */
  icon?: React.ReactNode
  /** Additional CSS class */
  className?: string
  /** Alert content */
  children: React.ReactNode
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, closable, onClose, icon, className = '', children }, ref) => {
    // ...implementation...
    return (
      <div ref={ref} className={/* ... */} role="alert">
        {/* ... */}
      </div>
    )
  }
)

Alert.displayName = 'Alert'
```

Checklist:

- `forwardRef<RootElement, Props>` — the first generic is the element type.
- `ref` is applied to the **outermost ref-able DOM node**, never swallowed.
- `displayName` is set on the `forwardRef` return value.
- Props interface is named `${ComponentName}Props` and `export`ed.
- Sensible defaults expressed inline (`variant = 'info'`).
- `className` prop is merged, not replaced.

---

## Template 2: Polymorphic component (`as` prop)

A component whose root element type is decided by the consumer. The only
current examples are `Text` and `Box`; reach for this when the semantic
element varies but the styling is the same.

Reference: `src/components/Text/Text.tsx`.

```tsx
import React from 'react'
import styles from './Text.module.css'

type TextElement = 'p' | 'span' | 'div' | 'label'

type TextOwnProps<E extends TextElement = 'p'> = {
  as?: E
  variant?: 'body' | 'caption' | 'small' | 'overline'
  size?: 'sm' | 'md' | 'lg'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  color?: string
  className?: string
  children: React.ReactNode
}

export type TextProps<E extends TextElement = 'p'> = TextOwnProps<E> &
  Omit<React.ComponentPropsWithoutRef<E>, keyof TextOwnProps<E>>

type PolymorphicRef<E extends React.ElementType> =
  React.ComponentPropsWithRef<E>['ref']

type PolymorphicText = <E extends TextElement = 'p'>(
  props: TextProps<E> & { ref?: PolymorphicRef<E> }
) => React.ReactElement | null

export const Text: PolymorphicText = React.forwardRef(
  <E extends TextElement = 'p'>(
    { as, variant = 'body', size = 'md', weight = 'normal', color, className = '', children, style, ...props }: TextProps<E>,
    ref: PolymorphicRef<E>
  ) => {
    const Tag = (as || 'p') as React.ElementType
    return (
      <Tag ref={ref} className={/* ... */} style={{ ...style, ...(color && { color }) }} {...props}>
        {children}
      </Tag>
    )
  }
) as PolymorphicText

;(Text as { displayName?: string }).displayName = 'Text'
```

Two things look weird but are load-bearing:

1. **The outer `as PolymorphicText` cast.** React's `forwardRef` is not
   expressive enough to preserve a generic parameter `E` through its return
   type — this is a well-known TypeScript/React limitation. We declare the
   desired call signature with `PolymorphicText` and assert. This is an
   `as` type assertion, **not** `as any` — the target type is fully
   specified and the rule does not fire.

2. **The `;(Text as { displayName?: string }).displayName = 'Text'` line.**
   `PolymorphicText` is a call signature, not an object type with a mutable
   `displayName` property. The structural cast to `{ displayName?: string }`
   lets us attach the `displayName` without widening the exported type.

Constrain the `E` type parameter to the elements you actually want to
support (here: `'p' | 'span' | 'div' | 'label'`). Do not accept
`React.ElementType` wholesale — it lets consumers pass literally any
component and you lose all prop validation.

---

## Template 3: Compound components (root + sub-components + context)

For UIs where the consumer needs to control layout and order, but the
pieces share state. Classic examples: Tabs, Accordion, Radio groups,
Select options.

Reference: `src/components/Tabs/Tabs.tsx`, `src/components/Tabs/Tab.tsx`.

Root component owns state and exposes it via context:

```tsx
'use client'

import React, { createContext, useContext, useState, useRef } from 'react'
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
  if (!context) throw new Error('Tabs components must be used within a Tabs provider')
  return context
}

export interface TabsProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  orientation?: 'horizontal' | 'vertical'
  variant?: 'line' | 'enclosed'
  children: React.ReactNode
  className?: string
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, defaultValue, onChange, orientation = 'horizontal', variant = 'line', children, className = '' }, ref) => {
    // controlled/uncontrolled state management...
    return (
      <TabsContext.Provider value={/* ... */}>
        <div ref={ref} className={/* ... */}>{children}</div>
      </TabsContext.Provider>
    )
  }
)

Tabs.displayName = 'Tabs'
```

Each sub-component is its own `forwardRef` and reads from context:

```tsx
'use client'

import React, { useRef } from 'react'
import { useTabsContext } from './Tabs'

export interface TabProps {
  value: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

export const Tab = React.forwardRef<HTMLButtonElement, TabProps>(
  ({ value, children, disabled = false, className = '' }, forwardedRef) => {
    const { activeTab, setActiveTab, registerTab } = useTabsContext()
    const buttonRef = useRef<HTMLButtonElement>(null)

    // When you need BOTH an internal ref (for keyboard nav, measurement,
    // registration) AND a forwarded ref, merge them via a setter:
    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    }

    return (
      <button ref={setButtonRef} role="tab" aria-selected={activeTab === value} /* ... */>
        {children}
      </button>
    )
  }
)

Tab.displayName = 'Tab'
```

Notes:

- Co-exporting the hook (`useTabsContext`) from the component file is
  deliberate and expected. The `react-refresh/only-export-components` rule is
  turned **off** for this library precisely because this pattern is
  fundamental to the API.
- If an internal effect depends on context callbacks (`registerTab`,
  `unregisterTab`) that the parent intentionally keeps stable, document it
  with an `// eslint-disable-next-line react-hooks/exhaustive-deps` + a
  one-line justification. See `src/components/Tabs/Tab.tsx:55-66`.

---

## Template 4: Trigger / `cloneElement` patterns

Overlays (Popover, Tooltip, Dropdown) accept an arbitrary element as the
trigger and need to clone it to attach refs + event handlers. Use typed
runtime narrowing rather than `as any`.

Reference: `src/components/Popover/Popover.tsx`.

```tsx
import React, { cloneElement } from 'react'

// The set of props we will inject onto the cloned trigger — HTML attribute
// handlers plus a `ref` so cloneElement can re-attach our internal ref.
type PopoverTriggerProps = React.HTMLAttributes<HTMLElement> &
  React.RefAttributes<HTMLElement>

type PopoverTriggerElement = React.ReactElement<PopoverTriggerProps>

// Inside the component body:
let triggerElement: React.ReactNode = trigger
if (React.isValidElement(trigger)) {
  const triggerEl = trigger as PopoverTriggerElement
  const originalProps = triggerEl.props

  triggerElement = cloneElement(triggerEl, {
    ref: triggerRef,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      showPopover()
      originalProps.onClick?.(e)
    },
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      /* ... */
      originalProps.onMouseEnter?.(e)
    },
    'aria-describedby': isVisible ? 'popover-content' : undefined,
  })
}
```

Key points:

- **Narrow at runtime** with `React.isValidElement(trigger)`. This is
  free-form type-safe and satisfies the linter.
- **Declare a `PopoverTriggerElement` alias** so `cloneElement` knows what
  shape of element we're working with.
- **Compose, don't overwrite** event handlers — always call the original
  `originalProps.onClick?.(e)` after your own behavior fires.
- **Never** write `cloneElement(trigger as any, { ... })`.

If the consumer passes something that isn't a valid React element, render
it through untouched (`triggerElement = trigger`) and the overlay simply
won't attach handlers — do not throw.

---

## Template 5: Children-only wrappers (no ref)

Rare. Use for components whose root is NOT a DOM element you own — most
commonly `Portal`, which delegates rendering to `react-dom.createPortal`.

Reference: `src/components/Portal/Portal.tsx`.

```tsx
'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PortalProps {
  children: React.ReactNode
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
```

Rules here:

- Plain named function declaration (`function Portal(...)`), **not**
  `React.FC` and **not** `const Portal = () => ...`.
- No `forwardRef`: there's no DOM element to attach a ref to.
- No `displayName` needed: the function's own name is picked up by DevTools.
- The JSDoc block **must** justify the absence of `forwardRef`. If you're
  reaching for this template, double-check you aren't actually looking at
  Template 1.

---

## Ref element types

Pick the narrowest HTML element type. Incomplete list of common roots:

| Element              | Type                     |
|----------------------|--------------------------|
| `<div>`              | `HTMLDivElement`         |
| `<button>`           | `HTMLButtonElement`      |
| `<input>`            | `HTMLInputElement`       |
| `<textarea>`         | `HTMLTextAreaElement`    |
| `<select>`           | `HTMLSelectElement`      |
| `<a>`                | `HTMLAnchorElement`      |
| `<li>`               | `HTMLLIElement`          |
| `<ul>` / `<ol>`      | `HTMLUListElement` / `HTMLOListElement` |
| `<hr>`               | `HTMLHRElement`          |
| `<progress>`         | `HTMLProgressElement`    |
| `<form>`             | `HTMLFormElement`        |
| `<span>`             | `HTMLSpanElement`        |
| `<table>`            | `HTMLTableElement`       |
| `<img>`              | `HTMLImageElement`       |
| `<h1>`..`<h6>`       | `HTMLHeadingElement`     |
| `<p>`                | `HTMLParagraphElement`   |
| Semantic landmarks<br/>(`<header>`, `<footer>`, `<nav>`, `<main>`, `<aside>`, `<section>`) | `HTMLElement` (TypeScript does not narrow these) |

---

## Lint enforcement

The following rule fires on any `any` in `src/components/**`:

```js
// eslint.config.js (excerpt)
{
  files: ['src/components/**/*.{ts,tsx}'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
}
```

Test files (`**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`) are exempt, so
`(globalThis as any).IntersectionObserver = Mock` in a Vitest setup block
is fine. Production component source is not exempt.

`npm run lint` runs this with `--max-warnings 0`. If you see a
`no-explicit-any` violation, the fix is almost always one of:

- `unknown` when you don't know the shape and intend narrowing downstream.
- A specific generic parameter (`<T = unknown>` with a constraint).
- A library type you forgot was available (`React.ComponentType<P>`,
  `React.CSSProperties`, `Record<string, ReactNode>`, etc.).

If you genuinely need to escape the type system — for instance, to bridge a
third-party callback signature to a DOM event handler — use
`as unknown as T` with a one-line comment explaining why. Lane 1 left
justified examples of this in `src/components/Button/Button.tsx` around
the `asChild`/Slot integration.

---

## Interaction Patterns

Components share a common interaction vocabulary so states feel consistent
across the library. Route every color through a semantic token, and use the
shared `--focus-ring-*` and `--duration-*` / `--easing-*` tokens rather than
per-component magic numbers.

### Hover states

Fully applied by ~150ms. Shift to the `hover` variant of the semantic token,
step the elevation up one step on the shadow scale, and add a subtle scale for
depth.

```css
.component:hover {
  background-color: var(--color-primary-hover);
  box-shadow: var(--shadow-md);
  transform: scale(1.02);
  transition: all var(--duration-fast) var(--easing-out);
}
```

### Focus states

The focus ring must appear immediately — no transition delay — for
accessibility. Use the shared focus-ring tokens.

```css
.component:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);

  /* OR a custom ring */
  box-shadow: var(--focus-ring-shadow);

  transition: none; /* immediate appearance */
}
```

### Active / pressed states

Scale down for tactile feedback, add an inner shadow for a pressed look, and
darken via the `active` token. Keep the transition fast for responsiveness.

```css
.component:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-inner);
  background-color: var(--color-primary-active);
  transition: all var(--duration-fast) var(--easing-in);
}
```

### Loading states

Loading is distinct from disabled — retain the variant coloring so the control
still reads as active, block pointer events, and show a spinner.

```tsx
<Button loading={isLoading}>
  {isLoading ? (
    <>
      <Spinner size="sm" />
      <span>Loading...</span>
    </>
  ) : (
    'Submit'
  )}
</Button>
```

```css
.button--loading {
  pointer-events: none;   /* prevent clicks during load */
  opacity: 0.7;           /* not a fully disabled look */
  background-color: var(--color-primary);
}

.spinner {
  animation: spin var(--duration-slow) linear infinite;
}
```

### Disabled states

Signal unavailability with reduced opacity and `not-allowed` — do not
grayscale, so the control keeps its brand identity.

```css
.component:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

## Animation Patterns

### Micro-interactions

Small, single-element flourishes confirming an action.

```css
@keyframes button-click {
  0%   { transform: scale(1); }
  50%  { transform: scale(0.98); }
  100% { transform: scale(1.02); }
}
.button:active { animation: button-click 200ms ease-out; }

@keyframes check-draw {
  0%   { stroke-dashoffset: 100; }
  100% { stroke-dashoffset: 0; }
}
.checkbox__checkmark {
  stroke-dasharray: 100;
  animation: check-draw 250ms ease-out forwards;
}

@keyframes success-pop {
  0%   { transform: scale(0); opacity: 0; }
  50%  { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}
.success-icon { animation: success-pop 400ms var(--easing-bounce); }
```

### Component transitions

Enter/exit motion for overlays. Reverse the same keyframes for the closing
state so open and close stay symmetrical.

```css
@keyframes modal-fade-in {
  from { opacity: 0; transform: translateY(-20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.modal          { animation: modal-fade-in 300ms var(--easing-out); }
.modal--closing { animation: modal-fade-in 200ms var(--easing-in) reverse; }

@keyframes dropdown-slide {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.dropdown { animation: dropdown-slide 200ms var(--easing-out); }
```

### Reduced motion

Always honor `prefers-reduced-motion`. A global reset keeps every component
covered by default:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Component Checklist

Before marking a component complete, verify:

- [ ] **Accessibility** (target — full AA conformance is an ongoing goal)
  - [ ] Keyboard navigable
  - [ ] Screen reader tested
  - [ ] Contrast ratios reviewed against AA targets (4.5:1 text, 3:1 UI)
  - [ ] Focus indicators visible
  - [ ] ARIA labels/roles correct

- [ ] **Responsive**
  - [ ] Works on mobile (320px)
  - [ ] Works on tablet (768px)
  - [ ] Works on desktop (1024px+)
  - [ ] Touch targets minimum 44px

- [ ] **States**
  - [ ] Default state styled
  - [ ] Hover state defined
  - [ ] Active/pressed state
  - [ ] Focus state visible
  - [ ] Disabled state clear
  - [ ] Loading state (if applicable)

- [ ] **Variants**
  - [ ] All visual variants implemented
  - [ ] All size variants implemented
  - [ ] Consistent with design tokens

- [ ] **Documentation**
  - [ ] Added to `reference/components.md`
  - [ ] Props documented
  - [ ] Usage examples provided
  - [ ] Accessibility notes included

- [ ] **Testing**
  - [ ] Unit tests pass
  - [ ] Visual regression tested
  - [ ] Accessibility tested (axe)
  - [ ] Cross-browser tested
