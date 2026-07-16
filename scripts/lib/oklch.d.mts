/**
 * Type declarations for the zero-dependency OKLCH color math in `oklch.mjs`.
 * The runtime is plain ESM JS (consumed by both the emit script and the
 * round-trip Vitest test); these ambient types let `tsc --noEmit` type-check
 * the `.mjs` import from `src/tokens/oklch-roundtrip.test.ts`.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Oklch {
  L: number
  C: number
  H: number
}

export interface Oklab {
  L: number
  a: number
  b: number
}

export interface OklchToSrgbResult extends Rgb {
  /** False if any linear channel fell outside [0,1] beyond a float epsilon. */
  inGamut: boolean
}

export function srgbChannelToLinear(c8: number): number
export function linearToSrgbChannel(c: number): number
export function hexToRgb(hex: string): Rgb
export function rgbToHex(rgb: Rgb): string
export function linearSrgbToOklab(r: number, g: number, b: number): Oklab
export function oklabToLinearSrgb(L: number, a: number, b: number): Rgb
export function hexToOklch(hex: string): Oklch
export function oklchToSrgb(L: number, C: number, H: number): OklchToSrgbResult
export function formatOklch(oklch: Oklch): string
export function hexToOklchString(hex: string): string
export function oklchToHex(L: number, C: number, H: number): string
export function oklabFromHex(hex: string): Oklab
export const WHITE_OKLAB: Oklab
export const BLACK_OKLAB: Oklab
export function mixOklab(a: Oklab, b: Oklab, p: number): Oklab
export function oklabDeltaE(o1: Oklab, o2: Oklab): number
export function oklabToOklch(oklab: Oklab): Oklch
