/**
 * Lando Labs Design System - Components
 */

export { Button } from './Button'
export type { ButtonProps } from './Button'

export { Input } from './Input'
export type { InputProps } from './Input'

// NumberInput — Sprint 54 #309 (numeric input with steppers + clamping)
export { NumberInput } from './NumberInput'
export type { NumberInputProps } from './NumberInput'

// FileInput — Sprint 55 #316 (drag-drop dropzone with paste + validation)
export { FileInput } from './FileInput'
export type {
  FileInputProps,
  FileRejection,
  FileRejectionReason,
} from './FileInput'

export { Heading } from './Heading'
export type { HeadingProps } from './Heading'

export { Text } from './Text'
export type { TextProps } from './Text'

export { Card, CardHeader, CardBody, CardFooter, CardTitle, CardMedia } from './Card'
export type { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps, CardTitleProps, CardMediaProps, CardMediaPosition } from './Card'

export { Badge } from './Badge'
export type { BadgeProps, BadgeColorScheme } from './Badge'

export { Chip } from './Chip'
export type { ChipProps } from './Chip'

export { Avatar } from './Avatar'
export type { AvatarProps } from './Avatar'

export { Modal } from './Modal'
export type { ModalProps } from './Modal'

// AlertDialog — Sprint 54 #314 (role-aware destructive-confirm primitive)
export { AlertDialog } from './AlertDialog'
export type { AlertDialogProps } from './AlertDialog'

export { Drawer } from './Drawer'
export type { DrawerProps, DrawerPlacement, DrawerSize } from './Drawer'

export { Toast, ToastContainer, ToastProvider, useToast } from './Toast'
export type {
  ToastProps,
  ToastContainerProps,
  ToastPosition,
  ToastProviderProps,
  ToastProviderPosition,
  ToastConfig,
  ToastVariant,
  UseToastReturn,
} from './Toast'

export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'

export { Tabs, TabList, Tab, TabPanel } from './Tabs'
export type { TabsProps, TabListProps, TabProps, TabPanelProps } from './Tabs'

export { Select } from './Select'
export type { SelectProps, SelectOption } from './Select'

// Combobox + MultiSelect — Sprint 54 #310 (searchable single/multi-select)
export { Combobox, MultiSelect } from './Combobox'
export type {
  ComboboxOption,
  ComboboxProps,
  ComboboxSize,
  MultiSelectProps,
} from './Combobox'

export { Checkbox } from './Checkbox'
export type { CheckboxProps } from './Checkbox'

export { Radio, RadioGroup } from './Radio'
export type { RadioProps, RadioGroupProps } from './Radio'

export { Switch } from './Switch'
export type { SwitchProps } from './Switch'

// Slider — Sprint 54 #308 (new component: single + range modes, full a11y)
export { Slider } from './Slider'
export type { SliderProps, SliderValue } from './Slider'

export { Textarea } from './Textarea'
export type { TextareaProps } from './Textarea'

export { TagInput } from './TagInput'
export type { TagInputProps } from './TagInput'

// Form + Field — Sprint 55 #313 (native-validation form abstraction;
// Conform integration deferred to follow-up — see Form.tsx ARCHITECTURE NOTE)
export { Form, useFormContext } from './Form'
export type { FormProps, FormValidator, FormContextValue } from './Form'

export { Field } from './Field'
export type { FieldProps, FieldChildProps } from './Field'

export { Progress } from './Progress'
export type { ProgressProps } from './Progress'

export { StepProgress } from './StepProgress'
export type {
  StepProgressProps,
  StepProgressStep,
  StepStatus,
  StepProgressOrientation,
  StepProgressVariant,
} from './StepProgress'

export { Accordion, AccordionItem } from './Accordion'
export type { AccordionProps, AccordionItemProps } from './Accordion'

export { Portal } from './Portal'
export type { PortalProps } from './Portal'

export { Slot } from './Slot'
export type { SlotProps } from './Slot'

export { Alert } from './Alert'
export type { AlertProps } from './Alert'

export { Callout } from './Callout'
export type { CalloutProps, CalloutAccent } from './Callout'

export { Banner } from './Banner'
export type { BannerProps } from './Banner'

export { Skeleton } from './Skeleton'
export type { SkeletonProps } from './Skeleton'

export { Spinner } from './Spinner'
export type { SpinnerProps } from './Spinner'

// StatusDot — Sprint 19 #108
export { StatusDot } from './StatusDot'
export type {
  StatusDotProps,
  StatusDotVariant,
  StatusDotSize,
} from './StatusDot'

export { Breadcrumb, BreadcrumbItem } from './Breadcrumb'
export type { BreadcrumbProps, BreadcrumbItemProps } from './Breadcrumb'

export { Pagination } from './Pagination'
export type { PaginationProps } from './Pagination'

export { Divider } from './Divider'
export type { DividerProps } from './Divider'

export { StickyBar } from './StickyBar'
export type { StickyBarProps } from './StickyBar'

export { Table } from './Table'
export type { TableProps, Column } from './Table'

// DataTable + DataTable.Static — Sprint 55 #311 (sortable/pageable/selectable
// data table; Static is the SSR-safe read-only variant)
export { DataTable, DataTableStatic } from './DataTable'
export type {
  DataTableProps,
  DataTableColumn,
  DataTableSort,
  DataTableSortDirection,
  DataTableStaticProps,
} from './DataTable'

export { List, ListItem } from './List'
export type { ListProps, ListItemProps } from './List'

export { StatCard } from './StatCard'
export type { StatCardProps } from './StatCard'

export { TaskCard } from './TaskCard'
export type { TaskCardProps } from './TaskCard'

export { DetailCard } from './DetailCard'
export type { DetailCardProps, DetailField, DetailDate } from './DetailCard'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { Timeline, TimelineItem, TimelineGroup } from './Timeline'
export type {
  TimelineProps,
  TimelineItemProps,
  TimelineGroupProps,
  TimelineStatus,
} from './Timeline'

export { Dropdown, DropdownItem } from './Dropdown'
export type { DropdownProps, DropdownItemProps } from './Dropdown'

export { Popover } from './Popover'
export type { PopoverProps } from './Popover'

export { Header } from './Header'
export type { HeaderProps } from './Header'

export { Sidebar } from './Sidebar'
export type { SidebarProps } from './Sidebar'
export { SidebarNavItem } from './Sidebar'
export type { SidebarNavItemProps } from './Sidebar'

export { Footer } from './Footer'
export type { FooterProps, FooterColumn, FooterLink, FooterSocial } from './Footer'

// BottomNav — Sprint 17 #82
export { BottomNav, BottomNavItem } from './BottomNav'
export type { BottomNavProps, BottomNavItemProps } from './BottomNav'

export { PageHeader } from './PageHeader'
export type { PageHeaderProps } from './PageHeader'

export { AppShell } from './AppShell'
export type { AppShellProps } from './AppShell'

export { CodeBlock } from './CodeBlock'
export type { CodeBlockProps } from './CodeBlock'

export { Markdown } from './Markdown'
export type { MarkdownProps } from './Markdown'

// MarkdownEditor is NOT exported from this barrel. It transitively imports
// `@uiw/react-md-editor`, which touches `document` at module evaluation —
// breaking Next.js App Router SSR for any consumer that imports anything
// else from `@lando-labs/lando-ds` or `/components`. Import via the
// dedicated subpath instead:
//
//   import { MarkdownEditor } from '@lando-labs/lando-ds/markdown-editor'
//
// In Next.js App Router, also wrap with `next/dynamic({ ssr: false })`
// because the underlying CodeMirror editor is browser-only.

export { ThemeBuilder } from './ThemeBuilder'
export type { ThemeBuilderProps, Theme } from './ThemeBuilder'

// ThemeScope — Sprint 55 #395 (scoped subtree theming via wrapper element)
export { ThemeScope } from './ThemeScope'
export type { ThemeScopeProps } from './ThemeScope'

export { Chat, ChatMessage, ChatInput, ChatThinkingIndicator } from './Chat'
export type { ChatProps, ChatMessageProps, ChatInputProps, ChatThinkingIndicatorProps, Message } from './Chat'

// Re-exports the Icon wrapper component AND the curated ~45 lucide icons
// from `./Icon` so consumers can `import { Search, Check } from '@lando-labs/lando-ds/components'`
export * from './Icon'

// IconButton
export { IconButton } from './IconButton'
export type { IconButtonProps } from './IconButton'

export { SegmentedControl } from './SegmentedControl'
export type { SegmentedControlProps, SegmentedControlOption } from './SegmentedControl'

export { ApprovalCard } from './ApprovalCard'
export type { ApprovalCardProps, ApprovalMetadata } from './ApprovalCard'

// ArticleCard — Sprint 15 #94
export { ArticleCard, Byline, Lede, PullQuote } from './ArticleCard'
export type {
  ArticleCardProps,
  ArticleCardScale,
  ArticleCardHeadingLevel,
  BylineProps,
  LedeProps,
  PullQuoteProps,
} from './ArticleCard'

export { Container } from './Container'
export type { ContainerProps } from './Container'

export { Grid } from './Grid'
export type { GridProps, GridGapAxes } from './Grid'

// GridItem — item-level sizing for `<Grid>` (#374)
export { GridItem } from './GridItem'
export type { GridItemProps, GridItemSpan } from './GridItem'

export { Stack } from './Stack'
export type { StackProps } from './Stack'

export { Inline } from './Inline'
export type { InlineProps } from './Inline'

export { Box } from './Box'
export type { BoxProps } from './Box'

export { Chart } from './Chart'
export type { ChartProps, BaseChartProps, ChartConfigProps, ColorScheme, LegendPosition, ChartTheme } from './Chart'
export { getChartColors, getChartTheme, formatChartValue, generateSampleData } from './Chart'

export { LineChart } from './LineChart'
export type { LineChartProps } from './LineChart'

export { BarChart } from './BarChart'
export type { BarChartProps } from './BarChart'

export { AreaChart } from './AreaChart'
export type { AreaChartProps } from './AreaChart'

export { PieChart } from './PieChart'
export type { PieChartProps } from './PieChart'

export { DonutChart } from './DonutChart'
export type { DonutChartProps } from './DonutChart'

export { FunnelChart } from './FunnelChart'
export type { FunnelChartProps, FunnelStage } from './FunnelChart'

export { Sparkline } from './Sparkline'
export type {
  SparklineProps,
  SparklineDataPoint,
  SparklineColor,
  SparklineColorVariant,
} from './Sparkline'

export { Kbd } from './Kbd'
export type { KbdProps } from './Kbd'

// ColorSwatch — Sprint 49 #379 (accessible color-preview primitive)
export { ColorSwatch } from './ColorSwatch'
export type {
  ColorSwatchProps,
  ColorSwatchShape,
  ColorSwatchSize,
} from './ColorSwatch'

// NavTabs — Sprint 50 #377 (horizontal area-switcher for top-bars)
export { NavTabs, NavTabsItem } from './NavTabs'
export type { NavTabsProps, NavTabsItemProps } from './NavTabs'

// CommandPalette — Sprint 50 #378 (first-class ⌘K palette primitive)
export {
  CommandPalette,
  CommandPaletteGroup,
  CommandPaletteItem,
} from './CommandPalette'
export type {
  CommandPaletteProps,
  CommandPaletteGroupProps,
  CommandPaletteItemProps,
} from './CommandPalette'

// DateDisplay — Sprint 55 #312 (read-only formatted-date surface; first in DatePicker family)
export { DateDisplay } from './DatePicker'
export type { DateDisplayProps, DateValue } from './DatePicker'

// Calendar — Sprint 56 #312 (standalone month-grid picker; second in DatePicker family)
export { Calendar } from './DatePicker'
export type { CalendarProps } from './DatePicker'

// DatePicker — Sprint 56 #312 (input + Calendar-anchored popover; third in DatePicker family)
export { DatePicker } from './DatePicker'
export type { DatePickerProps, DatePickerSize } from './DatePicker'

// DateRangePicker — Sprint 56 #312 (popover-anchored two-end calendar)
export { DateRangePicker } from './DatePicker'
export type { DateRangePickerProps } from './DatePicker'

// Sprint 53 #307 — trivial backfill primitives.
export { AspectRatio } from './AspectRatio'
export type { AspectRatioProps } from './AspectRatio'

export { VisuallyHidden } from './VisuallyHidden'
export type { VisuallyHiddenProps } from './VisuallyHidden'

export { Code } from './Code'
export type { CodeProps } from './Code'

export { Center } from './Center'
export type { CenterProps } from './Center'

export { Spacer } from './Spacer'
export type { SpacerProps } from './Spacer'

export { Mark } from './Mark'
export type { MarkProps } from './Mark'

export { AvatarGroup } from './AvatarGroup'
export type { AvatarGroupProps, AvatarGroupSize } from './AvatarGroup'

export { Collapsible } from './Collapsible'
export type { CollapsibleProps } from './Collapsible'

// ScrollArea — Sprint 55 #315 (custom-scrollbar wrapper, token-driven)
export { ScrollArea } from './ScrollArea'
export type {
  ScrollAreaProps,
  ScrollAreaMode,
  ScrollAreaVisibility,
  ScrollAreaOrientation,
} from './ScrollArea'
