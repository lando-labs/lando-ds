<!--
AI-Generated Documentation
Created by: designer
Date: 2025-10-22
Purpose: Practical guide for implementing design tokens and token transformation pipeline
-->

# Design Tokens Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the Lando Labs design token system using Style Dictionary.

## Token Architecture

The three-layer token architecture ensures scalability and maintainability:

```
Foundation (Universal) → Lando Labs (Brand) → Products (Custom)
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install --save-dev style-dictionary
npm install --save-dev @tokens-studio/sd-transforms
```

### 2. Directory Structure

Create the token directory structure:

```bash
mkdir -p tokens/foundation
mkdir -p tokens/lando-labs
mkdir -p tokens/products/{ai-task-manager,color-season-app,wellness-app}
```

### 3. Create Foundation Tokens

#### tokens/foundation/colors.json

```json
{
  "color": {
    "ocean": {
      "deep": { "value": "#0A4A6E", "type": "color" },
      "medium": { "value": "#1B7FA8", "type": "color" },
      "bright": { "value": "#2BA3D4", "type": "color" },
      "light": { "value": "#7BC8E8", "type": "color" },
      "mist": { "value": "#B8E3F5", "type": "color" },
      "foam": { "value": "#E8F6FC", "type": "color" }
    },
    "teal": {
      "deep": { "value": "#0D5F5F", "type": "color" },
      "medium": { "value": "#1A8F8F", "type": "color" },
      "bright": { "value": "#2DBFBF", "type": "color" },
      "seafoam": { "value": "#7FDEDE", "type": "color" },
      "mint-light": { "value": "#BEF0F0", "type": "color" }
    },
    "slate": {
      "900": { "value": "#0F1419", "type": "color" },
      "800": { "value": "#1E2936", "type": "color" },
      "700": { "value": "#374151", "type": "color" },
      "600": { "value": "#4B5563", "type": "color" },
      "500": { "value": "#6B7280", "type": "color" },
      "400": { "value": "#9CA3AF", "type": "color" },
      "300": { "value": "#D1D5DB", "type": "color" },
      "200": { "value": "#E5E7EB", "type": "color" },
      "100": { "value": "#F3F4F6", "type": "color" },
      "50": { "value": "#F9FAFB", "type": "color" }
    },
    "semantic": {
      "success": { "value": "#2DBFBF", "type": "color" },
      "success-light": { "value": "#BEF0F0", "type": "color" },
      "warning": { "value": "#F59E0B", "type": "color" },
      "warning-light": { "value": "#FEF3C7", "type": "color" },
      "error": { "value": "#EF4444", "type": "color" },
      "error-light": { "value": "#FEE2E2", "type": "color" },
      "info": { "value": "#3B82F6", "type": "color" },
      "info-light": { "value": "#DBEAFE", "type": "color" }
    }
  }
}
```

#### tokens/foundation/spacing.json

```json
{
  "space": {
    "0": { "value": "0", "type": "spacing" },
    "px": { "value": "1px", "type": "spacing" },
    "0-5": { "value": "2px", "type": "spacing" },
    "1": { "value": "4px", "type": "spacing" },
    "1-5": { "value": "6px", "type": "spacing" },
    "2": { "value": "8px", "type": "spacing" },
    "2-5": { "value": "10px", "type": "spacing" },
    "3": { "value": "12px", "type": "spacing" },
    "4": { "value": "16px", "type": "spacing" },
    "5": { "value": "20px", "type": "spacing" },
    "6": { "value": "24px", "type": "spacing" },
    "7": { "value": "28px", "type": "spacing" },
    "8": { "value": "32px", "type": "spacing" },
    "10": { "value": "40px", "type": "spacing" },
    "12": { "value": "48px", "type": "spacing" },
    "16": { "value": "64px", "type": "spacing" },
    "20": { "value": "80px", "type": "spacing" },
    "24": { "value": "96px", "type": "spacing" },
    "32": { "value": "128px", "type": "spacing" }
  }
}
```

### Spacing Scale — Dual Vocabulary (As-Implemented in `tokens.css`)

> **Status**: The Style-Dictionary spec above (`space.1 = 4px`, `space.2 = 8px`, Tailwind-step) is the **target**. The shipped `src/styles/tokens.css` currently emits a **dual-track** CSS variable surface for historical reasons. This section documents what consumers can rely on **today**.

Two naming conventions coexist on `:root`:

1. **Px-numeric scale (the PRIMARY scale)** — `--spacing-{N}` where `N` equals the pixel count: `--spacing-16` resolves to `1rem` (16px), `--spacing-24` to `1.5rem` (24px). The number *is* the pixel value, not a step index. Read this way — `N` = pixels — the scale is **strictly monotonic**: `--spacing-4` (4px) < `--spacing-8` (8) < `--spacing-10` (10) < `--spacing-12` (12) < `--spacing-16` (16) < … < `--spacing-256` (256). This ordering is enforced in CI by `src/test/spacing-scale-monotonic.test.ts`.
2. **Semantic scale** (`--spacing-{xs|sm|md|lg|…}`): context-named tokens that survive scale redesigns. `--spacing-sm` = 12px, `--spacing-md` = 16px, `--spacing-lg` = 24px. Also strictly increasing (`none < 2xs < xs < sm < … < 7xl`).

To reduce silent `initial` fallbacks for consumers arriving from Tailwind (where `p-3` = 12px, `p-5` = 20px, `p-6` = 24px), three **Tailwind-step-compat aliases** are shipped:

- `--spacing-3` = `0.75rem` (12px) — equivalent to `--spacing-12` and `--spacing-sm`
- `--spacing-5` = `1.25rem` (20px) — equivalent to `--spacing-20`
- `--spacing-6` = `1.5rem` (24px) — equivalent to `--spacing-24` and `--spacing-lg`

> **These aliases are deliberately NOT part of the ordered pixel scale.** Read as bare numbers they are *intentionally non-monotonic* — a "3" worth **12px** sits numerically between `--spacing-2` (2px) and `--spacing-4` (4px). That is by design: they exist purely so Tailwind muscle-memory (`p-3`/`p-5`/`p-6`) resolves to the right pixel value instead of falling back to `initial`. The monotonicity lint **allow-lists `--spacing-3/-5/-6` out** of the strictly-increasing pixel-scale assertion and instead locks their alias equivalences (`--spacing-3 == --spacing-12`, etc.), so they can never silently drift off their pixel twin. The sub-4 hairline rungs (`--spacing-1` = 1px, `--spacing-2` = 2px) are likewise allow-listed out — they are a border/hairline set, not part of the 4px-grid layout scale. If you ever wondered why the bare-numeric scale "looks non-monotonic," this is the entire reason: it is monotonic on the pixel rungs; only the compat aliases and hairlines break the bare-number reading.

#### Cross-Reference Table

| Tailwind-step | Px-numeric       | Semantic         | rem         | Pixels   |
|---------------|------------------|------------------|-------------|----------|
| —             | `--spacing-0`    | `--spacing-none` | `0`         | 0px      |
| —             | `--spacing-1`    | —                | `0.0625rem` | 1px ⚠️    |
| —             | `--spacing-2`    | —                | `0.125rem`  | 2px      |
| 1             | `--spacing-4`    | `--spacing-2xs`  | `0.25rem`   | 4px      |
| 2             | `--spacing-8`    | `--spacing-xs`   | `0.5rem`    | 8px      |
| 2.5           | `--spacing-10`   | —                | `0.625rem`  | 10px     |
| **3**         | `--spacing-12`   | `--spacing-sm`   | `0.75rem`   | 12px     |
| **3 (alias)** | **`--spacing-3`**| —                | `0.75rem`   | 12px     |
| 4             | `--spacing-16`   | `--spacing-md`   | `1rem`      | 16px     |
| **5 (alias)** | **`--spacing-5`**| —                | `1.25rem`   | 20px     |
| 5             | `--spacing-20`   | —                | `1.25rem`   | 20px     |
| **6 (alias)** | **`--spacing-6`**| —                | `1.5rem`    | 24px     |
| 6             | `--spacing-24`   | `--spacing-lg`   | `1.5rem`    | 24px     |
| 8             | `--spacing-32`   | `--spacing-xl`   | `2rem`      | 32px     |
| 10            | `--spacing-40`   | —                | `2.5rem`    | 40px     |
| 12            | `--spacing-48`   | `--spacing-2xl`  | `3rem`      | 48px     |
| 14            | `--spacing-56`   | —                | `3.5rem`    | 56px     |
| 16            | `--spacing-64`   | `--spacing-3xl`  | `4rem`      | 64px     |
| 20            | `--spacing-80`   | —                | `5rem`      | 80px     |
| 24            | `--spacing-96`   | `--spacing-4xl`  | `6rem`      | 96px     |
| 32            | `--spacing-128`  | `--spacing-5xl`  | `8rem`      | 128px    |

#### Recommendation

New code should **prefer the semantic names** (`--spacing-sm`, `--spacing-md`, `--spacing-lg`, …) over numeric — they survive scale redesigns better and read as intent rather than measurement. The Tailwind-compat aliases (`--spacing-3` / `--spacing-5` / `--spacing-6`) are maintained for consumers migrating from Tailwind muscle memory; treat them as secondary and migrate toward semantic tokens as files are touched.

#### ⚠️ Known wart

`--spacing-1` resolves to `0.0625rem` (**1px**, not the 4px Tailwind users might expect from a Tailwind-step reading). This predates the Tailwind-compat aliases and is tracked under **#43 DS-POLISH-1** for future reconciliation. Until that lands, do **not** use `--spacing-1` as a Tailwind-step-1 (4px) shorthand — use `--spacing-4` or `--spacing-2xs` instead.

### Component padding rhythm — `--component-padding-*` (#448)

Component stylesheets historically expressed their internal padding by reaching into whichever spacing vocabulary was closest to hand — sometimes the numeric `--spacing-N` rungs, sometimes the semantic `--spacing-{xs..}` names — so there was **no single knob for "the padding rhythm components share."** The `--component-padding-*` group is that shared surface:

| Token | References | Resolves to (today) |
|-------|------------|---------------------|
| `--component-padding-xs` | `var(--spacing-xs)` | 8px |
| `--component-padding-sm` | `var(--spacing-sm)` | 12px |
| `--component-padding-md` | `var(--spacing-md)` | 16px |
| `--component-padding-lg` | `var(--spacing-lg)` | 24px |
| `--component-padding-xl` | `var(--spacing-xl)` | 32px |

Design intent:

- **They alias the *semantic* spacing scale, not literal px.** So a future retune of the semantic rungs flows through to every component's padding without touching component CSS, and consumers can retarget the shared rhythm at one place.
- **TS source of truth:** the `componentPadding` object in `src/tokens/spacing.ts` (importable from `@lando-labs/lando-ds/tokens`). It is a **distinct** export — deliberately *not* merged into the `spacing` scale or `componentSpacing` — mirroring the CSS group one-to-one.
- **Phased rollout — this is Phase A (foundation only).** As of #448 Phase A, **nothing consumes these tokens yet**, so their addition changes zero rendered values. A later phase (Phase B) migrates component padding onto them; that migration — not this addition — is where any padding value could visibly move.

#### tokens/foundation/typography.json

```json
{
  "font": {
    "family": {
      "sans": { "value": "Inter, system-ui, -apple-system, sans-serif", "type": "fontFamily" },
      "mono": { "value": "JetBrains Mono, Consolas, monospace", "type": "fontFamily" }
    },
    "size": {
      "xs": { "value": "0.75rem", "type": "fontSize" },
      "sm": { "value": "0.875rem", "type": "fontSize" },
      "base": { "value": "1rem", "type": "fontSize" },
      "lg": { "value": "1.125rem", "type": "fontSize" },
      "xl": { "value": "1.25rem", "type": "fontSize" },
      "2xl": { "value": "1.5rem", "type": "fontSize" },
      "3xl": { "value": "1.875rem", "type": "fontSize" },
      "4xl": { "value": "2.25rem", "type": "fontSize" },
      "5xl": { "value": "3rem", "type": "fontSize" },
      "6xl": { "value": "3.75rem", "type": "fontSize" }
    },
    "weight": {
      "regular": { "value": "400", "type": "fontWeight" },
      "medium": { "value": "500", "type": "fontWeight" },
      "semibold": { "value": "600", "type": "fontWeight" },
      "bold": { "value": "700", "type": "fontWeight" },
      "black": { "value": "800", "type": "fontWeight" }
    },
    "lineHeight": {
      "tight": { "value": "1.2", "type": "lineHeight" },
      "snug": { "value": "1.375", "type": "lineHeight" },
      "normal": { "value": "1.5", "type": "lineHeight" },
      "relaxed": { "value": "1.625", "type": "lineHeight" },
      "loose": { "value": "2", "type": "lineHeight" }
    },
    "letterSpacing": {
      "tight": { "value": "-0.025em", "type": "letterSpacing" },
      "normal": { "value": "0", "type": "letterSpacing" },
      "wide": { "value": "0.025em", "type": "letterSpacing" },
      "wider": { "value": "0.05em", "type": "letterSpacing" }
    }
  }
}
```

#### tokens/foundation/border-radius.json

```json
{
  "radius": {
    "none": { "value": "0", "type": "borderRadius" },
    "sm": { "value": "4px", "type": "borderRadius" },
    "base": { "value": "6px", "type": "borderRadius" },
    "md": { "value": "8px", "type": "borderRadius" },
    "lg": { "value": "12px", "type": "borderRadius" },
    "xl": { "value": "16px", "type": "borderRadius" },
    "2xl": { "value": "20px", "type": "borderRadius" },
    "full": { "value": "9999px", "type": "borderRadius" }
  }
}
```

#### tokens/foundation/animation.json

```json
{
  "duration": {
    "instant": { "value": "0ms", "type": "duration" },
    "fast": { "value": "150ms", "type": "duration" },
    "base": { "value": "200ms", "type": "duration" },
    "medium": { "value": "300ms", "type": "duration" },
    "slow": { "value": "500ms", "type": "duration" },
    "slowest": { "value": "700ms", "type": "duration" }
  },
  "easing": {
    "in": { "value": "cubic-bezier(0.4, 0, 1, 1)", "type": "cubicBezier" },
    "out": { "value": "cubic-bezier(0, 0, 0.2, 1)", "type": "cubicBezier" },
    "in-out": { "value": "cubic-bezier(0.4, 0, 0.2, 1)", "type": "cubicBezier" },
    "smooth": { "value": "cubic-bezier(0.45, 0, 0.15, 1)", "type": "cubicBezier" },
    "bounce": { "value": "cubic-bezier(0.68, -0.55, 0.265, 1.55)", "type": "cubicBezier" }
  }
}
```

#### tokens/foundation/shadows.json

```json
{
  "shadow": {
    "xs": {
      "value": "0 1px 2px 0 rgba(10, 74, 110, 0.05)",
      "type": "boxShadow"
    },
    "sm": {
      "value": "0 1px 3px 0 rgba(10, 74, 110, 0.1), 0 1px 2px -1px rgba(10, 74, 110, 0.1)",
      "type": "boxShadow"
    },
    "base": {
      "value": "0 4px 6px -1px rgba(10, 74, 110, 0.1), 0 2px 4px -2px rgba(10, 74, 110, 0.1)",
      "type": "boxShadow"
    },
    "md": {
      "value": "0 10px 15px -3px rgba(10, 74, 110, 0.1), 0 4px 6px -4px rgba(10, 74, 110, 0.1)",
      "type": "boxShadow"
    },
    "lg": {
      "value": "0 20px 25px -5px rgba(10, 74, 110, 0.1), 0 8px 10px -6px rgba(10, 74, 110, 0.1)",
      "type": "boxShadow"
    },
    "xl": {
      "value": "0 25px 50px -12px rgba(10, 74, 110, 0.25)",
      "type": "boxShadow"
    },
    "inner": {
      "value": "inset 0 2px 4px 0 rgba(10, 74, 110, 0.05)",
      "type": "boxShadow"
    }
  }
}
```

### 4. Configure Style Dictionary

Create `style-dictionary.config.js`:

```javascript
const StyleDictionary = require('style-dictionary');

// Custom format for CSS variables
StyleDictionary.registerFormat({
  name: 'css/variables-ocean',
  formatter: function(dictionary, config) {
    return `:root {
${dictionary.allTokens
  .map(token => `  --${token.name}: ${token.value};`)
  .join('\n')}
}

[data-theme="dark"] {
${dictionary.allTokens
  .filter(token => token.path.includes('dark'))
  .map(token => `  --${token.name}: ${token.value};`)
  .join('\n')}
}`;
  }
});

module.exports = {
  source: [
    'tokens/foundation/**/*.json',
    'tokens/lando-labs/**/*.json'
  ],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'src/styles/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables-ocean'
        }
      ]
    },
    js: {
      transformGroup: 'js',
      buildPath: 'src/tokens/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6'
        }
      ]
    },
    json: {
      transformGroup: 'js',
      buildPath: 'dist/tokens/',
      files: [
        {
          destination: 'tokens.json',
          format: 'json/flat'
        }
      ]
    }
  }
};
```

### 5. Build Script

Add to `package.json`:

```json
{
  "scripts": {
    "tokens:build": "style-dictionary build",
    "tokens:watch": "chokidar 'tokens/**/*.json' -c 'npm run tokens:build'"
  },
  "devDependencies": {
    "chokidar-cli": "^3.0.0",
    "style-dictionary": "^3.9.0"
  }
}
```

### 6. Generate Tokens

```bash
npm run tokens:build
```

This creates:
- `src/styles/tokens.css` - CSS variables
- `src/tokens/tokens.js` - JavaScript exports
- `dist/tokens/tokens.json` - JSON format

## Usage in Components

### CSS Variables

```css
/* Component CSS Module */
.button {
  padding: var(--space-4) var(--space-6);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-base);
  background-color: var(--ocean-medium);
  color: white;
  transition: all var(--duration-base) var(--easing-out);
}

.button:hover {
  background-color: var(--ocean-bright);
  box-shadow: var(--shadow-md);
}
```

### JavaScript/TypeScript

```typescript
import { tokens } from '@/tokens/tokens';

const buttonStyles = {
  padding: `${tokens.space[4]} ${tokens.space[6]}`,
  fontSize: tokens.font.size.base,
  backgroundColor: tokens.color.ocean.medium,
  borderRadius: tokens.radius.base
};
```

## Dark Mode Implementation

### Toggle Component

```typescript
'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initial = stored ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### Dark Mode CSS

```css
:root {
  --ocean-deep: #0A4A6E;
  --ocean-medium: #1B7FA8;
  /* ... light mode tokens */
}

[data-theme="dark"] {
  --ocean-deep: #B8E3F5;
  --ocean-medium: #7BC8E8;
  /* ... dark mode tokens */
}
```

## Product-Specific Tokens

> **Security note (#323):** Product-theme override **values** are written to CSS
> custom properties at runtime by `ThemeProvider`. The DS screens every value
> against CSS-injection vectors (`;`, `url(`, `@import`, `<`, …) before writing
> it; unsafe values are skipped (fail-safe) and warned in dev. Consuming apps
> also need `style-src 'unsafe-inline'` in their CSP, and can use the
> `themeScript({ nonce })` option for a strict `script-src`. See
> [Content Security Policy](./csp.md) for the full contract.

### Create Product Override

`tokens/products/ai-task-manager/colors.json`:

```json
{
  "color": {
    "product": {
      "primary": { "value": "#8B5CF6", "type": "color" },
      "primary-dark": { "value": "#7C3AED", "type": "color" },
      "primary-light": { "value": "#A78BFA", "type": "color" }
    }
  }
}
```

### Build Product-Specific Tokens

```javascript
// style-dictionary.product.config.js
module.exports = {
  source: [
    'tokens/foundation/**/*.json',
    'tokens/lando-labs/**/*.json',
    'tokens/products/ai-task-manager/**/*.json'
  ],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'products/ai-task-manager/styles/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables-ocean'
        }
      ]
    }
  }
};
```

## Token Naming Convention

Follow this naming pattern:

```
[category]-[variant]-[state]

Examples:
--ocean-medium          (color-variant)
--space-4               (spacing-size)
--font-size-xl          (typography-size-scale)
--radius-md             (border-scale)
--shadow-lg             (elevation-scale)
--duration-base         (animation-speed)
--easing-out            (animation-curve)
```

## Validation

Create token validation script `scripts/validate-tokens.js`:

```javascript
const fs = require('fs');
const path = require('path');

function validateColorContrast(color1, color2) {
  // Implement WCAG contrast checking
  // Return ratio and pass/fail for AA/AAA
}

function validateTokens() {
  const tokens = require('../src/tokens/tokens.json');

  // Check all text colors against backgrounds
  // Ensure spacing scale is consistent
  // Validate font sizes follow ratio
  // Check shadow consistency

  console.log('✅ All tokens valid');
}

validateTokens();
```

## Best Practices

1. **Never hardcode values** - Always use tokens
2. **Use semantic tokens** - Prefer `--ocean-medium` over direct hex
3. **Test both themes** - Validate light and dark mode
4. **Document custom tokens** - Add descriptions in JSON
5. **Version your tokens** - Track changes in git
6. **Validate on build** - Run validation script in CI/CD

## RGB Channel Tokens & Alpha Composition

### Why RGB Channel Tokens Exist

Hex tokens (`#1B7FA8`) and functional color tokens like `--color-ocean-medium` are perfect for opaque fills, borders, and text. They fail, however, when a component needs the same brand color at a different opacity — for example, a `box-shadow` at 10% alpha, a hover background at 8% alpha, or a selection highlight at 25% alpha.

The naive fix is to hardcode an rgba literal:

```css
/* Anti-pattern: breaks single-source-of-truth */
.highlight {
  background-color: rgba(43, 163, 212, 0.1);
}
```

This duplicates the palette into every component stylesheet. If brand colors ever shift, every rgba literal must be hunted down and re-edited. It also bypasses theme switching — the hex is frozen at author time, so it cannot respond to theme contexts the way CSS variables do.

The fix is **RGB channel tokens** — space-separated RGB triplets exported as CSS variables, ready to be composed with any alpha value at the call site.

### Token Definitions

In `src/styles/tokens.css`:

```css
:root {
  /* Standard hex tokens (for opaque usage) */
  --color-ocean-medium: #1B7FA8;

  /* RGB channel tokens (for alpha composition) */
  --color-ocean-lightest-rgb: 230 244 247;
  --color-ocean-lighter-rgb:  179 221 232;
  --color-ocean-light-rgb:    102 194 217;
  --color-ocean-base-rgb:     43 163 212;
  --color-ocean-medium-rgb:   27 127 168;
  --color-ocean-dark-rgb:     19 96 128;
  --color-ocean-darker-rgb:   13 67 88;
  --color-ocean-darkest-rgb:  8 42 56;
}
```

Note the value is a **space-separated triplet** (no commas, no `rgb(...)` wrapper). This is CSS Color Module Level 4 syntax, and is the canonical form for composition.

### The Composition Pattern

Use `rgb(var(--token) / α)` to compose the channel token with an alpha value:

```css
/* Pattern: rgb(var(--color-<palette>-<shade>-rgb) / <alpha>) */
.highlight {
  background-color: rgb(var(--color-ocean-base-rgb) / 0.1);
}

.focus-ring {
  box-shadow: 0 0 0 3px rgb(var(--color-ocean-medium-rgb) / 0.1);
}

.modal-backdrop {
  background-color: rgb(var(--color-ocean-darkest-rgb) / 0.6);
}
```

### Before & After

**Before** (hardcoded literal, duplicates the palette):

```css
/* DetailCard.module.css */
.card.clickable:hover {
  box-shadow:
    0 8px 16px rgba(27, 127, 168, 0.12),
    0 3px 8px rgba(27, 127, 168, 0.08);
}
```

**After** (token-driven, single source of truth):

```css
/* DetailCard.module.css */
.card.clickable:hover {
  box-shadow:
    0 8px 16px rgb(var(--color-ocean-medium-rgb) / 0.12),
    0 3px 8px rgb(var(--color-ocean-medium-rgb) / 0.08);
}
```

Rendered output is identical, but the color now flows from a single token — update `--color-ocean-medium-rgb` once and every composed usage follows.

### Dark Mode Inheritance

A subtle but important property of the current ocean palette: **the ocean hex values do not redefine between `[data-theme="light"]` and `[data-theme="dark"]`**. The ocean palette is a brand constant; what changes between themes is the semantic surface layer (backgrounds, text, borders) that maps onto the ocean palette.

Because of this, RGB channel tokens inherit automatically across themes with zero extra work. A component that writes:

```css
.field--highlight {
  background: rgb(var(--color-ocean-medium-rgb) / 0.25);
}
```

...produces the same resolved color in both light and dark mode, and if a future brand refresh shifts the ocean palette, both themes pick up the change together.

If you ever introduce a token whose *hex value itself* should differ per theme, define the RGB channel token inside the theme selector too — mirror the same pattern used for opaque tokens. Do not assume theme-inheritance for novel palettes.

### Color Mapping Reference

When migrating existing rgba literals, use this mapping:

| Hardcoded literal              | Token replacement                              |
| ------------------------------ | ---------------------------------------------- |
| `rgba(230, 244, 247, α)`       | `rgb(var(--color-ocean-lightest-rgb) / α)`     |
| `rgba(179, 221, 232, α)`       | `rgb(var(--color-ocean-lighter-rgb) / α)`      |
| `rgba(102, 194, 217, α)`       | `rgb(var(--color-ocean-light-rgb) / α)`        |
| `rgba(43, 163, 212, α)`        | `rgb(var(--color-ocean-base-rgb) / α)`         |
| `rgba(27, 127, 168, α)`        | `rgb(var(--color-ocean-medium-rgb) / α)`       |
| `rgba(19, 96, 128, α)`         | `rgb(var(--color-ocean-dark-rgb) / α)`         |
| `rgba(13, 67, 88, α)`          | `rgb(var(--color-ocean-darker-rgb) / α)`       |
| `rgba(8, 42, 56, α)`           | `rgb(var(--color-ocean-darkest-rgb) / α)`      |

### When NOT to Use the RGB Pattern

Use the standard `--color-ocean-*` hex tokens (not the `-rgb` channel tokens) when:

- The color is fully opaque — there's no alpha to compose
- You want the value to change per theme via semantic aliasing (e.g., `--color-surface-primary` which resolves to different hexes per theme)

The RGB channel pattern is specifically for **alpha composition of brand-constant colors** — the case where you want the same underlying hue at a variable opacity.

### Browser Support

`rgb(R G B / A)` syntax (space-separated with slash-alpha) is supported in all evergreen browsers and Safari 15.4+. If a project must support older WebKit, fall back to the CSS preprocessor approach or inline hex with opacity at the utility layer.

## Semantic alias surface (v0.14.0+)

### Why this exists

Through v0.13, component CSS referenced brand-specific tokens directly: `var(--color-ocean-medium)` for the primary tint, `var(--color-teal-base)` for accent stops, and so on. That worked for the Lando Labs ocean theme but failed the moment a consumer (e.g. one with a tea palette) wanted to re-skin.

The semantic tokens — `--color-primary`, `--color-surface`, `--color-text-primary` — flowed through cleanly, so borders and text re-skinned correctly. But tinted backgrounds, gradients, and shadows still pulled `--color-ocean-*` directly, leaving consumers with a half-skinned product unless they *also* overrode the entire ocean palette (one consumer carried ~60 lines of brand-token shadowing as a workaround).

The v0.14.0 alias surface fixes this: every brand-ramp shade now has a role-named alias that defaults to the existing ocean/teal value. Component CSS references aliases only, and consumers re-skin the aliases (or, equivalently, the underlying brand palette) at `:root`.

### The aliases

Defined in `src/styles/tokens.css`:

#### Primary brand ramp — defaults to ocean

| Alias | Default |
| --- | --- |
| `--color-primary-lightest` | `var(--color-ocean-lightest)` |
| `--color-primary-lighter` | `var(--color-ocean-lighter)` |
| `--color-primary-light` | `var(--color-ocean-light)` |
| `--color-primary-base` | `var(--color-ocean-base)` |
| `--color-primary-medium` | `var(--color-ocean-medium)` |
| `--color-primary-dark` | `var(--color-ocean-dark)` |
| `--color-primary-darker` | `var(--color-ocean-darker)` |
| `--color-primary-darkest` | `var(--color-ocean-darkest)` |

Plus matching RGB-channel aliases for `rgb(var(--token) / α)` composition: `--color-primary-{shade}-rgb`.

#### Secondary brand ramp — defaults to teal

| Alias | Default |
| --- | --- |
| `--color-secondary-lightest` | `var(--color-teal-lightest)` |
| `--color-secondary-lighter` | `var(--color-teal-lighter)` |
| `--color-secondary-light` | `var(--color-teal-light)` |
| `--color-secondary-base` | `var(--color-teal-base)` |
| `--color-secondary-medium` | `var(--color-teal-medium)` |
| `--color-secondary-dark` | `var(--color-teal-dark)` |
| `--color-secondary-darker` | `var(--color-teal-darker)` |
| `--color-secondary-darkest` | `var(--color-teal-darkest)` |

#### Danger ramp — alias to error

| Alias | Default |
| --- | --- |
| `--color-danger` | `var(--color-error)` |
| `--color-danger-lightest` | `var(--color-error-lightest)` |
| `--color-danger-light` | `var(--color-error-light)` |
| `--color-danger-base` | `var(--color-error-base)` |
| `--color-danger-dark` | `var(--color-error-dark)` |
| `--color-danger-darkest` | `var(--color-error-darkest)` |

The danger alias closes the Sprint 19 StatusDot gap and gives consumers a stable name for "destructive" UI affordances independent of the underlying `error` semantic.

### Why `--color-secondary-*` and not `--color-accent-*`?

`--color-accent`, `--color-accent-light`, and `--color-accent-dark` are pre-existing **theme-preset slots** that `ThemeProvider` populates at runtime when a theme preset is applied. Re-using that namespace for a static teal-replacement ramp would collide with the preset contract.

`--color-secondary-*` is a fresh namespace with no prior contract, and reads cleanly as the "supporting" ramp paired with primary.

### How to re-skin

A consumer with a tea palette overrides the aliases at `:root`:

```css
:root {
  /* Re-skin primary brand ramp to a tea palette */
  --color-primary-lightest: #F5F0E8;
  --color-primary-lighter:  #E8DCC8;
  --color-primary-light:    #C9B187;
  --color-primary-base:     #8B6F47;
  --color-primary-medium:   #6B5538;
  --color-primary-dark:     #4F3F2A;
  --color-primary-darker:   #38291C;
  --color-primary-darkest:  #1F1610;

  /* Channel form (space-separated RGB triplets) */
  --color-primary-base-rgb:    139 111 71;
  --color-primary-medium-rgb:  107 85 56;
  --color-primary-dark-rgb:    79 63 42;
  --color-primary-darkest-rgb: 31 22 16;
  /* … and so on for the full ramp */
}
```

This is a one-place override — no component CSS needs to change, no brand-token shadowing required.

### Dark mode inheritance

The aliases pass through to the underlying ocean/teal tokens, which themselves do not redefine between light and dark mode (the ocean palette is a brand constant — see "Dark Mode Inheritance" earlier in this document). Aliases therefore inherit dark-mode behavior automatically.

If a future consumer ships a palette whose hex values *do* differ per theme, override the aliases inside `[data-theme='dark']` as well — same pattern as the existing dark-mode block in `tokens.css`.

### Brand-tinted chrome (opt-in, v0.26.0)

By default the **chrome layer** — `--color-background`, `--color-surface*`, `--color-border*`, `--color-text*` — is neutral in light mode and a static ocean-dark in dark mode. So overriding the brand re-skins *accents* (buttons, links, charts, the derived ramp) but leaves the dominant page surface neutral-cool. Setting **`data-tint-chrome`** on the root opts every surface into a subtle tint toward the live `--color-primary`:

```html
<!-- brand override + the opt-in flag belong on the SAME root element -->
<html data-tint-chrome style="--color-primary: #DC2626">
```

```tsx
// or via ThemeProvider — `tintChrome` writes `data-tint-chrome` to the same
// root it already manages (data-theme, data-product, the --color-primary ramp)
<ThemeProvider tintChrome defaultProductTheme={brandTheme}>
  <App />
</ThemeProvider>
```

- **Opt-in / non-breaking.** Absent the attribute, appearance is visually identical (ΔE < 0.013) to the current default — the dark block was re-expressed from literal hex to `color-mix()` token refs, an imperceptible shift.
- **Same root scope as the brand.** Like the derived `--color-primary-*` ramp, the tint resolves where `--color-primary` is declared — set the override and `data-tint-chrome` on `:root`/`<html>`, not a subtree, or the ramp won't re-derive under it. Note this is opt-in, not a no-op even for the home brand: enabling the tint re-anchors dark-mode text to neutral rungs, so even the default Ocean **dark** theme becomes *slightly* less saturated when the tint is on.
- **Contrast-safe by construction.** Each token mixes only toward a ramp rung in its *own* lightness lane — surfaces toward `--color-primary-light` (stay light), text toward `--color-primary-darkest` (stay dark) — so contrast can't collapse for an off-hue brand. `src/tokens/chrome-contrast.test.ts` resolves every text/surface pairing for a matrix of hostile primaries (every hue + near-white/near-black brands) and **fails CI** if any drops below WCAG AA. Verify a derived theme yourself with the published `meetsContrastAA(fg, bg)` from `@lando-labs/lando-ds/tokens`.

### CI enforcement

After Stage 2b lands, the component sweep, lint will block any `var(--color-(ocean|teal)-*)` reference inside `src/components/**/*.module.css`. Direct brand-ramp references in component CSS become an error. Token files (`src/styles/tokens.css`), product themes, and tests remain free to reference the brand tokens directly — only the component layer is locked down.

### Migration in component CSS

Stage 2b replaces every direct ocean/teal reference per the explicit map in `STAGE_2A_PLAN.md`. The replacement is mechanical:

| Brand ref | Alias replacement |
| --- | --- |
| `var(--color-ocean-{shade})` | `var(--color-primary-{shade})` |
| `var(--color-ocean-{shade}-rgb)` | `var(--color-primary-{shade}-rgb)` |
| `var(--color-teal-{shade})` | `var(--color-secondary-{shade})` |
| `var(--color-teal-{shade}-rgb)` | `var(--color-secondary-{shade}-rgb)` |

Two pre-existing aliases also flow through (defined in `tokens.css` as ocean alternates):

| Brand alias | Alias replacement |
| --- | --- |
| `var(--color-ocean-bright)` (= ocean-base) | `var(--color-primary-base)` |
| `var(--color-ocean-mist)` (= ocean-lighter) | `var(--color-primary-lighter)` |
| `var(--color-ocean-foam)` (= ocean-lightest) | `var(--color-primary-lightest)` |
| `var(--color-ocean-deep)` (= ocean-dark) | `var(--color-primary-dark)` |
| `var(--color-teal-bright)` (= teal-base) | `var(--color-secondary-base)` |
| `var(--color-teal-seafoam)` (= teal-light) | `var(--color-secondary-light)` |
| `var(--color-teal-deep)` (= teal-dark) | `var(--color-secondary-dark)` |

## Troubleshooting

**Issue**: CSS variables not updating
**Solution**: Ensure `:root` is at document level, check specificity

**Issue**: Dark mode flicker on load
**Solution**: Use inline script to set theme before render

**Issue**: Product tokens not overriding
**Solution**: Check source order in Style Dictionary config

## Next Steps

1. Create component tokens (button, input, card specific)
2. Add responsive tokens (breakpoint-based)
3. Set up token documentation site
4. Create token testing playground
