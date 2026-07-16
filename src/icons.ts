/**
 * Lando Labs Design System — `/icons` subpath entry (#376).
 *
 * Single source of truth for the lucide-react icon set the DS bundles +
 * a string-keyed resolver for serialized nav/menu/command-palette configs.
 *
 * Consumers should import from this subpath instead of taking a direct
 * dependency on `lucide-react`, which removes the version-skew risk that
 * surfaced in a consumer app (the consumer pinned `^1.8.0`, DS uses `^0.548.0`).
 *
 * @example
 * // Direct named import — pass the component to <Icon>:
 * import { Search } from '@lando-labs/lando-ds/icons'
 * import { Icon } from '@lando-labs/lando-ds'
 * <Icon size="md"><Search /></Icon>
 *
 * @example
 * // String-keyed resolver — for serialized nav/command/menu configs:
 * import { getIcon, type CuratedIconName } from '@lando-labs/lando-ds/icons'
 * const cmd = { id: 'search', icon: 'search' as CuratedIconName }
 * const Component = getIcon(cmd.icon)
 * Component && <Component />
 *
 * @example
 * // Polymorphic <Icon name="…"> — same name map, no manual resolution:
 * import { Icon } from '@lando-labs/lando-ds'
 * <Icon name="search" size="md" />
 *
 * @see https://lucide.dev for the full icon catalog. Icons not listed in the
 *      curated set are still importable from `lucide-react` directly, but
 *      consumers are encouraged to add them here when adopted broadly.
 */

// Re-export the curated lucide set verbatim so consumers can do
// `import { Search } from '@lando-labs/lando-ds/icons'` and never pin
// lucide themselves. Keep this list in sync with the curated re-export in
// `src/components/Icon/index.ts`.
export {
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

  // Exploration / lifestyle (added per #376 — lab editorial surfaces)
  Compass,
  Coffee,

  // App-shell affordances (added per #383 — lab follow-ups)
  LayoutDashboard,
  BarChart3,
  BookOpen,
  GitBranch,
  Sparkles,
  Wrench,
  Puzzle,
  CheckSquare,
} from 'lucide-react'

// Re-export the Icon component + types so consumers using ONLY the icons
// subpath have everything they need without a second import line. (The same
// component is also exported from the root `@lando-labs/lando-ds`
// barrel; this is purely a DX convenience for nav/menu config callers.)
export { Icon } from './components/Icon/Icon'
export type { IconProps } from './components/Icon/Icon'

// And the resolver + name type for serialized configs.
export { getIcon, ICON_REGISTRY } from './components/Icon/registry'
export type { CuratedIconName } from './components/Icon/registry'
