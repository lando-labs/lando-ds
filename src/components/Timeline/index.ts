/**
 * Timeline barrel export.
 *
 * Exports both compound-syntax (`<Timeline.Item>`) and direct named
 * imports (`import { TimelineItem } from '@lando-labs/lando-ds'`).
 */

export { Timeline, TimelineItem, TimelineGroup } from './Timeline'
export type {
  TimelineProps,
  TimelineItemProps,
  TimelineGroupProps,
  TimelineStatus,
} from './Timeline'
