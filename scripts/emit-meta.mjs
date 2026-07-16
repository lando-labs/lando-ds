#!/usr/bin/env node
/**
 * emit-meta.mjs (#418, #419)
 *
 * Emits the DS self-describing meta artifacts after the library bundle is
 * built:
 *
 *   - dist/meta.json          — LIGHT shape (~50 KB target)
 *   - dist/meta.verbose.json  — VERBOSE shape (~300 KB target, strict superset)
 *
 * Both files are validated against `src/meta/schema.json` after generation;
 * a failure exits non-zero so the build catches schema drift early.
 *
 * Strategy (one pass per artifact):
 *
 *   1. Walk `src/components/<Name>/` directories; for each one find the
 *      primary `.tsx` (matching the directory name).
 *   2. Use `react-docgen-typescript` to extract prop tables from those .tsx
 *      files. The parser is configured to:
 *        - extract literal values from string-union enums
 *        - save default values as strings
 *        - filter out inherited DOM props (HTMLButtonElement, etc.) by
 *          keeping only props whose `parent.fileName` is inside `src/`
 *      so the emitted prop tables describe the AUTHORED API, not every
 *      DOM attribute React happens to inherit.
 *   3. Scan the source for `'use client'` directives and `forwardRef`
 *      usage to populate capability flags.
 *   4. Read `src/tokens/index.ts` and `src/components/Icon/registry.ts`
 *      at runtime via a tiny dynamic-import shim (`tsx` → `node --import`)
 *      so we get the actual JS values, not just their TS types.
 *   5. Read `package.json` for the package block and the exports surface.
 *   6. Compose the meta shape, validate against schema, write both files.
 *
 * Usage:
 *   node scripts/emit-meta.mjs           # emit both artifacts (default)
 *   node scripts/emit-meta.mjs --check   # exit 1 if the emitted artifacts
 *                                          # would differ from the on-disk copy
 *
 * Exit 0: meta written / unchanged.
 * Exit 1: parse failure OR schema validation failure OR (--check) drift detected.
 *
 * Build-time devDeps used: react-docgen-typescript, ajv. No runtime deps.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

import docgen from 'react-docgen-typescript'
import Ajv from 'ajv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')

/* ------------------------------------------------------------------ */
/* 0. Load schema + Ajv validator.                                    */
/* ------------------------------------------------------------------ */

const schemaPath = join(repoRoot, 'src', 'meta', 'schema.json')
if (!existsSync(schemaPath)) {
  console.error('[emit-meta] Missing schema:', schemaPath)
  process.exit(1)
}
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const ajv = new Ajv({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

/* ------------------------------------------------------------------ */
/* 1. Read package.json for package + exports info.                    */
/* ------------------------------------------------------------------ */

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))

const packageMeta = {
  name: pkg.name,
  version: pkg.version,
  homepage:
    pkg.homepage ?? pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') ?? '',
}

const exportsMeta = {
  main: pkg.exports?.['.']?.import ?? pkg.module ?? pkg.main ?? '',
  subpaths: Object.keys(pkg.exports ?? {}).filter((k) => k !== '.'),
}

/* ------------------------------------------------------------------ */
/* 2. Discover component directories under src/components.            */
/* ------------------------------------------------------------------ */

const componentsRoot = join(repoRoot, 'src', 'components')
const componentDirs = readdirSync(componentsRoot)
  .filter((entry) => {
    const full = join(componentsRoot, entry)
    return statSync(full).isDirectory()
  })
  .sort()

/**
 * For a given component directory, find candidate primary `.tsx` files.
 * We collect every non-test `.tsx` in the directory so multi-component
 * dirs (e.g. `Card/`, `Accordion/`, `Toast/`) get full coverage.
 */
function findComponentFiles(dir) {
  const full = join(componentsRoot, dir)
  return readdirSync(full)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !f.endsWith('.stories.tsx'))
    .map((f) => join(full, f))
}

/* ------------------------------------------------------------------ */
/* 3. Parse the public component-barrel to learn the canonical list   */
/*    of exported component names + their owning subpath.             */
/* ------------------------------------------------------------------ */

const indexSrc = readFileSync(join(componentsRoot, 'index.ts'), 'utf8')

/**
 * Parse `export { Foo, Bar } from './Foo'` lines.
 * Returns array of `{ names: ['Foo','Bar'], subpath: './Foo' }`.
 * Skips type-only lines (`export type { … }`).
 */
function parseValueExports(src) {
  const re = /^export\s+\{([^}]+)\}\s+from\s+['"]\.\/([^'"]+)['"]/gm
  const out = []
  let m
  while ((m = re.exec(src)) !== null) {
    const names = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      // Strip aliases (`Foo as Bar` -> we want `Bar`)
      .map((s) => (s.includes(' as ') ? s.split(' as ')[1].trim() : s))
      // Skip hooks (lowercase) — meta covers components only in v1.0
      .filter((s) => /^[A-Z]/.test(s))
    if (names.length > 0) out.push({ names, dir: m[2] })
  }
  return out
}

/**
 * Hand-curated category map mirroring the CLAUDE.md groupings. The
 * `src/components/index.ts` file doesn't carry per-section dividers in
 * any structured way (Sprint annotations got mixed in), so categorization
 * lives here for now. Adding a new component? Add it to the right bucket.
 *
 * Any component absent from this map falls through to "Uncategorized" —
 * harmless and obvious in the meta when you grep.
 */
const COMPONENT_CATEGORIES = {
  // Layout Primitives
  Stack: 'Layout Primitives',
  Inline: 'Layout Primitives',
  Box: 'Layout Primitives',
  Container: 'Layout Primitives',
  Grid: 'Layout Primitives',
  GridItem: 'Layout Primitives',
  Divider: 'Layout Primitives',
  Center: 'Layout Primitives',
  Spacer: 'Layout Primitives',
  AspectRatio: 'Layout Primitives',
  ScrollArea: 'Layout Primitives',

  // Typography
  Heading: 'Typography',
  Text: 'Typography',
  Code: 'Typography',
  Mark: 'Typography',
  Kbd: 'Typography',

  // Core & Form Components
  Button: 'Core & Form',
  IconButton: 'Core & Form',
  Input: 'Core & Form',
  NumberInput: 'Core & Form',
  FileInput: 'Core & Form',
  Textarea: 'Core & Form',
  Select: 'Core & Form',
  Combobox: 'Core & Form',
  MultiSelect: 'Core & Form',
  Checkbox: 'Core & Form',
  Radio: 'Core & Form',
  RadioGroup: 'Core & Form',
  Switch: 'Core & Form',
  Slider: 'Core & Form',
  SegmentedControl: 'Core & Form',
  TagInput: 'Core & Form',
  Form: 'Core & Form',
  Field: 'Core & Form',
  DateDisplay: 'Core & Form',
  Calendar: 'Core & Form',
  DatePicker: 'Core & Form',
  DateRangePicker: 'Core & Form',
  ColorSwatch: 'Core & Form',

  // Data Display
  Card: 'Data Display',
  CardHeader: 'Data Display',
  CardBody: 'Data Display',
  CardFooter: 'Data Display',
  CardTitle: 'Data Display',
  CardMedia: 'Data Display',
  Badge: 'Data Display',
  Chip: 'Data Display',
  Avatar: 'Data Display',
  AvatarGroup: 'Data Display',
  Table: 'Data Display',
  DataTable: 'Data Display',
  DataTableStatic: 'Data Display',
  List: 'Data Display',
  ListItem: 'Data Display',
  StatCard: 'Data Display',
  TaskCard: 'Data Display',
  DetailCard: 'Data Display',
  ApprovalCard: 'Data Display',
  ArticleCard: 'Data Display',
  Byline: 'Data Display',
  Lede: 'Data Display',
  PullQuote: 'Data Display',
  Timeline: 'Data Display',
  TimelineItem: 'Data Display',
  TimelineGroup: 'Data Display',

  // Feedback & Status
  Alert: 'Feedback & Status',
  Callout: 'Feedback & Status',
  Banner: 'Feedback & Status',
  AlertDialog: 'Feedback & Status',
  Progress: 'Feedback & Status',
  StepProgress: 'Feedback & Status',
  Skeleton: 'Feedback & Status',
  Spinner: 'Feedback & Status',
  StatusDot: 'Feedback & Status',
  EmptyState: 'Feedback & Status',

  // Overlay & Interactive
  Modal: 'Overlay & Interactive',
  Drawer: 'Overlay & Interactive',
  Dropdown: 'Overlay & Interactive',
  DropdownItem: 'Overlay & Interactive',
  Popover: 'Overlay & Interactive',
  Tooltip: 'Overlay & Interactive',
  Toast: 'Overlay & Interactive',
  ToastContainer: 'Overlay & Interactive',
  ToastProvider: 'Overlay & Interactive',
  Accordion: 'Overlay & Interactive',
  AccordionItem: 'Overlay & Interactive',
  Tabs: 'Overlay & Interactive',
  TabList: 'Overlay & Interactive',
  Tab: 'Overlay & Interactive',
  TabPanel: 'Overlay & Interactive',
  Portal: 'Overlay & Interactive',
  Slot: 'Overlay & Interactive',
  Collapsible: 'Overlay & Interactive',
  CommandPalette: 'Overlay & Interactive',
  CommandPaletteGroup: 'Overlay & Interactive',
  CommandPaletteItem: 'Overlay & Interactive',

  // Navigation & Layout Chrome
  Header: 'Navigation & Chrome',
  Sidebar: 'Navigation & Chrome',
  SidebarNavItem: 'Navigation & Chrome',
  Footer: 'Navigation & Chrome',
  BottomNav: 'Navigation & Chrome',
  BottomNavItem: 'Navigation & Chrome',
  PageHeader: 'Navigation & Chrome',
  AppShell: 'Navigation & Chrome',
  Breadcrumb: 'Navigation & Chrome',
  BreadcrumbItem: 'Navigation & Chrome',
  Pagination: 'Navigation & Chrome',
  StickyBar: 'Navigation & Chrome',
  NavTabs: 'Navigation & Chrome',
  NavTabsItem: 'Navigation & Chrome',

  // Content Display
  CodeBlock: 'Content Display',
  Markdown: 'Content Display',
  VisuallyHidden: 'Content Display',

  // Communication
  Chat: 'Communication',
  ChatMessage: 'Communication',
  ChatInput: 'Communication',
  ChatThinkingIndicator: 'Communication',

  // Icons
  Icon: 'Icons',

  // Theming
  ThemeBuilder: 'Theming',
  ThemeScope: 'Theming',

  // Data Visualization
  Chart: 'Data Visualization',
  LineChart: 'Data Visualization',
  BarChart: 'Data Visualization',
  AreaChart: 'Data Visualization',
  PieChart: 'Data Visualization',
  DonutChart: 'Data Visualization',
  FunnelChart: 'Data Visualization',
  Sparkline: 'Data Visualization',
}

const exportLines = parseValueExports(indexSrc)

// Build {ComponentName -> dirName} map from the barrel
const dirByName = new Map()
for (const { names, dir } of exportLines) {
  for (const n of names) {
    if (!dirByName.has(n)) dirByName.set(n, dir)
  }
}

/* ------------------------------------------------------------------ */
/* 4. Configure react-docgen-typescript parser.                        */
/* ------------------------------------------------------------------ */

const parser = docgen.withCustomConfig(join(repoRoot, 'tsconfig.json'), {
  shouldExtractLiteralValuesFromEnum: true,
  shouldRemoveUndefinedFromOptional: true,
  savePropValueAsString: true,
  // Filter inherited HTMLAttributes / DOM noise — keep only props whose
  // owning interface lives inside src/. This is what makes the prop
  // tables actually about the AUTHORED API.
  propFilter: (prop) => {
    if (prop.parent == null) return true
    const file = prop.parent.fileName ?? ''
    // Keep props from src/ files; reject anything in node_modules.
    if (file.includes('node_modules')) return false
    return file.includes('/src/') || !file.includes('node_modules')
  },
})

/* ------------------------------------------------------------------ */
/* 5. Parse every component file. Bucket the docgen results by name.   */
/* ------------------------------------------------------------------ */

/** All files we'll feed to docgen (one big batch for speed). */
const allFiles = componentDirs.flatMap((d) => findComponentFiles(d))

console.log(`[emit-meta] Parsing ${allFiles.length} component .tsx files…`)
const allParsed = parser.parse(allFiles)

/** Map: PascalCase component name -> docgen ComponentDoc */
const docByName = new Map()
for (const doc of allParsed) {
  if (!doc.displayName) continue
  if (docByName.has(doc.displayName)) continue
  docByName.set(doc.displayName, doc)
}

/*
 * Second pass for the `extends` chain (#438). The primary `parser` above
 * strips ALL node_modules-owned props via its propFilter — which is exactly
 * the inherited-parent info the extends chain is built from. So we run a
 * second docgen pass that KEEPS inherited props, and harvest only the
 * distinct React DOM parent-interface names per component (we never surface
 * these props themselves — the prop TABLES still come from the filtered
 * parse). Deterministic: we only read `parent.name` strings.
 */
const extendsParser = docgen.withCustomConfig(join(repoRoot, 'tsconfig.json'), {
  shouldExtractLiteralValuesFromEnum: true,
  shouldRemoveUndefinedFromOptional: true,
  savePropValueAsString: true,
  // Keep everything — we want the inherited DOM parents visible.
})
const allParsedFull = extendsParser.parse(allFiles)

/** Map: component name -> Set of node_modules parent interface names. */
const domParentsByName = new Map()
for (const doc of allParsedFull) {
  if (!doc.displayName) continue
  if (domParentsByName.has(doc.displayName)) continue
  const parents = new Set()
  for (const p of Object.values(doc.props ?? {})) {
    const par = p.parent
    if (par?.fileName && par.fileName.includes('node_modules')) {
      parents.add(par.name)
    }
  }
  domParentsByName.set(doc.displayName, parents)
}

/* ------------------------------------------------------------------ */
/* 6. Build per-component meta entries.                                */
/* ------------------------------------------------------------------ */

/** Scan a file for 'use client' directive (first ~5 non-blank lines). */
function hasUseClientDirective(filePath) {
  if (!existsSync(filePath)) return false
  const lines = readFileSync(filePath, 'utf8').split('\n').slice(0, 20)
  for (const line of lines) {
    const trimmed = line.trim().replace(/[;\n]/g, '')
    if (
      trimmed === "'use client'" ||
      trimmed === '"use client"' ||
      trimmed === "'use client';" ||
      trimmed === '"use client";'
    ) {
      return true
    }
  }
  return false
}

/** Scan for forwardRef + the element type forwarded to. */
function detectForwardRefTarget(source) {
  // forwardRef<HTMLButtonElement, …>
  const m1 = source.match(/forwardRef<\s*([A-Za-z][A-Za-z0-9_]*)/)
  if (m1) return m1[1]
  // React.forwardRef<HTMLButtonElement, …>
  const m2 = source.match(/React\.forwardRef<\s*([A-Za-z][A-Za-z0-9_]*)/)
  if (m2) return m2[1]
  return null
}

/**
 * Detect polymorphism: an `as?:` element-swap prop or an `asChild` slot.
 *
 * We detect the PRESENCE of the `as?:` prop, not its specific type — the
 * library types `as` five different ways (`React.ElementType`, a string-literal
 * union, a generic `as?: E` where `<E extends ElementType>`, and named aliases
 * like `as?: CenterElement`). The old type-specific regexes silently
 * under-reported the generic and named-alias styles (Text/Callout/Container/
 * Center/DatePicker/VisuallyHidden all read `polymorphic: false` despite
 * shipping `as`). Grounding the composition contract in meta requires this to
 * be accurate (#509).
 */
function detectPolymorphic(source) {
  if (/^\s*as\?:/m.test(source)) return true
  if (/\basChild\??:\s*boolean/.test(source)) return true
  return false
}

/**
 * Map docgen prop -> our PropMeta. The `includeDescription` flag controls
 * whether the prop's JSDoc lands in the output — light meta drops it to
 * keep the artifact under its ~50 KB target; verbose keeps it.
 */
function propToMeta(prop, { includeDescription = false } = {}) {
  // react-docgen-typescript wraps string literals in double-quotes already.
  // We pass them through as-is.
  let typeStr = prop.type?.raw ?? prop.type?.name ?? 'unknown'

  let defaultStr = null
  if (prop.defaultValue && prop.defaultValue.value != null) {
    const dv = prop.defaultValue.value
    if (typeof dv === 'string') {
      const stripped = dv.replace(/^['"`]|['"`]$/g, '').trim()
      // "undefined" is JSDoc-noise — it really means "no default"
      if (stripped === 'undefined' || stripped === '') {
        defaultStr = null
      } else if (stripped === 'true' || stripped === 'false') {
        defaultStr = stripped
      } else if (!Number.isNaN(Number(stripped))) {
        defaultStr = stripped
      } else if (/^['"`].*['"`]$/.test(dv)) {
        // Already-quoted string default; keep verbatim
        defaultStr = dv
      } else if (/[\s(),]/.test(stripped)) {
        // Looks like a JSDoc note like `'row' (inherited from flex default)`
        // — keep it raw so the meta consumer can see the maintainer note,
        // but only in verbose. Light strips it.
        defaultStr = includeDescription ? dv : null
      } else {
        defaultStr = `'${stripped}'`
      }
    } else {
      defaultStr = String(dv)
    }
  }

  const out = {
    type: typeStr,
    required: !!prop.required,
    default: defaultStr,
  }
  if (includeDescription && prop.description && prop.description.trim().length > 0) {
    out.description = prop.description.trim()
  }
  return out
}

/**
 * Drop trivially DOM-inherited props (children, className, style, key)
 * from the LIGHT meta so we stay near the size target. They're kept in
 * VERBOSE because they're useful for grounding.
 */
const TRIVIAL_DOM_PROPS = new Set(['children', 'className', 'style', 'key', 'ref'])

/**
 * Best-effort description: first sentence-ish of the file's leading JSDoc
 * block. Skips the directive line if present.
 */
function extractFileDescription(source) {
  const m = source.match(/^\s*(?:'use client';?\s*)?\/\*\*([\s\S]*?)\*\//)
  if (!m) return ''
  const lines = m[1]
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/^\*\s?/, '')
        .replace(/^\* ?/, '')
    )
    .filter(Boolean)
  // Skip the first line if it's just the component name
  let body = lines
  if (body[0] && /^[A-Z][A-Za-z0-9]+\s+Component$/.test(body[0])) {
    body = body.slice(1)
  }
  return body.join(' ').slice(0, 600).trim()
}

/** Curated composition relationships — populated for the obvious pairs. */
const COMPOSES_MAP = {
  Button: {
    leftIcon: { accepts: 'Icon', as: 'ReactNode' },
    rightIcon: { accepts: 'Icon', as: 'ReactNode' },
  },
  IconButton: {
    icon: { accepts: 'Icon', as: 'ReactNode' },
  },
  Card: {
    children: { accepts: 'CardHeader | CardBody | CardFooter', as: 'ReactNode' },
  },
  CardHeader: {
    children: { accepts: 'Text | Heading | Inline', as: 'ReactNode' },
  },
  Tabs: {
    children: { accepts: 'TabList | TabPanel', as: 'ReactNode' },
  },
  TabList: {
    children: { accepts: 'Tab', as: 'ReactNode' },
  },
  Accordion: {
    children: { accepts: 'AccordionItem', as: 'ReactNode' },
  },
  Dropdown: {
    children: { accepts: 'DropdownItem', as: 'ReactNode' },
    trigger: { accepts: 'Button | IconButton', as: 'ReactNode' },
  },
  Breadcrumb: {
    children: { accepts: 'BreadcrumbItem', as: 'ReactNode' },
  },
  Sidebar: {
    children: { accepts: 'SidebarNavItem', as: 'ReactNode' },
  },
  BottomNav: {
    children: { accepts: 'BottomNavItem', as: 'ReactNode' },
  },
  NavTabs: {
    children: { accepts: 'NavTabsItem', as: 'ReactNode' },
  },
  CommandPalette: {
    children: { accepts: 'CommandPaletteGroup | CommandPaletteItem', as: 'ReactNode' },
  },
  Timeline: {
    children: { accepts: 'TimelineItem | TimelineGroup', as: 'ReactNode' },
  },
  RadioGroup: {
    children: { accepts: 'Radio', as: 'ReactNode' },
  },
  AvatarGroup: {
    children: { accepts: 'Avatar', as: 'ReactNode' },
  },
  List: {
    children: { accepts: 'ListItem', as: 'ReactNode' },
  },
  Chat: {
    children: { accepts: 'ChatMessage | ChatThinkingIndicator | ChatInput', as: 'ReactNode' },
  },
  Form: {
    children: { accepts: 'Field', as: 'ReactNode' },
  },
}

/** Curated examples — short, copy-pasteable. Sparse on purpose. */
const EXAMPLES_MAP = {
  Button: [
    { name: 'Primary action', code: '<Button variant="primary">Save</Button>' },
    {
      name: 'Loading state',
      code: '<Button variant="primary" loading>Saving…</Button>',
    },
  ],
  Input: [
    {
      name: 'With label + error',
      code: '<Input label="Email" type="email" error="Required" required />',
    },
  ],
  Stack: [{ name: 'Vertical layout', code: '<Stack gap="md">{children}</Stack>' }],
  Inline: [
    {
      name: 'Distributed row',
      code: '<Inline gap="sm" justify="between" align="center">{children}</Inline>',
    },
  ],
  Card: [
    {
      name: 'Composed card',
      code: '<Card variant="elevated"><CardHeader>Title</CardHeader><CardBody>Body</CardBody></Card>',
    },
  ],
}

/** Known deprecations as of v0.36 (Toast / ToastContainer per #332). */
const DEPRECATIONS = {
  Toast: {
    since: '0.36.0',
    replacedBy: 'useToast() (from ToastProvider)',
    removeAt: '1.0.0',
  },
  ToastContainer: {
    since: '0.36.0',
    replacedBy: 'ToastProvider',
    removeAt: '1.0.0',
  },
}

/** ref target overrides for known cases react-docgen can't see. */
function inferRefFromDoc(doc, source) {
  const raw = detectForwardRefTarget(source)
  if (raw) return raw
  return null
}

/* ------------------------------------------------------------------ */
/* 6b. Component `extends` chain synthesis (schema 1.2, #438).          */
/*                                                                      */
/* Props inherited from React's DOM types carry a `parent` in           */
/* node_modules/@types/react (HTMLAttributes, DOMAttributes,            */
/* AriaAttributes, and element-specific *HTMLAttributes). The primary   */
/* prop-table parse FILTERS these out; the second (un-filtered) parse   */
/* above harvested their names into `domParentsByName`. Here we turn    */
/* that plus the source `extends` clause + the ref target into a stable,*/
/* canonical, sorted extends chain.                                     */
/*                                                                      */
/* Design choices (kept DETERMINISTIC so the drift guard is stable):    */
/*  - Granularity is the GENERIC HTMLAttributes / SVGAttributes family, */
/*    not element-specific (ButtonHTMLAttributes, ...). docgen's        */
/*    element-specific attribution is noisy (shared props like          */
/*    type/value/form cross-contaminate an <input> with                 */
/*    ButtonHTMLAttributes), so we normalize to the generic form and    */
/*    recover the element type param from the source clause / ref.      */
/*  - forwardRef'd components additionally carry RefAttributes<T> (the  */
/*    ref-target block is precedent for cases docgen can't see, e.g.    */
/*    Omit<>-wrapped extends that strip parent linkage).                */
/*  - Output is deduped + alphabetically sorted.                        */
/* ------------------------------------------------------------------ */

/** Internal React-only parent names that are NOT meaningful extends info. */
const REACT_INTERNAL_PARENTS = new Set(['RefAttributes', 'Attributes'])

/** Strip block and line comments so source scans don't match JSDoc examples. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments (incl. JSDoc)
    .replace(/\/\/[^\n]*/g, ' ') // line comments
}

/**
 * Validate that a ref-target token names a concrete DOM element type
 * (HTMLButtonElement, SVGSVGElement, ...). Custom ref aliases like
 * `CardRef` are rejected — we can't know their element, so the type param
 * is dropped and a bare `HTMLAttributes` is emitted instead.
 */
function isDomElementType(name) {
  return typeof name === 'string' && /^(?:HTML|SVG)[A-Za-z]*Element$/.test(name)
}

/**
 * Recover the element type parameter for the DOM-attributes interface by
 * reading the component's props-interface / type declaration from source
 * (comments stripped first, so JSDoc examples don't leak in). Handles the
 * common authored forms:
 *   `extends React.HTMLAttributes<HTMLDivElement>`
 *   `extends Omit<React.HTMLAttributes<HTMLDivElement>, 'x'>`
 *   `extends Omit<React.FormHTMLAttributes<HTMLFormElement>, ...>`
 *   `Omit<React.HTMLAttributes<HTMLOListElement | HTMLUListElement>, ...>`
 * Returns `{ family: 'HTML'|'SVG', element: 'HTMLDivElement'|null }` when a
 * literal *Attributes reference is found in source, else `null`.
 *
 * For a union element param (`HTMLOListElement | HTMLUListElement`) only the
 * first concrete element is kept — the DS uses these where one element type
 * stands in for the family; a single canonical element keeps output stable.
 * Element-specific interfaces are normalized to the generic family; only the
 * `<TElement>` type param is retained.
 */
function extendsFromSource(source) {
  if (!source) return null
  const s = stripComments(source)
  // Match `[Prefix](HTML|SVG)Attributes<TElement[ | ...]>` in an extends /
  // Omit position. Capture the FIRST concrete element inside the type param.
  const re =
    /(?:React\.)?[A-Za-z]*?(HTML|SVG)Attributes\s*<\s*((?:HTML|SVG)[A-Za-z]*Element)(?:\s*\|[^>]*)?>/g
  let m
  while ((m = re.exec(s)) !== null) {
    return { family: m[1], element: m[2] }
  }
  // Fall back: a literal generic `HTMLAttributes` / `SVGAttributes` with no
  // element param (e.g. `extends HTMLAttributes` — rare).
  const bare = s.match(/(?:React\.)?(HTML|SVG)Attributes\b(?!\s*<)/)
  if (bare) return { family: bare[1], element: null }
  return null
}

/**
 * Determine, from the harvested node_modules parent-interface names (from
 * the un-filtered second docgen pass), whether the component inherits ANY
 * React DOM attributes and which family (HTML vs SVG). Returns
 * `{ inherits: boolean, family: 'HTML'|'SVG'|null }`.
 */
function domAttrsFromParents(parentNames) {
  let inherits = false
  let family = null
  if (!parentNames || parentNames.size === 0) return { inherits, family }
  for (const n of parentNames) {
    if (REACT_INTERNAL_PARENTS.has(n)) continue
    // Generic bases + element-specific attributes interfaces all imply the
    // component spreads DOM props.
    const mm = n.match(/^([A-Za-z]*?)(HTML|SVG)Attributes$/)
    if (mm || n === 'DOMAttributes' || n === 'AriaAttributes') {
      inherits = true
      // AriaAttributes / DOMAttributes are family-agnostic; prefer an
      // explicit HTML/SVG signal when present.
      if (mm) family = family ?? mm[2]
    }
  }
  return { inherits, family: family ?? (inherits ? 'HTML' : null) }
}

/**
 * Build the canonical, sorted `extends: string[] | null` chain for a
 * component from its source, the harvested DOM parent names, and the ref
 * target.
 */
function buildExtendsChain({ parentNames, source, refTarget }) {
  const out = new Set()

  // 1. DOM attributes inheritance. Prefer the source `extends` clause (it
  //    carries the exact element type param, even through Omit<>), and fall
  //    back to the harvested docgen parent signal for polymorphic type-
  //    aliases that spread via ComponentPropsWithoutRef<E> (no literal
  //    *Attributes in source, but docgen resolves the base to HTMLAttributes).
  const fromSrc = extendsFromSource(source)
  const fromParents = domAttrsFromParents(parentNames)

  if (fromSrc) {
    const family = fromSrc.family // 'HTML' | 'SVG'
    if (fromSrc.element && isDomElementType(fromSrc.element)) {
      out.add(`${family}Attributes<${fromSrc.element}>`)
    } else if (isDomElementType(refTarget)) {
      out.add(`${family}Attributes<${refTarget}>`)
    } else {
      out.add(`${family}Attributes`)
    }
  } else if (fromParents.inherits) {
    const family = fromParents.family ?? 'HTML'
    // No literal element param in source (polymorphic default element, or a
    // generic base) — attach the ref element if we have a concrete one.
    if (isDomElementType(refTarget)) {
      out.add(`${family}Attributes<${refTarget}>`)
    } else {
      out.add(`${family}Attributes`)
    }
  }

  // 2. forwardRef target → RefAttributes<T>. Only when the ref points at a
  //    concrete DOM element (custom aliases like `CardRef` are skipped).
  if (isDomElementType(refTarget)) {
    out.add(`RefAttributes<${refTarget}>`)
  }

  if (out.size === 0) return null
  return [...out].sort()
}

/* ------------------------------------------------------------------ */
/* 7. Build per-component buckets.                                     */
/* ------------------------------------------------------------------ */

/**
 * Narrow a (possibly multi-component) source file to just the spans that
 * describe `name`: its props-interface header (the `extends …` clause, up to
 * the body `{`) and its own `forwardRef<El, NameProps>` declaration. Keeps the
 * element type-param + ref-target extraction from latching onto a SIBLING
 * component's types in a shared file (e.g. Timeline.tsx declares Timeline,
 * TimelineItem, TimelineGroup). Falls back to the whole source when no
 * name-specific declaration is found (ordinary single-component file). (#438)
 */
function scopeToDeclaration(source, name) {
  if (!source) return source
  const parts = []
  const iface = source.match(new RegExp(`interface\\s+${name}Props\\b[^{]*`))
  if (iface) parts.push(iface[0])
  const fwd = source.match(
    new RegExp(`(?:React\\.)?forwardRef<\\s*[A-Za-z0-9_.]+\\s*,\\s*${name}Props\\s*>`)
  )
  if (fwd) parts.push(fwd[0])
  return parts.length ? parts.join('\n') : source
}

/**
 * Find the `.tsx` in `dir` that actually DECLARES `name` (its forwardRef,
 * function, or props interface) — used for sub-components exported from a
 * shared multi-component file that has no own `<Name>.tsx`. Prevents falling
 * back to the bare `index.ts` re-export, which carries no ref/extends info and
 * produced false-null / element-less extends chains. (#438)
 */
function declaringFileInDir(dir, name) {
  const dirAbs = join(componentsRoot, dir)
  let entries
  try {
    entries = readdirSync(dirAbs)
  } catch {
    return null
  }
  const decl = new RegExp(
    `export\\s+(?:const|function)\\s+${name}\\b` +
      `|forwardRef<[^>]*,\\s*${name}Props\\s*>` +
      `|interface\\s+${name}Props\\b`
  )
  for (const f of entries.filter((e) => e.endsWith('.tsx')).sort()) {
    const abs = join(dirAbs, f)
    if (decl.test(readFileSync(abs, 'utf8'))) return abs
  }
  return null
}

/**
 * Read source for a given component. Prefers an exact `<Name>.tsx`; for a
 * sub-component declared inside a shared multi-component file, resolves to the
 * file that actually declares it; only then falls back to the barrel
 * `index.ts`. Returns the whole `source` (for use-client / polymorphic /
 * description scans) plus a name-`scoped` slice (for element/ref extraction).
 */
function sourceForComponent(name) {
  // `scoped` is name-narrowed ONLY when the component is resolved out of a
  // SHARED multi-component file (no own `<Name>.tsx`). A component with its own
  // file keeps the WHOLE source, because its element type-param may live in a
  // helper alias elsewhere in that file (e.g. Card's CardBaseProps, Field's
  // FieldRootAttributes) that name-scoping would hide. (#438)
  const wrap = (file, doScope) => {
    const source = readFileSync(file, 'utf8')
    return { file, source, scoped: doScope ? scopeToDeclaration(source, name) : source }
  }
  // 1. Same-name file in any dir — whole source.
  for (const d of componentDirs) {
    const file = join(componentsRoot, d, `${name}.tsx`)
    if (existsSync(file)) return wrap(file, false)
  }
  // 2. The directory whose barrel exports the name.
  const dir = dirByName.get(name)
  if (dir) {
    const direct = join(componentsRoot, dir, `${name}.tsx`)
    if (existsSync(direct)) return wrap(direct, false)
    // Sub-component declared in a sibling .tsx (not its own file) → SCOPE it.
    const declFile = declaringFileInDir(dir, name)
    if (declFile) return wrap(declFile, true)
    // Pure re-exporter with no own declaration — last resort, whole source.
    const idx = join(componentsRoot, dir, 'index.ts')
    if (existsSync(idx)) return wrap(idx, false)
  }
  return null
}

const componentsMeta = {}
const componentsVerbose = {}
const rscSafe = []
const clientOnly = []
const polymorphic = []
const withRef = []
const exportedNames = new Set()

for (const { names } of exportLines) {
  for (const n of names) exportedNames.add(n)
}

const sortedNames = [...exportedNames].sort()

for (const name of sortedNames) {
  const src = sourceForComponent(name)
  const doc = docByName.get(name)

  const dirName = dirByName.get(name) ?? name
  const subpath = `./components/${dirName}`

  const useClient = src ? hasUseClientDirective(src.file) : false
  const serverSafe = !useClient
  const isPolymorphic = src ? detectPolymorphic(src.source) : false
  const refTarget = src ? inferRefFromDoc(doc, src.scoped ?? src.source) : null

  const propsLight = {}
  const propsVerbose = {}
  if (doc?.props) {
    // Sort prop names alphabetically for stable diffs.
    const sorted = Object.keys(doc.props).sort()
    for (const k of sorted) {
      // VERBOSE keeps every authored prop verbatim.
      propsVerbose[k] = propToMeta(doc.props[k], { includeDescription: true })
      // LIGHT trims trivially-DOM props to stay near the 50 KB target.
      if (TRIVIAL_DOM_PROPS.has(k)) continue
      propsLight[k] = propToMeta(doc.props[k], { includeDescription: false })
    }
  }

  const category = COMPONENT_CATEGORIES[name] ?? 'Uncategorized'
  const deprecated = DEPRECATIONS[name] ?? null

  // Inherited interface chain (schema 1.2, #438) — canonical + sorted.
  const extendsChain = buildExtendsChain({
    parentNames: domParentsByName.get(name),
    source: src?.scoped ?? src?.source ?? '',
    refTarget,
  })

  const base = {
    kind: 'component',
    category,
    platforms: ['web'],
    serverSafe,
    useClient,
    polymorphic: isPolymorphic,
    ref: refTarget,
    subpath,
    extends: extendsChain,
    deprecated,
  }

  componentsMeta[name] = {
    ...base,
    props: propsLight,
  }

  // Verbose superset
  const description = src ? extractFileDescription(src.source) : ''
  const examples = EXAMPLES_MAP[name] ?? []
  const composes = COMPOSES_MAP[name] ?? null
  componentsVerbose[name] = {
    ...base,
    props: propsVerbose,
    description,
    examples,
    composes,
    appliesClassNames: null,
  }

  if (useClient) clientOnly.push(name)
  else rscSafe.push(name)
  if (isPolymorphic) polymorphic.push(name)
  if (refTarget) withRef.push(name)
}

/* ------------------------------------------------------------------ */
/* 8. Load token registries.                                          */
/*                                                                     */
/*    Most families (colors/spacing/typography/radius/motion) are read */
/*    from the freshly-built dist/tokens.js runtime values.            */
/*                                                                     */
/*    SHADOWS and Z-INDEX are sourced from the shipped CSS             */
/*    (src/styles/tokens.css) instead — that CSS is what the DS        */
/*    actually renders, and the TS token modules (shadows.ts /         */
/*    zIndex.ts) have drifted from it (#451): the TS still carries the */
/*    old ocean-tinted shadow triples + the pre-#35 z-index ordering.  */
/*    Reading shadows/z-index from CSS makes meta.json structurally     */
/*    unable to disagree with the rendered surface.                    */
/* ------------------------------------------------------------------ */

const tokensCssPath = join(repoRoot, 'src', 'styles', 'tokens.css')

/**
 * Extract the body of the FIRST rule whose selector is `selector` (e.g.
 * ':root' or '[data-theme="dark"]') from a CSS source string. Matches the
 * selector only where it is immediately followed by its opening `{` (so
 * mentions of the selector inside comments — or an enclosing `@layer {` —
 * are not mistaken for the rule). Brace-matches the body so nested blocks
 * are handled. Returns '' if not found.
 */
function extractRuleBody(css, selector) {
  // Find `selector` directly followed by optional whitespace and `{`.
  let idx = 0
  let open = -1
  while ((idx = css.indexOf(selector, idx)) !== -1) {
    let j = idx + selector.length
    while (j < css.length && /\s/.test(css[j])) j++
    if (css[j] === '{') {
      open = j
      break
    }
    idx += selector.length
  }
  if (open === -1) return ''
  let depth = 0
  for (let i = open; i < css.length; i++) {
    const c = css[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  return ''
}

/** Collect `--name: value;` custom-property declarations from a rule body. */
function readCustomProps(body) {
  const props = {}
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi
  let m
  while ((m = re.exec(body)) !== null) {
    props[m[1]] = m[2].trim()
  }
  return props
}

/**
 * Split a CSS `box-shadow` value into its comma-separated layers WITHOUT
 * splitting inside function parens (rgba(...), color-mix(...)).
 */
function splitShadowLayers(value) {
  const out = []
  let depth = 0
  let buf = ''
  for (const ch of value) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(buf.trim())
      buf = ''
    } else {
      buf += ch
    }
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

/** Parse a CSS length token like `0`, `1px`, `-6px` → number of px. */
function px(tok) {
  return Number(String(tok).replace('px', ''))
}

/**
 * Parse a single CSS box-shadow layer string into the ShadowLayer object
 * shape used by meta ({ x, y, blur, spread, color, inset? }). Assumes the
 * DS canonical form `[inset] <x> <y> <blur> <spread> <color>` where color
 * may itself contain spaces inside parens (rgba(15, 23, 42, 0.1)).
 */
function parseShadowLayer(layer) {
  let s = layer.trim()
  let inset = false
  if (/^inset\b/.test(s)) {
    inset = true
    s = s.replace(/^inset\b\s*/, '')
  }
  // First four whitespace-separated tokens are the offsets/blur/spread;
  // everything after is the color (which may contain spaces inside parens).
  const m = s.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([\s\S]+)$/)
  if (!m) return null
  const [, x, y, blur, spread, color] = m
  const out = {
    x: px(x),
    y: px(y),
    blur: px(blur),
    spread: px(spread),
    color: color.trim(),
  }
  if (inset) out.inset = true
  return out
}

/** Parse a full CSS box-shadow declaration → ShadowValue (layers[] | 'none'). */
function parseBoxShadow(value) {
  const v = value.trim()
  if (v === 'none' || v === '') return 'none'
  return splitShadowLayers(v)
    .map(parseShadowLayer)
    .filter((l) => l !== null)
}

/* ------------------------------------------------------------------ */
/*  COLOR RESOLUTION (#455)                                            */
/*                                                                    */
/*  The colored shadow family (semantic hover glows) is authored in    */
/*  tokens.css as `color-mix(in oklab, var(--color-X[-base]),          */
/*  transparent 61%)`. Earlier (#451) that couldn't be resolved at     */
/*  emit-time so `colored` fell back to the drifted TS snapshot, which  */
/*  still carried the pre-v0.36 OCEAN tints — meta advertised an ocean  */
/*  glow the brand-neutral default no longer renders (#455).           */
/*                                                                    */
/*  We now resolve those color-mix()/var() chains against the default   */
/*  :root tokens with a minimal, spec-correct OKLab pipeline so         */
/*  `colored` reflects what the DS actually paints by default. The      */
/*  math is anchored by warning/error, whose resolved output must       */
/*  reproduce their existing rgba() literals exactly.                   */
/* ------------------------------------------------------------------ */

const srgbToLinear = (c) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
const linearToSrgb = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055

/** Linear sRGB → OKLab (Björn Ottosson reference matrices). */
function linSrgbToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l_ = Math.cbrt(l),
    m_ = Math.cbrt(m),
    s_ = Math.cbrt(s)
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}
/** OKLab → linear sRGB. */
function oklabToLinSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

const rgbToOklab = (r, g, b, alpha) => ({
  ...linSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)),
  alpha,
})

/** Mix two {L,a,b,alpha} colors in OKLab with premultiplied alpha (CSS spec). */
function mixOklab(ca, cb, wA, wB) {
  const Lp = wA * ca.L * ca.alpha + wB * cb.L * cb.alpha
  const ap = wA * ca.a * ca.alpha + wB * cb.a * cb.alpha
  const bp = wA * ca.b * ca.alpha + wB * cb.b * cb.alpha
  const alpha = wA * ca.alpha + wB * cb.alpha
  if (alpha === 0) return { L: 0, a: 0, b: 0, alpha: 0 }
  return { L: Lp / alpha, a: ap / alpha, b: bp / alpha, alpha }
}

const numOf = (s) => parseFloat(s)

/**
 * Resolve a CSS color expression → {L,a,b,alpha} (OKLab + alpha), following
 * `var(--x)` references against `props` and computing nested `color-mix()`.
 * Supports the subset the DS actually authors: transparent/white/black,
 * oklch()/oklab(), #hex, rgb[a](), var(), and color-mix(in oklab|oklch, …).
 */
function resolveCssColor(value, props, seen = new Set()) {
  const v = String(value).trim()
  const lower = v.toLowerCase()
  if (lower === 'transparent') return { L: 0, a: 0, b: 0, alpha: 0 }
  if (lower === 'white') return rgbToOklab(1, 1, 1, 1)
  if (lower === 'black') return rgbToOklab(0, 0, 0, 1)

  let m = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/i)
  if (m) {
    const key = m[1]
    if (seen.has(key)) throw new Error(`css color cycle at ${key}`)
    const next = new Set(seen).add(key)
    if (props[key] != null) return resolveCssColor(props[key], props, next)
    if (m[2] != null) return resolveCssColor(m[2], props, next)
    throw new Error(`unresolved var(${key})`)
  }

  m = v.match(/^oklch\(\s*([\d.%]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.%]+)\s*)?\)$/i)
  if (m) {
    const L = m[1].endsWith('%') ? numOf(m[1]) / 100 : numOf(m[1])
    const C = numOf(m[2])
    const H = (numOf(m[3]) * Math.PI) / 180
    const alpha = m[4] == null ? 1 : m[4].endsWith('%') ? numOf(m[4]) / 100 : numOf(m[4])
    return { L, a: C * Math.cos(H), b: C * Math.sin(H), alpha }
  }
  m = v.match(/^oklab\(\s*([\d.%]+)\s+([\d.-]+)\s+([\d.-]+)\s*(?:\/\s*([\d.%]+)\s*)?\)$/i)
  if (m) {
    const L = m[1].endsWith('%') ? numOf(m[1]) / 100 : numOf(m[1])
    const alpha = m[4] == null ? 1 : m[4].endsWith('%') ? numOf(m[4]) / 100 : numOf(m[4])
    return { L, a: numOf(m[2]), b: numOf(m[3]), alpha }
  }
  m = v.match(/^#([0-9a-f]{3,8})$/i)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return rgbToOklab(r, g, b, alpha)
  }
  m = v.match(/^rgba?\(([^)]+)\)$/i)
  if (m) {
    const p = m[1].split(/[,/]/).map((s) => s.trim()).filter(Boolean)
    const chan = (t) => (t.endsWith('%') ? numOf(t) * 2.55 : numOf(t)) / 255
    const alpha = p[3] == null ? 1 : p[3].endsWith('%') ? numOf(p[3]) / 100 : numOf(p[3])
    return rgbToOklab(chan(p[0]), chan(p[1]), chan(p[2]), alpha)
  }
  m = v.match(/^color-mix\(\s*in\s+(?:oklab|oklch)\s*,\s*([\s\S]+)\)$/i)
  if (m) {
    const parts = []
    let depth = 0,
      buf = ''
    for (const ch of m[1]) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      if (ch === ',' && depth === 0) {
        parts.push(buf.trim())
        buf = ''
      } else buf += ch
    }
    if (buf.trim()) parts.push(buf.trim())
    if (parts.length !== 2) throw new Error(`color-mix expects 2 colors: ${v}`)
    const split = (p) => {
      const pm = p.match(/\s([\d.]+)%\s*$/)
      return pm
        ? { color: p.slice(0, pm.index).trim(), pct: numOf(pm[1]) }
        : { color: p.trim(), pct: null }
    }
    const A = split(parts[0]),
      B = split(parts[1])
    let wB = B.pct != null ? B.pct : A.pct != null ? 100 - A.pct : 50
    let wA = A.pct != null ? A.pct : 100 - wB
    const sum = wA + wB || 1
    return mixOklab(
      resolveCssColor(A.color, props, seen),
      resolveCssColor(B.color, props, seen),
      wA / sum,
      wB / sum
    )
  }
  throw new Error(`unparseable css color: ${v}`)
}

/** {L,a,b,alpha} → canonical `rgba(r, g, b, a)` string (8-bit channels). */
function oklabToRgbaString(c) {
  const lin = oklabToLinSrgb(c.L, c.a, c.b)
  const clamp = (x) => Math.max(0, Math.min(1, x))
  const ch = (x) => Math.round(clamp(linearToSrgb(clamp(x))) * 255)
  const a = Math.round(c.alpha * 100) / 100
  return `rgba(${ch(lin.r)}, ${ch(lin.g)}, ${ch(lin.b)}, ${a})`
}

/**
 * Resolve the `colored` shadow family from the shipped CSS `--shadow-<fam>`
 * declarations (the source of truth), turning each layer's `color-mix()` /
 * `var()` color into the concrete rgba() the brand-neutral default renders.
 * If a color can't be resolved, keep the literal CSS expression (honest,
 * theme-derived) rather than reintroducing a stale ocean snapshot (#455).
 */
function resolveColoredFromCss(rootProps) {
  const colored = {}
  for (const fam of ['primary', 'success', 'warning', 'error']) {
    const raw = rootProps[`--shadow-${fam}`]
    if (raw == null) continue
    const layers = parseBoxShadow(raw)
    if (layers === 'none') continue
    colored[fam] = layers.map((layer) => {
      try {
        return { ...layer, color: oklabToRgbaString(resolveCssColor(layer.color, rootProps)) }
      } catch (err) {
        console.warn(
          `[emit-meta] shadows.colored.${fam}: could not resolve "${layer.color}" (${err.message}); ` +
            `emitting the literal CSS expression.`
        )
        return layer
      }
    })
  }
  return colored
}

/**
 * Build the shadow families from tokens.css. Returns the same shape the
 * schema/meta expects: { light, dark, colored }. All three are sourced from
 * the shipped CSS (the neutral-default source of truth): `light`/`dark` are
 * parsed directly; `colored` (semantic hover glows) additionally resolves its
 * `color-mix(var(--color-X), transparent 61%)` expressions to the concrete
 * brand-neutral rgba the DS renders (#455 — was previously the drifted OCEAN
 * TS snapshot).
 */
function buildShadowsFromCss(css) {
  const rootProps = readCustomProps(extractRuleBody(css, ':root'))
  const darkProps = readCustomProps(extractRuleBody(css, '[data-theme="dark"]'))

  const RUNGS = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'outline']

  const buildMode = (base, overrides) => {
    const mode = {}
    for (const rung of RUNGS) {
      const key = `--shadow-${rung}`
      // dark only overrides a subset; fall back to the :root (light) value.
      const raw = overrides[key] ?? base[key]
      if (raw == null) continue
      mode[rung] = parseBoxShadow(raw)
    }
    return mode
  }

  return {
    light: buildMode(rootProps, {}),
    dark: buildMode(rootProps, darkProps),
    // #455: resolved from the CSS color-mix chains against the default tokens,
    // so this reflects the brand-neutral glow the DS actually renders.
    colored: resolveColoredFromCss(rootProps),
  }
}

/**
 * Build the z-index scale from tokens.css `--z-index-*` custom properties.
 * The CSS block is the shipped, #35-correct ordering (overlays above modal),
 * unlike the drifted TS zIndex.ts. Deprecated short aliases (--z-header,
 * --z-dropdown, --z-toast) that resolve via `var(...)` are skipped — only the
 * canonical numeric `--z-index-*` scale is surfaced.
 */
function buildZIndexFromCss(css) {
  const rootProps = readCustomProps(extractRuleBody(css, ':root'))
  const z = {}
  for (const [name, value] of Object.entries(rootProps)) {
    const m = name.match(/^--z-index-([a-z0-9-]+)$/)
    if (!m) continue
    const n = Number(value)
    if (Number.isNaN(n)) continue // skip any var()-based aliases
    z[m[1]] = n
  }
  return z
}

async function loadTokens() {
  const distTokens = join(repoRoot, 'dist', 'tokens.js')

  // Shadows + z-index always come from the shipped CSS (source of truth).
  const css = existsSync(tokensCssPath)
    ? readFileSync(tokensCssPath, 'utf8')
    : ''
  if (!css) {
    console.warn(
      `[emit-meta] ${tokensCssPath} missing — shadows/z-index token blocks will be empty.`
    )
  }

  if (!existsSync(distTokens)) {
    console.warn(
      '[emit-meta] dist/tokens.js missing — run `npm run build` first; emitting empty token block.'
    )
    return {
      colors: { semantic: {}, brand: {} },
      spacing: {},
      typography: {},
      radius: {},
      shadows: css ? buildShadowsFromCss(css) : {},
      motion: {},
      zIndex: css ? buildZIndexFromCss(css) : {},
    }
  }
  // Import via file:// URL so node handles ESM resolution cleanly.
  const url = new URL(`file://${distTokens}`).href
  const mod = await import(url)
  const t = mod.tokens ?? mod.default?.tokens ?? {}
  const colors = t.colors ?? {}
  return {
    colors: {
      // semantic ramps (success/warning/error/info) live nested in colors.semantic
      semantic: colors.semantic ?? {},
      // brand ramps are the rest of the palette (ocean, teal, neutral, etc.)
      brand: Object.fromEntries(
        Object.entries(colors).filter(([k]) => k !== 'semantic' && k !== 'dark')
      ),
    },
    spacing: t.spacing ?? {},
    typography: t.typography ?? {},
    radius: t.radius ?? {},
    // Shadows sourced entirely from CSS (neutral slate), not the drifted TS
    // (ocean). `colored` resolves its color-mix() chains to concrete rgba (#455).
    shadows: css ? buildShadowsFromCss(css) : t.shadows ?? {},
    // Motion = animation + transitions in the DS tokens module
    motion: {
      animation: t.animation ?? {},
      transitions: t.transitions ?? {},
      animationPresets: t.animationPresets ?? {},
    },
    // Z-index sourced from CSS (#35-correct ordering); TS zIndex.ts is drifted.
    zIndex: css ? buildZIndexFromCss(css) : {},
  }
}

/**
 * Build the themePresets block (schema 1.1, #437) from the shipped
 * `dist/tokens.js` runtime values (`themePresets` array + the
 * `DEFAULT_THEME_PRESET` sentinel).
 *
 * Returns `{ light, verbose }` sharing one `default` id:
 *   - light  presets: { id, isDefault, description? }
 *   - verbose presets: light + `tokenOverrides` (from `preset.colors`)
 *
 * The DS ships brand-neutral by default since v0.36.0 (DEFAULT_THEME_PRESET
 * is the empty-string sentinel), so we surface a synthetic `brand-neutral`
 * entry as the default (isDefault: true, empty overrides) alongside the
 * named opt-in presets from the array (all isDefault: false). The legacy
 * `ocean` alias is intentionally excluded — it mirrors `lando` and the
 * canonical `themePresets` array omits it as a visual duplicate.
 */
function buildThemePresets(themePresetsArr, defaultPresetSentinel) {
  const DEFAULT_ID = 'brand-neutral'
  // DEFAULT_THEME_PRESET is '' (brand-neutral) since v0.36.0; map the empty
  // sentinel to the stable, meaningful id agents can key on.
  const defaultId =
    defaultPresetSentinel && defaultPresetSentinel.length > 0
      ? defaultPresetSentinel
      : DEFAULT_ID

  const lightPresets = {}
  const verbosePresets = {}

  // Synthetic brand-neutral default: it IS the default, with zero overrides.
  lightPresets[DEFAULT_ID] = {
    id: DEFAULT_ID,
    isDefault: defaultId === DEFAULT_ID,
    description: 'Brand-neutral default palette (no preset applied).',
  }
  verbosePresets[DEFAULT_ID] = {
    ...lightPresets[DEFAULT_ID],
    tokenOverrides: {},
  }

  // Named opt-in presets, sorted by id for deterministic output.
  const sorted = [...(themePresetsArr ?? [])].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  )
  for (const preset of sorted) {
    if (!preset || typeof preset.id !== 'string') continue
    if (preset.id === DEFAULT_ID) continue // never shadow the synthetic default
    const light = {
      id: preset.id,
      isDefault: defaultId === preset.id,
    }
    if (typeof preset.description === 'string' && preset.description.length > 0) {
      light.description = preset.description
    }
    lightPresets[preset.id] = light
    verbosePresets[preset.id] = {
      ...light,
      // Raw token overrides the preset applies (its `colors` map).
      tokenOverrides: preset.colors ?? {},
    }
  }

  return {
    light: { default: defaultId, presets: lightPresets },
    verbose: { default: defaultId, presets: verbosePresets },
  }
}

/**
 * Load the themePresets array + default sentinel from dist/tokens.js and
 * shape them into the meta block. Falls back to an empty (default-only)
 * block if the dist bundle isn't present yet.
 */
async function loadThemePresets() {
  const distTokens = join(repoRoot, 'dist', 'tokens.js')
  if (!existsSync(distTokens)) {
    console.warn(
      '[emit-meta] dist/tokens.js missing — themePresets block will be default-only.'
    )
    return buildThemePresets([], '')
  }
  const url = new URL(`file://${distTokens}`).href
  const mod = await import(url)
  const arr = mod.themePresets ?? mod.default?.themePresets ?? []
  const sentinel = mod.DEFAULT_THEME_PRESET ?? mod.default?.DEFAULT_THEME_PRESET ?? ''
  return buildThemePresets(arr, sentinel)
}

async function loadIcons() {
  const distIcons = join(repoRoot, 'dist', 'icons.js')
  if (!existsSync(distIcons)) {
    console.warn(
      '[emit-meta] dist/icons.js missing — falling back to manual registry parse.'
    )
    // Fallback: parse the registry source for kebab-case keys.
    const regSrc = readFileSync(
      join(componentsRoot, 'Icon', 'registry.ts'),
      'utf8'
    )
    // crude key-name match from the ICON_REGISTRY block
    const match = regSrc.match(/ICON_REGISTRY\s*=\s*\{([\s\S]*?)\}\s*as const/)
    const registry = {}
    let totalCount = 0
    if (match) {
      const keyRe = /['"]?([a-z][a-z0-9-]*)['"]?\s*:\s*([A-Za-z0-9_]+)/g
      let m
      while ((m = keyRe.exec(match[1])) !== null) {
        registry[m[1]] = {
          name: m[1],
          lucideName: m[2],
          category: 'uncategorized',
        }
        totalCount++
      }
    }
    return { totalCount, registry }
  }
  // The icons subpath does NOT export the registry object as a value at
  // runtime via dist — but the registry source itself is the authoritative
  // list. Re-parse from source so we can also bucket by section comments.
  const regSrc = readFileSync(join(componentsRoot, 'Icon', 'registry.ts'), 'utf8')
  // Find the ICON_REGISTRY block and walk lines, tracking section comments.
  const block = regSrc.match(/ICON_REGISTRY\s*=\s*\{([\s\S]*?)\}\s*as const/)
  const registry = {}
  if (block) {
    const lines = block[1].split('\n')
    let currentCategory = 'uncategorized'
    for (const line of lines) {
      const sec = line.match(/^\s*\/\/\s*([^]+?)\s*$/)
      if (sec) {
        // Normalize section comments like "// Navigation & UI" or "// Actions"
        currentCategory = sec[1]
          .replace(/\(.*$/, '') // strip trailing parens
          .trim()
          .toLowerCase()
          .replace(/[&]/g, 'and')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
        continue
      }
      const kv = line.match(/^\s*['"]?([a-z][a-z0-9-]*)['"]?\s*:\s*([A-Za-z0-9_]+)\s*,/)
      if (kv) {
        registry[kv[1]] = {
          name: kv[1],
          lucideName: kv[2],
          category: currentCategory,
        }
      }
    }
  }
  return {
    totalCount: Object.keys(registry).length,
    registry,
  }
}

/* ------------------------------------------------------------------ */
/* 8b. Hooks (#504).                                                    */
/* ------------------------------------------------------------------ */

/**
 * The public hooks surface, barrel-driven from `src/hooks/index.ts`.
 *
 * WHY this exists: the DS shipped four exported, fully-typed hooks that appeared
 * in NO meta section and NO doc — so the MCP server, and any AI agent grounding
 * itself on this artifact, could not see them. A consumer that imports the DS in
 * 77 files still hand-rolled its own 116-LOC `useFocusTrap`, because ours was
 * invisible. Emitting hooks here is what makes the surface discoverable (#504).
 *
 * Signatures come from the EMITTED `dist/hooks/<name>.d.ts` — the canonical,
 * TypeScript-resolved declaration. (The source's multi-line params carry nested
 * parens and arrow types, which are not safely regex-parseable.) `vite build`
 * runs before this script, so those declarations exist. If they don't — a bare
 * `emit-meta` in a fresh checkout — the hook is still emitted with its name,
 * description and category; only `signature`/`returns` are omitted.
 */
function loadHooks() {
  const hooksSrcDir = join(repoRoot, 'src', 'hooks')
  const barrelPath = join(hooksSrcDir, 'index.ts')
  if (!existsSync(barrelPath)) return {}

  // The public surface is exactly what the barrel re-exports (values, not types).
  const barrel = readFileSync(barrelPath, 'utf8')
  const exported = []
  const reExport = /export\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"]/g
  let m
  while ((m = reExport.exec(barrel)) !== null) {
    const file = m[2]
    for (const raw of m[1].split(',')) {
      const spec = raw.trim()
      if (!spec || spec.startsWith('type ')) continue
      const name = (spec.split(/\s+as\s+/).pop() ?? spec).trim()
      if (/^use[A-Z]/.test(name)) exported.push({ name, file })
    }
  }

  const hooks = {}
  for (const { name, file } of exported) {
    const srcPath = ['.ts', '.tsx']
      .map((ext) => join(hooksSrcDir, `${file}${ext}`))
      .find((p) => existsSync(p))
    if (!srcPath) continue
    const source = readFileSync(srcPath, 'utf8')

    const entry = {
      kind: 'hook',
      category: extractJsdocTag(source, 'category') ?? 'utility',
      // Every React hook needs client-runtime state — none are server-safe.
      serverSafe: false,
      useClient: /^\s*['"]use client['"]/m.test(source),
      subpath: `${pkg.name}/hooks`,
      description: extractHookDescription(source),
    }

    const dtsPath = join(repoRoot, 'dist', 'hooks', `${file}.d.ts`)
    if (existsSync(dtsPath)) {
      const parsed = signatureFromDts(readFileSync(dtsPath, 'utf8'), name)
      if (parsed) {
        entry.signature = parsed.signature
        if (parsed.returns) entry.returns = parsed.returns
      }
    }
    hooks[name] = entry
  }
  return hooks
}

/** Read a `@tag value` from anywhere in the file's JSDoc. */
function extractJsdocTag(source, tag) {
  const m = source.match(new RegExp(`@${tag}\\s+([^\\n*]+)`))
  return m ? m[1].trim() : null
}

/**
 * A hook's description: the leading JSDoc PROSE only, stopping at the first
 * `@tag`. (The shared `extractFileDescription` keeps going, so a component's
 * description swallows its `@example` code — pre-existing behaviour we don't
 * churn here. Hook descriptions are the whole point of #504's discoverability
 * fix, so they get a clean one: an AI agent reading `meta.hooks` should see
 * prose, not a code block.)
 */
function extractHookDescription(source) {
  const m = source.match(/^\s*(?:['"]use client['"];?\s*)?\/\*\*([\s\S]*?)\*\//)
  if (!m) return ''
  const lines = []
  for (const raw of m[1].split('\n')) {
    const line = raw.trim().replace(/^\*\s?/, '')
    if (/^@\w+/.test(line)) break
    lines.push(line)
  }
  return lines.filter(Boolean).join(' ').slice(0, 600).trim()
}

/**
 * Pull `useX(...): Ret` out of an emitted declaration. Scans BALANCED parens so
 * an arrow-typed param (`cb: (e: Event) => void`) can't truncate the signature.
 */
function signatureFromDts(dts, name) {
  const at = dts.indexOf(`declare function ${name}`)
  if (at === -1) return null
  const open = dts.indexOf('(', at)
  if (open === -1) return null

  let depth = 0
  let i = open
  for (; i < dts.length; i++) {
    if (dts[i] === '(') depth++
    else if (dts[i] === ')') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  // Terminate at the statement `;` — but only one at brace/bracket/paren depth
  // 0. A return type can be an INLINE OBJECT (`{ x: number; y: number }`) whose
  // internal `;` must NOT truncate the signature. (#504 skeptic defect 3a: the
  // first-`;` terminator lost `useClipboard`'s copied/error/reset, etc.)
  let d = 0
  let stop = dts.length
  for (let j = i; j < dts.length; j++) {
    const ch = dts[j]
    if (ch === '{' || ch === '[' || ch === '(') d++
    else if (ch === '}' || ch === ']' || ch === ')') d--
    else if (ch === ';' && d === 0) {
      stop = j
      break
    }
  }
  const collapse = (s) => s.replace(/\s+/g, ' ').trim()

  return {
    signature: collapse(dts.slice(dts.indexOf(name, at), stop)),
    // Everything after the balanced params close, minus the leading `:`.
    returns: collapse(dts.slice(i, stop).replace(/^\s*:\s*/, '')) || null,
  }
}

/* ------------------------------------------------------------------ */
/* 9. Compose final meta and write.                                    */
/* ------------------------------------------------------------------ */

const tokens = await loadTokens()
const icons = await loadIcons()
const themePresets = await loadThemePresets()
const hooks = loadHooks()

const capabilities = {
  rscSafe: rscSafe.sort(),
  clientOnly: clientOnly.sort(),
  polymorphic: polymorphic.sort(),
  withRef: withRef.sort(),
}

const lightMeta = {
  // 1.3 adds the `hooks` section (#504).
  $schemaVersion: '1.3',
  package: packageMeta,
  components: componentsMeta,
  hooks,
  tokens,
  icons,
  exports: exportsMeta,
  capabilities,
  themePresets: themePresets.light,
}

const verboseMeta = {
  ...lightMeta,
  components: componentsVerbose,
  // Verbose presets carry tokenOverrides on top of the light preset shape.
  themePresets: themePresets.verbose,
}

// Validate both
for (const [label, m] of [
  ['light', lightMeta],
  ['verbose', verboseMeta],
]) {
  if (!validate(m)) {
    console.error(`[emit-meta] Schema validation FAILED for ${label} meta:`)
    console.error(JSON.stringify(validate.errors, null, 2).slice(0, 4000))
    process.exit(1)
  }
}

const distDir = join(repoRoot, 'dist')
const lightPath = join(distDir, 'meta.json')
const verbosePath = join(distDir, 'meta.verbose.json')

// Minified for shipped artifacts: the schema is consumed programmatically
// (by AI agents, validators, build tools), not eyeballed. Skipping pretty-
// print roughly halves the wire size of meta.json without affecting
// content — JSON.parse normalizes whitespace anyway.
const lightStr = JSON.stringify(lightMeta) + '\n'
const verboseStr = JSON.stringify(verboseMeta) + '\n'

if (checkOnly) {
  let drift = false
  if (!existsSync(lightPath) || readFileSync(lightPath, 'utf8') !== lightStr) {
    console.error('[emit-meta] DRIFT: dist/meta.json out of date')
    drift = true
  }
  if (!existsSync(verbosePath) || readFileSync(verbosePath, 'utf8') !== verboseStr) {
    console.error('[emit-meta] DRIFT: dist/meta.verbose.json out of date')
    drift = true
  }
  process.exit(drift ? 1 : 0)
}

writeFileSync(lightPath, lightStr, 'utf8')
writeFileSync(verbosePath, verboseStr, 'utf8')

const kb = (str) => (str.length / 1024).toFixed(1)
console.log(
  `[emit-meta] Wrote dist/meta.json (${kb(lightStr)} KB, ${
    Object.keys(componentsMeta).length
  } components)`
)
console.log(
  `[emit-meta] Wrote dist/meta.verbose.json (${kb(verboseStr)} KB, ${
    Object.keys(componentsVerbose).length
  } components)`
)
console.log(
  `[emit-meta] capabilities: rscSafe=${capabilities.rscSafe.length}, clientOnly=${capabilities.clientOnly.length}, polymorphic=${capabilities.polymorphic.length}, withRef=${capabilities.withRef.length}`
)
console.log(`[emit-meta] icons: ${icons.totalCount}`)
