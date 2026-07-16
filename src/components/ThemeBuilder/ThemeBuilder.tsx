'use client'

/**
 * ThemeBuilder Component
 *
 * Demonstrates the multi-brand architecture of the Lando Labs Design System.
 * Allows users to preview different product themes, see color palettes, and view CSS variables.
 *
 * Features:
 * - Predefined themes (Forest, Sunset, Midnight, and the default brand theme)
 * - Real-time theme preview with key components
 * - Color palette display with hex values
 * - CSS variable code display
 * - Smooth theme transitions
 *
 * @example
 * <ThemeBuilder />
 */

import React, { useState } from 'react'
import {
  Button,
  Input,
  Badge,
  Card,
  CardHeader,
  CardBody,
  Select,
  CodeBlock,
} from '../'
import type { SelectOption } from '../Select'
import styles from './ThemeBuilder.module.css'

export interface Theme {
  name: string
  description: string
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    danger: string
    info: string
    background: string
    surface: string
    textPrimary: string
    textSecondary: string
  }
}

export interface ThemeBuilderProps
  // The outer `.themeBuilder` wrapper is a plain <div>; accept every native
  // div attribute as pass-through onto it.
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS class merged onto the outer `.themeBuilder` wrapper. */
  className?: string
  /**
   * Inline styles applied to the outer `.themeBuilder` wrapper. The component
   * sets no inline style on that element, so consumer keys apply directly.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

// Predefined themes
const themes: Theme[] = [
  {
    name: 'Ocean',
    description: 'Lando Labs ocean-inspired theme with blues and teals',
    colors: {
      primary: '#1B7FA8',
      secondary: '#0B4F71',
      success: '#2DBFBF',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#3B82F6',
      background: '#FFFFFF',
      surface: '#F8FAFB',
      textPrimary: '#0F1419',
      textSecondary: '#64748B',
    },
  },
  {
    name: 'Forest',
    description: 'Earthy greens and natural tones for environmental products',
    colors: {
      primary: '#2D5016',
      secondary: '#1A2E0A',
      success: '#4D7C0F',
      warning: '#CA8A04',
      danger: '#DC2626',
      info: '#0891B2',
      background: '#FEFEFE',
      surface: '#F7F8F5',
      textPrimary: '#1C1917',
      textSecondary: '#57534E',
    },
  },
  {
    name: 'Sunset',
    description: 'Warm sunset colors for creative and lifestyle apps',
    colors: {
      primary: '#EA580C',
      secondary: '#9A3412',
      success: '#65A30D',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#7C3AED',
      background: '#FFFBEB',
      surface: '#FFF7ED',
      textPrimary: '#1C1917',
      textSecondary: '#78716C',
    },
  },
  {
    name: 'Midnight',
    description: 'Deep blues and dark tones for professional applications',
    colors: {
      primary: '#1E40AF',
      secondary: '#1E3A8A',
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#0EA5E9',
      background: '#F8FAFC',
      surface: '#F1F5F9',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
    },
  },
]

// Generate CSS variables for a theme
const generateThemeCSS = (theme: Theme): string => {
  return `:root {
  /* Primary — hover/active/disabled derive from this base via the DS's OKLCH color-mix() layer (#271) */
  --color-primary: ${theme.colors.primary};

  /* Secondary Colors */
  --color-secondary: ${theme.colors.secondary};

  /* Semantic Colors */
  --color-success-base: ${theme.colors.success};
  --color-warning-base: ${theme.colors.warning};
  --color-error-base: ${theme.colors.danger};
  --color-info-base: ${theme.colors.info};

  /* Background & Surface */
  --color-background: ${theme.colors.background};
  --color-surface: ${theme.colors.surface};
  --color-surface-elevated: ${theme.colors.surface};

  /* Text Colors */
  --color-text-primary: ${theme.colors.textPrimary};
  --color-text-secondary: ${theme.colors.textSecondary};
}`
}

export const ThemeBuilder = React.forwardRef<HTMLDivElement, ThemeBuilderProps>(
  ({ className = '', style, ...rest }, ref) => {
    const [selectedThemeIndex, setSelectedThemeIndex] = useState(0)
    const selectedTheme = themes[selectedThemeIndex]

    // `themes` is a non-empty module constant and `selectedThemeIndex` is only
    // ever set from the theme <Select>'s own option indices, so this is
    // unreachable — it narrows `selectedTheme` to non-undefined for the render.
    if (!selectedTheme) return null

    // Create select options from themes
    const themeOptions: SelectOption[] = themes.map((theme, index) => ({
      label: theme.name,
      value: index.toString(),
    }))

    // Convert theme to CSS variables for preview
    const themeVars = {
      '--preview-primary': selectedTheme.colors.primary,
      '--preview-secondary': selectedTheme.colors.secondary,
      '--preview-success': selectedTheme.colors.success,
      '--preview-warning': selectedTheme.colors.warning,
      '--preview-danger': selectedTheme.colors.danger,
      '--preview-info': selectedTheme.colors.info,
      '--preview-background': selectedTheme.colors.background,
      '--preview-surface': selectedTheme.colors.surface,
      '--preview-text-primary': selectedTheme.colors.textPrimary,
      '--preview-text-secondary': selectedTheme.colors.textSecondary,
    } as React.CSSProperties

    const containerClasses = [styles.themeBuilder, className]
      .filter(Boolean)
      .join(' ')

    return (
      <div
        ref={ref}
        // Consumer escape hatch — `data-*`, `id`, event handlers, etc. Spread
        // BEFORE the component's own className/style so they win on conflict.
        {...rest}
        className={containerClasses}
        style={style}
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Theme Builder</h2>
            <p className={styles.subtitle}>
              Explore how the design system adapts to different product brands
            </p>
          </div>
        </div>

        {/* Theme Selector */}
        <div className={styles.controls}>
          <Select
            label="Select Theme"
            options={themeOptions}
            value={selectedThemeIndex.toString()}
            onChange={(value) => {
              // #328 — Select now emits undefined on clear; ignore that case
              // (clearing the theme picker has no meaningful default; keep
              // the current theme rather than parseInt(undefined) → NaN).
              if (value === undefined) return
              setSelectedThemeIndex(parseInt(value as string))
            }}
          />
          <div className={styles.themeDescription}>
            {selectedTheme.description}
          </div>
        </div>

        {/* Color Palette */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Color Palette</h3>
          <div className={styles.colorGrid}>
            {Object.entries(selectedTheme.colors).map(([name, color]) => (
              <div key={name} className={styles.colorItem}>
                <div
                  className={styles.colorSwatch}
                  style={{ backgroundColor: color }}
                  title={color}
                />
                <div className={styles.colorInfo}>
                  <div className={styles.colorName}>
                    {name.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className={styles.colorValue}>{color.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Component Preview */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Component Preview</h3>
          <div className={styles.preview} style={themeVars}>
            <div className={styles.previewGrid}>
              {/* Buttons */}
              <div className={styles.previewGroup}>
                <h4 className={styles.previewGroupTitle}>Buttons</h4>
                <div className={styles.previewRow}>
                  <Button
                    variant="primary"
                    style={{
                      backgroundColor: selectedTheme.colors.primary,
                      borderColor: selectedTheme.colors.primary,
                    }}
                  >
                    Primary
                  </Button>
                  <Button
                    variant="secondary"
                    style={{
                      backgroundColor: selectedTheme.colors.secondary,
                      borderColor: selectedTheme.colors.secondary,
                    }}
                  >
                    Secondary
                  </Button>
                  <Button
                    variant="outline"
                    style={{
                      color: selectedTheme.colors.primary,
                      borderColor: selectedTheme.colors.primary,
                    }}
                  >
                    Outline
                  </Button>
                </div>
              </div>

              {/* Badges */}
              <div className={styles.previewGroup}>
                <h4 className={styles.previewGroupTitle}>Badges</h4>
                <div className={styles.previewRow}>
                  <Badge
                    variant="success"
                    style={{ backgroundColor: selectedTheme.colors.success }}
                  >
                    Success
                  </Badge>
                  <Badge
                    variant="warning"
                    style={{ backgroundColor: selectedTheme.colors.warning }}
                  >
                    Warning
                  </Badge>
                  <Badge
                    variant="danger"
                    style={{ backgroundColor: selectedTheme.colors.danger }}
                  >
                    Danger
                  </Badge>
                  <Badge
                    variant="info"
                    style={{ backgroundColor: selectedTheme.colors.info }}
                  >
                    Info
                  </Badge>
                </div>
              </div>

              {/* Status Cards */}
              <div className={styles.previewGroup}>
                <h4 className={styles.previewGroupTitle}>Status Messages</h4>
                <div
                  style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: `${selectedTheme.colors.success}15`,
                    border: `2px solid ${selectedTheme.colors.success}`,
                    borderRadius: 'var(--radius-md)',
                    color: selectedTheme.colors.textPrimary,
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  Operation completed successfully
                </div>
                <div
                  style={{
                    padding: 'var(--spacing-md)',
                    backgroundColor: `${selectedTheme.colors.warning}15`,
                    border: `2px solid ${selectedTheme.colors.warning}`,
                    borderRadius: 'var(--radius-md)',
                    color: selectedTheme.colors.textPrimary,
                  }}
                >
                  Please review before continuing
                </div>
              </div>

              {/* Input */}
              <div className={styles.previewGroup}>
                <h4 className={styles.previewGroupTitle}>Input</h4>
                <Input
                  label="Email Address"
                  placeholder="Enter your email"
                  style={{
                    backgroundColor: selectedTheme.colors.surface,
                    color: selectedTheme.colors.textPrimary,
                  }}
                />
              </div>

              {/* Card */}
              <div className={styles.previewGroup}>
                <h4 className={styles.previewGroupTitle}>Card</h4>
                <Card
                  style={{
                    backgroundColor: selectedTheme.colors.surface,
                    color: selectedTheme.colors.textPrimary,
                  }}
                >
                  <CardHeader>
                    <h5 style={{ margin: 0, color: selectedTheme.colors.textPrimary }}>
                      Card Title
                    </h5>
                  </CardHeader>
                  <CardBody>
                    <p style={{ margin: 0, color: selectedTheme.colors.textSecondary }}>
                      This is a sample card component showing how content adapts to the
                      selected theme.
                    </p>
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* CSS Variables */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>CSS Variables</h3>
          <p className={styles.sectionDescription}>
            These CSS custom properties can be used to apply the theme to your application
          </p>
          <CodeBlock
            code={generateThemeCSS(selectedTheme)}
            language="css"
            title={`${selectedTheme.name} Theme Variables`}
            showLineNumbers
          />
        </div>

        {/* Usage Example */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Usage Example</h3>
          <p className={styles.sectionDescription}>
            Apply a custom theme by overriding CSS variables in your application
          </p>
          <CodeBlock
            code={`// In your app's CSS or styled-components
[data-product="${selectedTheme.name.toLowerCase()}"] {
  --color-primary: ${selectedTheme.colors.primary};
  --color-secondary: ${selectedTheme.colors.secondary};
  --color-success-base: ${selectedTheme.colors.success};
  --color-warning-base: ${selectedTheme.colors.warning};
  --color-error-base: ${selectedTheme.colors.danger};
  --color-info-base: ${selectedTheme.colors.info};

  --color-background: ${selectedTheme.colors.background};
  --color-surface: ${selectedTheme.colors.surface};

  --color-text-primary: ${selectedTheme.colors.textPrimary};
  --color-text-secondary: ${selectedTheme.colors.textSecondary};
}

// Then apply the theme to your app
<div data-product="${selectedTheme.name.toLowerCase()}">
  <YourApp />
</div>`}
            language="css"
          />
        </div>
      </div>
    )
  }
)

ThemeBuilder.displayName = 'ThemeBuilder'
