/**
 * Lando Labs Design System - Animation Tokens
 * Calm, fluid animations inspired by ocean waves
 *
 * Philosophy:
 * - Smooth, natural motion like water
 * - Fast enough to feel responsive
 * - Gentle enough to avoid jarring users
 * - Consistent timing across components
 *
 * Platform-agnostic primitives:
 * - Durations are numbers in milliseconds (ms).
 * - Easings are 4-tuples of `cubic-bezier` coefficients `[x1, y1, x2, y2]`,
 *   except for `'linear'` which is a sentinel string.
 * - The web rendering path composes CSS strings via composers in
 *   ../utils/tokens-web.ts (`composeDuration`, `composeEasing`,
 *   `composeTransition`, `composeAnimationShorthand`).
 * - React Native consumers feed durations directly to `Animated.timing()` and
 *   pass easing tuples to `Easing.bezier(...args)`.
 *
 * The `transitions`, `keyframes`, and `animationPresets` exports remain
 * CSS-shorthand strings — they're web-only convenience exports rebuilt
 * internally from the canonical primitives. RN consumers should ignore them.
 */

import {
  composeAnimationShorthand,
  composeTransition,
} from '../utils/tokens-web'

/** 4-tuple of cubic-bezier coefficients: [x1, y1, x2, y2]. */
export type EasingBezier = readonly [number, number, number, number]

export const animation = {
  // Duration presets (numbers, ms)
  duration: {
    instant: 0,
    fastest: 50,     // Instant feedback (hover states)
    faster: 100,     // Very fast transitions
    fast: 150,       // Fast transitions (default)
    normal: 200,     // Standard transitions
    slow: 300,       // Deliberate transitions
    slower: 500,     // Slow, emphasized transitions
    slowest: 700,    // Very slow transitions
  },

  // Easing functions (cubic-bezier 4-tuples, or `'linear'` sentinel)
  easing: {
    // Standard easings
    linear: 'linear' as const,
    easeIn: [0.4, 0, 1, 1] as EasingBezier,
    easeOut: [0, 0, 0.2, 1] as EasingBezier,           // Default - calm wave receding
    easeInOut: [0.4, 0, 0.2, 1] as EasingBezier,

    // Custom ocean-inspired easings
    wave: [0, 0, 0.2, 1] as EasingBezier,              // Gentle wave motion (ease-out, #65 — mirrors CSS --easing-wave)
    surge: [0.34, 1.56, 0.64, 1] as EasingBezier,      // Wave surge (slight overshoot)
    ripple: [0.25, 0.46, 0.45, 0.94] as EasingBezier,  // Ripple effect
    tide: [0.65, 0, 0.35, 1] as EasingBezier,          // Tide motion

    // Bouncy easings (use sparingly)
    bounce: [0.68, -0.55, 0.265, 1.55] as EasingBezier,
    elastic: [0.175, 0.885, 0.32, 1.275] as EasingBezier,
  },

  // Delay presets (numbers, ms)
  delay: {
    none: 0,
    shortest: 50,
    short: 100,
    medium: 150,
    long: 200,
    longest: 300,
  },
} as const

// Transition presets — web-only CSS strings, rebuilt from canonical primitives.
export const transitions = {
  // Basic transitions
  default: composeTransition('all', animation.duration.fast, animation.easing.easeOut),
  fast: composeTransition('all', animation.duration.faster, animation.easing.easeOut),
  slow: composeTransition('all', animation.duration.slow, animation.easing.easeOut),

  // Property-specific transitions
  color: composeTransition('color', animation.duration.fast, animation.easing.easeOut),
  background: composeTransition('background-color', animation.duration.fast, animation.easing.easeOut),
  border: composeTransition('border-color', animation.duration.fast, animation.easing.easeOut),
  opacity: composeTransition('opacity', animation.duration.normal, animation.easing.easeOut),
  transform: composeTransition('transform', animation.duration.normal, animation.easing.wave),
  shadow: composeTransition('box-shadow', animation.duration.normal, animation.easing.easeOut),

  // Component-specific transitions
  button: [
    composeTransition('background-color', animation.duration.fast, animation.easing.easeOut),
    composeTransition('transform', animation.duration.fastest, animation.easing.easeOut),
    composeTransition('box-shadow', animation.duration.normal, animation.easing.easeOut),
  ].join(', '),
  link: composeTransition('color', animation.duration.fastest, animation.easing.easeOut),
  modal: [
    composeTransition('opacity', animation.duration.normal, animation.easing.easeOut),
    composeTransition('transform', animation.duration.normal, animation.easing.wave),
  ].join(', '),
  dropdown: [
    composeTransition('opacity', animation.duration.fast, animation.easing.easeOut),
    composeTransition('transform', animation.duration.fast, animation.easing.wave),
  ].join(', '),
  tooltip: composeTransition('opacity', animation.duration.faster, animation.easing.easeOut),
} as const

// Keyframe animations (web-only — string-based CSS keyframe definitions)
export const keyframes = {
  // Fade animations
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
  },

  // Slide animations
  slideInUp: {
    from: { transform: 'translateY(10px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
  slideInDown: {
    from: { transform: 'translateY(-10px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
  slideInLeft: {
    from: { transform: 'translateX(-10px)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
  },
  slideInRight: {
    from: { transform: 'translateX(10px)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
  },

  // Scale animations
  scaleIn: {
    from: { transform: 'scale(0.95)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
  },
  scaleOut: {
    from: { transform: 'scale(1)', opacity: 1 },
    to: { transform: 'scale(0.95)', opacity: 0 },
  },

  // Rotate animations
  spin: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },

  // Pulse animation (for loading states)
  pulse: {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },

  // Wave animation (ocean-inspired)
  wave: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-4px)' },
  },

  // Ripple animation (spreading effect)
  ripple: {
    '0%': { transform: 'scale(0)', opacity: 0.5 },
    '100%': { transform: 'scale(1)', opacity: 0 },
  },
} as const

// Animation presets — web-only CSS shorthand strings.
export const animationPresets = {
  // Loading animations
  spinner: composeAnimationShorthand('spin', animation.duration.slower, animation.easing.linear, 'infinite'),
  pulse: composeAnimationShorthand('pulse', animation.duration.slowest, animation.easing.easeInOut, 'infinite'),

  // Entrance animations
  fadeIn: composeAnimationShorthand('fadeIn', animation.duration.normal, animation.easing.easeOut),
  slideInUp: composeAnimationShorthand('slideInUp', animation.duration.normal, animation.easing.wave),
  slideInDown: composeAnimationShorthand('slideInDown', animation.duration.normal, animation.easing.wave),
  scaleIn: composeAnimationShorthand('scaleIn', animation.duration.fast, animation.easing.wave),

  // Exit animations
  fadeOut: composeAnimationShorthand('fadeOut', animation.duration.fast, animation.easing.easeIn),
  scaleOut: composeAnimationShorthand('scaleOut', animation.duration.fast, animation.easing.easeIn),

  // Interactive animations
  wave: composeAnimationShorthand('wave', animation.duration.slower, animation.easing.wave, 'infinite'),
  ripple: composeAnimationShorthand('ripple', animation.duration.slower, animation.easing.easeOut),
} as const

// Type exports
export type Animation = typeof animation
export type Transitions = typeof transitions
export type Keyframes = typeof keyframes
export type AnimationPresets = typeof animationPresets
export type Duration = keyof typeof animation.duration
export type Easing = keyof typeof animation.easing
