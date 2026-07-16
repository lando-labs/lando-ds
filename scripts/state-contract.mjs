/**
 * State contract registry (#508) — the single source of truth for the design
 * system's uncontrolled-first state contract.
 *
 * `scripts/validate-state-contract.mjs` checks the emitted meta prop tables
 * (`dist/meta.json`) against this list; `reference/state-contract.md` is the
 * human-facing prose. Keeping both grounded in one data structure is what makes
 * the contract enforceable rather than aspirational (the claims-hygiene culture
 * of #425/#427).
 *
 * ── The contract ────────────────────────────────────────────────────────────
 * Every stateful component is uncontrolled-first: it exposes a `default*` prop
 * (uncontrolled seed) AND a `value`/`open`/… + `on*Change` pair (controlled
 * escape). See `src/hooks/useControllableState.ts` for the canonical primitive.
 *
 * ── Registry shape ──────────────────────────────────────────────────────────
 * Each entry names a component and, for every independent piece of state it
 * manages, a `state`:
 *   - `change`  — the change callback prop (REQUIRED to exist; proves the entry
 *                 corresponds to a real, current API — non-vacuous).
 *   - `value`   — the controlled prop.
 *   - `default` — the uncontrolled seed prop (REQUIRED unless `exempt`).
 *   - `exempt`  — a human reason. When present, the `default` requirement is
 *                 waived for a DELIBERATE one-sided contract (controlled-only or
 *                 uncontrolled-only). The reason is mandatory — no silent gaps.
 *
 * The validator additionally runs a completeness guard: any `on*Change`
 * value-callback found in meta that is NOT listed here fails the build, so a
 * newly-added stateful component cannot silently escape the contract.
 */

/**
 * @typedef {Object} StateEntry
 * @property {string} change   Change-callback prop name (must exist in meta).
 * @property {string} value    Controlled prop name.
 * @property {string} [default] Uncontrolled seed prop name (required unless exempt).
 * @property {string} [exempt] Reason this state is a deliberate one-sided contract.
 */

/** @type {{ component: string, states: StateEntry[] }[]} */
export const STATE_CONTRACT = [
  // ── Conforming: full uncontrolled-first pair ──────────────────────────────
  { component: 'Accordion', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'Calendar', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'Checkbox', states: [{ change: 'onChange', value: 'checked', default: 'defaultChecked' }] },
  { component: 'Collapsible', states: [{ change: 'onOpenChange', value: 'open', default: 'defaultOpen' }] },
  { component: 'Combobox', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  {
    component: 'DataTable',
    states: [
      { change: 'onPageChange', value: 'page', default: 'defaultPage' },
      { change: 'onSelectionChange', value: 'selectedRows', default: 'defaultSelectedRows' },
      { change: 'onSortChange', value: 'sort', default: 'defaultSort' },
    ],
  },
  {
    component: 'DatePicker',
    states: [
      { change: 'onChange', value: 'value', default: 'defaultValue' },
      { change: 'onOpenChange', value: 'open', default: 'defaultOpen' },
    ],
  },
  {
    component: 'DateRangePicker',
    states: [
      { change: 'onChange', value: 'value', default: 'defaultValue' },
      { change: 'onOpenChange', value: 'open', default: 'defaultOpen' },
    ],
  },
  { component: 'FileInput', states: [{ change: 'onChange', value: 'files', default: 'defaultFiles' }] },
  { component: 'MultiSelect', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'NumberInput', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'Popover', states: [{ change: 'onOpenChange', value: 'open', default: 'defaultOpen' }] },
  { component: 'RadioGroup', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  // Gained uncontrolled support in v0.54.0 (#508):
  { component: 'SegmentedControl', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'Select', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'TagInput', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'Slider', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'Switch', states: [{ change: 'onChange', value: 'checked', default: 'defaultChecked' }] },
  { component: 'Tabs', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'Textarea', states: [{ change: 'onChange', value: 'value', default: 'defaultValue' }] },
  { component: 'TimelineItem', states: [{ change: 'onExpandedChange', value: 'expanded', default: 'defaultExpanded' }] },

  // ── Mixed: one conforming state + one deliberately-exempt state ────────────
  {
    component: 'AppShell',
    states: [
      { change: 'onSidebarCollapsedChange', value: 'sidebarCollapsed', default: 'defaultSidebarCollapsed' },
      {
        change: 'onMobileSidebarOpenChange',
        value: 'mobileSidebarOpen',
        exempt: 'Transient mobile drawer — always opens from closed; there is no persisted default to seed.',
      },
    ],
  },
  {
    component: 'Sidebar',
    states: [
      { change: 'onCollapsedChange', value: 'collapsed', default: 'defaultCollapsed' },
      {
        change: 'onMobileOpenChange',
        value: 'mobileOpen',
        exempt: 'Transient mobile drawer — always opens from closed; there is no persisted default to seed.',
      },
    ],
  },

  // ── Deliberate exemptions (documented, one-sided by design) ────────────────
  {
    component: 'AlertDialog',
    states: [
      {
        change: 'onOpenChange',
        value: 'open',
        exempt:
          'Modal dialog — controlled-only by design (`open` is required). Divergence from Radix `defaultOpen` is intentional: an alert dialog’s visibility should always be owned by the consumer.',
      },
    ],
  },
  {
    component: 'CommandPalette',
    states: [
      {
        change: 'onOpenChange',
        value: 'open',
        exempt: 'Modal command surface — controlled-only by design (`open` is required).',
      },
      {
        change: 'onValueChange',
        value: 'value',
        exempt: 'Search query is transient — the palette seeds empty on each invocation, so there is no `defaultValue`.',
      },
    ],
  },
  {
    component: 'Pagination',
    states: [
      {
        change: 'onPageChange',
        value: 'currentPage',
        exempt:
          'Controlled navigation control — the current page is owned by the caller/router/URL; there is no coherent uncontrolled default target.',
      },
    ],
  },
  {
    // Uncontrolled-only: Table has no controlled selection prop, so no `value`.
    component: 'Table',
    states: [
      {
        change: 'onSelectionChange',
        exempt:
          'Row selection is uncontrolled-only internal state; use DataTable for the controlled-selection variant (`selectedRows` + `defaultSelectedRows`).',
      },
    ],
  },
]
