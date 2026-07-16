# Composition contract — `as` and `asChild`

> Status: audited + documented in v0.55.0 (#509). Per-component polymorphism is
> queryable from `meta.json` (`components[X].polymorphic`).

The design system gives you two ways to change what element a component renders,
so a component never traps you into its default tag or an extra wrapper node.

## The two mechanisms

### `asChild` — delegate to your own element (the universal mechanism)

`asChild` merges the component's styling, behavior, and semantics **onto a single
React element you provide**, rather than rendering its own node. This is the more
powerful primitive — your element keeps its own props, handlers, `href`, and ref.

```tsx
// A Button that IS a router link — one <a>, styled as a button, no nesting:
<Button asChild>
  <Link href="/dashboard">Go</Link>
</Button>
// → <a href="/dashboard" class="…button…">Go</a>
```

Use `asChild` when you need the rendered element to be *your* component/element
with its own contract (routing links, a custom control, an element that must
carry specific attributes). This is the same model as Radix's `asChild`.

### `as` — swap the tag (the ergonomic for primitives)

`as` changes the rendered tag while keeping the component's own styling. It's a
lighter ergonomic for the common "just render a different element" case on
primitives where there is no child to delegate to.

```tsx
<Stack as="section">…</Stack>          // a flex column that is a <section>
<Text as="label" htmlFor="email">…</Text>
<Heading level={2} as="div">…</Heading> // styled like an h2, non-heading semantics
```

`as` is provided on the layout & typography **primitives** (Box, Stack, Inline,
Container, Center, GridItem, Text, Callout, CardTitle, …) — the components whose
primary variation axis *is* the element type. (`Card` itself composes via
`asChild`, not `as`.)

### Which to use

| You want to… | Use |
|---|---|
| Render as your own element with its own props/handlers/href/ref | `asChild` |
| Just change the tag on a layout/typography primitive | `as` |
| Both are available on a component | Prefer `asChild` when the element has its own behavior; `as` for a pure tag swap |

Every interactive/content component supports `asChild`; a component doesn't need
`as` *and* `asChild` — `asChild` already covers polymorphism. `as` is an added
convenience on primitives, not a parallel requirement.

## The Slot merge contract (`asChild` internals)

`asChild` is implemented by `Slot` (`src/components/Slot`), a dependency-free,
Radix-compatible merge. When you pass a child, `Slot` merges the component's own
props onto it with these rules:

- **Event handlers compose** — both run; the **child's** handler runs first, then
  the component's. (Neither return value gates the other; `Slot` does not honor a
  child's `preventDefault` to cancel the component's handler.)
- **`className`** concatenates (component's first, then child's).
- **`style`** merges (child wins on key conflict).
- **All other props** — the **child wins** on a genuine key collision; props the
  component sets that the child doesn't specify are preserved (this is why
  `role`/`aria-*` survive).
- **Refs compose** — the component's forwarded ref and the child's own ref both
  receive the node.
- An invalid (non-single-element) child renders nothing and **warns in dev**.

### Caveat: state-bearing props

Because the child wins on collision, a *state-bearing* prop the caller sets
(`disabled`, `aria-busy`, `aria-disabled`) can be overridden by the child. When a
component's disabled state must survive `asChild`, the component forwards it
explicitly:

- **`Button`** forwards `aria-disabled` (native `disabled` isn't valid on `<a>`)
  and `preventDefault`s the child's action when `disabled`/`loading` (#509).
- **`Chip`** forwards `aria-disabled` so a slotted `<a>` is announced disabled,
  not merely styled disabled (#509).

If you slot your own element, don't set a conflicting state prop on it — let the
component be the single source of truth.

### Gotcha: interactive-in-interactive nesting

Some components inject an internal control (e.g. `Badge`'s `onRemove` button). With
`asChild` + an **interactive** child (`<a href>`), that control nests inside your
interactive element, which is invalid HTML. For a removable clickable tag, keep
the component non-`asChild`, or render the extra control as a sibling. This is
documented on the relevant props (e.g. `Badge.onRemove`).

## Coverage (grounded in meta)

`polymorphic: true/false` is emitted per component in `meta.json` and is the
authoritative, queryable source — **34 components** are polymorphic (support `as`
and/or `asChild`) as of v0.55.0. The detector keys on the *presence* of an `as?:`
prop (in any of the library's typing styles — `ElementType`, a string-literal
union, a generic `as?: E`, or a named element alias) or an `asChild` boolean, so
generically-typed primitives are no longer under-reported (#509).

```
# via the MCP server / meta.json:
components.Button.polymorphic   → true   (asChild)
components.Stack.polymorphic    → true   (as)
components.Card.polymorphic     → true   (asChild)
components.Modal.polymorphic    → false  (fixed multi-node internal DOM)
```

Complex composites with fixed internal structure (Modal, Select, DataTable, the
overlays) deliberately do **not** take `as` — a tag swap there would misrepresent
a multi-node widget as a single element. They compose via their documented slots
and (where meaningful) `asChild` on their trigger.
