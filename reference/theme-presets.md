<!--
AI-Generated Documentation
Created by: frontend
Date: 2025-10-26
Purpose: Theme preset system documentation - creating and using color theme variations
-->

# Theme Presets

The Lando Labs Design System includes a powerful theme preset system that allows users to switch between different color schemes while maintaining all other design tokens (spacing, typography, shadows, etc.).

## Overview

The design system ships **brand-neutral by default** — no preset is applied
(`DEFAULT_THEME_PRESET = ''`), and the neutral primary is meant to be overridden.
Theme presets are opt-in curated color palettes that override the neutral defaults.
Each preset maintains internal consistency while offering a distinct visual
personality suited for different applications or moods. Apply one with
`<ThemeProvider preset="lando">` or `setThemePreset('lando')`.

## Available Presets

There are **7** presets. `ocean` is a historical alias of `lando`; neither is the
default (the default is brand-neutral, no preset).

### 1. Lando
**ID**: `lando`
**Description**: Historical Lando ocean+teal palette (the pre-v0.36.0 default; now opt-in)
**Best for**: Lando-branded surfaces, trust-focused applications

**Colors**:
- Primary: `#1B7FA8` (ocean-medium)
- Secondary: `#2DBFBF` (teal-base)
- Accent: `#2BA3D4` (ocean-base)
- Personality: Calm, trustworthy, professional

### 2. Ocean (alias of Lando)
**ID**: `ocean`
**Description**: Alias of the `lando` preset (historical name) — same palette
**Best for**: Back-compat with code that referenced `ocean` before the rename

**Colors**:
- Primary: `#1B7FA8` (ocean-medium)
- Accent: `#2BA3D4` (ocean-base)
- Personality: Calm, trustworthy, professional

### 3. Midnight
**ID**: `midnight`
**Description**: Deep purples and indigos for sophisticated interfaces
**Best for**: Creative applications, premium experiences, nighttime usage

**Colors**:
- Primary: `#6366F1` (Indigo-500)
- On-primary text: `#000000` (black — Indigo-500 vs white is 4.47:1, just under AA; see [`onPrimary`](#onprimary--keeping-button-variantprimary-at-wcag-aa))
- Accent: `#8B5CF6` (Violet-500)
- Personality: Sophisticated, creative, mysterious

### 4. Sunset
**ID**: `sunset`
**Description**: Warm corals and oranges for vibrant, energetic feel
**Best for**: Energetic applications, call-to-action focused interfaces

**Colors**:
- Primary: `#F97316` (Orange-500)
- On-primary text: `#000000` (black — Orange-500 vs white is 2.80:1)
- Accent: `#F59E0B` (Amber-500)
- Personality: Warm, energetic, optimistic

### 5. Forest
**ID**: `forest`
**Description**: Rich greens and emeralds for natural, calming interfaces
**Best for**: Wellness applications, nature-focused content, eco-friendly products

**Colors**:
- Primary: `#10B981` (Emerald-500)
- On-primary text: `#000000` (black — Emerald-500 vs white is 2.54:1)
- Accent: `#14B8A6` (Teal-500)
- Personality: Natural, balanced, growth-oriented

### 6. Rose
**ID**: `rose`
**Description**: Soft pinks and magentas for elegant, welcoming interfaces
**Best for**: Beauty/wellness applications, fashion, lifestyle products

**Colors**:
- Primary: `#EC4899` (Pink-500)
- On-primary text: `#000000` (black — Pink-500 vs white is 3.53:1)
- Accent: `#F43F5E` (Rose-500)
- Personality: Elegant, warm, welcoming

### 7. Slate
**ID**: `slate`
**Description**: Cool grays and subtle blues for professional, minimal feel
**Best for**: Enterprise applications, professional tools, minimalist interfaces

**Colors**:
- Primary: `#64748B` (Slate-500)
- Accent: `#0EA5E9` (Sky-500)
- Personality: Professional, minimal, clear

## Usage

### In React Components

```tsx
import { useTheme } from '@lando-labs/lando-ds'

function MyComponent() {
  const { themePreset, setThemePreset } = useTheme()

  return (
    <div>
      <p>Current theme: {themePreset}</p>
      <button onClick={() => setThemePreset('midnight')}>
        Switch to Midnight
      </button>
    </div>
  )
}
```

### With Select Component

```tsx
import { Select } from '@lando-labs/lando-ds'
import { useTheme } from '@lando-labs/lando-ds'
import { themePresets } from '@lando-labs/lando-ds/tokens'

function ThemeSelector() {
  const { themePreset, setThemePreset } = useTheme()

  return (
    <Select
      options={themePresets.map(preset => ({
        label: preset.name,
        value: preset.id,
      }))}
      value={themePreset}
      onChange={setThemePreset}
    />
  )
}
```

## Creating Custom Theme Presets

You can create your own theme presets by following this structure:

### 1. Define Your Preset

Create a new preset object in `/src/tokens/themePresets.ts`:

```typescript
export const customTheme: ThemePreset = {
  id: 'custom',  // Unique identifier
  name: 'Custom',  // Display name
  description: 'My custom color scheme',
  colors: {
    // Required: Primary colors
    primary: '#FF5733',        // Main brand color
    primaryHover: '#FF7851',   // Hover state
    primaryActive: '#E54623',  // Active/pressed state

    // Optional (but check it!): text/icon color on a `primary`-filled
    // surface. Omitting this inherits the global white default
    // (`--color-on-primary: var(--color-neutral-white)`), which only holds
    // WCAG AA if `primary` is dark/saturated enough (>= ~4.5:1 against
    // white). Compute both before shipping:
    //   contrastRatio(primary, '#FFFFFF')  // white text (the default)
    //   contrastRatio(primary, '#000000')  // black text
    // and set `onPrimary` to whichever (or neither, if both already pass)
    // clears AA_NORMAL. See `theme-preset-contrast.test.ts`, which fails CI
    // for any preset whose primary/on-primary pair doesn't clear AA (#10).
    onPrimary: '#000000',

    // Optional: Accent colors
    accent: '#33C4FF',
    accentLight: '#70D9FF',
    accentDark: '#1BA3E0',

    // Optional: Semantic overrides
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  }
}
```

### 2. Add to Presets Array

```typescript
export const themePresets: ThemePreset[] = [
  landoTheme,   // `ocean` is an alias of this, resolved by getThemePreset — not a separate array entry
  midnightTheme,
  sunsetTheme,
  forestTheme,
  roseTheme,
  slateTheme,
  customTheme,  // Add your new preset
]
```

### 3. Export Your Preset

```typescript
// In /src/tokens/index.ts
export {
  themePresets,
  landoTheme,
  oceanTheme,   // historical alias export
  midnightTheme,
  customTheme  // Export your preset
} from './themePresets'
```

## Design Guidelines for Theme Presets

### Color Selection Principles

1. **Maintain Contrast**: Ensure `primary` clears WCAG AA (4.5:1) against its **resolved** `--color-on-primary` — the inherited white default if you don't set `onPrimary`, or your explicit override if you do (#10). Don't assume white text works just because it's the default.
2. **Brand Harmony**: New presets should feel cohesive with the rest of the preset family
3. **State Progression**: Hover should be lighter, active should be darker than primary
4. **Semantic Consistency**: Success = green, Error = red, Warning = amber/orange

### Testing Your Preset

1. **Light and Dark Mode**: Test your colors in both modes
2. **All Components**: Verify buttons, links, badges, and interactive elements look good
3. **Accessibility**: Run contrast checks with WebAIM or similar tools
4. **Edge Cases**: Test with disabled states, loading states, errors

## Architecture

### How It Works

1. **ThemeProvider** loads the selected preset from localStorage on mount
2. **CSS Custom Properties** are dynamically set on `:root` via `applyTheme()`
3. **All Components** reference `var(--color-primary)` etc. and automatically update
4. **Persistence** happens via localStorage with key `lando-theme-preset`

### CSS Variables Affected

When a theme preset is applied, these CSS variables are overridden:

```css
--color-primary          /* Main brand color */
--color-primary-hover    /* Hover state */
--color-primary-active   /* Active/pressed state */
--color-on-primary       /* Text/icon color on a primary-filled surface (optional — see below) */
--color-accent           /* Accent color */
--color-accent-light     /* Light accent */
--color-accent-dark      /* Dark accent */
--color-success-base     /* Success color (optional) */
--color-warning-base     /* Warning color (optional) */
--color-error-base       /* Error color (optional) */
--color-info-base        /* Info color (optional) */
```

### `onPrimary` — keeping Button `variant="primary"` at WCAG AA

`--color-on-primary` (the text/icon color rendered on a `primary`-filled
surface — Button `variant="primary"`, and anywhere else the token is
consumed) is declared **once, globally**, in `tokens.css`
(`var(--color-neutral-white)`). A preset only overrides it via
`colors.onPrimary` when its `primary` doesn't already clear WCAG AA (4.5:1)
against that white default — omitting the field inherits it unchanged.

Four of the six shipped presets need it (#10 — audited with the DS's own
`contrastRatio()` / `AA_NORMAL` from `src/tokens/contrast.ts`):

| preset | `primary` | vs white (default) | resolved `onPrimary` | vs resolved |
| --- | --- | --- | --- | --- |
| `lando` | `#1B7FA8` | 4.52 ✅ | *(inherited: white)* | 4.52 ✅ |
| `slate` | `#64748B` | 4.76 ✅ | *(inherited: white)* | 4.76 ✅ |
| `midnight` | `#6366F1` | 4.47 ❌ | `#000000` | 4.70 ✅ |
| `sunset` | `#F97316` | 2.80 ❌ | `#000000` | 7.49 ✅ |
| `forest` | `#10B981` | 2.54 ❌ | `#000000` | 8.28 ✅ |
| `rose` | `#EC4899` | 3.53 ❌ | `#000000` | 5.95 ✅ |

Every failing preset is fixed by switching to black text (`#000000` —
the same value as `--color-neutral-black`), not by picking a new brand
color: an orange/green/pink button with near-black text is a legitimate
design, not a compromise. `midnight` is the interesting case — indigo is
close enough to the AA floor that a softer "ink" tone (e.g. `#0F1419`)
*doesn't* clear it (4.14:1); only true black does (4.70:1).

`lando` and `slate` already clear AA against the inherited white default
and are left as-is — no `onPrimary` override, and (for `lando`) no change
to the documented historical `primary` hex, to avoid touching a value
several other places in the codebase assert exact parity with. `lando`'s
margin (4.52 vs. the 4.5 floor) is real but slim; a follow-up could widen
it by nudging `primary` a fraction darker in OKLCH if the margin becomes a
problem in practice, but that wasn't judged worth the parity break for
this fix.

This is enforced by a guard test — `src/tokens/theme-preset-contrast.test.ts`
loops over every `themePresets` entry and asserts `primary` vs. its
resolved `onPrimary` (explicit or inherited) clears `AA_NORMAL`, plus the
brand-neutral default (no preset). A new preset that skips `onPrimary`
while shipping a `primary` lighter than ~4.5:1 against white will fail
this test.

### Data Attributes

The active preset is also set as a data attribute for CSS targeting:

```css
/* Target specific preset in CSS */
[data-theme-preset="midnight"] {
  /* Midnight-specific styles */
}

/* Works with theme mode */
[data-theme="dark"][data-theme-preset="sunset"] {
  /* Dark mode + sunset preset */
}
```

## Advanced Usage

### Conditional Rendering Based on Preset

```tsx
import { useTheme } from '@lando-labs/lando-ds'

function MyComponent() {
  const { themePreset } = useTheme()

  return (
    <div>
      {themePreset === 'midnight' && (
        <StarryBackground />
      )}
      {/* ... */}
    </div>
  )
}
```

### Custom Preset Metadata

```tsx
import { getThemePreset } from '@lando-labs/lando-ds/tokens'

const preset = getThemePreset('forest')
console.log(preset?.name)         // "Forest"
console.log(preset?.description)  // "Rich greens and emeralds..."
console.log(preset?.colors.primary)  // "#10B981"
```

### Programmatic Preset Switching

```tsx
// Switch based on time of day
const hour = new Date().getHours()
const preset = hour >= 18 || hour < 6 ? 'midnight' : 'ocean'
setThemePreset(preset)

// Switch based on route
if (location.pathname === '/wellness') {
  setThemePreset('forest')
} else if (location.pathname === '/fashion') {
  setThemePreset('rose')
}
```

## Best Practices

### 1. Don't Override Everything
Only override what's necessary. The brand-neutral defaults have carefully balanced tokens (spacing, typography, shadows) - preserve what works and change only the color palette.

### 2. Test Across Components
A color that looks great on buttons might not work for badges or links. Test comprehensively.

### 3. Document Your Preset
If creating a custom preset, document the use case and personality it conveys.

### 4. Consider Dark Mode
Your preset colors should work in both light and dark modes. The system handles mode switching separately.

### 5. Maintain a Cohesive Family
All presets should feel like they belong in the same system — consistent contrast relationships, saturation, and role mapping (primary/secondary/accent) across the set.

## Troubleshooting

### Preset Not Applying

1. Check that preset ID is correct and exists in `themePresets` array
2. Verify localStorage is enabled in browser
3. Check browser console for warnings
4. Ensure `ThemeProvider` wraps your app

### Colors Look Wrong

1. Verify you're using the right CSS variable names
2. Check component CSS is using design tokens, not hardcoded colors
3. Test in both light and dark modes
4. Clear browser cache and localStorage

### TypeScript Errors

```typescript
// Import the type
import type { ThemePreset } from '@lando-labs/lando-ds/tokens'

// Use it in your code
const myPreset: ThemePreset = { /* ... */ }
```

## Future Enhancements

Potential future improvements to the preset system:

- **Preset Builder UI**: Visual interface for creating presets
- **More Semantic Overrides**: Override shadows, border radius per preset
- **Preset Transitions**: Smooth color transitions when switching
- **User-Generated Presets**: Save/load custom user presets from server
- **Gradient Presets**: Support for gradient-based themes
- **Seasonal Presets**: Automatic switching based on season

---

**Related Documentation**:
- [Design Tokens](/reference/design-tokens-implementation.md) - Token architecture
- [Theming Guide](/reference/theming-guide.md) - Complete theming documentation
