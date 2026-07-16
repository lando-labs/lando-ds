/**
 * Lando Labs Design System - Container Query Tokens
 * Component-relative responsive design (reflow by element width, not viewport)
 *
 * Philosophy:
 * - Cards (and, from Sprint 41 / #270, other components) reflow based on the
 *   width of THEIR OWN container, not the viewport. A StatCard in a 4-up grid
 *   on a wide screen still adopts its compact layout because each grid track is
 *   narrower than the card's compact threshold — something a viewport
 *   `@media` query can never see.
 * - Thresholds intentionally mirror `breakpoints.ts` (the card compact
 *   threshold is `sm` = 640px = 40rem) so the component-relative system stays
 *   legible alongside the viewport-relative one.
 *
 * Container naming convention (CSS `container-name`):
 * - Each component type declares a DISTINCT container name on its host via the
 *   `container: <name> / inline-size` shorthand, so a component nested inside
 *   another's `@container` query resolves against the RIGHT ancestor (the
 *   nearest container that shares the queried name), not whichever container
 *   happens to be closest. This is what makes table-in-card, list-in-sidebar,
 *   footer-in-modal compositions reflow correctly: each queries its OWN host.
 * - Container names are NOT hashed by CSS Modules — they are global. Keep them
 *   unique and descriptive. The names in use today:
 *     Cards (#269):
 *       card · stat-card · task-card · detail-card · approval-card · article-card
 *     Non-card components (#270):
 *       list · table · footer · banner · breadcrumb · chart · chat-message ·
 *       code-block · modal · pagination · segmented-control
 *
 * Usage (authoring `@container` rules inside a `*.module.css`):
 *   .root { container: stat-card / inline-size; }
 *   `@container stat-card (max-width: 40rem)` { .value { font-size: … } }
 *
 * Usage (consuming the token in TS):
 *   import { containerQueries } from '@lando-labs/lando-ds/tokens'
 *   containerQueries.names.statCard   // 'stat-card'
 *   containerQueries.down.sm          // '@container (max-width: 40rem)'
 */

import { breakpoints } from './breakpoints'

export const containerQueries = {
  // Pixel values — DERIVED from breakpoints.px (#454) so the shared sm/md
  // tiers can never drift from the viewport breakpoint source of truth.
  px: {
    sm: breakpoints.px.sm, // Card / component compact threshold (= breakpoints.px.sm, 640)
    md: breakpoints.px.md, // Secondary reflow tier used by Footer/Table (= breakpoints.px.md, 768)
  },

  // rem values (the unit used in the authored `@container` rules: 640 / 16, 768 / 16)
  rem: {
    sm: breakpoints.px.sm / 16, // 40
    md: breakpoints.px.md / 16, // 48
  },

  // Container names declared on each host via `container: <name> / inline-size`.
  // These are GLOBAL identifiers (CSS Modules does not hash container-name).
  names: {
    // Cards (#269)
    card: 'card',
    statCard: 'stat-card',
    taskCard: 'task-card',
    detailCard: 'detail-card',
    approvalCard: 'approval-card',
    articleCard: 'article-card',
    // Non-card components (#270)
    list: 'list',
    table: 'table',
    footer: 'footer',
    banner: 'banner',
    breadcrumb: 'breadcrumb',
    chart: 'chart',
    chatMessage: 'chat-message',
    codeBlock: 'code-block',
    modal: 'modal',
    pagination: 'pagination',
    segmentedControl: 'segmented-control',
  },

  // Anonymous container-query strings (no name → matches nearest container
  // ancestor of any name). Mirrors `breakpoints.down` for desktop-first ranges.
  down: {
    sm: '@container (max-width: 40rem)', // < 640px container width
    md: '@container (max-width: 48rem)', // < 768px container width
  },

  // Named container-query strings — target a specific host's container so a
  // nested component queries the right ancestor. Mirrors the naming convention.
  // All thresholds are the `sm` tier (40rem) except where a component historically
  // reflowed at `md` (768px) — Footer's rich grid and Table's cell padding.
  named: {
    // Cards (#269)
    card: '@container card (max-width: 40rem)',
    statCard: '@container stat-card (max-width: 40rem)',
    taskCard: '@container task-card (max-width: 40rem)',
    detailCard: '@container detail-card (max-width: 40rem)',
    approvalCard: '@container approval-card (max-width: 40rem)',
    articleCard: '@container article-card (max-width: 40rem)',
    // Non-card components (#270)
    list: '@container list (max-width: 40rem)',
    table: '@container table (max-width: 40rem)',
    tableMd: '@container table (max-width: 48rem)',
    footer: '@container footer (max-width: 40rem)',
    footerMd: '@container footer (max-width: 48rem)',
    banner: '@container banner (max-width: 40rem)',
    breadcrumb: '@container breadcrumb (max-width: 40rem)',
    chart: '@container chart (max-width: 40rem)',
    chatMessage: '@container chat-message (max-width: 40rem)',
    codeBlock: '@container code-block (max-width: 40rem)',
    modal: '@container modal (max-width: 40rem)',
    pagination: '@container pagination (max-width: 40rem)',
    segmentedControl: '@container segmented-control (max-width: 40rem)',
  },
} as const

// Helper: build a named container query string for a given card container.
// Defaults to a `max-width` (desktop-first / compact) query at the `sm` tier.
export const createContainerQuery = (
  name: string,
  rem: number = containerQueries.rem.sm,
  type: 'up' | 'down' = 'down',
): string => {
  const comparator = type === 'up' ? 'min-width' : 'max-width'
  return `@container ${name} (${comparator}: ${rem}rem)`
}

// Type exports
export type ContainerQueries = typeof containerQueries
export type ContainerName = keyof typeof containerQueries.names
