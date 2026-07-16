/**
 * src/tokens/oklch.ts
 *
 * Published TypeScript twin of `scripts/lib/oklch.mjs`. The build script keeps
 * its own zero-dep `.mjs` copy (no TS in the pre-build graph); `oklch-parity.test.ts`
 * asserts the two never drift.
 *
 * Zero-dependency sRGB <-> OKLCH color conversion (Björn Ottosson's OKLab).
 * This is the surface consumers import from `@lando-labs/lando-ds/tokens`
 * instead of forking the matrix math.
 *
 * The DS authors colors as sRGB hex in `src/tokens/colors.ts` (the JS source of
 * truth — `resolveColorPath` returns hex). The CSS token layer ships the same
 * ramps as `oklch()` so the platform gets perceptually-even ramps + a wide-gamut
 * format. hex -> OKLCH is a lossless coordinate transform: every emitted
 * `oklch(L C H)` round-trips back to its source hex within < 1/255 per channel,
 * which is what makes "the Ocean theme is perceptually unchanged" a provable
 * claim rather than an eyeball.
 *
 * No external dep (no culori) on purpose — this is ~standard matrix math and we
 * don't want a runtime/devtime color library in the build graph for it.
 */

/** Polar OKLCH coordinates. L,C in 0..~1; H in degrees 0..360. */
export interface Oklch {
  L: number
  C: number
  H: number
}

/** Integer sRGB channels (0..255). */
export interface Rgb {
  r: number
  g: number
  b: number
}

/** Rectangular OKLab coordinates (the space CSS `color-mix(in oklab, …)` uses). */
export interface Oklab {
  L: number
  a: number
  b: number
}

/** sRGB channels (0..255, clamped) plus an in-gamut flag from the conversion. */
export interface OklchSrgb extends Rgb {
  inGamut: boolean
}

/* ---- sRGB (0..255) <-> linear-light sRGB (0..1) ---- */

/** Companded sRGB channel (0..255) -> linear-light (0..1). */
export function srgbChannelToLinear(c8: number): number {
  const c = c8 / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Linear-light channel (0..1) -> companded sRGB (0..255, unclamped). */
export function linearToSrgbChannel(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return v * 255
}

/* ---- hex <-> {r,g,b} (0..255) ---- */

/** Parse `#RRGGBB` (or `#RGB`) to integer channels 0..255. */
export function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex color: "${hex}"`)
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** Integer channels 0..255 -> `#RRGGBB` (uppercase). */
export function rgbToHex({ r, g, b }: Rgb): string {
  const f = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase()
  return `#${f(r)}${f(g)}${f(b)}`
}

/* ---- linear sRGB <-> OKLab (Ottosson) ---- */

export function linearSrgbToOklab(r: number, g: number, b: number): Oklab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

export function oklabToLinearSrgb(L: number, a: number, b: number): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

/* ---- public: hex <-> OKLCH ---- */

/**
 * Convert `#RRGGBB` to OKLCH coordinates.
 * @returns L,C in 0..~1; H in degrees 0..360.
 *   Hue is normalized to 0 for achromatic (near-zero chroma) colors so neutrals
 *   emit a stable `oklch(L 0 0)` instead of an arbitrary atan2 angle on noise.
 */
export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex)
  const lr = srgbChannelToLinear(r)
  const lg = srgbChannelToLinear(g)
  const lb = srgbChannelToLinear(b)
  const { L, a, b: bb } = linearSrgbToOklab(lr, lg, lb)
  const C = Math.hypot(a, bb)
  let H: number
  if (C < 1e-6) {
    H = 0
  } else {
    H = (Math.atan2(bb, a) * 180) / Math.PI
    if (H < 0) H += 360
  }
  return { L, C, H }
}

/**
 * Convert OKLCH coordinates back to sRGB.
 * @returns channels 0..255 (clamped); `inGamut` is false if any linear channel
 *   fell outside [0,1] beyond a tiny float epsilon before clamping.
 */
export function oklchToSrgb(L: number, C: number, H: number): OklchSrgb {
  const hr = (H * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const lin = oklabToLinearSrgb(L, a, b)

  // Gamut tolerance. A channel that lands a hair past [0,1] purely from the
  // 4-decimal OKLCH rounding of an already-in-gamut source (e.g. #FFEDD5's red
  // channel round-trips to 1.0002) is NOT a real gamut clip — after companding
  // + clamping it maps back to 255 with zero 1/255-scale error. Real out-of-gamut
  // colors overshoot by orders of magnitude more. ~0.25/255 in linear light
  // separates "rounding noise" from "actually clipped".
  const eps = 1e-3
  const inGamut =
    lin.r >= -eps &&
    lin.r <= 1 + eps &&
    lin.g >= -eps &&
    lin.g <= 1 + eps &&
    lin.b >= -eps &&
    lin.b <= 1 + eps

  const clamp = (c: number) => Math.max(0, Math.min(255, linearToSrgbChannel(c)))
  return { r: clamp(lin.r), g: clamp(lin.g), b: clamp(lin.b), inGamut }
}

/**
 * Format an OKLCH triple as a CSS `oklch()` string. L is emitted to 4 decimals
 * (0..1), C to 4 decimals, H to 2 decimals (degrees) — enough precision that the
 * round-trip back to sRGB lands within < 1/255 per channel for all DS rungs,
 * without emitting noise digits. Trailing zeros are trimmed.
 */
export function formatOklch({ L, C, H }: Oklch): string {
  const trim = (n: number, dp: number) => {
    const s = n.toFixed(dp)
    return s.replace(/\.?0+$/, '') || '0'
  }
  return `oklch(${trim(L, 4)} ${trim(C, 4)} ${trim(H, 2)})`
}

/** Convenience: `#RRGGBB` -> `oklch(...)` CSS string. */
export function hexToOklchString(hex: string): string {
  return formatOklch(hexToOklch(hex))
}

/**
 * Convert OKLCH coordinates back to a clamped `#RRGGBB` hex string.
 * Inverse of {@link hexToOklch} (modulo gamut clamping). Consumers/tools that
 * need to round-trip OKLCH back to a paintable hex (theme builders, contrast
 * tooling) use this instead of forking the matrix math.
 */
export function oklchToHex(L: number, C: number, H: number): string {
  const { r, g, b } = oklchToSrgb(L, C, H)
  return rgbToHex({ r, g, b })
}

/* ---- OKLab-space mixing (models CSS `color-mix(in oklab, …)`) ---- */

/**
 * OKLab coordinates for a hex color: `{ L, a, b }` (rectangular OKLab, the space
 * CSS `color-mix(in oklab, …)` interpolates in). Distinct from {@link hexToOklch},
 * which returns polar `{ L, C, H }`.
 */
export function oklabFromHex(hex: string): Oklab {
  const { r, g, b } = hexToRgb(hex)
  return linearSrgbToOklab(srgbChannelToLinear(r), srgbChannelToLinear(g), srgbChannelToLinear(b))
}

/** Pre-computed OKLab of pure white (`#FFFFFF`) — the lighten endpoint. */
export const WHITE_OKLAB: Oklab = oklabFromHex('#FFFFFF')
/** Pre-computed OKLab of pure black (`#000000`) — the darken endpoint. */
export const BLACK_OKLAB: Oklab = oklabFromHex('#000000')

/**
 * Model CSS `color-mix(in oklab, A, B p%)`: linear interpolation in OKLab,
 * weighting `B` by `p` percent. `a`/`b` accept `{ L, a, b }` OKLab objects.
 * Returns the mixed OKLab triple. (CSS mixes in OKLab, so this matches the
 * browser's result for two fully-opaque colors.)
 */
export function mixOklab(a: Oklab, b: Oklab, p: number): Oklab {
  const w = p / 100
  return {
    L: a.L * (1 - w) + b.L * w,
    a: a.a * (1 - w) + b.a * w,
    b: a.b * (1 - w) + b.b * w,
  }
}

/** Euclidean ΔE between two OKLab triples (OKLab ΔE — perceptual distance). */
export function oklabDeltaE(o1: Oklab, o2: Oklab): number {
  return Math.hypot(o1.L - o2.L, o1.a - o2.a, o1.b - o2.b)
}

/** OKLab `{ L, a, b }` -> OKLCH `{ L, C, H }` (polar). Hue 0 when achromatic. */
export function oklabToOklch({ L, a, b }: Oklab): Oklch {
  const C = Math.hypot(a, b)
  let H = 0
  if (C >= 1e-6) {
    H = (Math.atan2(b, a) * 180) / Math.PI
    if (H < 0) H += 360
  }
  return { L, C, H }
}
