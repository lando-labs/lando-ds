// ESLint v9 flat config for @lando-labs/lando-ds
//
// Enforces the type-hygiene standards set in Sprint 8 (v0.5.2):
//   - `@typescript-eslint/no-explicit-any` = error on src/components/** (issue #16)
//   - React hooks rules on all TS/TSX
//   - HMR-safe fast-refresh warning
//
// Reference: reference/component-authoring.md
//
// Note: we use the separate @typescript-eslint/parser + @typescript-eslint/eslint-plugin
// packages (already in devDependencies at v8.x) rather than the unified
// `typescript-eslint` helper, since the unified package is not installed.

import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // Global ignores (replaces .eslintignore in flat config).
  // NOTE: a bare `ignores` block MUST NOT be combined with `files`/`rules` in
  // the same entry — otherwise it becomes a per-matcher ignore, not a global
  // one. Keep this object minimal.
  {
    ignores: [
      'dist/**',
      'dist-meta/**',
      'dist-meta-schema/**',
      'node_modules/**',
      'coverage/**',
      '.storybook/**',
      '.claude/**',
      'mcp-server/**',
      'mcp-test-app/**',
      'examples/**',
      'scripts/**',
      'reference/**',
      // Config files at repo root — not part of the library surface.
      '*.config.js',
      '*.config.ts',
      '*.config.cjs',
      '*.config.mjs',
      'vite.config.ts',
      'vitest.config.ts',
    ],
  },

  // Base recommended JS rules.
  js.configs.recommended,

  // TS/TSX base: parser + plugin + recommended rules.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // Browser + DOM globals the library uses.
        window: 'readonly',
        document: 'readonly',
        globalThis: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLLIElement: 'readonly',
        HTMLHRElement: 'readonly',
        HTMLProgressElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLOListElement: 'readonly',
        HTMLUListElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLTableElement: 'readonly',
        HTMLHeadingElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        FocusEvent: 'readonly',
        Event: 'readonly',
        IntersectionObserver: 'readonly',
        IntersectionObserverInit: 'readonly',
        ResizeObserver: 'readonly',
        MutationObserver: 'readonly',
        getComputedStyle: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        CustomEvent: 'readonly',
        DOMRect: 'readonly',
        SVGSVGElement: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Turn off core ESLint rules that clash with TS.
      'no-unused-vars': 'off',
      'no-undef': 'off', // TS handles this; ESLint's rule sees JSX intrinsics as undefined.

      // TS-aware versions. Explicitly-prefixed `_` is the escape hatch.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // React hooks — pulled from the plugin's recommended config.
      ...reactHooks.configs.recommended.rules,

      // HMR safety for component files. `allowConstantExport` lets us export
      // theme-related constants alongside a component without warning.
      //
      // Turned OFF for this library: our compound-component pattern
      // (e.g. Tabs + useTabsContext, Accordion + useAccordionContext,
      // ThemeProvider + useTheme) co-exports a hook with the component by
      // design. That pattern is fundamental to the API — see
      // reference/component-authoring.md Template 3. The rule is aimed at
      // Next.js/CRA app code with dev-time HMR, not library source that
      // compiles to a `.js` bundle.
      'react-refresh/only-export-components': 'off',

      // Baseline library hygiene.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Stricter rules for component source — Sprint 8 issue #16.
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Test files — relaxed. globalThis.IntersectionObserver mocks (StickyBar.test.tsx)
  // and similar shim code are fine here.
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      'src/test/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
]
