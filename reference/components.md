<!--
AI-Generated Documentation
Created by: frontend
Date: 2025-10-22
Purpose: Component library documentation for Lando Labs Design System
-->

# Component Library Reference

This document provides comprehensive documentation for all components in the Lando Labs Design System. Each component is built with CSS Modules, uses design tokens, supports dark mode, and is built with accessibility in mind (semantic HTML, ARIA on overlays, keyboard support). A systematic WCAG AA audit is tracked in **#13** — do not assume full AA conformance until that roll-up closes.

## Component Architecture

All components follow these principles:

- **CSS Modules**: Scoped styling with `.module.css` files
- **Design Tokens**: Use CSS variables from the token system
- **TypeScript**: Fully typed with exported interfaces
- **Accessibility**: Built with accessibility in mind (ARIA labels, keyboard navigation, focus management on overlays); a systematic WCAG AA audit is tracked in #13 — do not assume full AA conformance
- **Dark Mode**: Automatic theme support via ThemeProvider
- **Brand-neutral by default**: Ships neutral; skin it by overriding `--color-primary` (or apply the opt-in `lando` preset for the historical ocean palette)

### Layout: choosing Stack/Inline vs CardBody `stack`/`inline`

`CardBody` and `Box` accept the same `gap`/`align`/`justify` vocabulary as
`Stack` and `Inline` (#58). When that overlap gives you a choice, reach for the
shallowest option:

- **`Stack` / `Inline`** for pure layout — when the container's only job is to
  arrange children. They're dedicated primitives with sensible layout defaults
  and the shortest call site for a vertical or horizontal group.
- **`CardBody stack`/`inline`** when you'd otherwise wrap a `CardBody`'s
  children in a `Stack`/`Inline` as its first and only child. The `CardBody` is
  already the compositional site, so the shorthand keeps the tree one level
  shallower.
- **`Box` with `display="flex"`** when the layout is coupled to visual styling
  that already lives on the same element (`padding`, `background`,
  `borderRadius`, `border`). Splitting the visual container from the flex layout
  into two elements usually reads worse, not better.

They compile to the same CSS semantics — the guidance is about what's easiest to
read six months from now: prefer the primitive with the fewest moving parts at
each call site.

```tsx
// BEFORE — redundant nested layout site
<Card>
  <CardBody>
    <Stack gap="sm">
      <Text>one</Text>
      <Text>two</Text>
    </Stack>
  </CardBody>
</Card>

// AFTER — CardBody is the layout site
<Card>
  <CardBody stack gap="sm">
    <Text>one</Text>
    <Text>two</Text>
  </CardBody>
</Card>
```

### Typography: semantic HTML + page-title sizing

`Heading` and `Text` exist so raw `<h1>`/`<p>` tags are never needed: they
provide semantic HTML for accessibility and SEO while keeping visual size
**independent of** the semantic level (separating semantics from presentation).
The same `<h1>` can therefore render at any typographic scale.

**Page-title sizing (DS-MOD-1)** — choose the visual `size` that matches the
surrounding UI, not the largest available:

- **App page titles** (dashboards, settings, detail views, forms) — `size="lg"`
  (31px) or `size="xl"` (39px). Most app pages look best at `lg`; reach for `xl`
  only when the page is an obvious hero (onboarding, first-run, empty-state
  landing).
- **Section headers within a page** — `size="md"` or `size="lg"`, one step below
  the page title so the hierarchy reads.
- **Card / panel titles** — `size="sm"` or `size="md"`; these should feel like a
  label on a surface, not a competing page title.
- **Marketing hero titles** — `size="2xl"` (49px). This is the only intended use
  for the top of the scale.

Rule of thumb: if the page has a Header bar above it, the page title should be
`lg` or `xl` — reserve `2xl` for landing-page hero blocks where the heading is
*the* focal point and no app chrome competes with it.

```tsx
<Heading level={1} size="lg">Account Settings</Heading>   {/* app page */}
<Heading level={2} size="md">Billing</Heading>            {/* section header */}
<Heading level={3} size="sm">Payment Methods</Heading>    {/* card title */}
<Heading level={1} size="2xl">Tools for Intentional Living</Heading> {/* marketing hero */}
```

## Components Overview

### Button

A versatile button component with ocean-inspired ripple effects.

**Variants**: `primary`, `secondary`, `outline`, `ghost`, `danger`, `link`
**Sizes**: `xs`, `sm`, `md`, `lg`, `xl`

**Features**:
- Click ripple animation (ocean wave effect)
- Loading state with spinner
- Left and right icon support (`leftIcon` / `rightIcon`)
- Full width option
- Disabled state (distinct from loading — see below)
- `asChild` for integration with routing libraries (e.g. `next/link`)

**Disabled vs. loading (#39)**: The two states are semantically and
visually distinct and should not be conflated:

| State | What you see | Intent |
| --- | --- | --- |
| `disabled` | `--color-surface-disabled` fill, `--color-text-on-disabled` text, `--color-border-disabled` border, `cursor: not-allowed` | The action isn't available (e.g. form invalid) |
| `loading` | Variant coloring retained + spinner overlay + `opacity: 0.7` + `cursor: progress` | An action is in flight |

Secondary buttons carry a 1px `--color-border-default` so they remain
distinguishable from the page background (#41). Primary/secondary/danger
hover lift is `translateY(-0.5px)` — a subtle rise, not a jump (#43).

**Focus ring (#38)**: Buttons consume the unified `--focus-ring-*`
tokens — the same ring appears on Input, Textarea, Select, Checkbox,
Radio, Switch, Dropdown items, and Tabs. If you need to adjust the
ring (width, color, halo alpha) across the whole library, edit the
tokens — never stack a second indicator in a component stylesheet.

**Basic usage**:
```tsx
import { Button } from '@lando-labs/lando-ds'

<Button variant="primary" size="md">
  Click me
</Button>

<Button loading>Saving...</Button>
```

#### Buttons with icons

The icon slots are named **`leftIcon`** and **`rightIcon`** — not
`iconLeft` / `iconRight`. They accept any `React.ReactNode`, so you can
pass Lucide React icons, the design system's `<Icon>` wrapper, or any
custom SVG.

**Icon before the label:**

```tsx
import { Button } from '@lando-labs/lando-ds'
import { Plus } from 'lucide-react'

<Button variant="primary" leftIcon={<Plus size={16} />}>
  New Task
</Button>
```

**Icon after the label:**

```tsx
import { Button } from '@lando-labs/lando-ds'
import { ArrowRight } from 'lucide-react'

<Button variant="primary" rightIcon={<ArrowRight size={16} />}>
  Continue
</Button>
```

**Ghost / outline variants with icons:**

```tsx
import { Button } from '@lando-labs/lando-ds'
import { Trash2, Download } from 'lucide-react'

<Button variant="ghost" leftIcon={<Trash2 size={16} />}>
  Delete
</Button>

<Button variant="outline" rightIcon={<Download size={16} />}>
  Export CSV
</Button>
```

**Icon-only button:** always supply an `aria-label` when there is no
visible text label.

```tsx
import { Button } from '@lando-labs/lando-ds'
import { Settings } from 'lucide-react'

<Button variant="ghost" aria-label="Settings">
  <Settings size={16} />
</Button>
```

> **Common gotcha:** `iconLeft` / `iconRight` are **not** valid props —
> TypeScript will reject them. Use `leftIcon` and `rightIcon`. This
> naming may be revisited at v1.0.0.

#### Integrating with routing libraries

When `asChild` is true, the button delegates rendering to its single
React element child, merging button styling onto it. This is the
recommended way to integrate with `next/link` or other routing primitives
without nesting `<a>` inside `<button>`.

```tsx
import { Button } from '@lando-labs/lando-ds'
import Link from 'next/link'

<Button asChild variant="primary">
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>
```

When `asChild` is true, `loading`, `leftIcon`, and `rightIcon` are
ignored — the child element owns its own rendering.

**Props**:
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link'
  /** Size of the button */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Show loading spinner and disable interactions */
  loading?: boolean
  /** Icon to display before the button text */
  leftIcon?: React.ReactNode
  /** Icon to display after the button text */
  rightIcon?: React.ReactNode
  /** Make button take full width of container */
  fullWidth?: boolean
  /**
   * Render as the single child element, merging button props onto it.
   * Useful for integrating with routing libraries like next/link.
   * When true, `loading`, `leftIcon`, and `rightIcon` are ignored.
   */
  asChild?: boolean
}
```

---

### IconButton

Icon-only button primitive with a **TypeScript-enforced `aria-label`
requirement**. Use this anywhere you previously reached for `<Button
variant="ghost">` with just an icon child (e.g. close-buttons in
modals/toasts, row-level delete buttons, kebab-menu triggers).

Surfaced in a design-system recomposition audit —
recurring patterns like `.menuTrigger`, `.dismissBtn`, `.commentDeleteBtn`,
`.userViewDeleteBtn`, and `.orderBtn` collapse onto this primitive.

**Variants**: `ghost` (default), `solid`, `outline`
**Sizes**: `xs`, `sm` (default), `md`

**Why a dedicated component (not just `<Button>` with an icon child):**

- **`aria-label` is REQUIRED at the type level.** Icon-only buttons have no
  visible text, so without `aria-label` they're invisible to screen-reader
  users. Making the prop non-optional in the TypeScript types turns a
  recurring a11y regression into a compile error.
- **44×44px guaranteed hit area** regardless of visible size (iOS HIG /
  Material touch-target guidance). Visible chrome is centered inside the
  larger interactive square.
- **Pre-tuned padding and 1:1 aspect ratio** — consumers stop re-deriving
  these per call site.

**Visible vs. hit-area sizing:**

| size | visible | hit area |
| ---- | ------- | -------- |
| `xs` | 24×24   | 44×44    |
| `sm` | 32×32   | 44×44    |
| `md` | 40×40   | 44×44    |

**Basic usage:**

```tsx
import { IconButton } from '@lando-labs/lando-ds'
import { Trash2 } from 'lucide-react'

<IconButton aria-label="Delete comment" onClick={handleDelete}>
  <Trash2 />
</IconButton>
```

**Variants:**

```tsx
import { IconButton } from '@lando-labs/lando-ds'
import { Settings, Check, Edit } from 'lucide-react'

<IconButton aria-label="Settings" variant="ghost"><Settings /></IconButton>
<IconButton aria-label="Save"     variant="solid"><Check /></IconButton>
<IconButton aria-label="Edit"     variant="outline"><Edit /></IconButton>
```

**Compile-time a11y enforcement:**

```tsx
// ❌ TypeScript error: Property 'aria-label' is missing
<IconButton><Trash2 /></IconButton>

// ✅ OK
<IconButton aria-label="Delete"><Trash2 /></IconButton>
```

**Loading state** *(Sprint 20, [#114](https://github.com/lando-labs/lando-ds/issues/114))*:

`loading?: boolean` mirrors the same prop on `<Button>`. When `true`:

- The icon child is swapped for a centered `<Spinner>` sized to match the
  IconButton size (`xs` → `Spinner size="xs"`, `sm` → `sm`, `md` → `md`).
- The native `disabled` attribute is set, so click and keyboard activation
  are blocked at the browser level.
- `aria-busy="true"` is set so assistive tech can communicate the in-flight
  state.
- `aria-label` is preserved — the action stays announceable.
- Variant chrome (border, focus ring, background) still renders, so the
  button doesn't visually disappear mid-action.

```tsx
import { useState } from 'react'
import { IconButton } from '@lando-labs/lando-ds'
import { Save } from 'lucide-react'

function SaveButton() {
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await api.save()
    } finally {
      setSaving(false)
    }
  }

  return (
    <IconButton
      aria-label="Save changes"
      loading={saving}
      onClick={handleSave}
    >
      <Save />
    </IconButton>
  )
}
```

**Renders as:** `<button type="button">` by default. All native
`<button>` props (e.g. `onClick`, `disabled`, `form`, `type`) pass through
except `aria-label`, which the component re-declares as required.

**Props:**

```typescript
interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible label — REQUIRED. Compile-time enforced. */
  'aria-label': string
  /** Visual variant. Default: 'ghost'. */
  variant?: 'ghost' | 'solid' | 'outline'
  /** Visible icon size. Default: 'sm'. Hit area is 44×44 regardless. */
  size?: 'xs' | 'sm' | 'md'
  /**
   * Show spinner and disable interactions. Sets the native `disabled`
   * attribute and `aria-busy="true"`; preserves `aria-label`.
   */
  loading?: boolean
  /** Icon to render (Lucide icon, custom SVG, or DS `<Icon>` wrapper). */
  children: React.ReactNode
}
```

---

### Input

Accessible form input with validation states and helper text.

**Types**: All HTML input types supported (`text`, `email`, `password`, `number`, etc.)

**Features**:
- Label with required indicator
- Error and helper text
- Left and right icon support
- Character count (with maxLength)
- Password visibility toggle
- Clear button option
- Autofill support

**Usage**:
```tsx
import { Input } from '@lando-labs/lando-ds'

<Input
  label="Email"
  type="email"
  placeholder="Enter your email"
  helperText="We'll never share your email"
  required
/>

<Input
  label="Password"
  type="password"
  error="Password is required"
/>

<Input
  label="Search"
  leftIcon={<SearchIcon />}
  onClear={() => setValue('')}
/>
```

**Props**:
```typescript
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  helperText?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  showCharCount?: boolean
  onClear?: () => void
  containerClassName?: string
}
```

**Focus ring (#38)**: The Input field consumes `--focus-ring-shadow`
on `:focus-visible` along with a border shift to `--focus-ring-color`.
Previously the component stacked a 2px border shift + `--shadow-outline`
halo + the global `:focus-visible` outline — three indicators
simultaneously. The new treatment is one coherent ring (border tint +
halo) and is keyboard-only (no ring on mouse click).

**Accessibility (#13)**: The password visibility toggle and clear button
are **keyboard focusable** — previously they were rendered with
`tabIndex={-1}` and unreachable via Tab. The password toggle also exposes
`aria-pressed` so screen readers announce the on/off state.

---

### Textarea

Multi-line text input with label, helper text, error states, and
an optional character counter.

**Features**:
- Label with required indicator (matches Input conventions)
- Helper text / error text / `aria-invalid` + `aria-describedby` wiring
- Character counter (requires `maxLength`; pass `showCount` to render)
- Resize control: `'none' | 'vertical' | 'horizontal' | 'both'`
- Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`)

**Usage**:
```tsx
import { Textarea } from '@lando-labs/lando-ds'

<Textarea
  label="Description"
  placeholder="Tell us more…"
  helperText="Markdown supported"
  rows={5}
/>

<Textarea
  label="Bio"
  maxLength={500}
  showCount
  resize="vertical"
/>

<Textarea
  label="Message"
  error="Message is required"
  required
/>
```

**Props**:
```typescript
interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  label?: string
  helperText?: string
  error?: string
  rows?: number
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
  maxLength?: number
  showCount?: boolean
  containerClassName?: string
}
```

**Focus ring (#38)**: Prior to v0.5 the Textarea had no DS `:focus`
treatment — keyboard focus fell through to the browser-default 3px
outline. It now applies the unified `--focus-ring-*` halo via
`:focus-visible`, consistent with Input and Select.

**Character counter (#43)**: The counter uses `--color-text-secondary`
at `--font-size-sm`, transitioning to `--color-error-base` at/past
`maxLength`. It was previously `--color-text-tertiary` which, prior to
#12's contrast fix, sat at 2.6:1 against white and was difficult to
read; the counter is also promoted a hierarchy tier so the running
count is legible at a glance.

---

### TagInput

A free-text combobox for collecting a list of tags. Users type, press
Enter (or a delimiter character), and the text becomes a chip. Optional
`suggestions` enable autocomplete, and `allowCustom={false}` rejects
values not in the suggestion list (predefined-options "pill select").

Replaces the hand-rolled chip-input UI pattern that the v0.10.0
primitives audit found duplicated across multiple consumers.
`<Select multiple>` does not fit the same use case because it requires
a fixed `options` list and rejects unknown values.

```tsx
import { TagInput } from '@lando-labs/lando-ds'
import { useState } from 'react'

const [tags, setTags] = useState<string[]>([])

<TagInput
  label="Topics"
  value={tags}
  onChange={setTags}
  suggestions={['react', 'typescript', 'nextjs']}
  placeholder="Add tags..."
  helperText="Press Enter or comma to add"
/>
```

**Props**

| Prop          | Type                              | Default    | Description |
|---------------|-----------------------------------|------------|-------------|
| `value`       | `string[]`                        | —          | Controlled tag list. |
| `onChange`    | `(tags: string[]) => void`        | —          | Called with the new array on every change. |
| `suggestions` | `string[]`                        | `undefined`| Optional autocomplete pool. Filtered case-insensitively against the typed text; already-selected tags are hidden. |
| `allowCustom` | `boolean`                         | `true`     | If `false`, only values present in `suggestions` may be added. |
| `delimiter`   | `string`                          | `','`      | Character that, when typed, commits the preceding text as a tag. Enter always commits regardless. |
| `maxTags`     | `number`                          | `undefined`| Hard upper bound. Input becomes disabled once reached and a "Max N tags" hint appears. Programmatic additions via `value` still work. |
| `validateTag` | `(tag: string) => boolean`        | `undefined`| Predicate run before commit. Returning `false` rejects the tag without adding it. |
| `name`        | `string`                          | `undefined`| When set, renders one hidden `<input type="hidden">` per tag so `FormData.getAll(name)` returns the array (matches `<Select multiple>` v0.4.1). |
| `label`       | `string`                          | —          | Optional label rendered above the combobox. |
| `helperText`  | `string`                          | —          | Subtext below the combobox. Suppressed when `error` is set. |
| `error`       | `string`                          | —          | Error message; surfaces with `role="alert"` and the unified error border. |
| `placeholder` | `string`                          | —          | Shown only when no chips are present. |
| `required`    | `boolean`                         | `false`    | Cosmetic + ARIA only — pair with `error` for validation messaging. |
| `disabled`    | `boolean`                         | `false`    | Disables both the editor and chip removal. |
| `id`          | `string`                          | auto       | Stable id for the combobox wrapper. |

**Keyboard**

| Key                           | Effect |
|-------------------------------|--------|
| `Enter`                       | Commit current text (or highlighted suggestion if open). |
| `delimiter` (default `,`)     | Strip and commit the preceding text inline. |
| `Tab` (with text)             | Commit current text, then move focus normally. |
| `Backspace` (empty input)     | Remove the last chip. |
| `ArrowDown` / `ArrowUp`       | Navigate the suggestion list. |
| `Home` / `End`                | Jump to first / last suggestion. |
| `Escape`                      | Close the suggestion list (focus stays in input). |

**Accessibility**

- Outer wrapper is `role="combobox"` with `aria-expanded`, `aria-haspopup="listbox"`, `aria-controls`, and `aria-activedescendant`.
- Inner `<input>` is a plain textfield (avoids nesting interactive roles inside the editor); it carries `aria-autocomplete="list"` when `suggestions` are supplied and `aria-invalid` when `error` is set.
- Each chip exposes a remove button labelled `Remove {tag}` and stays keyboard reachable (Tab order: input → first chip's remove → next chip's remove → next focusable).
- Focus ring uses the unified `--focus-ring-*` tokens via `:focus-within` on the wrapper (Sprint 7 #38) so the same shift-and-halo treatment applied to `<Input>` carries over here.
- Suggestion list is `role="listbox"`, options are `role="option"` with `aria-selected` mirroring the highlighted index.

**Implementation notes**

- The suggestion dropdown renders **inline** (`position: absolute` under the wrapper) rather than via `<Portal>`. Rationale: TagInput is typically embedded inside a form scroll context, and inline keeps the dropdown z-index correct without the rAF positioning + scroll listener overhead Portal needs. If you embed `TagInput` inside a Modal that clips overflow, give the Modal `overflow: visible` (the standard Lando-Labs Modal already does).
- Generic typing (`TagInput<T>`) is intentionally **deferred** for v0.10.0. If a consumer needs richer-than-string values, file a follow-up issue and we'll add a generic overload behind a back-compat `valueFor`/`labelFor` API. Today, the component is string-only.

---

### Radio

Accessible radio button for selecting a single option from a set. Must be used inside a `RadioGroup`, which orchestrates selection state, keyboard navigation, and the shared `name` attribute.

**Label API**:
- `children` (recommended) — matches React ecosystem convention (Radix, shadcn/ui, MUI) and supports rich content
- `label` — string-friendly shorthand; retained for backward compatibility
- When both are provided, `children` wins
- When neither is provided, no label text is rendered and the radio still works

**Features**:
- Controlled and uncontrolled modes via `RadioGroup`
- Keyboard navigation across the group (arrow keys)
- Per-radio and group-level `disabled`
- Error state on the group (`error` prop)
- Horizontal and vertical orientation
- Rich label content via `children` (icons, formatting)

**Usage**:
```tsx
import { Radio, RadioGroup } from '@lando-labs/lando-ds'

// Recommended: children pattern
<RadioGroup name="size" value={size} onChange={setSize}>
  <Radio value="sm">Small</Radio>
  <Radio value="md">Medium</Radio>
  <Radio value="lg">Large</Radio>
</RadioGroup>

// Rich label content
<RadioGroup name="plan" value={plan} onChange={setPlan}>
  <Radio value="free">
    <strong>Free</strong> — 5 projects
  </Radio>
  <Radio value="pro">
    <strong>Pro</strong> — unlimited projects
  </Radio>
</RadioGroup>

// Legacy label prop (still works)
<RadioGroup name="size" value={size} onChange={setSize}>
  <Radio value="sm" label="Small" />
  <Radio value="md" label="Medium" />
</RadioGroup>

// With group error state
<RadioGroup
  name="priority"
  value={priority}
  onChange={setPriority}
  error={errors.priority}
>
  <Radio value="low">Low</Radio>
  <Radio value="high">High</Radio>
</RadioGroup>
```

**Props**:
```typescript
interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'name' | 'children'> {
  /** Value for this radio option */
  value: string
  /** Recommended: label content. Accepts rich ReactNode. */
  children?: React.ReactNode
  /** Legacy shorthand for simple string labels. `children` wins when both provided. */
  label?: React.ReactNode
  /** Container className for the radio wrapper */
  containerClassName?: string
}

interface RadioGroupProps {
  /** Controlled value */
  value?: string
  /** Default value for uncontrolled mode */
  defaultValue?: string
  /** Callback when the selected value changes */
  onChange?: (value: string) => void
  /** Shared `name` attribute for all radios in this group */
  name: string
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical'
  /** Error message — when provided, the group enters an error state */
  error?: string
  /** Disable all radios in the group */
  disabled?: boolean
  /** Container className */
  className?: string
  /** Radio components */
  children: React.ReactNode
}
```

---

### Card

Flexible container component with optional sections.

**Variants**: `default`, `outlined`, `elevated`
**Padding**: `none`, `sm`, `md`, `lg`

**Features**:
- Composable with CardHeader, CardBody, CardFooter
- Clickable state with hover effects
- Loading skeleton state
- Ocean gradient option
- Responsive design

**Usage**:
```tsx
import { Card, CardHeader, CardBody, CardFooter } from '@lando-labs/lando-ds'

<Card variant="elevated">
  <CardHeader actions={<Button size="sm">Edit</Button>}>
    <h3>Card Title</h3>
  </CardHeader>
  <CardBody>
    <p>Card content goes here</p>
  </CardBody>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

<Card clickable onClick={handleClick}>
  <CardBody>Clickable card</CardBody>
</Card>

<Card gradient loading />
```

**Outlined border override (v0.14.0, #116)**:

`variant="outlined"` exposes a `--card-outline-color` CSS custom
property hook so consumers can render semantic-colored outlined cards
(e.g. error/success/warning states) without a typed prop. The default
border color is unchanged — the variable falls back to
`var(--color-border-default)` when not set.

```tsx
// Default outlined card — uses --color-border-default
<Card variant="outlined">…</Card>

// Error-state outlined card — overrides the border color per-instance
<Card
  variant="outlined"
  style={{ '--card-outline-color': 'var(--color-error-base)' } as React.CSSProperties}
>
  …
</Card>
```

**Auto-header shortcut (v0.6.0)**:

For the common widget-card pattern where the header is just a title
(optionally with a subtitle and actions), set the `title`, `subtitle`,
and `actions` props on `Card` directly — it will auto-render an
internal `<CardHeader>` with a `<CardTitle>` for you. Use this
shortcut **OR** a manual `<CardHeader>` inside children, not both.

```tsx
<Card title="Tasks" subtitle="3 open" actions={<Button size="sm">New</Button>}>
  <CardBody>
    <List>…</List>
  </CardBody>
</Card>
```

The `titleAs` prop (default `3`) sets the semantic heading level for
the auto-rendered title.

**CardTitle**: A small semantic heading (16px / weight 600) sized for
widget titles. Export it for explicit composition when you need a
custom header layout:

```tsx
import { Card, CardHeader, CardTitle } from '@lando-labs/lando-ds'

<Card>
  <CardHeader actions={<Button size="sm">Edit</Button>}>
    <CardTitle as={2}>Dashboard</CardTitle>
  </CardHeader>
  <CardBody>…</CardBody>
</Card>
```

**Props**:
```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'flat' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  clickable?: boolean
  loading?: boolean
  gradient?: boolean
  // Auto-header shortcut (v0.6.0)
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  titleAs?: 1 | 2 | 3 | 4 | 5 | 6 // default 3
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode
}

interface CardTitleProps {
  as?: 1 | 2 | 3 | 4 | 5 | 6 // default 3
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  // Layout shortcuts (v0.6.0, additive — #58)
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  stack?: boolean    // Shorthand for display:flex + flex-direction:column
  inline?: boolean   // Shorthand for display:flex + flex-direction:row
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
}
```

**CardBody layout shortcuts (v0.6.0)**: `CardBody` accepts the same
layout vocabulary as the `Stack`/`Inline` primitives so consumers can
express card-body layout without nesting a layout primitive inside
the card (issue #58). Rules:

- When **neither** `stack` nor `inline` is set, `CardBody` renders as
  a plain block — identical to its pre-v0.6.0 behavior. No breaking
  change.
- `stack` and `inline` are mutually exclusive; `stack` wins if both
  are accidentally passed.
- `gap` accepts **semantic tokens only** (maps to
  `var(--spacing-<token>)`). For custom pixel gaps, pass
  `style={{ gap: '42px' }}` instead.
- `gap`, `align`, and `justify` are **no-ops** unless `stack` or
  `inline` is active — the component never implicitly enables flex,
  to avoid surprising consumers who only want to set a token-based
  gap on their own flex/grid.

```tsx
// Vertical stack inside a card body
<Card title="Profile">
  <CardBody stack gap="sm">
    <Text>john.doe@example.com</Text>
    <Text variant="caption">Last active 2 minutes ago</Text>
  </CardBody>
</Card>

// Label-on-the-left, badge-on-the-right row
<Card>
  <CardBody inline align="center" justify="between" gap="md">
    <Text>Status</Text>
    <Badge variant="success">Active</Badge>
  </CardBody>
</Card>
```

**CardMedia (v0.11.0, #86)**:

`CardMedia` is the dedicated media slot for `Card` composition — drop in
an `<img>`, `<video>`, `<picture>`, or `next/image`, and CardMedia handles
the `position: relative; overflow: hidden;` + `object-fit: cover` +
border-radius boilerplate that consumers were previously hand-rolling
across a variety of card and media components.

```tsx
import { Card, CardMedia, CardBody } from '@lando-labs/lando-ds'

// Top-positioned media (default) — full-width strip above the body.
<Card>
  <CardMedia aspectRatio="16/9">
    <img src="/hero.jpg" alt="Article hero" />
  </CardMedia>
  <CardBody>
    <Heading level={3}>Headline</Heading>
    <Text>Lede copy goes here.</Text>
  </CardBody>
</Card>

// Side-positioned media — fixed-width column beside the body.
<Card>
  <CardMedia aspectRatio="1/1" position="left" width={120}>
    <img src="/thumb.jpg" alt="" />
  </CardMedia>
  <CardBody>
    <Heading level={4}>Feed item</Heading>
    <Text variant="caption">Body</Text>
  </CardBody>
</Card>

// Loading + image-error slots.
<Card>
  <CardMedia
    aspectRatio="3/2"
    placeholder={<Skeleton />}
    fallback={<EmptyState>Image unavailable</EmptyState>}
  >
    <img src={maybeBrokenSrc} alt="..." />
  </CardMedia>
  <CardBody>...</CardBody>
</Card>
```

**Behavior**:

- **Border radius**: inherits from `Card` (`border-radius: inherit`) so
  rounded Card corners clip the media automatically. Card already uses
  `overflow: hidden`, so for `position="top"` the inheritance is
  defense-in-depth.
- **Object fit**: any direct `<img>`/`<video>`/`<picture>` child receives
  `object-fit: cover; width: 100%; height: 100%`. `next/image` works
  without special handling — the wrapper element it produces is
  recognized by the same selector.
- **Aspect ratio**: forwarded to the CSS `aspect-ratio` property. Use
  ratio strings like `"16/9"`, `"1/1"`, `"4/3"`, `"3/2"`.
- **Side positioning**: when `position="left"` or `"right"`, the parent
  `Card` flips to row-flex via a `:has()` rule so the media renders as a
  fixed-width column beside `CardBody`. **No edits to `<Card>`'s public
  API or props are needed** — pair with the `width` prop to size the
  media column. `:has()` is supported in all modern browsers (Chrome
  105+, Firefox 121+, Safari 15.4+); older runtimes fall back to a
  stacked layout where the media still renders, just stacked on top.
- **Placeholder slot**: rendered when `children` is `null`/`undefined`.
  Use this for skeleton states while the URL is being resolved.
  CardMedia intentionally does **not** detect img-loading state — wrap
  in a Suspense boundary or use `next/image`'s built-in loading if you
  need that.
- **Fallback slot**: rendered when the first media child fires `onError`.
  CardMedia clones the first child to attach an internal error handler
  (any consumer-supplied `onError` is preserved and called first). The
  error state resets when the child's `src` changes.

**`next/image` integration**:

```tsx
import Image from 'next/image'

<Card>
  <CardMedia aspectRatio="16/9">
    <Image src="/hero.jpg" alt="..." fill sizes="100vw" />
  </CardMedia>
  <CardBody>...</CardBody>
</Card>
```

No special wrapper needed — CardMedia treats the `next/image` output the
same as a plain `<img>`. With `fill` the image stretches to the
container's `aspect-ratio`-derived height.

**CardMedia Props**:

```typescript
interface CardMediaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** CSS aspect-ratio value, e.g. "16/9", "1/1", "4/3". */
  aspectRatio?: string
  /** Where the media sits inside the Card. */
  position?: 'top' | 'left' | 'right' // default: 'top'
  /**
   * Pixel width for the media column. Only meaningful for
   * position="left" | "right". Numeric values are emitted as `${width}px`.
   */
  width?: number | string
  /** Slot rendered when children is null/undefined (e.g. <Skeleton/>). */
  placeholder?: React.ReactNode
  /** Slot rendered when the first media child errors out (onError). */
  fallback?: React.ReactNode
}
```

---

### ArticleCard

Editorial / newspaper-style surface with a deliberate **serif** divergence
from the DS sans-serif baseline. ArticleCard is a **sibling of `<Card>`,
not a Card variant** — its slot model (`headline`, `byline`, `pullQuote`,
`hero`, `lede`) and serif typography don't fit Card's generic surface
cleanly, and consumers asking for "a newspaper article" think differently
than consumers asking for "a card."

Renders as a semantic `<article>` element. All typography uses the editorial
token set (`--font-family-editorial`, `--color-editorial-ink-*`,
`--font-size-editorial-*`) so dark mode and consumer themes propagate
without forking.

**Scales** (controls headline size):
- `lead` — front-page lead story (2.5rem headline)
- `supporting` — secondary story (1.5rem headline) — **default**
- `brief` — sidebar brief / digest item (1.125rem headline, tighter padding)

**Slots**:
- `headline` (required) — heading text, defaults to `<h2>`, override via `headlineAs="h1" | "h2" | "h3"`
- `byline` + `date` — credits author and pub date in serif italic
- `hero` — image element rendered with stable `aspect-ratio: 16/9`, `object-fit: cover`
- `lede` — first paragraph, larger serif, tighter line-height
- `pullQuote` — `<blockquote>` with italic serif and left-border accent
- `children` — article body content, rendered after the lede block
- `href` — when set, the entire surface becomes a single clickable anchor (one `<a>`, no nested anchors)

**Standalone primitives**: `<Byline>`, `<Lede>`, and `<PullQuote>` are also
exported standalone for use in custom editorial layouts (long-form posts,
marketing hero copy, etc.).

**Basic usage**:
```tsx
import { ArticleCard } from '@lando-labs/lando-ds'

<ArticleCard
  headline="The morning headline"
  scale="lead"
  byline="Claude Opus 4.7"
  date="April 26, 2026"
  hero={<img src="/hero.jpg" alt="A descriptive alt." />}
  pullQuote="The most striking thing was how predictable it all became."
  href="/articles/the-morning-headline"
>
  <p>The article body, rendered in serif type for editorial flow.</p>
</ArticleCard>
```

**Standalone primitives**:
```tsx
import { Byline, Lede, PullQuote } from '@lando-labs/lando-ds'

<Byline name="Claude Opus 4.7" date="April 26, 2026" />
<Lede>The first paragraph in larger serif type sets the tone.</Lede>
<PullQuote attribution="Ada Lovelace">
  "The Analytical Engine has no pretensions whatever to originate anything."
</PullQuote>
```

**When to reach for ArticleCard vs Card**:
- Editorial / newsroom surfaces (lead story, supporting story, sidebar brief, blog index card with byline + lede) → **ArticleCard**.
- Dashboard tiles, form containers, generic content surfaces, anything sans-serif → **Card**.

**Editorial tokens** (added in v0.9.0, sprint 15, #94):
```css
--font-family-editorial: Georgia, "Times New Roman", "PT Serif", serif;
--font-size-editorial-headline-lead: 2.5rem;
--font-size-editorial-headline-supporting: 1.5rem;
--font-size-editorial-headline-brief: 1.125rem;
--font-size-editorial-lede: 1.125rem;
--font-size-editorial-pullquote: 1.5rem;
--font-size-editorial-byline: 0.875rem;
--font-size-editorial-body: 1rem;
--line-height-editorial-headline: 1.15;
--line-height-editorial-body: 1.7;

/* Ink colors alias DS text tokens — dark mode propagates automatically. */
--color-editorial-ink-primary: var(--color-text-primary);
--color-editorial-ink-secondary: var(--color-text-secondary);
--color-editorial-ink-muted: var(--color-text-tertiary);
--color-editorial-rule: var(--color-border-subtle);
```

Consumer themes can re-skin editorial surfaces by overriding any of the
above on `:root`, `[data-theme]`, or `[data-product]` blocks — the
component never reaches outside the token set.

---

### Badge

Small label component for status, counts, or tags.

**Variants**: `default`, `primary`, `success`, `warning`, `danger`, `info`
**Color schemes (#87)**: `ocean`, `teal`, `orange`, `blue`, `purple`, `green`, `rose`
**Sizes**: `sm`, `md`, `lg`

**Features**:
- Pill shape option
- Dot indicator variant
- Removable with callback
- Identity palettes via `colorScheme` (orthogonal to `variant`)

**`variant` vs `colorScheme` — when to use which**

These props are **orthogonal**. Use whichever (or both) fits the meaning:

- **`variant`** paints **state**. A "success" badge means *the thing
  succeeded*; a "warning" badge means *the thing needs attention*. The
  variant is semantic — it carries meaning beyond color.
- **`colorScheme`** paints **identity**. A "RSS" source-type tag is
  always orange; a "PubMed" tag is always purple. The color *is* the
  identity, regardless of state. Consumers should NOT abuse the
  semantic variants (success/warning/danger/info) to mean "green
  pill" / "amber pill" / etc. — that's what `colorScheme` exists for.

If both are passed, **`colorScheme` wins for color**. `variant` is still
emitted on the element so non-color semantics (such as future variant-
specific behaviors, or consumer overrides via `className`) keep working.

**Usage**:
```tsx
import { Badge } from '@lando-labs/lando-ds'

// State (variant) — semantic meaning
<Badge variant="success">Active</Badge>
<Badge variant="warning" size="sm">Pending</Badge>
<Badge variant="primary" pill>New</Badge>
<Badge variant="danger" onRemove={handleRemove}>
  Removable
</Badge>
<Badge dot variant="success" />

// Identity (colorScheme) — non-semantic palette
<Badge colorScheme="orange">RSS</Badge>
<Badge colorScheme="blue">NewsAPI</Badge>
<Badge colorScheme="purple">PubMed</Badge>
<Badge colorScheme="green">ThinkTank</Badge>
<Badge colorScheme="teal">Topic</Badge>

// Both — colorScheme wins for color
<Badge variant="success" colorScheme="orange">RSS (active)</Badge>
```

**Props**:
```typescript
type BadgeColorScheme =
  | 'ocean' | 'teal' | 'orange' | 'blue' | 'purple' | 'green' | 'rose'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  colorScheme?: BadgeColorScheme
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
  pill?: boolean
  icon?: React.ReactNode
  onRemove?: () => void
}
```

**Dark-mode contrast (#43, #87)**: Every semantic variant AND every
`colorScheme` palette uses a light-tinted surface + dark-tinted text on
both light and dark themes. The warning variant in particular mirrors
its light-mode relationship (dark amber on a lighter amber) rather than
the low-contrast cream-on-orange it replaced.
Identity palettes added in #87 follow the same lift pattern: light mode
pairs `--color-{key}-lightest` bg with `--color-{key}-darkest` text,
dark mode lifts the bg to `--color-{key}-light` while keeping the
darkest text. This pattern is *designed toward* WCAG AA contrast, but a
systematic per-palette audit is tracked in #13 — do not assume full AA
conformance across all 7 palettes until it closes.

---

### Chip

Interactive, multi-select pill-shaped toggle for filter panels and
similar surfaces. Renders as a real `<button type="button">` with
`aria-pressed` toggle semantics.

**Sizes**: `sm`, `md` (default)

**Features**:
- `selected` toggle state with tinted-background visual treatment
- Optional `count` slot rendered inline after the label, e.g. `Failed (42)`
- Optional `leftIcon` slot (lucide-react element or any ReactNode)
- Optional `rightIcon` slot, symmetric with `leftIcon`, rendered after
  the count badge — useful for a dismiss `×`, chevron, or trailing
  affordance. Passive slot only; the chip's `onClick` covers the whole
  surface (there is no `onRightIconClick`).
- `disabled` state — suppresses pointer events and reduces opacity
- Native button keyboard activation (Enter / Space)
- `forwardRef` to the underlying `<button>`

**Chip vs SegmentedControl vs Badge vs Button**

These four primitives all sit in the same "small interactive label"
neighborhood; pick by interaction model and weight:

- **`Chip`** — multi-select toggle. Each chip independently tracks
  `selected`. Use for filter panels where users can toggle several
  filters on at once (e.g. "Failed (42)", "Running (7)", "Stopped (3)").
- **`SegmentedControl`** — single-select. Exactly one option active at a
  time. Use for view-mode switchers, sort directions, etc.
- **`Badge`** — non-interactive (renders as `<span>`). Use for status
  indicators, identity tags, and counts that don't toggle anything.
- **`Button`** — full-weight action. Use when the affordance needs to
  read as a primary or secondary action, not a filter pill.

**Usage**:
```tsx
import { Chip } from '@lando-labs/lando-ds'
import { Filter } from 'lucide-react'

// Multi-select filter chip
<Chip selected={isFailed} onClick={() => toggle('failed')} count={42}>
  Failed
</Chip>

// With leading icon
<Chip
  selected={hasActiveFilter}
  onClick={() => toggleFilter()}
  leftIcon={<Filter />}
  size="sm"
>
  Active
</Chip>

// With trailing icon — e.g. a dismiss "×" affordance. The whole chip
// is one button; clicking the icon fires the chip's onClick. If you
// need an independent dismiss action, render a separate adjacent
// button instead of nesting one inside the chip.
import { X } from 'lucide-react'

<Chip
  selected
  onClick={() => removeFilter('failed')}
  rightIcon={<X />}
>
  Failed
</Chip>

// Filter row pattern
<Inline gap="sm">
  {filters.map((f) => (
    <Chip
      key={f.id}
      selected={selectedIds.includes(f.id)}
      onClick={() => toggleId(f.id)}
      count={f.count}
    >
      {f.label}
    </Chip>
  ))}
</Inline>
```

**Props**:
```typescript
interface ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  selected?: boolean
  count?: number
  size?: 'sm' | 'md'
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  // disabled, onClick, className, etc. inherit from <button>
}
```

**Accessibility**:
- Renders as `<button type="button">` (native button — not a div with
  role), so keyboard activation via Enter and Space is handled by the
  browser.
- `aria-pressed` reflects `selected` for screen readers (toggle button
  semantics, per WAI-ARIA Toggle Button pattern).
- Focus ring uses the unified `--focus-ring-*` tokens (#38).
- Disabled chips set the native `disabled` attribute, which removes
  them from the tab order.

**Origin**: Surfaced in a design-system recomposition audit. Two
surfaces hand-rolled this pattern (`.chip*` + `.rangeBtn*`). Targets
a consumer app's filter-panel consolidation.

---

### StatusDot

Small (~8–10px) semantic-colored circle for indicating status — drift,
session lifecycle, agent health, presence. Decorative by default; pass
`aria-label` to expose meaning to assistive tech.

Surfaced in a design-system recomposition audit. Recurring pattern
previously hand-rolled as `.statusDot` in consumer apps and reproduced
in session lifecycle markers.

**Variants**: `success`, `warning`, `danger`, `neutral`, `info`
**Sizes**: `sm` (8px, default), `md` (10px)

**Why a separate component (not `<Badge size="dot">`)?** Badge is
text-bearing and its API contract is built around that. A textless
dot-only Badge variant would complicate the common case to serve a
niche one. StatusDot is the dedicated primitive for the textless case.

**Usage**:
```tsx
import { StatusDot } from '@lando-labs/lando-ds'

// Shorthand (Sprint 20, #113) — dot + text in a single call. The dot
// is automatically aria-hidden because the label carries the meaning.
<StatusDot variant="success" label="Healthy" />

// Equivalent (pre-#113) hand-rolled wrapper — still supported but
// usually unnecessary now that `label` exists.
import { Inline, Text } from '@lando-labs/lando-ds'
<Inline gap="xs" align="center">
  <StatusDot variant="success" />
  <Text>Healthy</Text>
</Inline>

// Standalone — give it an accessible label.
<StatusDot variant="warning" aria-label="Drifted" />

// 10px size.
<StatusDot variant="info" size="md" />

// Live-region announcement when status changes dynamically.
<StatusDot variant="danger" aria-label="Failed" role="status" />
```

**Props**:
```typescript
type StatusDotVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'
type StatusDotSize = 'sm' | 'md'

interface StatusDotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'role'> {
  variant?: StatusDotVariant       // default: 'neutral'
  size?: StatusDotSize             // default: 'sm'
  label?: string                   // adjacent text label; dot becomes aria-hidden
  'aria-label'?: string            // when omitted → aria-hidden="true"
  role?: 'img' | 'status'          // default: 'img' (only when aria-label set)
}
```

**`label` prop (Sprint 20, #113)**: Bundles the canonical
`<Inline gap="xs"><StatusDot/><Text/></Inline>` wrapper into a single
component call. When `label` is provided:

- The component renders a wrapper `<span>` containing the dot and a
  `<span>` carrying the label text.
- The dot is automatically marked `aria-hidden="true"` — the label
  text natively carries the meaning to assistive tech.
- The label inherits body-copy typography (`--font-size-sm`,
  `--color-text-primary`).

When `label` is **not** provided, behavior is identical to v0.13.0
(bare dot, with the existing `aria-label` flow intact).

**Token mapping**:

| Variant   | Token                    | Notes                                        |
|-----------|--------------------------|----------------------------------------------|
| `success` | `--color-success`        |                                              |
| `warning` | `--color-warning`        |                                              |
| `danger`  | `--color-error`          | No `--color-danger` token; uses `--color-error`. Sprint 20 should add a `--color-danger` alias. |
| `neutral` | `--color-text-tertiary`  |                                              |
| `info`    | `--color-info`           |                                              |

**Accessibility**: When `aria-label` is omitted, the dot renders with
`aria-hidden="true"` — its meaning must be carried by a sibling text
node ("Healthy", "Drifted", etc.). When `aria-label` is provided, the
dot renders with `role="img"` and the given label so screen readers
announce it. Pass `role="status"` instead for live-region
announcements when the dot's color/state changes dynamically.

---

### Avatar

User avatar component with images, initials, and status indicators.

**Sizes**: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
**Status**: `online`, `offline`, `busy`, `away`

**Features**:
- Image with fallback to initials or icon
- Status indicator badge
- Loading skeleton state
- Ocean gradient option for initials
- Automatic image error handling

**Usage**:
```tsx
import { Avatar } from '@lando-labs/lando-ds'

<Avatar src="/user.jpg" alt="John Doe" />
<Avatar initials="JD" size="lg" />
<Avatar initials="AB" status="online" gradient />
<Avatar loading />
<Avatar /> {/* Falls back to icon */}
```

**Props**:
```typescript
interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  initials?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  status?: 'online' | 'offline' | 'busy' | 'away'
  loading?: boolean
  gradient?: boolean
}
```

**Accessibility (#13, WCAG 1.4.1)**: Status indicators use **both color
and shape** so color-blind users can still tell states apart:

| Status  | Color                  | Glyph              |
|---------|------------------------|--------------------|
| online  | success-base (green)   | solid disc         |
| offline | neutral-500 (grey)     | hollow ring        |
| busy    | error-base (red)       | horizontal bar     |
| away    | warning-base (amber)   | crescent moon      |

The indicator is a `role="img"` with `aria-label="Status: <state>"` so
screen readers announce it as a single unit.

---

### Dropdown

Portal-rendered menu with viewport-aware positioning and keyboard
navigation. Used for context menus, action menus, and overflow menus.

**Positioning & z-index contract:**

- Rendered via `<Portal>` into `document.body`. This **escapes ancestor
  `overflow`, `transform`, and `z-index` stacking contexts** — Dropdowns
  inside a `Card` with `overflow: hidden`, a CSS-transformed parent, or
  a lower-z-index container are **not clipped**.
- Stacks at `--z-index-dropdown` (1100), which sits above
  `--z-index-sticky` (100) and above `--z-index-modal` (1000) so that a
  Dropdown opened INSIDE a Modal renders above the Modal backdrop. See the
  [Nested Overlay Contract](#nested-overlay-contract) and the
  [Z-index Layering Contract](#z-index-layering-contract) for the full
  scale.
- Uses the shared [`usePortalPosition`](#portal-positioning-hook) hook
  for viewport flipping (above/below), scroll/resize tracking, and
  first-paint flash prevention.
- Carries `data-portal-content` on the portaled element so
  `useClickOutside` (and other outside-click handlers) know to treat
  clicks inside the dropdown as "inside".
- Carries `data-placement="above" | "below"` so consumers can target
  flip-aware animation origins in CSS.

**Features:**

- Viewport-aware flipping (opens above when no room below)
- Keyboard navigation with focus trap (Escape to close)
- Closes on outside click (respects `data-portal-content` children)
- Smart horizontal alignment (`left` / `right` / `center`)
- Horizontally clamped to viewport with 8px margin

**Usage:**

```tsx
import { Dropdown, DropdownItem, Button } from '@lando-labs/lando-ds'
import { Edit, Trash } from 'lucide-react'

<Dropdown trigger={<Button>Actions</Button>} align="right">
  <DropdownItem icon={<Edit size={16} />} onClick={handleEdit}>
    Edit
  </DropdownItem>
  <DropdownItem divider />
  <DropdownItem icon={<Trash size={16} />} destructive onClick={handleDelete}>
    Delete
  </DropdownItem>
</Dropdown>
```

**Dropdown inside a bounded parent works correctly:**

```tsx
// The Card has overflow: hidden but the Dropdown portal escapes it.
<Card>
  <Dropdown trigger={<Button>Menu</Button>}>
    <DropdownItem>Profile</DropdownItem>
    <DropdownItem>Settings</DropdownItem>
  </Dropdown>
</Card>
```

**Dropdown inside a Modal renders above modal content:**

As of v0.4.1, `--z-index-dropdown` (1100) sits ABOVE `--z-index-modal` (1000),
so a `<Dropdown>` inside a `<Modal>` portals to `document.body` and paints
above the Modal backdrop. This is the fix for #35 / #46 — see the
[Nested Overlay Contract](#nested-overlay-contract) for the full
implementation requirements when authoring a new overlay.

**Props:**

```typescript
interface DropdownProps {
  trigger: React.ReactNode
  align?: 'left' | 'right' | 'center'
  children: React.ReactNode
  className?: string
}
```

**Accessibility (#13)**: The cloned trigger automatically receives
`aria-haspopup="menu"` and `aria-expanded` reflecting the open state —
screen readers announce the disclosure relationship even though the
portaled menu lives elsewhere in the DOM. Consumer-supplied values
win, so a command-menu trigger can pass `aria-haspopup="listbox"` if
that's a better fit.

---

### Drawer

Edge-pinned slide-over panel for secondary surfaces — version histories,
detail readers, filter panels, mobile menus. Distinct from `Modal`
(centered overlay), `Sidebar` (persistent navigation chrome), and
`Popover` (tooltip-scale anchored content).

**Behavioural contract:**

- Reuses `Modal`'s overlay infrastructure: `<Portal>` mount, `useFocusTrap`
  for Tab/Shift+Tab containment, `useKeyPress('Escape')` for keyboard
  dismiss, `useClickOutside` for backdrop dismissal, body scroll-lock
  while open.
- Stacks at `--z-index-drawer` (1000) — same tier as Modal. Drawer and
  Modal are mutually exclusive in practice; if both render at once they
  paint as siblings rather than nested layers, and the later-mounted one
  wins paint order.
- Slides in from the chosen viewport edge:
  - `right` (default): translateX from `100%` → `0`
  - `left`: translateX from `-100%` → `0`
  - `bottom`: translateY from `100%` → `0`
- For `right` / `left` placements `size` controls the panel **width**;
  for `bottom` placement it controls **height**.
- Honors `prefers-reduced-motion` — slide is replaced with a fade.
- Backdrop click and Escape both call `onClose`; either can be opted out
  via `closeOnBackdropClick={false}` / `closeOnEscape={false}` for
  destructive flows where the user must use an explicit action.
- `data-placement="right" | "left" | "bottom"` is exposed for consumers
  that want to target the placement in their own CSS.

**Sticky header pattern:**

When `title` is provided, the Drawer renders an internal sticky header
that pins the title and close-X above the scrolling body. The header is
the standard pattern for the version-history / article-panel use cases
the primitive was built for. For custom header layouts, omit `title`,
omit the close button via `showCloseButton={false}`, and render your
own structure as the first child of the Drawer body. This mirrors the
`Card` / `CardHeader` composition story without forcing the consumer
into a sub-component contract.

**Usage:**

```tsx
import { Drawer, Button } from '@lando-labs/lando-ds'

function ArticleReader() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open article</Button>
      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        placement="right"
        size="md"
        title="Reading panel"
      >
        <ArticleBody />
      </Drawer>
    </>
  )
}
```

**Numeric size override:**

```tsx
{/* Editorial article panel — 480px reading column */}
<Drawer isOpen={open} onClose={close} size={480}>
  <ArticleContent />
</Drawer>

{/* Mobile bottom sheet at 60vh */}
<Drawer placement="bottom" size={Math.round(window.innerHeight * 0.6)}>
  <SheetContent />
</Drawer>
```

**Props:**

```typescript
type DrawerPlacement = 'right' | 'left' | 'bottom'
type DrawerSize = 'sm' | 'md' | 'lg' | number

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  placement?: DrawerPlacement                  // default: 'right'
  size?: DrawerSize                            // default: 'md'
  title?: string
  closeOnBackdropClick?: boolean               // default: true
  closeOnEscape?: boolean                      // default: true
  showCloseButton?: boolean                    // default: true
  children: React.ReactNode
  className?: string
}
```

**Size tiers:**

| Tier   | Desktop | Mobile (≤640px)               |
|--------|---------|-------------------------------|
| `sm`   | 320px   | clamps to `min(320px, 80%)`   |
| `md`   | 480px   | clamps to `min(480px, 90%)`   |
| `lg`   | 640px   | clamps to `min(640px, 95%)`   |
| number | exact   | exact (no clamp)              |

For `bottom` placement these values control HEIGHT rather than WIDTH.

**Accessibility (#13):** Renders as `role="dialog"` with `aria-modal="true"`
and a unique `aria-labelledby` (via `useId`) when `title` is provided —
multiple Drawers on a page do not collide on the labelled-by id.
Focus is trapped inside the panel for the duration the drawer is open;
on close, focus returns to the element that had focus before opening.

---

### CommandPalette

First-class ⌘K palette primitive — a centered spotlight with grouped,
keyboard-navigable commands. Composes the v0.29 native `<dialog>` Modal so
all dialog mechanics (top-layer promotion, `::backdrop`, focus trap, Esc
dismiss, scroll-lock) come from the platform.

**Why it ships:** prior consumers hand-rolled
palettes on top of `Modal + Input`, with custom keyboard nav and
**invalid ARIA** (`role="option"` with no `role="listbox"` ancestor).
`CommandPalette` fixes that bug architecturally and supplies the missing
affordances (groups, shortcuts, descriptions, filter, empty state).

**Behavioural contract:**

- **Controlled-only**: consumers own `open` + `onOpenChange` (and the ⌘K
  hotkey via their own keyboard listener — the palette deliberately does
  not register a global hotkey, because hotkeys are an app-shell concern).
- **Listbox semantics**: the items live inside a real `role="listbox"`.
  Groups use `role="group"` with `aria-labelledby` linkage to their
  heading — the WAI-ARIA "Listbox Grouping" pattern, used by GitHub's
  command-k.
- **`aria-activedescendant` focus model**: DOM focus stays on the search
  input the whole time (so the user can keep typing); the active option is
  announced via `aria-activedescendant`. Same pattern as `Select`.
- **Filter**: built-in case-insensitive substring filter against each
  item's `searchValue` (or its text children). For async/fuzzy matching,
  control `value` and render only the items you want shown.
- **Esc dismissal**: bubbles to Modal's `cancel` event → `onOpenChange(false)`.

**Usage:**

```tsx
import {
  CommandPalette,
  CommandPaletteGroup,
  CommandPaletteItem,
  Kbd,
} from '@lando-labs/lando-ds'
import { Home, Search, Settings } from 'lucide-react'

function App() {
  const [open, setOpen] = useState(false)
  // Consumer wires the ⌘K hotkey themselves.
  useHotkey('mod+k', () => setOpen((o) => !o))

  return (
    <CommandPalette open={open} onOpenChange={setOpen}>
      <CommandPaletteGroup heading="Navigation">
        <CommandPaletteItem
          icon={<Home size={16} />}
          shortcut={<Kbd shortcut="meta+1" />}
          onSelect={() => router.push('/')}
        >
          Home
        </CommandPaletteItem>
        <CommandPaletteItem
          icon={<Search size={16} />}
          shortcut={<Kbd shortcut="meta+k" />}
          onSelect={() => setOpen(true)}
        >
          Search
        </CommandPaletteItem>
      </CommandPaletteGroup>

      <CommandPaletteGroup heading="Account">
        <CommandPaletteItem
          icon={<Settings size={16} />}
          description="Application preferences"
          onSelect={() => router.push('/settings')}
        >
          Settings
        </CommandPaletteItem>
      </CommandPaletteGroup>
    </CommandPalette>
  )
}
```

**Keyboard:**

| Key | Effect |
|-----|--------|
| `ArrowDown` / `ArrowUp` | Move active descendant (wraps). |
| `Home` / `End` | Jump to first / last option. |
| `Enter` | Invoke active option's `onSelect`. |
| `Esc` | Dismiss via Modal's `cancel` flow. |

**Props:**

```typescript
interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string                       // controlled filter; omit for internal
  onValueChange?: (value: string) => void
  placeholder?: string                 // default: 'Type a command or search…'
  emptyState?: React.ReactNode         // default: 'No results.'; pass null to suppress
  'aria-label'?: string                // listbox label; default: 'Commands'
  children: React.ReactNode
}

interface CommandPaletteGroupProps {
  heading: string
  children: React.ReactNode
}

interface CommandPaletteItemProps {
  id?: string                          // auto via useId
  children: React.ReactNode            // primary label
  description?: React.ReactNode
  shortcut?: React.ReactNode           // typically <Kbd shortcut="…" />
  icon?: React.ReactNode
  onSelect: () => void
  disabled?: boolean
  searchValue?: string                 // overrides text-children filter key
}
```

---

### Select

Portal-rendered combobox with search, keyboard navigation, and
multi-select support.

**Positioning & z-index contract:**

- Same portal and z-index contract as [Dropdown](#dropdown). Select
  shares the `usePortalPosition` hook so positioning behavior is
  identical.
- The listbox matches the trigger width automatically. The `maxHeight`
  prop (default 300px) drives the scrollable area — the options panel
  uses `flex: 1 1 auto; min-height: 0; overflow-y: auto` so all options
  render and scroll internally instead of collapsing.

**Features:**

- Single or multiple selection (`multiple` prop)
- Optional search filter (`searchable` prop)
- Optional clear button (`clearable` prop)
- Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
- Error state with message
- Loading state
- Custom option rendering via `renderOption`
- `name` prop for native `FormData` / Server Actions support

**Usage:**

```tsx
import { Select } from '@lando-labs/lando-ds'

<Select
  label="Fruit"
  options={[
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' },
  ]}
  value={fruit}
  onChange={setFruit}
  searchable
  clearable
/>

// With 20+ options — all render, listbox scrolls internally:
<Select
  options={manyOptions}
  value={value}
  onChange={setValue}
  maxHeight={320}
/>

// Server Actions — single-select (FormData.get('language')):
<Select
  name="language"
  label="Language"
  options={languageOptions}
  value={language}
  onChange={(v) => setLanguage(v as string)}
/>

// Server Actions — multi-select (FormData.getAll('tags')):
<Select
  name="tags"
  label="Tags"
  multiple
  options={tagOptions}
  value={selectedTags}
  onChange={(v) => setSelectedTags(v as string[])}
/>
```

**Props:**

```typescript
interface SelectOption<T = any> {
  label: string
  value: T
  disabled?: boolean
  group?: string
}

interface SelectProps<T = any> {
  options: SelectOption<T>[]
  value?: T | T[]
  onChange: (value: T | T[]) => void
  placeholder?: string
  searchable?: boolean
  clearable?: boolean
  disabled?: boolean
  loading?: boolean
  multiple?: boolean
  maxHeight?: number              // px, default 300
  renderOption?: (option: SelectOption<T>) => React.ReactNode
  error?: string
  label?: string
  className?: string
  /**
   * HTML field name. When set, renders hidden input(s) so FormData /
   * Server Actions receive the value.
   *
   * Single-select: one hidden input; value is String(selectedValue ?? '').
   * Multi-select:  one hidden input per selected value so
   *   FormData.getAll(name) returns a string array — matching the native
   *   <select multiple> contract.
   */
  name?: string
}
```

**FormData serialization:**

| Mode | Hidden inputs emitted | How to read in Server Action |
|------|----------------------|------------------------------|
| Single, value selected | 1 — `name=value` | `formData.get(name)` |
| Single, no selection | 1 — `name=""` | `formData.get(name)` → `''` |
| Multi, N values | N — one per value | `formData.getAll(name)` |
| Multi, no selection | 0 | `formData.getAll(name)` → `[]` |

**Accessibility (#13)**: The combobox follows the WAI-ARIA 1.2
[combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

- Each rendered option has a stable unique id.
- `aria-activedescendant` on the combobox (and the search input, when
  searchable) points at the currently highlighted option so screen
  readers announce it as the user arrow-keys through the list.
- `aria-controls` wires the combobox to the listbox id while open.
- The **same key handler** fires whether focus is on the combobox
  trigger or the search input — Arrow/Enter/Escape work in both
  states. Previously the search input swallowed keyboard events and
  keyboard users could type a filter but couldn't pick an option.
- `Home` / `End` jump the highlight to the first / last option.
- `Escape` closes and returns focus to the combobox trigger.

---

### Tooltip

Lightweight hover/focus tooltip with smart positioning, portal rendering,
and an external-anchor escape hatch for SVG elements.

**Positioning & z-index contract:**

- Rendered via `<Portal>` into `document.body`, so Tooltips **escape
  ancestor `overflow: hidden` / `overflow: auto` containers and
  transformed stacking contexts**. Tooltipping a chart bar inside a
  scrollable `Card` is not clipped.
- Stacks at `--z-index-tooltip` (1300), above Popover (1200), Dropdown
  (1100), and Modal (1000). See the
  [Z-index Layering Contract](#z-index-layering-contract) for the full scale.
- `top` / `bottom` / `auto` placements use the shared
  [`usePortalPosition`](#portal-positioning-hook) hook — same rAF retry
  loop, off-screen init, and capture-phase scroll listeners as Dropdown
  and Select.
- `left` / `right` placements use an inline effect that mirrors the same
  pattern, so all four directions share correctness guarantees.
- Carries `data-portal-content` on the portaled element (outside-click
  helpers treat clicks inside as "inside") and `data-placement` so
  consumers can target flip-aware animation origins in CSS.
- Initial render is off-screen at `(-9999, -9999)` with
  `visibility: hidden` until measurement completes — no flash at (0, 0).

**Features:**

- Delayed show (default 300ms) so hover transit doesn't trigger
- Dark variant (`dark` prop) and `maxWidth` clamp
- Arrow pointer aligned to the computed placement
- Full keyboard accessibility via focus / blur events
- `disabled` prop to suppress without unmounting

**Usage — normal wrapping (most tooltips):**

```tsx
import { Tooltip, Button } from '@lando-labs/lando-ds'

<Tooltip content="This is a helpful tip" position="top">
  <Button>Hover me</Button>
</Tooltip>
```

**Usage — external anchor for SVG (`anchorRef`):**

Use `anchorRef` when `cloneElement` can't forward refs to your trigger —
most commonly with SVG child elements in data visualizations. The
consumer owns the anchor element and `Tooltip` just reads its rect and
attaches hover/focus listeners directly. Pass `<></>` (or any placeholder)
as `children` — it is ignored when `anchorRef` is provided.

```tsx
import { useRef } from 'react'
import { Tooltip } from '@lando-labs/lando-ds'

function SparklineBar({ count, start, end }: Props) {
  const rectRef = useRef<SVGRectElement>(null)
  return (
    <>
      <rect ref={rectRef} x={10} y={10} width={20} height={40} fill="#1B7FA8" />
      <Tooltip
        content={`${count} events · ${start} — ${end}`}
        anchorRef={rectRef}
      >
        <></>
      </Tooltip>
    </>
  )
}
```

**Usage — SVG child without `anchorRef`:**

Passing an SVG element directly as `children` also works: `Tooltip`
auto-wraps it in a `<span style={{ display: 'contents' }}>` so the
layout is unchanged but there's a stable HTML anchor for ref + hover
events. `anchorRef` is still the recommended path for SVG — it's more
explicit and avoids the wrapper entirely.

```tsx
<svg width={100} height={100}>
  <Tooltip content="Apr 15 — 15 events">
    <rect x={10} y={10} width={20} height={40} />
  </Tooltip>
</svg>
```

**Usage — tooltip inside an overflow-clipped container:**

The portal escape contract means Tooltips work correctly inside table
cells, scrollable panels, and other clipped containers without any
extra configuration:

```tsx
<div style={{ overflow: 'hidden', width: 120 }}>
  <Tooltip content="Not clipped by the ancestor overflow">
    <button>Hover</button>
  </Tooltip>
</div>
```

**Props:**

```typescript
interface TooltipProps {
  /** Tooltip content */
  content: React.ReactNode
  /** Preferred position. `auto` flips to the side with most room. */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'  // default: 'top'
  /** Delay in ms before showing tooltip */
  delay?: number                                           // default: 300
  /**
   * Child to attach tooltip to. When `anchorRef` is provided, `children`
   * is rendered as-is (no ref or handler cloning) so consumers can pass
   * `<></>` or keep the child element for tree structure only.
   */
  children: React.ReactElement
  /**
   * Optional external anchor. When provided, `Tooltip` positions against
   * this ref's element and attaches hover/focus listeners directly on it.
   * Accepts `Element` so both `HTMLElement` and `SVGElement` refs work.
   * Recommended for SVG trigger elements.
   */
  anchorRef?: React.RefObject<Element | null>
  /** Dark variant (inverted colors) */
  dark?: boolean                                           // default: false
  /** Maximum width in pixels */
  maxWidth?: number                                        // default: 280
  /** Disable the tooltip entirely */
  disabled?: boolean                                       // default: false
}
```

---

### Portal Positioning Hook

Both `Dropdown` and `Select` consume `usePortalPosition(triggerRef,
isOpen, options)` from `@lando-labs/lando-ds` (exported as a
public hook). It handles the three classic pain points of positioning
a portaled overlay:

1. **No first-paint flash at (0,0).** Returns `{ top: -9999, left: -9999,
   isReady: false }` until the overlay element is measured. Consumers
   apply `visibility: hidden` while `isReady === false`.
2. **Reliable measurement on mount.** Uses `useLayoutEffect` plus a
   `requestAnimationFrame` retry loop (up to 10 frames) to handle the
   case where the Portal has not yet attached the overlay on the first
   tick after `isOpen` becomes `true`.
3. **Viewport-aware flipping.** Places the overlay below the trigger
   when there is room, above when not. Reports `placement: 'above' |
   'below'` so consumers can set flip-aware animation origins via
   `[data-placement='above']` selectors.

Scroll (capture phase, to catch ancestor scroll in `overflow: auto`
parents) and resize listeners reposition the overlay while open.

```typescript
const position = usePortalPosition(triggerRef, isOpen, {
  align: 'left' | 'right' | 'center',
  offset: 4,                      // px gap between trigger and overlay
  overlayRef,                     // ref to the overlay element
  matchTriggerWidth: false,       // force overlay width = trigger width
})
// → { top, left, width, placement, isReady }
```

See `src/hooks/usePortalPosition.ts` for the canonical implementation.

---

### Header

A responsive top bar composed of three independent slots — `logo`,
`navigation`, `actions` — with sticky, transparent, and mobile-menu
variants. Ships with sensible marketing-site defaults and a `maxWidth`
prop for in-app shells wider than the default centered band.

**Layout contract:**

- Outer `<header>` always spans the full viewport (important for
  `sticky` and background continuity).
- Inner `.container` is the content band. Defaults to a 1280px
  centered column — ideal for marketing pages. Override with
  `maxWidth` for in-app shells.
- `actions` right-pins regardless of which other slots are populated,
  via `margin-left: auto` on the slot. A Header that only receives
  `actions` (no logo, no nav) still renders them on the right.

**Features:**

- Three-slot composition: `logo`, `navigation`, `actions`
- `sticky` with scroll-triggered shadow
- `transparent` overlay mode (turns opaque once scrolled)
- Built-in mobile hamburger + mobile menu (shows navigation + actions)
- Keyboard: Escape closes the mobile menu; outside-click closes
- `maxWidth` prop for in-app / full-bleed scenarios

**Mobile menu gating:**

The hamburger + slide-down mobile menu only render when a
`navigation` slot is provided. Headers that use only `actions`
(a common in-app shell pattern where global navigation lives in a
sidebar) keep their actions visible at all viewports — no hamburger
appears, so actions aren't hidden.

**Usage:**

```tsx
import { Header } from '@lando-labs/lando-ds'

// Marketing site — centered 1280px band (default)
<Header
  logo={<Logo />}
  navigation={<MainNav />}
  actions={<UserMenu />}
  sticky
/>

// In-app shell — full-bleed content
<Header
  maxWidth="none"
  logo={<Logo />}
  actions={<UserMenu />}
  sticky
/>

// Custom content width (e.g. 1440px cap inside full-bleed background)
<Header maxWidth={1440} logo={<Logo />} actions={<UserMenu />} />

// Actions-only layout — still right-pins correctly
<Header actions={<UserMenu />} />
```

**Props:**

```typescript
interface HeaderProps {
  logo?: React.ReactNode
  navigation?: React.ReactNode
  actions?: React.ReactNode
  sticky?: boolean          // Default: false
  transparent?: boolean     // Default: false
  /**
   * Max width of the inner content area.
   * - Omitted: 1280px centered band (marketing default)
   * - number: applied as pixels (e.g. 1440 → "1440px")
   * - string: applied verbatim. Use "none" or "100%" for full-bleed.
   *
   * The outer <header> always spans the full viewport regardless.
   */
  maxWidth?: string | number
  /**
   * Skip-link target (WCAG 2.4.1). When provided, a visually-hidden-
   * until-focused "Skip to content" link is rendered as the first
   * focusable element in the header.
   *
   * Example: <Header skipLinkHref="#main" /> + <main id="main" tabIndex={-1}>
   */
  skipLinkHref?: string
  /** Visible label for the skip link. Default: "Skip to content" */
  skipLinkLabel?: string
  className?: string
}
```

**Behavior notes:**

- `maxWidth="none"` also resets the centering margins so the container
  truly spans edge-to-edge. Any other value keeps `margin: 0 auto`
  centering.
- When combined with `AppShell`, pass `maxWidth="none"` to let the
  Header fill the full shell width — `AppShell` already handles the
  outer layout frame.

**Accessibility (#13) — skip link (WCAG 2.4.1 "Bypass Blocks")**:

Pass `skipLinkHref` to render a keyboard-only "Skip to content" link
as the first focusable element in the header. Keyboard users pressing
Tab on page load land on it first and can jump past the nav/actions
block to the main content — satisfying WCAG 2.4.1.

```tsx
<Header
  skipLinkHref="#main"
  logo={<Logo />}
  navigation={<Nav />}
  actions={<UserMenu />}
  sticky
/>

// Somewhere else in the page:
<main id="main" tabIndex={-1}>
  {/* ... */}
</main>
```

The skip link is visually hidden (translated off-screen) until it
receives focus, at which point it reveals itself pinned to the top-
left of the header. `tabIndex={-1}` on the target main landmark lets
the browser move focus there after activation.

---

### PageHeader

A page-level header primitive that absorbs the `title` + optional
`subtitle` + optional `breadcrumbs` + optional `actions` pattern
that every consumer app rebuilds on every route. Composes the
existing `Heading` and `Text` primitives and renders a semantic
`<header>` element.

**Why this exists (#54):** pre-PageHeader, every route was reaching
for a hand-rolled `<div className="page-header">` with an inline
Flexbox + `Heading` + `Text` + `Button` combo. A single consumer app
had six copies across six routes. `<PageHeader>` replaces the whole
pattern with one prop-driven component.

**Layout contract:**

- Outer element is `<header>` (not `<div>`). Ref type is
  `HTMLElement`.
- Title column (left, flex-grow) stacks: `breadcrumbs` above,
  `Heading` in the middle, `subtitle` below.
- `actions` slot right-pins via `flex: 0 0 auto`.
- Under 640px the row wraps so actions drop below the title.

**Title scale (#43 DS-MOD-1):** default `titleSize` is `'2xl'` —
the app page-title scale (~25px). That's deliberately NOT the
marketing hero scale — page titles live inside an app shell, not
a landing-page hero. Override with `titleSize` if you need
something different, but `'2xl'` is the correct default for 95%
of in-app pages.

**Escape hatch:** when `children` is provided, `title` /
`subtitle` / `breadcrumbs` / `actions` are ignored and `children`
render inside the `<header>` wrapper. Use this only for layouts
that can't be expressed by the structured props — the whole point
of this component is to centralize the pattern, so prefer the
props.

**Horizontal padding is 0.** PageHeader handles vertical rhythm
(`var(--spacing-lg)` top/bottom) but leaves horizontal gutters
to the consumer — typically a `Container` or `StickyBar`.

**Usage:**

```tsx
import { PageHeader, Button } from '@lando-labs/lando-ds'

// Prop-based: the 95% case
<PageHeader
  title="Contacts"
  subtitle="Manage your contact list"
  actions={<Button variant="primary">Add Contact</Button>}
/>

// With breadcrumbs
<PageHeader
  title="Settings"
  breadcrumbs={
    <Breadcrumb>
      <BreadcrumbItem href="/">Home</BreadcrumbItem>
      <BreadcrumbItem current>Settings</BreadcrumbItem>
    </Breadcrumb>
  }
/>

// Children escape hatch
<PageHeader>
  <CustomHeaderLayout />
</PageHeader>
```

---

### Sidebar

A responsive sidebar navigation with a robust collapse API, a collapsed-rail
slot, and mobile-drawer behavior under 768px.

> **See also**: [`integrating-with-nextjs.md`](./integrating-with-nextjs.md)
> for the App Router `AppShell` recipe. The `Sidebar` and `AppShell` prop APIs
> are documented in full below.

**API shape:**

- Controlled: `collapsed` + `onCollapsedChange`
- Uncontrolled: `defaultCollapsed`
- Persisted: `persistKey` (localStorage) — ignored if controlled
- Collapsed rail slot: `collapsedContent` renders in place of `children` while
  collapsed on tablet/desktop. Omit it to simply shrink width without swapping
  content.
- `id` (auto-generated if omitted) is used for `aria-controls` wiring with the
  built-in collapse toggle.

**Responsive breakpoints:**

| Viewport       | Behavior                                       |
|----------------|------------------------------------------------|
| `<768px`       | Fixed overlay drawer; `aria-modal`; focus trap |
| `768–1023px`   | Visible; rail-mode-friendly                    |
| `≥1024px`      | Visible; expanded by default                   |

Driven by the `--breakpoint-md` and `--breakpoint-lg` tokens.

**Features:**

- Smooth width transition via `--duration-slow` / `--easing-wave`
- Participates in flex/grid flow (no `position: fixed` outside mobile)
- Exposes effective width as the `--sidebar-width` CSS custom property
- `role="navigation"` + configurable `ariaLabel`
- Collapse toggle has `aria-expanded` and `aria-controls`
- Mobile drawer: Escape closes, focus trap, body scroll lock, scrim backdrop
- Ocean-gradient variant (via `.gradient` class override — legacy API preserved)

**Usage:**

```tsx
import { Sidebar } from '@lando-labs/lando-ds'

// Simplest form — component owns state
<Sidebar>
  <NavList />
</Sidebar>

// Uncontrolled with persistence
<Sidebar defaultCollapsed persistKey="app-sidebar">
  <NavList />
</Sidebar>

// Controlled
const [collapsed, setCollapsed] = useState(false)
<Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed}>
  <NavList />
</Sidebar>

// Collapsed rail with icon-only nav
<Sidebar collapsedContent={<IconRail />}>
  <FullNav />
</Sidebar>
```

**Props:**

```typescript
interface SidebarProps {
  position?: 'left' | 'right'          // Default: 'left'
  width?: string | number              // Default: '16rem'
  collapsedWidth?: string | number     // Default: '3.5rem' (56px)
  collapsible?: boolean                // Show built-in toggle. Default: true
  collapsed?: boolean                  // Controlled
  onCollapsedChange?: (collapsed: boolean) => void
  defaultCollapsed?: boolean           // Uncontrolled. Default: false
  persistKey?: string                  // localStorage key (uncontrolled only)
  collapsedContent?: React.ReactNode   // Renders in rail mode
  mobileOpen?: boolean                 // Controlled drawer state
  onMobileOpenChange?: (open: boolean) => void
  overlay?: boolean                    // Mobile scrim. Default: true
  id?: string                          // Auto-generated if omitted
  ariaLabel?: string                   // Default: 'Sidebar navigation'
  children: React.ReactNode
  className?: string
}
```

**Accessibility caveats:**

- Icon-only items in `collapsedContent` must have accessible names — add
  `aria-label` to icon buttons, and consider pairing with `<Tooltip>` for
  sighted users. This is a consumer responsibility; the design system
  cannot infer labels.
- For active-route expression, apply `aria-current="page"` on the matching
  nav item. Sidebar styles a matching background tint on any child with
  `aria-current="page"` or `aria-current="true"`, so consumers using
  anchor-based navigation (react-router NavLink, Next Link with pathname
  matching) don't need to separately toggle List's `active` prop.

**Touch targets (#40, WCAG 2.5.8)**: Sidebar enforces a 44px `min-height`
on `:global(.listItem)` (List-based nav items) and on items inside
`collapsedContent`, so touch-device users and users with motor
impairments have adequate hit areas even in rail mode.

**Tooltip pattern for rail mode (#43 DS-MOD-3)**: When collapsed, pair
nav items with `<Tooltip>` using the label text as tooltip content. Give
each icon button a stable `aria-label` (screen readers rely on it
exclusively in rail mode), and only enable the tooltip while collapsed —
on an expanded sidebar the label is already visible. For SVG-based icons
or third-party links that don't forward refs cleanly, use Tooltip's
`anchorRef` escape hatch.

---

### SidebarNavItem

A reusable nav-item primitive that absorbs the `.nav-item` CSS pattern every
consumer was reproducing. Composes icon + label + optional badge with built-in
touch targets, active state, and collapsed-rail Tooltip support.

**Key features:**

- 44px `min-height` — WCAG 2.5.8 touch target (Sprint 7 #40)
- 20px icon default — DS-MOD-2 (#43)
- `aria-current="page"` when `active`
- `asChild` for `next/link` integration (Slot from v0.3.0 #8)
- Tooltip wrapping in collapsed-rail mode (DS-MOD-3 #43)
- Ocean-lightest active background, ocean-medium active text

**Context note:** `Sidebar` does not expose a React context, so `collapsed`
must be passed down explicitly when the sidebar is in collapsed state.

**Usage:**

```tsx
import { SidebarNavItem } from '@lando-labs/lando-ds'
import { LayoutDashboard, Users } from 'lucide-react'

// Static href — active current page
<SidebarNavItem href="/" icon={<LayoutDashboard />} active>
  Dashboard
</SidebarNavItem>

// With unread badge
<SidebarNavItem href="/contacts" icon={<Users />} badge={<Badge>3</Badge>}>
  Contacts
</SidebarNavItem>

// next/link integration via asChild
// The <Link> element receives className, aria-current, onClick, and ref.
// The icon and badge remain in SidebarNavItem's control.
<SidebarNavItem icon={<Users />} asChild>
  <Link href="/contacts">Contacts</Link>
</SidebarNavItem>

// Collapsed rail — auto-wraps with Tooltip (placement="right") showing the label
<SidebarNavItem href="/contacts" icon={<Users />} collapsed>
  Contacts
</SidebarNavItem>
```

**Props:**

```typescript
interface SidebarNavItemProps {
  href?: string                        // Renders <a> when provided (non-asChild)
  asChild?: boolean                    // Slot the child as the label element
  icon?: React.ReactNode               // Leading icon (lucide-react or DS Icon)
  active?: boolean                     // Active/current state; adds aria-current
  badge?: React.ReactNode              // Trailing chip — hidden in collapsed mode
  children: React.ReactNode            // Label text (used as Tooltip in collapsed)
  collapsed?: boolean                  // Collapsed-rail mode; hides label+badge
  onClick?: React.MouseEventHandler    // Click handler
  className?: string
}
```

**Accessibility:**

- `aria-current="page"` is set automatically when `active` is true.
- In collapsed mode the Tooltip carries the accessible label for sighted users;
  icon-only items should still have an accessible name on the icon itself if the
  item is used outside of a Tooltip context.
- Focus ring uses `--focus-ring-color` / `--focus-ring-width` / `--focus-ring-offset`
  tokens (Sprint 8 #38 consolidation).

---

### BottomNav

Mobile-only fixed-bottom tab bar (Sprint 17 #82). Hidden on viewports
`>= 768px` (`--breakpoint-md`); use `Sidebar` for desktop. Replaces
hand-rolled mobile-nav patterns where each consumer was reproducing
`position: fixed; bottom: 0` with safe-area padding.

**Key features:**

- `position: fixed; bottom: 0; left: 0; right: 0`
- `padding-bottom: env(safe-area-inset-bottom)` — respects iOS home indicator
- z-index: `var(--z-bottomnav, 900)` (Banner sits above at 950, Modal at 1000)
- Mobile-only via `@media (min-width: 768px) { display: none }`
- 60px height (configurable via `--bottomnav-height` CSS var)
- 44px min touch target per item — WCAG 2.5.8
- `aria-current="page"` on active tab
- Badge slot for unread counts (auto-skips `null` / `undefined` / `0`)
- `asChild` for routing-library integration (`next/link`, `react-router`)

**Consumer responsibility:** the bar is `position: fixed`, so the underlying
page can scroll behind it. Add bottom padding to the main content area
(e.g. `padding-bottom: 60px` on mobile) so content isn't covered.

**Usage:**

```tsx
import { BottomNav, BottomNavItem } from '@lando-labs/lando-ds'
import { Compass, Leaf, Coffee, User } from 'lucide-react'

<BottomNav>
  <BottomNavItem
    href="/discover"
    icon={<Compass />}
    label="Discover"
    active={pathname.startsWith('/discover')}
  />
  <BottomNavItem
    href="/library"
    icon={<Leaf />}
    label="Library"
    badge={unreadCount}
  />
  <BottomNavItem href="/serve"   icon={<Coffee />} label="Serve" />
  <BottomNavItem href="/account" icon={<User />}   label="Account" />
</BottomNav>

// next/link integration via asChild — Link receives className, ref,
// onClick, and aria-current. Icon and label remain in BottomNavItem's
// control so the visual structure stays consistent.
<BottomNavItem icon={<Compass />} label="Discover" asChild>
  <Link href="/discover" />
</BottomNavItem>
```

**Props (`BottomNav`):**

```typescript
interface BottomNavProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
  ariaLabel?: string                   // landmark label, defaults to "Primary"
  className?: string
}
```

**Props (`BottomNavItem`):**

```typescript
interface BottomNavItemProps {
  href?: string                        // renders <a> when set (non-asChild)
  asChild?: boolean                    // slot the child as the tab root
  icon: React.ReactNode                // required leading icon
  label: React.ReactNode               // small label below the icon (~11px)
  badge?: React.ReactNode | number | null  // upper-right indicator
  active?: boolean                     // adds aria-current="page"
  onClick?: React.MouseEventHandler<HTMLElement>
  className?: string
  ariaLabel?: string                   // override accessible name if needed
  children?: React.ReactNode           // slotted child when asChild=true
}
```

**Badge rules:**

- `null`, `undefined`, `0` → no badge rendered
- `number > 0` → rendered as text inside the badge pill
- any other ReactNode → rendered as-is

---

### AppShell

A composable application shell. Drops `Header`, `Sidebar`, `main`, and
`Footer` into a stable CSS grid with keyboard shortcuts and responsive
behavior built in.

> **See [integrating-with-nextjs.md](./integrating-with-nextjs.md)** for the
> App Router `AppShell` recipe (the `app/layout.tsx` setup).

**Layout contract:**

- CSS grid: `auto / 1fr / auto` rows (header / body / footer)
- Header is `position: sticky` inside the grid
- Body is a flex row (sidebar column | main column)
- Main has its own scroll context (`overflow-x: hidden`, min-width/height: 0)
- Footer pinned to the shell bottom
- Mobile (<768px): body collapses to single column; sidebar upgrades to drawer

**Usage:**

```tsx
import { AppShell, Header, Sidebar, Footer } from '@lando-labs/lando-ds'

<AppShell
  header={<Header logo={<Logo />} sticky />}
  sidebar={<Sidebar><NavList /></Sidebar>}
  footer={<Footer copyright="© 2026 Lando Labs" variant="simple" />}
  sidebarPersistKey="my-app-sidebar"
>
  <h1>Dashboard</h1>
  <p>Main content goes here…</p>
</AppShell>
```

**Keyboard shortcut:**

- `Cmd/Ctrl + B` toggles sidebar collapse by default
- Configurable via `sidebarShortcut` (e.g. `"ctrl+shift+s"`)
- Pass `sidebarShortcut={false}` to disable
- Automatically ignored when focus is inside an `<input>`, `<textarea>`,
  `<select>`, or `contentEditable` element

**Props:**

```typescript
interface AppShellProps {
  header?: React.ReactNode
  sidebar?: React.ReactNode            // <Sidebar> element or arbitrary content
  footer?: React.ReactNode
  children: React.ReactNode            // main content

  // Sidebar state management (forwarded to Sidebar)
  sidebarCollapsed?: boolean
  onSidebarCollapsedChange?: (collapsed: boolean) => void
  defaultSidebarCollapsed?: boolean
  sidebarPersistKey?: string

  // Keyboard shortcut
  sidebarShortcut?: string | false     // Default: 'meta+b'

  // Mobile drawer
  mobileSidebarOpen?: boolean
  onMobileSidebarOpenChange?: (open: boolean) => void

  // Main content layout (v0.7.0, issue #60)
  contentPadding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  contentMaxWidth?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string

  className?: string
  mainAriaLabel?: string               // Default: 'Main content'
  mainProps?: React.HTMLAttributes<HTMLElement>
}
```

**Main content layout (v0.7.0, issue #60):**

AppShell now has opinions about the `<main>` content area so consumers
don't have to re-declare `padding` and `max-width` on their own. Both
props map to CSS variables on the outer shell element, so you can reach
for the prop API or override the CSS var directly — whichever is cleaner.

| Prop              | Tokens / Values                                                                 | Default CSS                  |
|-------------------|---------------------------------------------------------------------------------|------------------------------|
| `contentPadding`  | `'none'` or semantic token (`xs` → `--spacing-xs`, `md` → `--spacing-md`, etc.) | `var(--spacing-md)`          |
| `contentMaxWidth` | `'none'` \| `'sm'` (640) \| `'md'` (768) \| `'lg'` (1024) \| `'xl'` (1280) \| `'2xl'` (1440) \| any CSS length | `none` |

When `contentMaxWidth` is anything other than `'none'`, the main
content centers horizontally inside the body row via `margin-inline: auto`
— sidebar columns still reflow correctly because the centering lives on
the `.main` flex item.

```tsx
// Reading-width article shell
<AppShell contentMaxWidth="md" contentPadding="xl" header={<Header />}>
  <article>…</article>
</AppShell>

// Full-width dashboard with tighter padding
<AppShell contentPadding="lg" sidebar={<Nav />}>
  <Dashboard />
</AppShell>

// Custom CSS length (any string that's not a semantic token is used as-is)
<AppShell contentMaxWidth="75ch">
  <Prose />
</AppShell>
```

**CSS variable overrides** (on the outer shell):

| Variable                           | Default                     |
|------------------------------------|-----------------------------|
| `--app-shell-header-height`        | `auto`                      |
| `--app-shell-footer-height`        | `auto`                      |
| `--app-shell-max-width`            | `100%`                      |
| `--app-shell-gap`                  | `0`                         |
| `--app-shell-body-bg`              | `var(--color-background)`   |
| `--app-shell-content-padding`      | `var(--spacing-md)`         |
| `--app-shell-content-max-width`    | `none`                      |

**Landmarks:**

- `header` slot wraps in `<div role="banner">`
- `sidebar` gets `role="navigation"` (via Sidebar itself)
- `children` render inside `<main aria-label="…">`
- `footer` slot wraps in `<div role="contentinfo">`

---

### Divider

A visual separator for horizontal or vertical orientation, with an
optional labeled "section break" variant.

**Orientations**: `horizontal` (default), `vertical`
**Variants**: `solid` (default), `dashed`, `dotted`
**Spacing**: `sm`, `md` (default), `lg`

**Features:**

- Horizontal plain form renders a semantic `<hr>` with
  `role="separator"`.
- Labeled form renders the classic "line — label — line" pattern
  (`<div role="separator">` hosting two `aria-hidden` line spans + a
  label). Useful for page-level section breaks.
- Vertical form ignores `label` (out of scope).
- Label typography matches the DS caption style (secondary text
  color, snug line-height, `--font-size-sm`), with a medium font
  weight so the label reads as an inline section break.
- `labelPosition` accepts logical values (`start` / `end`) and
  directional aliases (`left` / `right`) for backward compatibility.

**Usage:**

```tsx
import { Divider } from '@lando-labs/lando-ds'

// Plain horizontal separator
<Divider />

// Section break with a centered label
<Divider label="Or Continue With" />

// Section break with a start-aligned label
<Divider label="Agents" labelPosition="start" spacing="lg" />

// Vertical separator (label ignored)
<Divider orientation="vertical" />

// Dashed variant
<Divider variant="dashed" spacing="lg" />
```

**Props:**

```typescript
type DividerLabelPosition =
  | 'start'
  | 'center'
  | 'end'
  | 'left'    // alias for 'start'
  | 'right'   // alias for 'end'

interface DividerProps {
  orientation?: 'horizontal' | 'vertical'     // Default: 'horizontal'
  variant?: 'solid' | 'dashed' | 'dotted'     // Default: 'solid'
  spacing?: 'sm' | 'md' | 'lg'                // Default: 'md'
  /** Horizontal only. When orientation='vertical', label is ignored. */
  label?: string | React.ReactNode
  labelPosition?: DividerLabelPosition        // Default: 'center'
  className?: string
}
```

**Accessibility:**

- Plain horizontal divider uses a native `<hr>` with explicit
  `role="separator"` and `aria-orientation="horizontal"`.
- Labeled divider renders as `<div role="separator">` because `<hr>`
  cannot host descendant content. `aria-orientation` is preserved.
- The two decorative line spans carry `aria-hidden="true"` so screen
  readers hear only the label text.

---

### StatCard

A specialized card for displaying a single statistic — large value,
label, optional icon, optional trend indicator, optional contextual
subtitle, and a gradient accent bar.

**Color variants**: `primary` (default), `success`, `warning`, `error`, `neutral`

**Features:**

- Large value display with semantic `label`
- Optional circular icon slot (top-right)
- Optional trend indicator (`up` / `down` / `neutral` with percentage)
- Trend color decouples from arrow direction via `trend.sentiment` (`positive` / `negative` / `neutral`). Omit it and the color follows the direction's usual meaning (up = positive); set it to express an **inverted metric** (e.g. Refund Rate) — an up-arrow in the error color. The pill also exposes stable `data-direction` / `data-sentiment` hooks.
- Optional `trendLabel` (e.g. "vs last month")
- Optional `subtitle` — a short caption explaining surprising values
  without abusing `trend`/`trendLabel`
- Gradient accent bar at the top, colored by variant
- Loading skeleton preserves row spacing for each present slot

**Usage:**

```tsx
import { StatCard } from '@lando-labs/lando-ds'
import { Users } from 'lucide-react'

// Basic
<StatCard label="Total Users" value="1,234" />

// With icon + trend
<StatCard
  label="Total Users"
  value="1,234"
  icon={<Users size={20} />}
  trend={{ value: 12.5, direction: 'up' }}
  trendLabel="vs last month"
  color="success"
/>

// Inverted metric — up is bad (Refund Rate): up-arrow rendered in the error color
<StatCard
  label="Refund Rate"
  value="4.0%"
  trend={{ value: 0.4, direction: 'up', sentiment: 'negative' }}
  trendLabel="vs last month"
/>

// With subtitle — explain a surprising zero
<StatCard
  label="Active Agents"
  value={0}
  subtitle="all events from Claude Code root"
/>

// Subtitle + trend coexist (stacked)
<StatCard
  label="Revenue"
  value="$12.4k"
  subtitle="excluding refunds"
  trend={{ value: 8.2, direction: 'up' }}
  trendLabel="vs last month"
/>

// Loading
<StatCard label="Users" value="--" loading />
```

**Props:**

```typescript
interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  /**
   * Optional contextual caption rendered beneath the primary value
   * (above any trend line). Typography: DS caption-like — smaller
   * than label, color-text-secondary, not bold.
   *
   * Use for edge-case explanations — e.g. "0 sub-agents (all events
   * from Claude Code root)". Coexists with `trend` and `trendLabel`.
   */
  subtitle?: string | React.ReactNode
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' }
  trendLabel?: string
  icon?: React.ReactNode
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
  loading?: boolean
}
```

**When to use `subtitle` vs `trendLabel`:**

- `trendLabel` — contextualizes a trend value (e.g. "vs last month").
  Should read naturally alongside a percentage.
- `subtitle` — contextualizes the primary value itself, independent of
  any trend. Use when the raw number alone could mislead.

Both can render simultaneously; the subtitle sits between the value
and the trend row.

---

### ApprovalCard

A specialized card for approval workflows — displays a title,
description, status/priority badges, a metadata grid, and one of
two action surfaces:

1. **Binary mode** (default) — side-by-side `Approve` / `Reject`
   buttons.
2. **Workflow mode** (#95) — a single `Take action ▼` dropdown menu
   listing N transitions. Used when the next status depends on the
   current one (e.g. an editorial flow with `draft → editor_review →
   revision → second_review → human_review → approved → published →
   killed`).

The two modes are **mutually exclusive**: when `workflow` is
provided the binary buttons do NOT render, regardless of whether
`onApprove` / `onReject` were also passed. In dev, a `console.warn`
fires if both are passed simultaneously so the consumer can pick one.

**Features:**

- Status badge (`pending` / `approved` / `rejected`) — surfaced via
  `Badge`. The status string still drives this badge in workflow
  mode; only the action surface changes.
- Priority badge (`low` / `medium` / `high`) with dot indicator.
- Metadata grid — auto-fitting `label / value` pairs in a soft
  surface-tinted box.
- **Workflow dropdown** — composes the DS `<Dropdown>` and
  `<DropdownItem>`. Each transition renders with `label` as the
  primary line and an optional muted `description` as the secondary
  line. `variant: 'danger'` items use the same destructive styling
  precedent as `<Button variant="danger">` (red text via
  `--color-error-base`, including the description).
- ARIA: the workflow trigger is labeled
  `"<triggerLabel> on '<title>'"` (e.g. `"Take action on 'The
  morning investigation'"`) so screen-reader users get the context
  of which item the action menu belongs to. Keyboard navigation
  inside the menu (Tab / Shift+Tab to rotate, Escape to close) is
  inherited from `<Dropdown>` — see the [Dropdown](#dropdown)
  section.

**Usage — binary mode:**

```tsx
import { ApprovalCard } from '@lando-labs/lando-ds'

<ApprovalCard
  title="Budget Request #1234"
  description="Q4 marketing campaign budget increase"
  status="pending"
  priority="high"
  metadata={[
    { label: 'Amount', value: '$50,000' },
    { label: 'Submitted', value: '2 days ago' },
  ]}
  onApprove={() => approve(1234)}
  onReject={() => reject(1234)}
/>
```

**Usage — workflow mode:**

```tsx
<ApprovalCard
  title="The morning investigation"
  description="Lead story for tomorrow's edition"
  status="pending"
  metadata={[
    { label: 'Editor', value: 'J. Doe' },
    { label: 'Word count', value: '2,400' },
  ]}
  workflow={{
    transitions: [
      {
        value: 'revision',
        label: 'Send back for revision',
        description: 'Author will revise',
      },
      {
        value: 'second_review',
        label: 'Promote to second review',
        description: 'Senior editor will review',
      },
      {
        value: 'killed',
        label: 'Kill the story',
        description: 'Will not publish',
        variant: 'danger',
      },
    ],
    onTransition: (value) => handleTransition(value),
  }}
/>
```

**Props:**

```typescript
interface ApprovalMetadata {
  label: string
  value: string
  icon?: React.ReactNode
}

interface WorkflowTransition {
  value: string
  label: string
  description?: string
  variant?: 'default' | 'danger'
}

interface WorkflowConfig {
  transitions: WorkflowTransition[]
  onTransition: (value: string) => void
  /** Override the trigger button label. Default `'Take action'`. */
  triggerLabel?: string
}

interface ApprovalCardProps {
  title: string
  description?: string
  status?: 'pending' | 'approved' | 'rejected'
  priority?: 'low' | 'medium' | 'high'
  metadata?: ApprovalMetadata[]
  /** Binary mode — approve callback. Ignored when `workflow` is set. */
  onApprove?: () => void
  /** Binary mode — reject callback. Ignored when `workflow` is set. */
  onReject?: () => void
  approveLabel?: string
  rejectLabel?: string
  disabled?: boolean
  /**
   * Workflow mode — when provided, replaces the binary buttons with a
   * "Take action ▼" dropdown of N transitions. Mutually exclusive with
   * `onApprove` / `onReject` (workflow wins, dev console warns).
   */
  workflow?: WorkflowConfig
  className?: string
}
```

**When to use which mode:**

- **Binary** — the decision is yes/no, the two outcomes are
  symmetrical (approve vs reject), and there's no intermediate
  state.
- **Workflow** — the decision is N-way, transitions depend on the
  current status, or some transitions are destructive in a way that
  warrants per-item visual treatment (e.g. `kill the story`).

---

### Table

A generic data table with sortable columns, checkbox selection,
loading skeleton, empty state, striped rows, and — as of #30 —
first-class clickable rows with full keyboard support.

**Features:**

- Generic over row type `T extends Record<string, any>`
- Sortable columns (optional per column, toggle asc/desc)
- Row selection with indeterminate header checkbox
- Loading skeleton and empty state
- Striped variant
- Clickable rows via `onRowClick` with Enter/Space keyboard support (#30)
- Escape hatch for interactive cell content (Dropdowns, buttons)

**Usage:**

```tsx
import { Table, type Column } from '@lando-labs/lando-ds'

type User = { id: string; name: string; email: string; status: string }

const columns: Column<User>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>{row.status}</Badge>,
  },
]

<Table<User> data={users} columns={columns} sortable selectable />
```

#### Clickable rows (#30)

When `onRowClick` is provided, every row becomes an interactive,
focusable, button-role element. Enter and Space both activate the
handler; clicks on interactive descendants (buttons, links, inputs,
selects, textareas, labels, contentEditable elements, or anything
marked `data-no-row-click`) are swallowed so consumers can drop
action columns or dropdown triggers into cells without double-fire.

```tsx
<Table<User>
  data={users}
  columns={columns}
  onRowClick={(row, index, event) => openDetailDrawer(row)}
  // Optional: meaningful SR announcement instead of reciting every cell.
  getRowAriaLabel={(row) => `Open ${row.name}`}
  // Optional: opt individual rows out of interactivity.
  isRowInteractive={(row) => !row.locked}
/>
```

**Cells with their own interactive element** — the built-in tag
swallowing covers `<button>`, `<a>`, `<input>`, `<select>`,
`<textarea>`, `<label>`, and any element with the `contenteditable`
attribute. For custom interactive cells (e.g. a Dropdown trigger
rendered as a `<div>`), add `data-no-row-click` to opt that element
and its subtree out of the row click:

```tsx
const columns: Column<User>[] = [
  { key: 'name', label: 'Name' },
  {
    key: 'menu',
    label: '',
    render: (row) => (
      <Dropdown trigger={<button data-no-row-click>…</button>}>
        <DropdownItem onClick={() => editRow(row)}>Edit</DropdownItem>
      </Dropdown>
    ),
  },
]
```

**Accessibility pattern — `role="button"` on each `<tr>`:**

Clickable rows behave semantically as buttons (activate → open
drawer / navigate), not as part of a grid-navigation pattern.
`role="button"` + `tabIndex={0}` communicates activation intent to
assistive technology. Enter and Space both trigger the handler;
Space is `preventDefault`'d so the page doesn't scroll when a row
is focused. The `:focus-visible` ring uses `var(--color-focus)` at
2px inset so it reads clearly without overlap with adjacent row
borders.

If you need selectable-row semantics (arrow keys move focus
between rows and rows are part of a grid), pair this with a
roving-tabindex pattern in consumer code — `onRowClick` doesn't
attempt to cover grid-navigation semantics.

**Props:**

```typescript
interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  sortable?: boolean
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  selectable?: boolean
  onSelectionChange?: (selectedRows: T[]) => void
  /**
   * Row click + keyboard activation (#30). When provided, every row
   * becomes role=button + tabIndex=0. Clicks on interactive descendants
   * are swallowed. Enter + Space fire the handler.
   */
  onRowClick?: (row: T, index: number, event: React.SyntheticEvent) => void
  /** Per-row aria-label for better SR announcements. */
  getRowAriaLabel?: (row: T, index: number) => string
  /** Return false to opt a specific row out of click/keyboard. */
  isRowInteractive?: (row: T, index: number) => boolean
  emptyState?: React.ReactNode
  loading?: boolean
  striped?: boolean
  className?: string
}

interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (row: T, index: number) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}
```

**Backward compatibility:**

When `onRowClick` is not provided, rows render exactly as before —
no `tabIndex`, no `role`, no cursor change, no handlers, no extra
classes. Existing consumers are completely unaffected by #30.

---

### Timeline

A vertical event timeline supporting **two complementary usage
modes** that share the same connector rail:

1. **Distributed-tracing / log mode** — string timestamps, `status`,
   `expandable`, nested `<Timeline.Group>` for span hierarchies.
   Ported from a consumer app's session-trace pattern
   ([#2](https://github.com/lando-labs/lando-ds/issues/2)).
2. **Activity-feed mode** ([#92](https://github.com/lando-labs/lando-ds/issues/92), v0.9.0)
   — `icon` in the dot bezel, bold `title`, muted `actor` byline,
   smart-formatted `Date` timestamps via `Intl.RelativeTimeFormat`.

Both modes can be mixed within a single Timeline.

**Features:**

- Ordered-list semantics (`<ol>` + `<li>`) — chronological events
  are inherently ordered
- Compound API: `<Timeline.Item>` / `<Timeline.Group>` plus equivalent
  named exports (`TimelineItem`, `TimelineGroup`) — both render
  identically
- Status-based dot coloring (`default` / `info` / `success` / `warning`
  / `error`) **or** activity-feed `variant` (`neutral` / `info` /
  `success` / `warning` / `error`) — same color tokens under the hood
- Optional `icon` rendered inside an enlarged 24px dot bezel
  (activity-feed mode)
- `title` (bold lead line) + `actor` ("by …" muted line) slots
- Smart `Date` timestamp formatting: relative (`Intl.RelativeTimeFormat`)
  for the last 7 days, absolute (`Intl.DateTimeFormat`) for older
  events, with a `formatTimestamp` escape hatch
- Connector line hides automatically on the last item
- Nested `<Timeline.Group>` renders thinner second-tier visuals
  (6px dots, 1px lines) via CSS descendant selectors — no JS depth
  detection
- Expandable items with `aria-expanded`, keyboard (Enter / Space),
  and controlled + uncontrolled state
- Leading timestamp slot with `font-variant-numeric: tabular-nums`
- Loading state (3 skeleton rows with `aria-busy="true"`)
- Empty-state slot

**Usage:**

```tsx
import { Timeline } from '@lando-labs/lando-ds'

// Basic chronological list
<Timeline>
  <Timeline.Item timestamp="09:42:01" status="success">
    Request started
  </Timeline.Item>
  <Timeline.Item timestamp="09:42:02" status="info">
    Resolving DNS
  </Timeline.Item>
  <Timeline.Item timestamp="09:42:03" status="error">
    Error: timeout
  </Timeline.Item>
</Timeline>
```

**Nested groups (child spans / sub-events):**

```tsx
<Timeline>
  <Timeline.Item timestamp="09:42:02" status="info">
    Tool call: web_search
    <Timeline.Group>
      <Timeline.Item timestamp="09:42:02.1" status="info">
        Fetched 42 results
      </Timeline.Item>
      <Timeline.Item timestamp="09:42:02.4" status="success">
        Filter complete
      </Timeline.Item>
    </Timeline.Group>
  </Timeline.Item>
</Timeline>
```

**Expandable items:**

```tsx
const [open, setOpen] = useState(false)

<Timeline>
  <Timeline.Item
    timestamp="09:42:02"
    status="info"
    expandable
    expanded={open}
    onExpandedChange={setOpen}
  >
    Tool call: web_search (click to expand)
    <Timeline.Group>
      <Timeline.Item timestamp="09:42:02.1">
        Fetched 42 results
      </Timeline.Item>
    </Timeline.Group>
  </Timeline.Item>
</Timeline>
```

For uncontrolled behavior, drop `expanded` / `onExpandedChange`
and use `defaultExpanded` instead.

**Activity-feed mode (`icon`, `title`, `actor`, `Date` timestamps):**

```tsx
import { Timeline, TimelineItem, Icon } from '@lando-labs/lando-ds'

<Timeline aria-label="Story activity">
  <TimelineItem
    icon={<Icon name="Edit" />}
    timestamp={new Date('2026-04-25T14:30:00')}
    title="Story moved to Editor Review"
    actor="claude-opus-4-7"
  >
    The investigator agent completed the draft. Word count: 1,247.
  </TimelineItem>
  <TimelineItem
    icon={<Icon name="Check" />}
    timestamp={new Date('2026-04-25T14:32:00')}
    title="Approved by editor"
    actor="user@example.com"
    variant="success"
  />
  <TimelineItem
    icon={<Icon name="AlertTriangle" />}
    timestamp={new Date('2026-04-20T09:00:00')}
    title="Reverted earlier edit"
    actor="ops-bot"
    variant="warning"
    formatTimestamp={(d) =>
      d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    }
  />
</Timeline>
```

In activity-feed mode:

- `icon` is rendered inside an enlarged 24px dot bezel.
- `title` is a bold lead line above the body; `actor` renders as
  `by {actor}` in the muted tertiary text style.
- `timestamp` accepts a `Date` and formats it as relative time for
  the last week (`"5 minutes ago"`, `"yesterday"`) and absolute date
  for older events (`"Apr 20, 2026, 9:00 AM"`).
- Pass `formatTimestamp` to override the default formatting (only
  invoked when `timestamp` is a `Date`).
- `variant` is the activity-feed flavor of `status` — `variant="success"`
  and `status="success"` produce the same color. Use `variant` for
  feed semantics; use `status` for tracing semantics.

Tracing-mode and activity-feed items can be mixed inside the same
`<Timeline>`:

```tsx
<Timeline>
  <TimelineItem timestamp="09:42:01" status="success">
    Request completed
  </TimelineItem>
  <TimelineItem
    icon={<Icon name="UserPlus" />}
    timestamp={new Date()}
    title="New user joined"
    actor="auth-service"
    variant="info"
  />
</Timeline>
```

**Loading + empty states:**

```tsx
// Loading shimmer
<Timeline loading />

// Empty slot
<Timeline emptyState="No events yet" />
```

**Props — `<Timeline>`:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `loading` | `boolean` | `false` | Render 3 skeleton rows with `aria-busy="true"` |
| `emptyState` | `React.ReactNode` | — | Rendered when no children are provided |
| `children` | `React.ReactNode` | — | `<Timeline.Item>` elements |

Inherits `React.HTMLAttributes<HTMLOListElement>` (e.g. `aria-label`,
`className`).

**Props — `<Timeline.Item>` / `<TimelineItem>`:**

Both names render identically (`Timeline.Item === TimelineItem`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `timestamp` | `React.ReactNode \| Date` | — | Leading timestamp. Strings/ReactNode rendered as-is (tracing). `Date` is smart-formatted via `formatTimestamp` (or the default relative/absolute formatter). |
| `formatTimestamp` | `(date: Date) => string` | — | Override the default `Date` formatter. Ignored when `timestamp` is not a `Date`. |
| `status` | `'default' \| 'info' \| 'success' \| 'warning' \| 'error'` | `'default'` | Dot color (tracing flavor). |
| `variant` | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'error'` | — | Dot color (activity-feed flavor). Same color tokens as `status`. Wins over `status` when both are set. `neutral` maps to `default`. |
| `icon` | `React.ReactNode` | — | Icon rendered inside the dot bezel (activity-feed mode). Bezel grows to 24px when set. |
| `title` | `React.ReactNode` | — | Bold lead line above `children` body. |
| `actor` | `string` | — | Muted "by {actor}" line below `title`. |
| `expandable` | `boolean` | `false` | Wrap the header in a toggle button with chevron + `aria-expanded`. |
| `expanded` | `boolean` | — | Controlled expanded state. |
| `defaultExpanded` | `boolean` | `false` | Uncontrolled initial expanded state. |
| `onExpandedChange` | `(expanded: boolean) => void` | — | Fires on expand/collapse. |
| `children` | `React.ReactNode` | — | Body content; a nested `<Timeline.Group>` becomes the collapsible payload when `expandable` is true. |

Inherits `React.HTMLAttributes<HTMLLIElement>` (the native HTML
`title` attribute is replaced by the visual title slot).

**Props — `<Timeline.Group>`:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | — | Nested `<Timeline.Item>` elements; rendered with smaller second-tier dots + lines |

Inherits `React.HTMLAttributes<HTMLOListElement>`.

**Accessibility notes:**

- Top-level and nested lists are semantic `<ol>` elements — assistive
  technology announces item counts automatically.
- Expandable items wrap their header in a `<button>` with
  `aria-expanded`; the nested `<Timeline.Group>` is rendered as a
  sibling of the button so interactive descendants are not nested
  inside the clickable region.
- Pass `aria-label` on the `<Timeline>` root when the surrounding
  page context doesn't already label the list (e.g. "Session trace").

---

### StickyBar

A primitive for horizontal strips that pin to the top or bottom of
their nearest scroll container. Consumers were hand-rolling
`position: sticky` + z-index + backdrop-filter for filter bars,
toolbars, and form action rails — StickyBar formalizes the pattern
and centralizes the scroll-shadow quirk. ([#23](https://github.com/lando-labs/lando-ds/issues/23))

#### Why `position: sticky` (not `fixed`)

StickyBar uses CSS sticky positioning so it respects the scroll context
it lives in. Drop it inside AppShell's `<main>` region and it will pin
relative to that scroll area — not the viewport. This is the behavior
consumers actually want for filter bars and form footers.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'top' \| 'bottom'` | `'top'` | Which edge the bar pins to |
| `offset` | `number \| string` | `0` | Distance from the pinned edge. Numbers are px; strings pass through (supports `calc()`) |
| `variant` | `'surface' \| 'blur' \| 'transparent'` | `'surface'` | Background treatment |
| `elevation` | `'none' \| 'shadow' \| 'shadow-on-scroll'` | `'none'` | Shadow treatment. `shadow-on-scroll` appears only once pinned |
| `zIndex` | `number` | — | Override default z-index (falls back to `--z-index-sticky: 100`) |
| `role` | `string` | `'region'` | ARIA role — use `'toolbar'` if bar holds only controls |
| `aria-label` | `string` | — | Accessible label for the region landmark |
| `className` | `string` | — | Additional CSS class |
| `style` | `CSSProperties` | — | Inline styles (merged after position/zIndex props) |

#### Usage

**Top-pinned filter toolbar with blur + shadow-on-scroll**

The Activity-page pattern — a translucent strip that gets a
shadow once it's pinned past its original position:

```tsx
<StickyBar
  variant="blur"
  elevation="shadow-on-scroll"
  aria-label="Filter toolbar"
>
  <Inline gap="sm" padding="md">
    <Badge>All</Badge>
    <Badge>Active</Badge>
    <Badge>Archived</Badge>
  </Inline>
</StickyBar>
```

**Bottom-pinned form action bar**

The pattern for "save / cancel" rails at the bottom of a form or
detail page:

```tsx
<StickyBar
  position="bottom"
  elevation="shadow"
  aria-label="Form actions"
>
  <Inline gap="sm" justify="end" padding="md">
    <Button variant="ghost">Cancel</Button>
    <Button variant="primary">Save Changes</Button>
  </Inline>
</StickyBar>
```

**Offset under an AppShell header**

When your scroll container already has sticky chrome above the bar
(e.g. a 64px AppShell header), use `offset` to push StickyBar below it:

```tsx
// Numeric offset — pixels
<StickyBar offset={64}>
  <Toolbar />
</StickyBar>

// String offset — supports calc() and design tokens
<StickyBar offset="calc(var(--header-height) + var(--spacing-8))">
  <Toolbar />
</StickyBar>
```

**Inside AppShell's main content**

StickyBar pins to the scrollable region, not the viewport — so it
composes cleanly with AppShell:

```tsx
<AppShell header={<Header />} sidebar={<Sidebar />}>
  <StickyBar variant="blur" elevation="shadow-on-scroll" aria-label="Tasks filters">
    <FilterChips />
  </StickyBar>
  <TaskList />
</AppShell>
```

#### Variants at a glance

- **`surface`** — opaque, uses `--color-surface`. Safest default; works
  against any scroll content.
- **`blur`** — translucent `--color-surface` at ~80% with a `backdrop-filter: blur(8px)`.
  Lets content show through while remaining legible. Matches the
  pattern a consumer app uses for filter bars.
- **`transparent`** — no background. For bars that overlay other chrome
  (e.g. a translucent toolbar on a hero section).

#### Elevation modes

- **`none`** — no shadow, no pin detection, no JS.
- **`shadow`** — always-on shadow. Static visual lift regardless of
  scroll state. Good for form action bars where the bar is always
  visually separated from content.
- **`shadow-on-scroll`** — shadow appears only when the bar becomes
  pinned. StickyBar mounts a zero-height sentinel element at the
  bar's natural (unpinned) position and uses `IntersectionObserver`
  to flip a `data-pinned` attribute on the bar. The CSS applies the
  shadow only when `data-pinned="true"`. Cheaper than a scroll
  listener and avoids the classic "which scroll container do I
  subscribe to?" problem.

#### Accessibility

- Default role is `region` — screen readers expose it as a landmark.
- Provide `aria-label` whenever the bar has semantic meaning (filters,
  form actions, toolbar). Unlabeled regions are pruned from most
  screen readers' landmark lists.
- For bars that hold only controls (bold/italic, filter chips), set
  `role="toolbar"` — screen readers announce it distinctly and enable
  arrow-key navigation conventions.

#### Z-index contract

StickyBar sits at `--z-index-sticky` (100) by default — above body
content but below overlays:

```
body content (0) < StickyBar (100) < Modal (1000) < Dropdown (1100) < Tooltip (1300)
```

Override with `zIndex` only when you have a specific stacking need.
See the [Z-index Layering Contract](#z-index-layering-contract)
section below for the full stacking order.

---

### Callout

A left-border accent block with optional uppercase label and optional
leading icon. Sits between `Divider` (orientation only) and `Alert`
(transient + dismiss baggage) — purely a static container primitive
for annotations, callouts, and pull-quotes.

**Accents**: `primary` (default), `success`, `warning`, `danger`,
`info`, `neutral`

**Polymorphic**: renders as `<div>` by default. Common alternatives are
`as="blockquote"` for editorial pull-quotes and `as="aside"` for
sidebar-style annotations.

**Features:**

- Token-only — no hardcoded colors. Each accent maps to a left-border
  color, a low-saturation background tint, and a label/icon ink color.
  Consumer theme overrides (e.g. a tea palette) propagate
  automatically.
- Optional `label` slot rendered above the body in uppercase
  micro-type (`letter-spacing: 0.05em`, `font-weight: 600`,
  `font-size: 0.6875rem`/11px).
- Optional `icon` slot at the start of the callout, vertically aligned
  with the first line of content. Marked `aria-hidden="true"` because
  it's decorative — the surrounding text carries the meaning.
- `forwardRef` support — the ref points to the rendered element
  (e.g. an `HTMLQuoteElement` when `as="blockquote"`).

**Token mapping note:** the canonical scale in `tokens.css` is
`lightest | light | base | dark | darkest` for semantic palettes
(`success`, `warning`, `info`, `error`) and the longer
`lightest | lighter | light | base | medium | dark | darker | darkest`
for ocean/teal. The component picks the closest available step per
accent rather than relying on a uniform `-medium`/`-lightest` shape:

| `accent`  | border-left          | background             | label / icon ink         |
| --------- | -------------------- | ---------------------- | ------------------------ |
| `primary` | `--color-ocean-medium`   | `--color-ocean-lightest`   | `--color-ocean-darker`     |
| `success` | `--color-success-base`   | `--color-success-lightest` | `--color-success-darkest`  |
| `warning` | `--color-warning-base`   | `--color-warning-lightest` | `--color-warning-darkest`  |
| `danger`  | `--color-error-base`     | `--color-error-lightest`   | `--color-error-darkest`    |
| `info`    | `--color-info-base`      | `--color-info-lightest`    | `--color-info-darkest`     |
| `neutral` | `--color-neutral-400`    | `--color-neutral-100`      | `--color-neutral-700`      |

In dark mode the background falls to an ~8% alpha tint of the accent
hue and the label/icon ink lifts to the `light` step of each scale to
hold AA contrast on the elevated surface.

**Usage:**

```tsx
import { Callout } from '@lando-labs/lando-ds'

// Annotation block (editorial `MY TAKE` pattern)
<Callout accent="primary" label="MY TAKE">
  This pattern deserves wider adoption than it gets.
</Callout>

// Editorial pull-quote
<Callout as="blockquote" accent="neutral">
  "The ocean is enough for me."
</Callout>

// With a leading icon
<Callout accent="info" label="HEADS UP" icon={<Icon name="Info" />}>
  This setting affects every workspace member.
</Callout>

// Inline annotation, no label
<Callout accent="warning">
  Saving will overwrite the existing draft.
</Callout>
```

**Props:**

```typescript
type CalloutAccent =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

interface CalloutProps {
  /** HTML element to render as. Default: 'div'. */
  as?: 'div' | 'aside' | 'blockquote' | 'section' | 'figure' | 'p'
  /** Accent color. Default: 'primary'. */
  accent?: CalloutAccent
  /** Optional uppercase label rendered above the body. */
  label?: React.ReactNode
  /** Optional leading icon (rendered aria-hidden). */
  icon?: React.ReactNode
  /** Callout body content. */
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}
```

**Accessibility:**

- The icon slot is wrapped in a span with `aria-hidden="true"`
  (decorative — meaning lives in the surrounding text). Pass an
  accessible label via the surrounding context if the icon
  communicates required state.
- `<Callout as="blockquote">` produces a semantic `<blockquote>`
  element — preferred for editorial pull-quotes over a styled `<div>`.
- All six accent variants pass `jest-axe` smoke checks.

---

### StepProgress

A discrete, stepped progress tracker. Where `<Progress>` shows
indeterminate or percent-based loading, `<StepProgress>` tracks named
steps through a wizard, an AI generation pipeline, or an editorial
workflow. ([#89](https://github.com/lando-labs/lando-ds/issues/89))

It replaces the hand-rolled `position: relative; height: 2px;` line +
`border-radius: 50%` dot pattern that ships in OnboardingFlow,
DistillPanel, and the Newsroom 8-status flow.

#### API — two overloads (discriminated union)

The component accepts **either** explicit per-step status objects **or**
plain string labels with a `currentStep` index — never both. Mixing
them is a TypeScript compile error.

```tsx
// Overload 1 — fully controlled per-step status
<StepProgress
  steps={[
    { label: 'Analyzing items',     status: 'completed' },
    { label: 'Finding patterns',    status: 'completed' },
    { label: 'Generating insights', status: 'active' },
    { label: 'Synthesizing',        status: 'upcoming' },
  ]}
  variant="labeled"
/>

// Overload 2 — string labels + 0-based currentStep index
<StepProgress
  steps={['Sign up', 'Add interests', 'Choose blends', 'Done']}
  currentStep={2}
/>
// Indices < currentStep → 'completed'
// Index === currentStep → 'active'
// Indices > currentStep → 'upcoming'
```

Use overload 2 for linear wizards. Use overload 1 anywhere a step can
be in `'error'` or where the flow isn't strictly linear (parallel
pipelines, retries).

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `steps` | `StepProgressStep[] \| string[]` | — | Required. Either rich step objects or plain strings (with `currentStep`) |
| `currentStep` | `number` | — | Required when `steps: string[]`. 0-based active index. Forbidden when `steps` are objects |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction |
| `variant` | `'dots' \| 'labeled' \| 'numbered'` | `'dots'` | Visual style — see below |
| `aria-label` | `string` | `'Progress'` | Accessible label for the underlying `role="list"` |
| `className` | `string` | — | Additional class on the root |

#### Step status

`StepStatus = 'completed' | 'active' | 'upcoming' | 'error'`

- **completed** — filled accent dot/circle; connector line filled
- **active** — filled dot with animated ring (`prefers-reduced-motion` respected); label bold
- **upcoming** — muted neutral dot; connector dashed/muted
- **error** — error-tinted ring + light fill; connector solid error

#### Variants

- **`dots`** *(default)* — minimal: just markers and connecting lines.
  Labels are visually hidden but still announced by screen readers.
- **`labeled`** — same markers, with the label rendered under (horizontal)
  or beside (vertical) each dot.
- **`numbered`** — larger circles displaying step numbers (1, 2, 3…).
  Completed steps render a checkmark instead of the digit.

#### Orientation

```tsx
// Horizontal — labels under markers, connectors run left-to-right
<StepProgress steps={[...]} orientation="horizontal" variant="labeled" />

// Vertical — labels beside markers, connectors run top-to-bottom
<StepProgress steps={[...]} orientation="vertical" variant="labeled" />
```

The vertical orientation works well for left-rail timelines and
multi-column status panels.

#### Accessibility

- Root is `<ol role="list" aria-label="Progress">`. Override with
  `aria-label` for context-specific labels (e.g. `'Onboarding progress'`).
- Each step is an `<li>`; the active step carries `aria-current="step"`.
- The pulsing animation on the active marker honors
  `prefers-reduced-motion: reduce`.
- All variants pass `jest-axe` smoke checks (horizontal labeled,
  vertical numbered, error-state).

#### Theming

Every visual is keyed off design tokens, so consumer themes propagate:

- Completed marker + filled connector: `--color-primary`
- Upcoming marker + dashed connector: `--color-neutral-300`
- Error marker: `--color-error-base` + `--color-error-light`
- Active pulse ring: `rgb(var(--color-ocean-medium-rgb) / α)`
- Animation duration/easing: `--duration-normal`, `--easing-ease-out`

Override `--color-primary` at any ancestor (e.g. a tea palette
context) and StepProgress repaints automatically.

#### Examples

**AI pipeline status (DistillPanel)**

```tsx
<StepProgress
  steps={[
    { label: 'Analyzing items',     status: 'completed' },
    { label: 'Finding patterns',    status: 'completed' },
    { label: 'Generating insights', status: 'active' },
    { label: 'Synthesizing',        status: 'upcoming' },
  ]}
  variant="labeled"
  aria-label="Distill pipeline"
/>
```

**Onboarding wizard**

```tsx
<StepProgress
  steps={['Sign up', 'Add interests', 'Choose blends', 'Done']}
  currentStep={currentStepIndex}
  variant="numbered"
  aria-label="Onboarding progress"
/>
```

**Editorial workflow with an error**

```tsx
<StepProgress
  orientation="vertical"
  variant="labeled"
  steps={[
    { label: 'Draft',          status: 'completed' },
    { label: 'Editor review',  status: 'completed' },
    { label: 'Revision',       status: 'error' },
    { label: 'Second review',  status: 'upcoming' },
    { label: 'Approved',       status: 'upcoming' },
  ]}
/>
```

---

### Alert

Inline contextual feedback rendered in the normal document flow. Supports
four semantic variants (`info` / `success` / `warning` / `error`), an
optional title, a default or custom icon, and an optional close button.

Two visual shapes:

- **`block`** (default) — full alert "card" with elevated surface tint,
  `--spacing-16` (1rem) padding, and a slide-in entrance animation. Use
  for prominent inline notices like form-level errors and post-action
  confirmations.
- **`inline`** (`inline` prop, added in v0.13.0) — slim, no-card treatment
  with `--spacing-8`/`--spacing-12` padding and a much subtler tinted
  background. Designed for in-page guidance and teaching banners that
  flow inline with surrounding copy. Surfaced in a design-system
  recomposition audit
  where consumers were hand-rolling `.teachingBanner` / `.inactiveBanner`
  styles with `color-mix()` to approximate this shape. Closes [#109](https://github.com/lando-labs/lando-ds/issues/109).

> **Note: Alert vs Banner.** Despite the overloaded "banner" terminology,
> these are different components and should not be confused:
>
> - **`Alert` (`inline` shape)** — *inline content flow*. Slim teaching /
>   guidance banner that lives in the document, scrolls with the page, and
>   is rendered exactly where you place it.
> - **`Banner`** — *viewport-fixed persistent notice*. Pinned with
>   `position: fixed` to the top or bottom edge of the viewport (GDPR
>   notices, offline state, session expiring). See [Banner](#banner) below.
>
> If the notice should scroll with the page, use `<Alert inline>`. If it
> should stay pinned to the viewport edge, use `<Banner>`.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Semantic color variant |
| `title` | `string` | — | Optional title displayed prominently above the body |
| `closable` | `boolean` | `false` | Render a close (×) button |
| `onClose` | `() => void` | — | Callback fired after the 300ms exit animation completes |
| `icon` | `ReactNode` | variant default | Custom icon. Pass `null` to suppress; omit to use the variant's default |
| `inline` | `boolean` | `false` | Render the slim, no-card shape for in-page guidance / teaching banners |
| `className` | `string` | — | Additional CSS class |
| `children` | `ReactNode` | — | Alert body content |

#### Usage

**Form-level error (block, default)**

```tsx
<Alert variant="error" title="Could not save changes">
  Please fix the highlighted fields and try again.
</Alert>
```

**Success confirmation (block, dismissible)**

```tsx
<Alert variant="success" closable onClose={handleDismiss}>
  Settings saved.
</Alert>
```

**In-page teaching banner (inline)**

```tsx
<Alert variant="info" inline>
  Tip: drag cards between columns to reorder them.
</Alert>
```

**Inactive-project notice (inline, warning)**

```tsx
<Alert variant="warning" inline title="Project archived">
  This project is read-only. Restore it to make changes.
</Alert>
```

**Inline + dismissible**

```tsx
<Alert variant="info" inline closable onClose={dismissTip}>
  New: keyboard shortcuts are now available. Press <kbd>?</kbd> to view.
</Alert>
```

#### Accessibility

- **Role**: `role="alert"` with `aria-live="polite"` so assistive tech
  announces newly-rendered alerts without interrupting the user.
- **Default icons**: marked `aria-hidden="true"` — the icon reinforces the
  semantic variant visually but the variant meaning is conveyed in copy.
- **Close button**: rendered only when `closable` is true. Has an
  accessible name ("Close alert") and visible focus outline.
- **Reduced motion**: the slide-in entrance and slide-out exit animations
  are short (300ms) and applied to opacity + small translate. The `inline`
  shape opts out of the entrance animation entirely so it never fights
  surrounding scroll-linked content.

---

### Banner

A slim viewport-fixed (`position: fixed`) persistent notification bar pinned
to the top or bottom edge of the viewport. Sits between `Toast` (transient,
auto-dismisses), `StickyBar` (sticky inside scroll container, not viewport),
and `Alert` (inline content) — Banner is the "viewport-edge persistent
notice" primitive. ([#84](https://github.com/lando-labs/lando-ds/issues/84))

Primary use cases:

1. **GDPR consent banners** — pinned to viewport bottom, persistent until
   the user accepts or dismisses.
2. **System-level notices** — offline indicator, session expiring, scheduled
   maintenance window.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placement` | `'top' \| 'bottom'` | `'bottom'` | Which edge of the viewport the banner pins to |
| `variant` | `'info' \| 'warning' \| 'success' \| 'error'` | `'info'` | Semantic color variant — aligns with `Alert` |
| `onDismiss` | `() => void` | — | Optional dismiss callback. When provided, a close (×) button renders on the trailing edge |
| `actions` | `React.ReactNode` | — | Optional actions slot (typically `<Button>`) rendered to the right of the message, before the dismiss button |
| `children` | `React.ReactNode` | — | Banner content (the primary message) |
| `className` | `string` | — | Additional CSS class |
| `style` | `CSSProperties` | — | Inline styles |

#### Usage

**GDPR consent banner (bottom, with actions + dismiss)**

```tsx
<Banner
  placement="bottom"
  variant="info"
  onDismiss={handleDecline}
  actions={
    <>
      <Button variant="ghost" size="sm" onClick={handleLearnMore}>Learn more</Button>
      <Button variant="primary" size="sm" onClick={handleAccept}>Accept</Button>
    </>
  }
>
  We use cookies to improve your experience. <a href="/privacy">Privacy policy</a>
</Banner>
```

**Offline notice (top, non-dismissible)**

```tsx
<Banner placement="top" variant="warning">
  You are offline. Changes will sync when reconnected.
</Banner>
```

**Session expiring (top, with action)**

```tsx
<Banner
  placement="top"
  variant="warning"
  actions={<Button size="sm" onClick={handleExtend}>Stay signed in</Button>}
>
  Your session will expire in 2 minutes.
</Banner>
```

**Critical error (top, error variant)**

```tsx
<Banner placement="top" variant="error">
  Connection lost. Some features may be unavailable.
</Banner>
```

#### Accessibility

- **Role**: error variant uses `role="alert"` (assertive announcement);
  non-error variants (`info`/`warning`/`success`) use `role="status"`
  (polite, non-interrupting).
- **Dismiss button**: rendered only when `onDismiss` is provided. Has an
  accessible name ("Dismiss banner") and visible focus outline.
- **Safe-area insets**: applies `env(safe-area-inset-top)` /
  `env(safe-area-inset-bottom)` so the banner doesn't sit underneath iOS
  notches or the home-indicator gesture area.
- **Reduced motion**: slide-in animations downgrade to a fade when
  `prefers-reduced-motion: reduce` is set.

#### Z-index contract

Banner sits at `--z-banner: 950` — above `BottomNav` (`--z-bottomnav: 900`)
and below `Modal` / `Drawer` (`--z-modal: 1000`):

```
body content (0) < BottomNav (900) < Banner (950) < Modal/Drawer (1000) < Toast (1400)
```

This ordering means a "session expiring" banner stays visible above a
mobile tab bar but never obscures a focused dialog.

#### Banner vs Toast vs StickyBar vs Alert

| Component | Position | Lifetime | Use for |
|-----------|----------|----------|---------|
| `Banner` | `fixed` to viewport edge | Persistent until dismissed | GDPR notices, offline state, session expiring |
| `Toast` | `fixed` corner stack | Auto-dismisses (3–5s) | Transient confirmations ("Saved!") |
| `StickyBar` | `sticky` inside scroll container | Lifetime of the page | Filter toolbars, form action rails |
| `Alert` | inline (normal flow) | As long as the message is relevant | Form-level errors, inline contextual notices |

---

## Component Composition Patterns

### User Profile Card
```tsx
<Card variant="elevated">
  <CardHeader actions={<Button size="sm" variant="ghost">Edit</Button>}>
    <h4>User Profile</h4>
  </CardHeader>
  <CardBody>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <Avatar initials="JD" size="lg" status="online" gradient />
      <div>
        <h5>John Doe</h5>
        <p>john.doe@example.com</p>
        <Badge variant="success" size="sm">Active</Badge>
      </div>
    </div>
  </CardBody>
  <CardFooter>
    <Button variant="primary" size="sm">View Profile</Button>
    <Button variant="ghost" size="sm">Settings</Button>
  </CardFooter>
</Card>
```

### Form with Validation
```tsx
<Card variant="outlined" padding="lg">
  <CardBody>
    <Input
      label="Email"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      error={emailError}
      required
    />
    <Input
      label="Password"
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      helperText="Minimum 8 characters"
      showCharCount
      maxLength={100}
    />
    <Button variant="primary" fullWidth loading={isLoading}>
      Sign In
    </Button>
  </CardBody>
</Card>
```

---

## Styling Guidelines

### Using Design Tokens

All components use CSS variables from the token system:

```css
.myComponent {
  /* Colors */
  color: var(--color-text-primary);
  background-color: var(--color-surface);
  border-color: var(--color-border-default);

  /* Spacing */
  padding: var(--spacing-md);
  gap: var(--spacing-sm);

  /* Typography */
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);

  /* Borders */
  border-radius: var(--radius-lg);

  /* Shadows */
  box-shadow: var(--shadow-md);

  /* Animations */
  transition: var(--transition-default);
}
```

### Responsive Design

Components are mobile-first and responsive:

```css
/* Mobile first */
.component {
  padding: var(--spacing-md);
}

/* Tablet and up */
@media (min-width: 768px) {
  .component {
    padding: var(--spacing-lg);
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .component {
    padding: var(--spacing-xl);
  }
}
```

### Dark Mode Support

All components automatically support dark mode:

```css
/* Light mode (default) */
.button {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

/* Dark mode specific overrides */
[data-theme='dark'] .button {
  box-shadow: var(--shadow-lg);
}
```

### Z-index Layering Contract

The design system ships a unified, predictable z-index scale so every overlay,
popover, and floating surface stacks in the order users expect. Component
stylesheets MUST reference these tokens directly — hardcoded `z-index` numerals
are a smell and will be flagged in review.

Values are spaced so consumers can insert custom layers between tiers without
renumbering the scale.

| Token                   | Value  | Tier     | Intended Use                                           |
| ----------------------- | ------ | -------- | ------------------------------------------------------ |
| `--z-index-below`       | `-1`   | below    | Behind-the-layer decorations (backgrounds, blobs)      |
| `--z-index-base`        | `0`    | base     | Default document flow                                  |
| `--z-index-content`     | `1`    | content  | Above flow but below chrome                            |
| `--z-index-sticky`      | `100`  | sticky   | Sticky headers, pinned navigation, Sidebar             |
| `--z-index-fixed`       | `200`  | fixed    | Fixed chrome (app bars, persistent toolbars)           |
| `--z-index-overlay`     | `900`  | overlay  | Scrim / backdrop (below dialogs)                       |
| `--z-index-modal`       | `1000` | modal    | `Modal` dialogs                                        |
| `--z-index-drawer`      | `1000` | drawer   | Slide-out drawers (peer of modal)                      |
| `--z-index-dropdown`    | `1100` | dropdown | Menus, comboboxes (`Dropdown`, `Select`)               |
| `--z-index-popover`     | `1200` | popover  | `Popover`, non-transient floating content              |
| `--z-index-tooltip`     | `1300` | tooltip  | `Tooltip` (above popover, brief and transient)         |
| `--z-index-toast`       | `1400` | toast    | `Toast`, `Notification` (top of the world)             |

**Contract guarantees:**

1. **Dropdowns open above sticky headers.** `--z-index-dropdown` (1100) beats
   `--z-index-sticky` (100).
2. **Overlays opened inside Modal render above the backdrop.** Dropdown, Select,
   Popover, and Tooltip all sit ABOVE `--z-index-modal` (1000). This is the
   inverted contract from v0.4.0 and earlier — see
   [Nested Overlay Contract](#nested-overlay-contract) below for the rationale.
3. **Popovers / Tooltips above Dropdowns.** `--z-index-popover` (1200) and
   `--z-index-tooltip` (1300) sit above `--z-index-dropdown` (1100), so a
   tooltip on a menu item appears above the menu.
4. **Toasts are always visible.** `--z-index-toast` (1400) is the ceiling of
   the normal layering stack; nothing ships above it.

**Overriding tokens:**

Consumers can override any individual token at the root or under a theme
selector without touching the rest of the scale:

```css
:root {
  /* Float custom drawer above modal (e.g., drawer-triggers-modal UX) */
  --z-index-drawer: 1050;
}

[data-product="my-app"] {
  /* Lift toasts above a full-screen takeover */
  --z-index-toast: 2000;
}
```

**Inserting custom layers:**

The 100-unit spacing between neighboring overlay tiers (e.g., dropdown 1100 →
popover 1200) leaves room for product-specific layers. Prefer inserting
between tiers rather than stacking at-or-above an existing tier:

```css
.customBannerAboveStickyHeader {
  /* Between sticky (100) and fixed (200) */
  z-index: 150;
}

.customCoachmarkAboveTooltip {
  /* Between tooltip (1300) and toast (1400) */
  z-index: 1350;
}
```

**Deprecated aliases (v0.1.x):**

The legacy `--z-dropdown`, `--z-header`, and `--z-sidebar` tokens now forward
to the unified scale and are kept for one release. Migrate to the
`--z-index-*` tokens; the aliases will be removed in v0.3.0.

See `src/styles/tokens.css` for the canonical definitions, and
`src/styles/tokens.test.ts` for the enforcement tests that pin the ordering.

---

### Nested Overlay Contract

**The rule:** overlays opened from INSIDE a Modal render ABOVE the Modal
backdrop, not behind it. This covers `Dropdown`, `Select`, `Popover`, and
`Tooltip` children of a `Modal`.

#### Background (why this section exists)

Prior to v0.4.1 the z-index scale placed `--z-index-dropdown` (1000) BELOW
`--z-index-modal` (1100). Standalone this looked sensible: if a loose
Dropdown and a Modal opened at the same time, the Modal would cover the
Dropdown. In practice, though, the common combination is a form Modal that
CONTAINS a `<Select>` or `<Dropdown>` — and there, the Modal's backdrop
painted above the portaled overlay, hiding it entirely. Users saw the caret
rotate and nothing else. See issues #35, #37, #46 for the three
user-facing symptoms this caused.

#### The fix

As of v0.4.1 the overlay tiers (`dropdown`, `popover`, `tooltip`, `toast`)
all sit ABOVE `modal`. An overlay portalled to `document.body` from inside a
Modal will always paint above the backdrop:

```
  toast        1400
  tooltip      1300
  popover      1200
  dropdown     1100   ← (was 1000, now above modal)
  modal        1000   ← (was 1100)
  drawer       1000
  overlay      900    ← (backdrop / scrim tier)
  fixed        200
  sticky       100
```

This trade-off is deliberate: a loose Dropdown opened alongside a standalone
Modal will now render on top of the Modal, but that combination is rare —
Modals are focus-trapped and own the active interaction surface. The common
case is the nested one, and this contract makes that work.

#### Implementation requirements

If you're authoring a new overlay component, you MUST:

1. **Render via `<Portal>`**, so the overlay appends to `document.body` and
   escapes the Modal's stacking context.
2. **Assign a z-index from the overlay tier** — `dropdown`, `popover`, or
   `tooltip` — NEVER below `--z-index-modal`. Hardcoded numeric values will
   be flagged in review.
3. **Use the shared `usePortalPosition` hook** (or mirror its rAF-retry
   pattern for non-vertical axes) so positioning doesn't race with the
   Portal's own `useEffect` mount. This is specifically the source of
   regression #37 — a bespoke single-rAF implementation can get stuck at
   `isPositioned = false` and leave the overlay at opacity 0 forever.
4. **Set `visibility: hidden` until `isReady`** from the hook. Overlays
   initialize at `(-9999, -9999)` by contract; rendering them at that
   position before the `visibility: hidden` flip causes a flash.

#### Tested scenarios (regression coverage)

The following scenarios are pinned by `src/components/Modal/NestedOverlays.test.tsx`:

- [x] `<Select>` inside `<Modal>` — options render, portal to
      `document.body`, listbox gets `positioned` class, selection fires
      `onChange`. (#46)
- [x] `<Dropdown>` inside `<Modal>` — menu portals to `document.body`,
      menu items are present. (#35)
- [x] `<Popover>` inside `<Modal>` — overlay mounts with `visible` class
      (no `isPositioned` race), portals to `document.body`, is not nested
      inside the dialog. (#35, #37)
- [x] Standalone `Dropdown` / `Select` / `Popover` outside Modal — no
      regressions in the ordinary case.

And by `src/styles/tokens.test.ts`:

- [x] `dropdown > modal`
- [x] `popover > modal`
- [x] `tooltip > modal`
- [x] `toast > tooltip > popover > dropdown` (internal overlay order)

#### Troubleshooting a new overlay-in-Modal bug

If you add a new overlay and it doesn't show up inside a Modal:

1. **Open DevTools and inspect the overlay element.**
   - Is it in the DOM at all? If no → it's a render-level bug, not a
     stacking bug. Verify the trigger is firing and `isOpen` becomes true.
2. **Is it a child of `<body>` or of the Modal's portal?**
   - Must be a child of `<body>`. If it's nested inside the Modal's portal,
     you're not using `<Portal>` or you passed a custom `container`
     inherited from the Modal. Remove the custom container.
3. **Check `getComputedStyle(el).zIndex`.**
   - Must be >= 1100 (the current modal value). If not, your stylesheet is
     pinning a numeric value or referencing a wrong token.
4. **Check the overlay's bounding rect.**
   - If it's `(0, 0, 0, 0)` then `getBoundingClientRect` ran before the
     element mounted — this is the #37 race. Use `usePortalPosition`.
5. **Check the overlay's `visibility` + `opacity`.**
   - If `visibility: hidden` / `opacity: 0` after several frames, the
     `isPositioned` flag never flipped. Investigate whether `triggerRef`
     and `overlayRef` are both attached.

---

## Accessibility Features

Components are built with accessibility in mind. A systematic WCAG AA audit is
tracked in **#13** — do not assume full AA conformance until that roll-up closes.
Features present today:

- **Semantic HTML**: Proper element usage (`<button>`, `<label>`, etc.)
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus States**: Visible focus indicators
- **Color Contrast**: Token ramps designed toward AA (chrome pairs verified by `src/tokens/chrome-contrast.test.ts`; full per-surface audit is #13)
- **Screen Reader Text**: Where appropriate

### Component-specific a11y behaviors (v0.5.0, #13 / #40 / #43)

| Component  | What changed                                                                                   |
|------------|-----------------------------------------------------------------------------------------------|
| Input      | Password/clear icon buttons are keyboard-focusable; password toggle exposes `aria-pressed`    |
| Modal      | `aria-labelledby` uses `useId()` (unique per dialog); initial focus lands on dialog body, not close X |
| Dropdown   | Cloned trigger gets `aria-haspopup="menu"` + `aria-expanded` by default                       |
| Popover    | Hover popovers also show on focus; Escape always dismisses; content persists while pointer is on it |
| Select     | Options have unique ids; `aria-activedescendant` on combobox + search input; `aria-controls` wiring; shared key handler works from search input; Home/End shortcuts |
| Header     | `skipLinkHref` prop renders a WCAG 2.4.1 "Skip to content" link as first focusable element    |
| Sidebar    | 44px `min-height` on nav items (WCAG 2.5.8); `aria-current="page"` styling; tooltip recipe for collapsed rail |
| Avatar     | Status indicators use distinct **shape** + color (WCAG 1.4.1); `role="img"` + descriptive label |

Example:
```tsx
<Button aria-label="Close dialog" aria-busy={loading}>
  <CloseIcon />
</Button>

<Input
  label="Email"
  aria-invalid={!!error}
  aria-describedby="email-error"
/>

<Header skipLinkHref="#main" logo={<Logo />} sticky />
<main id="main" tabIndex={-1}>…</main>
```

---

## Testing

All components include test files. To run tests:

```bash
npm test              # Run all tests
npm run test:ui       # Open test UI
npm run test:coverage # Generate coverage report
```

Example test:
```typescript
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

it('renders children correctly', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})
```

---

## Bundle Size Optimization

Components are tree-shakeable. Import only what you need:

```tsx
// Good - imports only Button
import { Button } from '@lando-labs/lando-ds'

// Also good - direct import
import { Button } from '@lando-labs/lando-ds/components'

// Avoid - imports everything
import * as DS from '@lando-labs/lando-ds'
```

---

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

---

### Kbd

A platform-aware keyboard-shortcut pill. Renders as a semantic
`<kbd>` element styled with the design system's mono font and a
subtle surface fill.

**Sizes**: `xs`, `sm` (default), `md`

**Two usage modes**:

1. **Raw children** — full control over the display:

```tsx
<Kbd>⌘K</Kbd>
<Kbd size="md">Ctrl+Shift+P</Kbd>
```

2. **Semantic `shortcut` prop** — auto-renders with platform-aware glyphs:

```tsx
<Kbd shortcut="meta+k" />       // macOS: ⌘K       | other: Ctrl+K
<Kbd shortcut="shift+alt+f" />  // macOS: ⇧⌥F      | other: Shift+Alt+F
<Kbd shortcut="enter" />        // macOS: ↵        | other: Enter
```

Recognized modifier keys: `meta` / `cmd` / `command`, `alt` / `option` /
`opt`, `ctrl` / `control`, `shift`. Recognized named keys: `enter` /
`return`, `escape` / `esc`, `tab`, `backspace`, `delete`, arrow keys
(`up` / `down` / `left` / `right`). Unknown keys are rendered
uppercase.

**SSR safety**: On the server (and before React hydration) the
non-Mac variant is rendered, then the component upgrades to the
detected platform after mount. This avoids hydration mismatches.

**Props**:
```typescript
interface KbdProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Raw display content (takes precedence over `shortcut`). */
  children?: React.ReactNode
  /** Semantic shortcut like "meta+k" — auto-rendered with platform-aware glyphs. */
  shortcut?: string
  /** Visual size. Default 'sm'. */
  size?: 'xs' | 'sm' | 'md'
}
```

---

## ToastProvider + useToast (v0.10.0)

Canonical global toast pattern. Wrap your app shell once with
`<ToastProvider>` and call `useToast()` from anywhere inside it.

This replaces the legacy queue-style hook (`{ success, error, warning,
info, dismiss, dismissAll }`) that shipped before v0.10.0. The standalone
`<Toast>` and `<ToastContainer>` components remain available for advanced
manual wiring, but new code should adopt `ToastProvider` + `useToast`.

```tsx
import { ToastProvider, useToast } from '@lando-labs/lando-ds'

function App() {
  return (
    <ToastProvider position="bottom-right" maxToasts={3}>
      <Shell />
    </ToastProvider>
  )
}

function SaveButton() {
  const { showToast, dismissToast } = useToast()

  const handleSave = async () => {
    const id = showToast({
      variant: 'info',
      title: 'Saving...',
      duration: 0, // sticky until we resolve
      dismissable: false,
    })
    try {
      await save()
      dismissToast(id)
      showToast({
        variant: 'success',
        title: 'Item saved',
        description: 'Find it in your saved items.',
        duration: 5000,
        action: { label: 'Undo', onClick: handleUndo },
      })
    } catch (err) {
      dismissToast(id)
      showToast({ variant: 'error', title: 'Save failed' })
    }
  }
}
```

**Behavior**:
- Single global container at `var(--z-toast: 1400)` — above Tooltip
  (1300) and Modal, so error toasts surface over modal dialogs.
- Six placements: `top-left | top-center | top-right | bottom-left |
  bottom-center | bottom-right` (default `bottom-right`).
- Auto-dismiss after `duration` ms (default 5000). `0` or `Infinity`
  keeps the toast visible until dismissed programmatically.
- **Pause on hover/focus, resume on leave/blur** so users have time to
  read long messages or click the action button.
- `maxToasts` (default 5) caps the visible stack; the oldest toast is
  dropped when a new one arrives at the cap.
- Action button (when `action` is provided) calls `onClick` and dismisses
  the toast in one click.
- Dismiss (×) button is rendered when `dismissable` is `true` (default).
- `error` toasts use `role="alert"` + `aria-live="assertive"`; other
  variants use `role="status"` + `aria-live="polite"`.

**Server-component safety**:
- `ToastProvider` and `useToast` both carry the `'use client'` directive.
- Calling `useToast()` outside a `<ToastProvider>` throws a clear error:
  `useToast must be called inside ToastProvider — make sure your app
  shell wraps children in <ToastProvider>`.

**Escalation guidance**:
"Show this only once per session", rate-limiting, and deduplication live
in **consumer code**, not in the provider. The provider is intentionally
unopinionated — wrap `showToast` in your own helper if you need those
behaviours. This keeps the DS primitive lean and lets each app pick its
own escalation policy.

**`<ToastProvider>` props**:
```typescript
interface ToastProviderProps {
  children: React.ReactNode
  /** Anchor corner. Default 'bottom-right'. */
  position?: 'top-left' | 'top-center' | 'top-right'
            | 'bottom-left' | 'bottom-center' | 'bottom-right'
  /** Cap on simultaneous toasts. Default 5. */
  maxToasts?: number
  /** Duration applied when showToast() omits one. Default 5000. */
  defaultDuration?: number
}
```

**`showToast()` config**:
```typescript
interface ToastConfig {
  variant?: 'info' | 'success' | 'warning' | 'error' // default 'info'
  title?: string
  description?: string
  duration?: number               // ms; 0 or Infinity = sticky
  action?: { label: string; onClick: () => void }
  dismissable?: boolean           // default true
}
```

**`useToast()` return**:
```typescript
interface UseToastReturn {
  showToast: (config: ToastConfig) => string  // returns id
  dismissToast: (id: string) => void          // no-op for unknown id
}
```

**Migration from the legacy hook**:
```tsx
// Before (v0.9.x)
const { success, error, dismiss } = useToast()
success('Saved!', { title: 'Done' })

// After (v0.10.0+)
const { showToast } = useToast()
showToast({ variant: 'success', title: 'Done', description: 'Saved!' })
```

The legacy `<Toast>` standalone component (with `id`, `message`, manual
`onDismiss`) is unchanged and still exported — no migration required for
direct `<Toast>` consumers.

---

## Contributing

When adding new components:

1. Create component directory: `src/components/ComponentName/`
2. Add files:
   - `ComponentName.tsx` - Component logic
   - `ComponentName.module.css` - Scoped styles
   - `index.ts` - Exports
   - `ComponentName.test.tsx` - Tests
3. Use design tokens for all styling
4. Ensure accessibility compliance
5. Add to `src/components/index.ts`
6. Document in this file
7. Add to ComponentShowcase

---

## Next Components (Roadmap)

Future components to build:

- **Select/Dropdown**: Custom select component
- **Checkbox**: Styled checkbox with indeterminate state
- **Switch/Toggle**: Binary switch component
- **Modal**: Dialog/modal overlay
- **Toast**: Notification toast system
- **Tabs**: Tab navigation component
- **Accordion**: Collapsible content sections
- **Table**: Data table with sorting/filtering
- **Pagination**: Page navigation component
- **Skeleton**: Loading placeholders
- **Progress**: Progress bar and spinner
- **Alert**: Inline alert messages

---

## Sprint 10 (v0.7.0) — Ocean-by-Default Brand Promotion (#59)

Before Sprint 10, the DS shipped ocean-branded variants (`gradient`, shadow-xs, colored hovers) as strictly opt-in. Screenshots of the showcase read as generic SaaS because nobody opted in. Sprint 10 promotes the brand surfaces to **non-breaking defaults**, each with a clear opt-out so teams that want the older flat look can preserve it.

### Summary of default changes

| Component | Before | Now (default) | Opt-out |
|---|---|---|---|
| `Card` | Hairline border, no shadow | Hairline border + subtle ocean-tinted shadow | `variant="flat"` |
| `Header` | Pure `--color-surface` background | Subtle ocean-foam → surface gradient (left edge) | `variant="flat"` |
| `Avatar` | Flat neutral-300 circle behind initials | Hash-indexed ocean gradient (one of 7 slots) | `gradient={false}` |
| `Footer` | 1px neutral top border | 2px ocean → teal gradient ribbon | `accent={false}` |
| `Dropdown` item | `--color-surface-hover` (neutral grey) hover | `--color-ocean-lightest` (ocean-foam) hover | — (hover is universal; destructive variant still danger-tinted) |
| `Modal` | Plain rounded surface | 3px `--color-ocean-medium` top-accent line | `accent={false}` |
| `Sidebar` | Page-surface background | Subtle ocean-foam tint on the whole sidebar | — (can be themed away via className) |

### Opt-out API conventions

- **Visual variants with a new default** use `variant="flat"` (Card, Header). This keeps the variant enum tight — `default` means branded, `flat` means neutral.
- **Toggleable accents** use an `accent` boolean prop (Footer, Modal). Default is `true`. Pass `accent={false}` to suppress.
- **Avatar** uses `gradient={false}` (existing prop, flipped default) so contact lists that already depended on flat avatars stay stable if they were passing `gradient={false}` explicitly.

### Avatar gradient hashing

When an Avatar has `initials` and no `src`, it defaults to a deterministic ocean-adjacent gradient:

```
slotIndex = sum(charCodeAt) mod 7
```

Slots span ocean-light→ocean-medium, teal-light→teal-medium, ocean-base→teal-base, ocean-medium→ocean-dark, teal-medium→ocean-medium, coral-light→coral-base, and ocean-light→teal-base (the original variant, preserved). Same initials always pick the same slot — "JD" today is the same color as "JD" next year. Pass `gradient={false}` to restore the flat neutral background.

### What *did not* change

- `variant="outlined"` on Card (still hairline border, no shadow).
- `variant="elevated"` on Card (still the strongest shadow option).
- The `gradient` className on Header / Footer / Sidebar (still the "full brand hero" option for marketing sections).
- Sprint 9 primitives (`PageHeader`, `CardTitle`, `SidebarNavItem`, `Kbd`) — untouched.
- Tokens. No new tokens in Sprint 10; the changes compose existing ocean-scale and RGB-channel tokens.

### Dark mode

Every new default has an explicit `[data-theme='dark']` counterpart that preserves the feel (branded but subtle) against the deeper dark-mode page surfaces. Spot-checked in: Card, Header, Avatar (all 7 slots), Footer, Dropdown, Modal, Sidebar.

### Migration notes

- **No breaking changes.** Every existing component call continues to work; only the visual defaults shift toward ocean.
- If a consumer app currently relies on Card looking completely flat (e.g. inside deeply nested cards), add `variant="flat"` to those call sites.
- If a consumer has built a custom contact list expecting flat initials, add `gradient={false}` to those Avatars.
- If the Footer ribbon conflicts with a custom branded band above the footer, pass `accent={false}`.
- Modal and Footer gain new props, which is a minor-version bump per semver (hence v0.7.0).

---

## Data Visualization

### Sparkline

Lightweight inline data visualization — an 80×20px (default) trend strip
rendered as hand-rolled SVG. Intentionally does **not** import recharts, so
it adds ~0 KB to the recharts-using chart bundle and can be dropped into
table cells, list rows, or stat cards without pulling in the charting
runtime.

**Variants**: `bars` (default), `line`

**Features**:
- 80×20px by default, overridable via `size={{ w, h }}` (or `width` / `height`
  shortcut props). For status-card style usage where the sparkline is a
  hero element rather than a table cell garnish, ~40px height reads well.
- **Two data overloads**: `SparklineDataPoint[]` for explicit `{ t, count }`
  buckets, **or** plain `number[]` when you don't have meaningful timestamps
- **Semantic color variants** (`primary`, `success`, `warning`, `danger`,
  `neutral`, `info`) resolved to design tokens — or pass any raw CSS string
- **Gradient fill** (`fill`) under the line for an area-chart vibe (line
  variant only)
- **End-of-line dot** (`showDot`) emphasizing the most recent value
- Renders `emptyFallback` (default `—`) when `data` is empty **or** all
  `count` values are zero — stable layout whether a row has activity or not
- `role="img"` on the SVG, with an auto-generated trend summary
  (`"Trend: ascending, min 12, max 45"`) used as the `aria-label` when no
  explicit `ariaLabel` is provided
- `forwardRef` to the outer `<span>` for anchor-able positioning
- SSR-safe: no `window` / `document` references

**Usage**:
```tsx
import { Sparkline } from '@lando-labs/lando-ds'

// Original API — explicit { t, count } buckets, bars variant (default)
<Sparkline
  data={[
    { t: '10:00', count: 2 },
    { t: '10:05', count: 8 },
    { t: '10:10', count: 3 },
    { t: '10:15', count: 5 },
  ]}
  ariaLabel="Requests per minute"
/>

// Simple-API — plain number[], line variant, semantic color, gradient fill, end-dot
<Sparkline
  data={[12, 19, 15, 25, 32, 28, 45]}
  variant="line"
  color="success"
  height={40}
  fill
  showDot
/>

// Line variant, custom CSS color and size (back-compat with v0.8 callers)
<Sparkline
  variant="line"
  color="var(--color-teal-base)"
  size={{ w: 120, h: 28 }}
  data={dailyHits}
  ariaLabel="Daily hits"
/>

// Empty-state fallback (empty array or all-zero values)
<Sparkline data={[]} emptyFallback="No activity" ariaLabel="No activity" />
```

**Props**:
```typescript
interface SparklineDataPoint {
  /** Bucket identifier — typically an ISO timestamp, but any string or number works. */
  t: string | number
  /** Value for this bucket. Must be ≥ 0. */
  count: number
}

type SparklineColorVariant =
  | 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'

type SparklineColor = SparklineColorVariant | (string & {})

interface SparklineProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * Time-series data, most recent last. Accepts either explicit
   * `{ t, count }` buckets OR a plain `number[]` (index becomes
   * the synthetic `t`). Empty array → renders emptyFallback.
   */
  data: SparklineDataPoint[] | number[]
  /** Size in pixels. Defaults to 80×20. */
  size?: { w?: number; h?: number }
  /** Convenience override for height (alias for `size.h`). Default: 20. */
  height?: number
  /** Convenience override for width (alias for `size.w`). Default: 80. */
  width?: number
  /** Bar chart or line chart. Default 'bars'. */
  variant?: 'bars' | 'line'
  /**
   * Color for the line/bars. Accepts a semantic variant key
   * (`'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'`)
   * resolved to the matching `--color-*-base` token, OR any raw CSS color
   * string (`'#1b7fa8'`, `'rgb(…)'`, `'var(--color-teal-base)'`).
   * Default: `var(--color-ocean-base)`.
   */
  color?: SparklineColor
  /**
   * When truthy and `variant="line"`, render a gradient fill below the line
   * (full color at top → ~5% opacity at baseline). Ignored for `bars`.
   */
  fill?: boolean
  /** When truthy, render a small `<circle>` at the last data point. */
  showDot?: boolean
  /** Rendered when data is empty or all values are zero. Default: em-dash. */
  emptyFallback?: React.ReactNode
  /**
   * Accessible label for the SVG / em-dash span. If omitted, an auto-generated
   * trend summary (`"Trend: ascending, min N, max M"`) is used so screen-reader
   * users get a meaningful announcement without consumer effort.
   */
  ariaLabel?: string
}
```

**Color resolution table**:

| `color` value | Resolves to |
|---|---|
| `'primary'` | `var(--color-primary)` |
| `'success'` | `var(--color-success-base)` |
| `'warning'` | `var(--color-warning-base)` |
| `'danger'` | `var(--color-error-base)` |
| `'neutral'` | `var(--color-neutral-500)` |
| `'info'` | `var(--color-info-base)` |
| (any other string) | passed through unchanged (`'#1b7fa8'`, `'var(--color-teal-base)'`, etc.) |
| (omitted) | `var(--color-ocean-base)` |

**Rendering notes**:
- **Bars variant** skips zero-count buckets entirely (no `<rect>` emitted),
  so sparse activity reads as gaps rather than 0-height slivers.
- **Line variant** keeps zero buckets as genuine low points on the polyline
  so the curve's shape is preserved.
- Bar width is clamped to `Math.max(1, …)` so a single-bucket sparkline
  still renders a visible bar.
- The `fill` gradient is rendered as a closed `<path>` under the polyline,
  with stops `0% currentColor @ 0.4` → `100% currentColor @ 0.05`. It's only
  drawn for `variant="line"`; setting `fill` on a `bars` sparkline is a no-op
  rather than an error so consumers can swap variants without re-shaping props.
- The `showDot` circle uses a radius proportional to the sparkline height
  (`min 1.5px`, `max 3.5px`). At the default 20px height it reads as a small
  "current value" indicator; at 40px it scales up gracefully.
- Colors use `currentColor` on the inner SVG — pass a design-token string
  to `color` (e.g. `"var(--color-teal-base)"`) and the whole surface
  inherits it.
- `ariaLabel` defaults to a content-aware trend summary
  (`"Trend: ascending, min 12, max 45"`). If you need a static label for
  marketing/UX reasons (e.g. "Daily visits"), pass `ariaLabel` explicitly
  to override.

**When to reach for Sparkline vs. LineChart/BarChart**: Sparkline is for
at-a-glance trends inline with other content (a table cell, a KPI, a list
row). If you need axes, a legend, tooltips, or a height over ~40px, use
`LineChart` or `BarChart` instead.

---

### FunnelChart

Sequential drop-off visualization for SaaS funnels (signup → verified →
activated → paid). Distinct from `BarChart` (no implicit drop-off semantic)
and `PieChart` (no sequential ordering). Custom SVG trapezoid renderer —
recharts has no native funnel primitive, so this component hand-rolls the
geometry while leaning on the shared chart utilities for theming, state
shells, and accessibility.

**Variants**: `vertical` (default) — stages stack top→bottom with width
tapering. `horizontal` — stages flow left→right with height tapering.

**Features**:
- **Trapezoid stages** sized proportionally to `count` (or `percentage`),
  centered along the funnel's main axis
- **Inside labels** for the vertical orientation (stage name + count +
  percentage painted on the colored fill) — **beside labels** for the
  horizontal orientation (placed below each stage)
- **`colorScheme` prop** matching the rest of the chart family
  (`'ocean' | 'teal' | 'success' | 'warning' | 'danger' | 'custom'`) —
  resolved through the shared `getChartColors` utility, so palette changes
  propagate to every chart component at once. Each stage is assigned the
  next color in the palette (cycling if there are more stages than colors).
- **Animated mount** — each stage fades and slides into place with an
  80 ms stagger; respects `prefers-reduced-motion`
- **Auto-computed percentages** when `percentage` is omitted on a stage
  (`count / data[0].count * 100`)
- **Loading / empty / error / SSR data-table fallback** mirror the
  `Chart` base behavior. The off-screen `<table>` is the canonical accessible
  representation — screen readers announce the funnel via this table while
  the SVG is marked `role="presentation"`.
- **Validation**: negative counts or non-numeric percentages render the
  Chart base error state with a descriptive message
- `forwardRef` to the root container

**Usage**:
```tsx
import { FunnelChart } from '@lando-labs/lando-ds'

// Vertical funnel with explicit percentages
<FunnelChart
  data={[
    { stage: 'Signups',   count: 1250, percentage: 100 },
    { stage: 'Verified',  count: 980,  percentage: 78 },
    { stage: 'Activated', count: 620,  percentage: 50 },
    { stage: 'Converted', count: 215,  percentage: 17 },
  ]}
  orientation="vertical"
  showPercentages
  showAbsoluteCounts
  colorScheme="ocean"
/>

// Horizontal funnel with auto-computed percentages (omit `percentage`)
<FunnelChart
  data={[
    { stage: 'Visited',   count: 5000 },
    { stage: 'Engaged',   count: 3500 },
    { stage: 'Signed up', count: 2000 },
    { stage: 'Activated', count: 900 },
    { stage: 'Paid',      count: 200 },
  ]}
  orientation="horizontal"
  colorScheme="teal"
/>

// Counts only — hide the percentage labels
<FunnelChart
  data={stages}
  showPercentages={false}
  showAbsoluteCounts
/>
```

**Props**:
```typescript
interface FunnelStage {
  stage: string
  count: number
  /** Optional. Auto-computed from `count / data[0].count * 100` when omitted. */
  percentage?: number
}

interface FunnelChartProps
  extends Omit<
    BaseChartProps,
    | 'data'
    | 'showGrid'
    | 'showLegend'
    | 'legendPosition'
    | 'showTooltip'
    | 'onDataPointClick'
    | 'onLegendClick'
    | 'aspectRatio'
  > {
  data: FunnelStage[]
  orientation?: 'vertical' | 'horizontal'   // default 'vertical'
  showPercentages?: boolean                 // default true
  showAbsoluteCounts?: boolean              // default true
}
```

**Rendering notes**:
- The funnel's first stage is treated as the 100% reference; downstream
  stages taper relative to it. If you need a "true" funnel where each
  stage's bottom width equals the next stage's top width, the geometry
  already does that — the polygon for stage `i` uses `stages[i+1]`'s width
  ratio for its bottom edge.
- The Chart base `ResponsiveContainer` is intentionally NOT wrapped around
  the SVG. `ResponsiveContainer` expects a Recharts child and pulls a
  `ResizeObserver` dependency that hurts test ergonomics for no benefit
  on a hand-rolled SVG. The shared `Chart.module.css` is imported for
  visual parity of the loading / empty / error / title / description shells,
  so consumer experience is identical.
- The accessible name on the wrapper falls back to `"Funnel chart with N
  stages"` when `ariaLabel` and `title` are both omitted.

**When to reach for FunnelChart vs. BarChart**: use `FunnelChart` when the
data is sequential drop-off (each stage is a subset of the previous one).
Use `BarChart` for arbitrary categorical comparison where the ordering
doesn't carry a "X% of stage N-1" meaning.

---

## Markdown Authoring

### MarkdownEditor

A batteries-included markdown authoring surface that wraps
[`@uiw/react-md-editor`](https://github.com/uiwjs/react-md-editor)
(CodeMirror-based, ~80 KB gzipped before tree-shaking) and threads it
through the design system: theme, preview pipeline, and form
behavior all match DS conventions.

**Why a wrapper instead of exposing the underlying editor**:
- **Theme parity**: ThemeProvider's resolved theme drives the editor's
  `data-color-mode` attribute, so light/dark mode "just works."
- **Render parity**: the editor's bundled preview renderer is replaced
  with the DS `<Markdown>` component, so the rendered output in
  edit-mode preview matches read-only Markdown surfaces (chat messages,
  documentation, etc.) exactly — same sanitizer, same GFM behavior,
  same external-link policy.
- **API narrowness**: only the props consumers actually need are
  exposed; the rest stay at sensible defaults.

**Props**:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | required | Markdown content (controlled) |
| `onChange` | `(value: string) => void` | required | Change handler |
| `mode` | `'edit' \| 'preview' \| 'live'` | `'live'` | `live` is split edit/preview, `edit` is editor-only, `preview` is render-only |
| `height` | `number \| string` | `400` | Editor height — number is treated as px |
| `placeholder` | `string` | — | Placeholder text for the empty editor |
| `hasFrontmatter` | `boolean` | `false` | When true, YAML frontmatter is stripped from preview render (body still renders) |
| `toolbar` | `boolean` | `true` | Show the visual toolbar. Keyboard shortcuts always work regardless |
| `name` | `string` | — | Hidden form field name — `FormData.get(name)` returns the current value |
| `className` | `string` | — | Extra class on the wrapping `<div>` |

**Basic usage** — import from the dedicated `/markdown-editor` subpath (never the package root barrel; see "Server / client boundary" below):
```tsx
'use client'
import { MarkdownEditor } from '@lando-labs/lando-ds/markdown-editor'
import { useState } from 'react'

export function SkillEditor() {
  const [content, setContent] = useState('')
  return (
    <MarkdownEditor
      value={content}
      onChange={setContent}
      placeholder="Write your skill..."
      height={400}
    />
  )
}
```

**Edit-only / preview-only**:
```tsx
<MarkdownEditor value={src} onChange={setSrc} mode="edit" />
<MarkdownEditor value={src} onChange={() => {}} mode="preview" />
```

**Frontmatter handling** — strip YAML from the preview while keeping
it in the editor source view:
```tsx
const initial = `---
title: Greeter
description: Say hello to someone by name.
---

# Greeter

Greets a person by name.
`

<MarkdownEditor
  value={content}
  onChange={setContent}
  hasFrontmatter
/>
// Editor pane shows the YAML; preview pane only shows the body.
```

**Form-friendly** — drop into a form and let `FormData` /
Server Actions pick up the value without manual state plumbing:
```tsx
<form action={createSkill}>
  <input name="title" required />
  <MarkdownEditor
    value={content}
    onChange={setContent}
    name="content"
  />
  <button type="submit">Save</button>
</form>
```
Mirrors the `Select` v0.4.1 hidden-input pattern.

**Toolbar visibility** — keyboard shortcuts (Cmd-B, Cmd-I, Cmd-K,
etc.) keep working when `toolbar={false}`; the prop only controls
the visible affordance:
```tsx
<MarkdownEditor value={src} onChange={setSrc} toolbar={false} />
```

#### Server / client boundary

`MarkdownEditor` is a `'use client'` component. The underlying
editor uses CodeMirror with browser-only APIs and **cannot be
imported into a React Server Component**.

**It is not exported from the package root barrel.** Importing it
from `@lando-labs/lando-ds` (or `/components`) would drag
`@uiw/react-md-editor` — which touches `document` at module
evaluation — into every consumer of the barrel and break Next.js
App Router SSR. Always import it from the dedicated
`/markdown-editor` subpath:
```tsx
'use client'
import { MarkdownEditor } from '@lando-labs/lando-ds/markdown-editor'
```

In a server-component context (or if you hit "ReferenceError:
window is not defined" / "navigator is not defined" during build),
defer the subpath import with `next/dynamic`:
```tsx
import dynamic from 'next/dynamic'

const MarkdownEditor = dynamic(
  () => import('@lando-labs/lando-ds/markdown-editor').then((m) => m.MarkdownEditor),
  { ssr: false }
)
```

This is the recommended pattern from `@uiw/react-md-editor`'s own
docs and isolates the CodeMirror-heavy bundle to client-side
rendering.

#### Theming

The wrapper's CSS module overrides the editor's GitHub-Primer-style
CSS custom properties (`--color-canvas-default`,
`--color-fg-default`, `--color-border-default`, etc.) and maps them
to DS tokens (`--color-surface`, `--color-text-primary`,
`--color-border-default`). The wrapper element exposes
`data-color-mode={'light'|'dark'}` driven by `ThemeProvider`, which
the editor's CSS keys off of. The result: the editor inherits ocean
theming + dark mode automatically, no JS plumbing required from
consumers.

#### Bundle impact

`@uiw/react-md-editor` (incl. CodeMirror + dependencies) is the
heaviest dependency in the design system at the moment. The chunk
that imports it grows by roughly **~370 KB gzipped** vs. a build
without `MarkdownEditor`. The editor is only loaded when consumers
import `MarkdownEditor` — Vite/Webpack tree-shake the rest of the
DS away from consumers who don't use it.

#### Accessibility note

The underlying `@uiw/react-md-editor` toolbar ships its icons as
`<svg role="img">` without alt text, which `axe-core` flags as
`svg-img-alt`. This is an upstream accessibility gap (logged
against `uiwjs/react-md-editor`); we cannot fix it cleanly from a
wrapper without re-rendering every toolbar command. Consumers who
need a fully axe-clean surface should pass `toolbar={false}` and
provide their own toolbar (or rely on keyboard shortcuts, which
still work). The wrapper itself + the DS preview surface
(`<Markdown>`) pass `axe` cleanly.

