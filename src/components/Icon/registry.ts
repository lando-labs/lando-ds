/**
 * Icon name → component registry (#376).
 *
 * String-keyed map over the curated lucide-react set the DS bundles. Lets
 * consumers store icon references as plain strings in serialized configs
 * (nav routes, command palette entries, menu items) and resolve to a real
 * React component at render time.
 *
 * The map is `as const` so `CuratedIconName` is the LITERAL union of valid
 * keys — typos fail to compile, autocomplete works in IDEs that walk the
 * generic, and `getIcon(name)` returns `LucideIcon | null` with no `any`.
 *
 * Keys are lowercase kebab-case (`message-square`, `external-link`) to read
 * naturally in JSON configs. Both kebab-case and the lucide PascalCase
 * spellings (`MessageSquare`) are accepted for ergonomic flexibility, but
 * the canonical key is kebab-case.
 */

import {
  // Navigation & UI
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ExternalLink,

  // Actions
  Search,
  Plus,
  Minus,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Send,
  Filter,
  Save,
  MoreHorizontal,
  MoreVertical,

  // Status & Feedback
  Check,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  Loader2,

  // Content & Media
  Star,
  Heart,
  Bookmark,
  Link,
  MessageSquare,
  Quote,

  // People & Identity
  User,
  Users,

  // System
  Settings,
  Calendar,
  Clock,
  Bell,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  LogOut,
  Sun,
  Moon,
  Monitor,
  File,
  Folder,
  Image,

  // Exploration / lifestyle (#376 — editorial surfaces)
  Compass,
  Coffee,

  // App-shell affordances (#383 — generic cross-product utility)
  LayoutDashboard,
  BarChart3,
  BookOpen,
  GitBranch,
  Sparkles,
  Wrench,
  Puzzle,
  CheckSquare,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Canonical kebab-case → component map.
 *
 * `as const` pins the value types so `CuratedIconName` is a literal union.
 * `Record<string, LucideIcon>` would erase the keys — keep this object
 * literal-typed.
 */
export const ICON_REGISTRY = {
  // Navigation & UI
  menu: Menu,
  x: X,
  close: X,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'external-link': ExternalLink,

  // Actions
  search: Search,
  plus: Plus,
  minus: Minus,
  edit: Edit,
  trash: Trash2,
  copy: Copy,
  download: Download,
  upload: Upload,
  refresh: RefreshCw,
  send: Send,
  filter: Filter,
  save: Save,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,

  // Status & Feedback
  check: Check,
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  info: Info,
  'x-circle': XCircle,
  loader: Loader2,

  // Content & Media
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  link: Link,
  message: MessageSquare,
  'message-square': MessageSquare,
  quote: Quote,

  // People & Identity
  user: User,
  users: Users,

  // System
  settings: Settings,
  calendar: Calendar,
  clock: Clock,
  bell: Bell,
  eye: Eye,
  'eye-off': EyeOff,
  lock: Lock,
  unlock: Unlock,
  logout: LogOut,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  file: File,
  folder: Folder,
  image: Image,
  home: Folder, // editorial alias — many command palettes ask for "home"

  // Exploration / lifestyle
  compass: Compass,
  coffee: Coffee,

  // App-shell affordances (#383 — generic cross-product utility)
  dashboard: LayoutDashboard,
  'layout-dashboard': LayoutDashboard,
  'bar-chart': BarChart3,
  'bar-chart-3': BarChart3,
  'book-open': BookOpen,
  'git-branch': GitBranch,
  sparkles: Sparkles,
  wrench: Wrench,
  puzzle: Puzzle,
  'check-square': CheckSquare,
} as const

/**
 * Literal union of every valid curated icon name. Use in nav/menu/command
 * configs typed against the DS:
 *
 * @example
 * type NavItem = { id: string; icon?: CuratedIconName }
 */
export type CuratedIconName = keyof typeof ICON_REGISTRY

/** PascalCase aliases — accept either casing from JSON configs. */
const PASCAL_ALIASES: Record<string, CuratedIconName> = {
  Menu: 'menu',
  X: 'x',
  Close: 'close',
  ChevronDown: 'chevron-down',
  ChevronUp: 'chevron-up',
  ChevronLeft: 'chevron-left',
  ChevronRight: 'chevron-right',
  ArrowLeft: 'arrow-left',
  ArrowRight: 'arrow-right',
  ArrowUp: 'arrow-up',
  ArrowDown: 'arrow-down',
  ExternalLink: 'external-link',
  Search: 'search',
  Plus: 'plus',
  Minus: 'minus',
  Edit: 'edit',
  Trash2: 'trash',
  Trash: 'trash',
  Copy: 'copy',
  Download: 'download',
  Upload: 'upload',
  RefreshCw: 'refresh',
  Refresh: 'refresh',
  Send: 'send',
  Filter: 'filter',
  Save: 'save',
  MoreHorizontal: 'more-horizontal',
  MoreVertical: 'more-vertical',
  Check: 'check',
  CheckCircle: 'check-circle',
  AlertCircle: 'alert-circle',
  AlertTriangle: 'alert-triangle',
  Info: 'info',
  XCircle: 'x-circle',
  Loader2: 'loader',
  Loader: 'loader',
  Star: 'star',
  Heart: 'heart',
  Bookmark: 'bookmark',
  Link: 'link',
  MessageSquare: 'message-square',
  Quote: 'quote',
  User: 'user',
  Users: 'users',
  Settings: 'settings',
  Calendar: 'calendar',
  Clock: 'clock',
  Bell: 'bell',
  Eye: 'eye',
  EyeOff: 'eye-off',
  Lock: 'lock',
  Unlock: 'unlock',
  LogOut: 'logout',
  Sun: 'sun',
  Moon: 'moon',
  Monitor: 'monitor',
  File: 'file',
  Folder: 'folder',
  Image: 'image',
  Home: 'home',
  Compass: 'compass',
  Coffee: 'coffee',
  LayoutDashboard: 'layout-dashboard',
  Dashboard: 'dashboard',
  BarChart3: 'bar-chart-3',
  BarChart: 'bar-chart',
  BookOpen: 'book-open',
  GitBranch: 'git-branch',
  Sparkles: 'sparkles',
  Wrench: 'wrench',
  Puzzle: 'puzzle',
  CheckSquare: 'check-square',
}

/**
 * Look up an icon component by its kebab-case name (or its PascalCase lucide
 * spelling, accepted as a convenience). Returns the component or `null` if
 * the name isn't in the curated set.
 *
 * In development, an unknown name logs a `console.warn` once so misspellings
 * surface during local iteration. Production builds stay silent to avoid
 * spamming the console with consumer-supplied data.
 *
 * @example
 * const Component = getIcon('search')
 * Component && <Component size={16} />
 *
 * @example
 * // PascalCase from a config file generated against the lucide registry:
 * getIcon('MessageSquare') === getIcon('message-square') // true
 *
 * @example
 * // Unknown names return null; render a fallback or skip:
 * const Component = getIcon('teleporter')
 * if (!Component) return null
 */
export function getIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null

  // Try direct kebab-case lookup first.
  if (name in ICON_REGISTRY) {
    return ICON_REGISTRY[name as CuratedIconName]
  }

  // Try PascalCase alias.
  const alias = PASCAL_ALIASES[name]
  if (alias) {
    return ICON_REGISTRY[alias]
  }

  // Unknown name — warn once in dev, fall through.
  if (process.env.NODE_ENV !== 'production') {
    warnUnknownIcon(name)
  }
  return null
}

/**
 * Track names we've already warned about so a rendering loop over a config
 * full of typos doesn't spam the console.
 */
const warnedNames = new Set<string>()
function warnUnknownIcon(name: string): void {
  if (warnedNames.has(name)) return
  warnedNames.add(name)
  console.warn(
    `[Lando Labs DS] getIcon: unknown icon name "${name}". ` +
      `Valid names are listed in src/components/Icon/registry.ts (ICON_REGISTRY). ` +
      `For icons outside the curated set, import directly from ` +
      `'@lando-labs/lando-ds/icons' and pass the component as children.`,
  )
}
