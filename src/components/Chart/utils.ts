/**
 * Chart Utility Functions
 *
 * Helper functions for color schemes, formatting, and data generation
 */

import { ColorScheme, ChartTheme } from './types'

/**
 * Get color array for a given color scheme
 */
export function getChartColors(scheme: ColorScheme): string[] {
  // #287 — every series color is a re-skinnable token (bare semantic + the
  // now-derived brand ramp), so overriding --color-primary/secondary re-skins
  // all charts. Default-theme resolved values noted inline. Previously these
  // returned raw brand-palette rungs, which never moved when a product theme
  // overrode the base.
  const schemes: Record<ColorScheme, string[]> = {
    brand: [
      'var(--color-accent)',
      'var(--color-primary)',
      'var(--color-secondary)',
      'var(--color-primary-light)',
      'var(--color-secondary-light)',
      'var(--color-primary-darker)',
    ],
    teal: [
      'var(--color-secondary)',
      'var(--color-secondary-medium)',
      'var(--color-secondary-light)',
      'var(--color-secondary-dark)',
    ],
    success: [
      'var(--color-success)',
      'var(--color-secondary)',
      'var(--color-primary-light)',
    ],
    warning: [
      'var(--color-warning)',
      'var(--color-accent)',
    ],
    danger: [
      'var(--color-error)',
      'var(--color-primary-darker)',
    ],
    custom: [],
  }

  return schemes[scheme] || schemes.brand
}

/**
 * Get chart theme values from CSS variables
 */
export function getChartTheme(): ChartTheme {
  if (typeof window === 'undefined') {
    // SSR fallback — the default-theme resolved values of getChartColors('brand')
    // (accent / primary / secondary / primary-light / secondary-light /
    // primary-darker). A product theme re-skin resolves on the client after
    // hydration; SSR renders the default brand palette.
    return {
      colors: ['#2BA3D4', '#1B7FA8', '#2DBFBF', '#66C2D9', '#66D9D9', '#0D4358'],
      gridColor: 'rgba(10, 74, 110, 0.1)',
      axisColor: '#6B7280',
      tooltipBg: '#FFFFFF',
      tooltipBorder: '#E5E7EB',
    }
  }

  const style = getComputedStyle(document.documentElement)

  return {
    colors: getChartColors('brand').map(color => {
      const cssVar = color.replace('var(', '').replace(')', '')
      return style.getPropertyValue(cssVar).trim()
    }),
    gridColor: style.getPropertyValue('--color-border-subtle').trim(),
    axisColor: style.getPropertyValue('--color-text-secondary').trim(),
    tooltipBg: style.getPropertyValue('--color-surface').trim(),
    tooltipBorder: style.getPropertyValue('--color-border-subtle').trim(),
  }
}

/**
 * Format number for display in charts
 */
export function formatChartValue(value: number, format?: string): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (format === 'percent') {
    return `${value.toFixed(1)}%`
  }

  if (format === 'compact') {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }

  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Generate sample data for testing charts
 */
export function generateSampleData(type: 'line' | 'bar' | 'area' | 'pie', points: number = 12) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const categories = ['Product A', 'Product B', 'Product C', 'Product D', 'Product E']

  if (type === 'line' || type === 'bar' || type === 'area') {
    return Array.from({ length: Math.min(points, 12) }, (_, i) => ({
      month: months[i],
      value: Math.floor(Math.random() * 5000) + 1000,
      target: Math.floor(Math.random() * 5000) + 1000,
    }))
  }

  if (type === 'pie') {
    return Array.from({ length: Math.min(points, 5) }, (_, i) => ({
      name: categories[i],
      value: Math.floor(Math.random() * 1000) + 100,
    }))
  }

  return []
}
