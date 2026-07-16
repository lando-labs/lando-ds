/**
 * Lando Labs Design System - Utilities Index
 * Export all utility functions and providers
 */

export { ThemeProvider, useTheme, themeScript, themeScriptPath, presetColorVars, isSafeTokenValue, isSafeTokenKey } from './ThemeProvider'
export type { ThemeMode, ResolvedTheme, ThemeScriptOptions } from './ThemeProvider'

// #370 — re-export the mode-aware token value shape next to the rest of the
// theming API. Canonical declaration lives in `src/tokens/index.ts`.
export type { ModeAwareTokenValue } from '../tokens'

export { calculatePosition, clamp } from './positioning'
export type { Position, PositionResult } from './positioning'

export { safeHref, isExternalHref } from './safeHref'
export { sanitizeRestProps } from './sanitizeRestProps'

export { supportsPopoverApi, syncPopoverState } from './popoverApi'
