/**
 * Lando Labs Design System - Z-Index Tokens
 * Layering system for stacking context control
 *
 * Philosophy:
 * - Clear hierarchy prevents z-index chaos
 * - Semantic names instead of magic numbers
 * - Increments of 10 allow for intermediate values if needed
 * - Higher values for overlays and notifications
 */

export const zIndex = {
  // Base content layers
  base: 0,              // Default layer
  below: -1,            // Below base (backgrounds, decorative elements)

  // Content layers
  content: 1,           // Standard content
  sticky: 100,          // Sticky headers, sidebars
  fixed: 200,           // Fixed positioning elements

  // Interactive layers
  //
  // v0.4.1 nested-overlay ordering (#35/#46): floating overlays sit ABOVE
  // modal/drawer so a Dropdown/Select/Popover opened from inside a Modal
  // paints above the backdrop instead of behind it. Values mirror the CSS
  // source of truth in src/styles/tokens.css (--z-index-*).
  overlay: 900,         // Overlay backgrounds (scrims behind modal/drawer)
  modal: 1000,          // Modal dialogs
  drawer: 1000,         // Side drawers, slide-outs
  dropdown: 1100,       // Dropdowns, select menus (above modal)
  popover: 1200,        // Popovers
  tooltip: 1300,        // Tooltips (highest interactive element)
  notification: 1400,   // Toasts, alerts

  // Special layers
  debug: 9999,          // Debug overlays (development only)
  maximum: 2147483647,  // Maximum z-index value (use sparingly)
} as const

// Component-specific z-index presets
export const componentZIndex = {
  // Navigation
  navbar: zIndex.sticky,
  sidebar: zIndex.sticky,
  sidebarBackdrop: zIndex.overlay,

  // Dropdowns and selects
  dropdown: zIndex.dropdown,
  select: zIndex.dropdown,
  combobox: zIndex.dropdown,

  // Overlays
  modal: zIndex.modal,
  modalBackdrop: zIndex.overlay,
  drawer: zIndex.drawer,
  drawerBackdrop: zIndex.overlay,

  // Notifications
  toast: zIndex.notification,
  alert: zIndex.notification,
  banner: zIndex.notification,

  // Interactive elements
  popover: zIndex.popover,
  tooltip: zIndex.tooltip,
  contextMenu: zIndex.dropdown,

  // Special cases
  loadingOverlay: zIndex.overlay,
  fullscreenOverlay: zIndex.modal,
} as const

// Type exports
export type ZIndex = typeof zIndex
export type ZIndexValue = keyof typeof zIndex
export type ComponentZIndex = typeof componentZIndex
