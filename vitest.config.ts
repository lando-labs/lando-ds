import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// #468 — mirror vite.config.ts's `define` so `__DS_VERSION__` (used by
// src/index.ts's VERSION export) also resolves under Vitest. Without this the
// version.test.ts assertion would hit an undefined identifier.
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string }

export default defineConfig({
  define: {
    __DS_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './vitest.setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/tokens': resolve(__dirname, './src/tokens'),
      '@/utils': resolve(__dirname, './src/utils'),
    },
  },
})
