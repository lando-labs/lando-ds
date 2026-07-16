# Design Tokens

Design tokens are the foundational building blocks of the Lando Labs Design System. They ensure consistency across all components and enable powerful theming capabilities.

## Philosophy

Our token system follows a **three-layer architecture** to support multiple brands and products:

1. **Foundation Layer** - Never changes across brands
   - Spacing scale (4px grid system)
   - Typography scale (Major Third ratio)
   - Breakpoints (responsive design)
   - Z-index scale (layering)

2. **Lando Labs Layer** - Company brand identity
   - Ocean-inspired color palette
   - Inter font family
   - 6-12px border radius (soft, approachable)
   - Calm, fluid animations

3. **Product Layer** - Application-specific customization
   - Custom primary colors
   - Product-specific illustrations
   - Component variations

## Token Categories

### Colors

Ocean-inspired palette with semantic color assignments.

```typescript
import { colors, semantic } from '@lando-labs/lando-ds/tokens'

// Ocean blues (primary brand)
colors.ocean.base         // #2BA3D4
colors.ocean.medium       // #1B7FA8 (primary brand color)
colors.ocean.dark         // #136080

// Semantic colors
semantic.success.base     // #2DBFBF (teal)
semantic.warning.base     // #F59E0B (amber)
semantic.error.base       // #EF4444 (red)
semantic.info.base        // #2BA3D4 (ocean bright)
```

**CSS Variables:**
```css
.my-component {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border: 1px solid var(--color-border-default);
}
```

### Typography

Inter font family with Major Third (1.250 ratio) type scale.

```typescript
import { typography, textStyles } from '@lando-labs/lando-ds/tokens'

// Font sizes
typography.fontSize.base   // 1rem (16px)
typography.fontSize.lg     // 1.125rem (18px)
typography.fontSize['2xl'] // 1.563rem (~25px)

// Text styles (pre-configured)
textStyles.heading.h1      // H1 heading style
textStyles.body.base       // Body text style
textStyles.label.base      // Label style
```

**CSS Variables:**
```css
.my-heading {
  font-family: var(--font-family-base);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}
```

### Spacing

Base-16 system with 4px increments for precise control.

```typescript
import { spacing, componentSpacing } from '@lando-labs/lando-ds/tokens'

// Named spacing
spacing.md     // 1rem (16px) - default
spacing.lg     // 1.5rem (24px)
spacing.xl     // 2rem (32px)

// Component-specific
componentSpacing.padding.md  // { x: '1rem', y: '0.75rem' }
componentSpacing.gap.normal  // '1rem'
```

**CSS Variables:**
```css
.my-card {
  padding: var(--spacing-lg);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-2xl);
}
```

### Border Radius

Soft, approachable rounded corners (6-12px sweet spot).

```typescript
import { radius, componentRadius } from '@lando-labs/lando-ds/tokens'

// Base radius
radius.md       // 0.375rem (6px) - default
radius.lg       // 0.5rem (8px) - buttons, inputs
radius.xl       // 0.75rem (12px) - cards
radius.full     // 9999px - pills, avatars

// Component-specific
componentRadius.button.md  // 0.5rem (8px)
componentRadius.card.md    // 0.75rem (12px)
```

**CSS Variables:**
```css
.my-button {
  border-radius: var(--radius-lg);
}

.my-card {
  border-radius: var(--radius-xl);
}
```

### Shadows

Ocean-tinted shadows with elevation levels.

```typescript
import { shadows, elevation } from '@lando-labs/lando-ds/tokens'

// Light mode shadows
shadows.light.sm    // Subtle shadow
shadows.light.md    // Default shadow
shadows.light.lg    // Prominent shadow

// Semantic elevation
elevation.raised    // Slightly elevated (cards at rest)
elevation.floating  // Floating above (dropdowns)
elevation.lifted    // Lifted high (modals)
```

**CSS Variables:**
```css
.my-card {
  box-shadow: var(--shadow-md);
}

.my-card:hover {
  box-shadow: var(--shadow-lg);
}
```

### Animation

Calm, fluid animations inspired by ocean waves.

```typescript
import { animation, transitions } from '@lando-labs/lando-ds/tokens'

// Duration
animation.duration.fast     // 150ms (default)
animation.duration.normal   // 200ms
animation.duration.slow     // 300ms

// Easing
animation.easing.easeOut    // Default (calm wave receding)
animation.easing.wave       // Gentle wave motion
animation.easing.surge      // Wave surge (slight overshoot)

// Transitions
transitions.default         // All properties, fast, ease-out
transitions.button          // Button-specific transition
```

**CSS Variables:**
```css
.my-button {
  transition: var(--transition-button);
  /* or custom */
  transition: background-color var(--duration-fast) var(--easing-wave);
}
```

### Breakpoints

Mobile-first responsive design system.

```typescript
import { breakpoints, devices } from '@lando-labs/lando-ds/tokens'

// Pixel values
breakpoints.px.sm   // 640
breakpoints.px.md   // 768
breakpoints.px.lg   // 1024

// Media queries
breakpoints.up.md   // '@media (min-width: 48rem)'
breakpoints.down.lg // '@media (max-width: 63.9375rem)'

// Device categories
devices.mobile      // < 768px
devices.tablet      // 768px - 1023px
devices.desktop     // >= 1024px
```

**CSS Usage:**
```css
.my-component {
  padding: var(--spacing-md);
}

@media (min-width: 48rem) {
  .my-component {
    padding: var(--spacing-lg);
  }
}
```

### Z-Index

Layering system for stacking context control.

```typescript
import { zIndex, componentZIndex } from '@lando-labs/lando-ds/tokens'

// Base layers
zIndex.content      // 1
zIndex.sticky       // 10
zIndex.dropdown     // 100
zIndex.modal        // 400
zIndex.tooltip      // 600

// Component-specific
componentZIndex.navbar     // 10
componentZIndex.modal      // 400
componentZIndex.tooltip    // 600
```

**CSS Variables:**
```css
.my-modal {
  z-index: var(--z-index-modal);
}

.my-modal-backdrop {
  z-index: var(--z-index-overlay);
}
```

## Using Tokens in Components

### TypeScript/React

```tsx
import { spacing, colors, typography } from '@lando-labs/lando-ds/tokens'

const MyComponent: React.FC = () => {
  return (
    <div
      style={{
        padding: spacing.lg,
        backgroundColor: colors.ocean.base,
        fontSize: typography.fontSize.lg,
      }}
    >
      Hello World
    </div>
  )
}
```

### CSS Modules

```css
.container {
  padding: var(--spacing-lg);
  background-color: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
```

## Multi-Brand Architecture

The token system supports product-specific customization through the `ThemeProvider`.

### Creating a Product Theme

```tsx
import { ThemeProvider } from '@lando-labs/lando-ds'
import type { ProductTheme } from '@lando-labs/lando-ds/tokens'

const myProductTheme: ProductTheme = {
  name: 'my-product',
  tokens: {
    colors: {
      primary: '#FF6B6B',        // Custom primary color
      'primary-hover': '#FF5252', // Custom hover state
    },
    radius: {
      md: '8px',  // More rounded than default
    },
  },
}

function App() {
  return (
    <ThemeProvider
      defaultMode="system"
      defaultProductTheme={myProductTheme}
    >
      <YourApp />
    </ThemeProvider>
  )
}
```

### Product Theme CSS

Product themes automatically set CSS variables:

```css
/* Automatically applied when productTheme is set */
[data-product="my-product"] {
  --color-primary: #FF6B6B;
  --color-primary-hover: #FF5252;
  --radius-md: 8px;
}
```

## Theming

### Light and Dark Mode

The design system includes comprehensive light and dark mode support.

```tsx
import { useTheme } from '@lando-labs/lando-ds'

function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button onClick={toggle}>
      Current theme: {theme}
    </button>
  )
}
```

### CSS for Dark Mode

```css
/* Light mode (default) */
.my-component {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
}

/* Dark mode - automatically applied when [data-theme="dark"] */
/* No need to write dark mode styles - variables handle it! */
```

## Best Practices

### DO

✅ **Use CSS variables in components** for runtime theming:
```css
.button {
  background-color: var(--color-primary);
}
```

✅ **Use semantic tokens** for context:
```css
.error-message {
  color: var(--color-error-base);
}
```

✅ **Respect the spacing scale**:
```css
.card {
  padding: var(--spacing-lg);
  gap: var(--spacing-md);
}
```

✅ **Use named breakpoints**:
```css
@media (min-width: 48rem) { /* md breakpoint */ }
```

### DON'T

❌ **Don't hardcode colors**:
```css
/* Bad */
.button {
  background-color: #2BA3D4;
}

/* Good */
.button {
  background-color: var(--color-primary);
}
```

❌ **Don't use arbitrary spacing**:
```css
/* Bad */
.card {
  padding: 18px;
}

/* Good */
.card {
  padding: var(--spacing-lg); /* 24px */
}
```

❌ **Don't bypass the token system**:
```css
/* Bad */
.element {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Good */
.element {
  box-shadow: var(--shadow-md);
}
```

## Extending Tokens

If you need additional tokens for your product, extend through the product theme:

```tsx
const extendedTheme: ProductTheme = {
  name: 'my-product',
  tokens: {
    colors: {
      // Add custom colors
      'accent': '#FF6B6B',
      'accent-hover': '#FF5252',
    },
    spacing: {
      // Add custom spacing
      'section': '6rem',
    },
  },
}
```

Then use in CSS:

```css
[data-product="my-product"] .my-section {
  padding: var(--spacing-section);
  background-color: var(--color-accent);
}
```

## Token Updates

Tokens are versioned with the design system. When updating:

1. Check `CHANGELOG.md` for breaking changes
2. Update your project's dependency
3. Run visual regression tests
4. Update product theme overrides if needed

## Resources

- [Color Palette Explorer](#) (coming soon)
- [Typography Scale Calculator](#) (coming soon)
- [Spacing Grid Visualizer](#) (coming soon)
- [Component Examples](../components/README.md)
- [Theme Provider Documentation](../utils/ThemeProvider.tsx)
