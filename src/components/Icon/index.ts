export { Icon } from './Icon'
export type { IconProps, IconName } from './Icon'

// Name-keyed resolver + registry (#376) — for serialized nav/menu/command
// configs that store icons as strings instead of component references.
export { getIcon, ICON_REGISTRY } from './registry'
export type { CuratedIconName } from './registry'

// ---------------------------------------------------------------------------
// Curated icon re-exports
//
// A hand-picked subset of Lucide icons commonly needed across Lando Labs
// applications. Import these for zero-config convenience without the wildcard
// bundle hit.
//
// For icons not listed here, import directly from the DS-bundled subpath
// (preferred, no version skew) or from 'lucide-react' directly:
//   import { SomeIcon } from '@lando-labs/lando-ds/icons'
//   <Icon size="md"><SomeIcon /></Icon>
// ---------------------------------------------------------------------------

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
  // Added per #383 — common UI affordances
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
  // Added per #376 — editorial / chat surfaces
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

  // Exploration / lifestyle — added per #376
  Compass,
  Coffee,

  // App-shell affordances — added per #383 (generic cross-product utility)
  LayoutDashboard,
  BarChart3,
  BookOpen,
  GitBranch,
  Sparkles,
  Wrench,
  Puzzle,
  CheckSquare,
} from 'lucide-react'
