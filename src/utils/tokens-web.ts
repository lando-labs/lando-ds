/**
 * Web-side composers that turn platform-agnostic token primitives back into
 * CSS string values. The canonical tokens in `src/tokens/*.ts` are stored as
 * numbers (px) and structured objects so React Native and other non-web
 * targets can consume them directly. The web rendering path (CSS variables,
 * StyleSheet emission via ThemeProvider) uses these composers to format
 * values for CSS.
 */

import type { ShadowLayer } from '../tokens/shadows'
import type { EasingBezier } from '../tokens/animation'

/** `8` → `"8px"`. Pass strings through unchanged (for `"100%"`, `"auto"`, etc.). */
export function composeSpacing(value: number | string): string {
  if (typeof value === 'string') return value
  return `${value}px`
}

/** `8` → `"8px"`. Same shape as composeSpacing; named for clarity at call sites. */
export const composeRadius = composeSpacing

/** `16` → `"16px"`. Same shape; named for clarity at call sites. */
export const composeFontSize = composeSpacing

/** `-0.05` (em) → `"-0.05em"`. Pass strings through. */
export function composeLetterSpacing(value: number | string): string {
  if (typeof value === 'string') return value
  if (value === 0) return '0'
  return `${value}em`
}

/** `200` → `"200ms"`. */
export function composeDuration(ms: number): string {
  return `${ms}ms`
}

/** `[0, 0, 0.2, 1]` → `"cubic-bezier(0, 0, 0.2, 1)"`. `"linear"` → `"linear"`. */
export function composeEasing(easing: EasingBezier | 'linear'): string {
  if (easing === 'linear') return 'linear'
  return `cubic-bezier(${easing.join(', ')})`
}

/**
 * Compose a CSS `transition` shorthand from primitives.
 * `composeTransition('all', 200, [0, 0, 0.2, 1])` → `"all 200ms cubic-bezier(0, 0, 0.2, 1)"`.
 */
export function composeTransition(
  property: string,
  durationMs: number,
  easing: EasingBezier | 'linear',
): string {
  return `${property} ${composeDuration(durationMs)} ${composeEasing(easing)}`
}

/**
 * Compose a CSS `animation` shorthand from primitives.
 * `composeAnimationShorthand('spin', 500, 'linear', 'infinite')` →
 *   `"spin 500ms linear infinite"`.
 */
export function composeAnimationShorthand(
  name: string,
  durationMs: number,
  easing: EasingBezier | 'linear',
  iterationCount?: 'infinite' | number,
): string {
  const base = `${name} ${composeDuration(durationMs)} ${composeEasing(easing)}`
  return iterationCount !== undefined ? `${base} ${iterationCount}` : base
}

/**
 * Compose one or more shadow layers into a CSS `box-shadow` value.
 * `[{ x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(...)' }]` →
 *   `"0px 1px 2px 0px rgba(...)"`.
 * Inset layers render with the `inset` keyword.
 * `'none'` passes through.
 */
export function composeBoxShadow(value: readonly ShadowLayer[] | 'none'): string {
  if (value === 'none') return 'none'
  return value
    .map((l) => {
      const prefix = l.inset ? 'inset ' : ''
      return `${prefix}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`
    })
    .join(', ')
}
