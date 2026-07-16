# Uncontrolled-first state contract

> Status: **enforced in CI** (`npm run validate:state`) as of v0.54.0 (#508).

Every stateful component in the design system follows one rule, borrowed from
Radix's most durable maintainability lesson:

> **A stateful component is uncontrolled-first.** It works with zero wiring
> (`defaultX`, the component owns its state) and offers a controlled escape
> hatch (`X` + `onXChange`, the consumer owns its state).

This means the *simple* case is always available — you can drop a `Select`,
`Tabs`, or `TagInput` into a page and it just works, then reach for controlled
mode only when you need to drive or observe the state from outside.

```tsx
// Uncontrolled — the component owns its selection.
<Tabs defaultValue="overview">…</Tabs>

// Controlled — you own it.
const [tab, setTab] = useState('overview')
<Tabs value={tab} onChange={setTab}>…</Tabs>

// Uncontrolled with an observer — own nothing, still watch changes.
<Tabs defaultValue="overview" onChange={(t) => analytics.track(t)}>…</Tabs>
```

## The canonical primitive: `useControllableState`

Internally, components route their state through
[`src/hooks/useControllableState.ts`](../src/hooks/useControllableState.ts), a
dependency-free hook modeled on Radix's `useControllableState`:

```ts
const [value, setValue] = useControllableState({
  value,          // controlled prop — when !== undefined, controlled mode
  defaultValue,   // uncontrolled seed — used only in uncontrolled mode
  onChange,       // fires on every change, in BOTH modes
})
```

- Passing `value !== undefined` selects controlled mode; the hook never mutates
  internal state and defers to the consumer via `onChange`.
- Otherwise it is uncontrolled, seeding internal state from `defaultValue`.
- `onChange` fires on real changes in both modes (in uncontrolled mode it is an
  optional observer that fires after commit).
- `setValue` accepts a next value or a functional updater `(prev) => next`,
  mirroring React's `useState` setter, and is referentially stable.

### The `undefined`-as-controlled-value case

By default the hook infers controlled-ness from `value !== undefined` (React's
native convention). That breaks down when `undefined` is itself a *meaningful*
controlled value — e.g. `Select`'s cleared single-select state (#328), which the
component both renders and emits from `onChange`. Round-tripping that `undefined`
back in would be mistaken for "uncontrolled" and the component would silently
fall back to stale internal state.

Such components pass an explicit `controlled` override keyed on **prop presence**:

```tsx
const { value, defaultValue, onChange, ...rest } = props
const [state, setState] = useControllableState({
  value, defaultValue, onChange,
  controlled: 'value' in props, // present (even as undefined) ⇒ controlled
})
```

`Select`, `SegmentedControl`, and `TagInput` do this. The rule stays the same for
consumers: pass `value` (controlled) **or** `defaultValue` (uncontrolled) for a
given instance — not both.

## Enforcement

The contract is not a convention we hope holds — it is checked in CI against the
design system's own emitted meta prop tables (`dist/meta.json`, the same
artifact the MCP server and consumers read):

- **Source of truth:** [`scripts/state-contract.mjs`](../scripts/state-contract.mjs)
  — a registry listing every stateful component, the `value`/`default`/`change`
  triple for each piece of state it manages, and explicit exemptions.
- **Check:** [`scripts/validate-state-contract.mjs`](../scripts/validate-state-contract.mjs)
  (`npm run validate:state`), run after `build` in `test.yml` and `publish.yml`.
  It fails the build when:
  1. a contract-bound state is missing its `default*` or controlled prop, or
  2. an exemption lacks a reason, or
  3. **any** `on*Change` value-callback in the API is absent from the registry
     (the *completeness guard* — a newly-added stateful component cannot
     silently escape the contract).

### Adding a stateful component

1. Route its state through `useControllableState` and expose `defaultX`,
   `X`, and `onXChange`.
2. Add an entry to `scripts/state-contract.mjs`.
3. `npm run build && npm run validate:state` — green means it conforms.

If a component is legitimately one-sided, mark the state `exempt` with a reason
instead of a `default` (see below). An empty reason is rejected — no silent gaps.

## Deliberate exemptions

Some components are intentionally one-sided. These are documented, not overlooked:

| Component | State | Why exempt |
|---|---|---|
| **AlertDialog** | `open` | Modal dialog — controlled-only by design (`open` is required). An alert dialog's visibility should always be owned by the consumer. (Deliberate divergence from Radix's `defaultOpen`.) |
| **CommandPalette** | `open` | Modal command surface — controlled-only by design. |
| **CommandPalette** | `value` | Search query is transient — the palette seeds empty on each invocation, so there is no `defaultValue`. |
| **Pagination** | `currentPage` | Controlled navigation control — the page is owned by the caller/router/URL; there is no coherent uncontrolled default. |
| **Table** | row selection | Uncontrolled-only internal state (no controlled prop); use **DataTable** for the controlled-selection variant (`selectedRows` + `defaultSelectedRows`). |
| **AppShell** | `mobileSidebarOpen` | Transient mobile drawer — always opens from closed; nothing to seed. |
| **Sidebar** | `mobileOpen` | Transient mobile drawer — always opens from closed; nothing to seed. |

Everything else — Accordion, Calendar, Checkbox, Collapsible, Combobox,
DataTable (page/selection/sort), DatePicker, DateRangePicker, FileInput,
MultiSelect, NumberInput, Popover, RadioGroup, SegmentedControl, Select, Slider,
Switch, Tabs, TagInput, Textarea, TimelineItem, and the collapsed-sidebar state
of AppShell/Sidebar — exposes the full uncontrolled-first pair.
