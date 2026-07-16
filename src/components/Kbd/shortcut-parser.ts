/**
 * Keyboard shortcut parser for the Kbd component.
 *
 * Parses semantic shortcut strings like "meta+k" or "shift+alt+f" into
 * platform-appropriate display tokens.
 *
 * - On macOS: returns symbols (⌘K, ⇧⌥F)
 * - Elsewhere: returns Ctrl/Alt/Shift labels joined with '+'
 */

const MAC_SYMBOLS: Record<string, string> = {
  meta: '⌘',
  cmd: '⌘',
  command: '⌘',
  alt: '⌥',
  option: '⌥',
  opt: '⌥',
  ctrl: '⌃',
  control: '⌃',
  shift: '⇧',
  enter: '↵',
  return: '↵',
  escape: '⎋',
  esc: '⎋',
  tab: '⇥',
  backspace: '⌫',
  delete: '⌦',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
}

const NON_MAC_LABELS: Record<string, string> = {
  meta: 'Ctrl', // Non-Mac shortcuts typically use Ctrl even when "meta" is semantically specified
  cmd: 'Ctrl',
  command: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  enter: 'Enter',
  return: 'Enter',
  escape: 'Esc',
  esc: 'Esc',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform =
    (navigator as Navigator & { platform?: string }).platform ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform) || /mac/i.test(navigator.userAgent)
}

/**
 * Parse a shortcut string like "meta+k" or "shift+alt+f" into a display
 * string. On Mac, returns symbols without separators (⌘K). Otherwise
 * returns labels joined with '+' (Ctrl+K).
 */
export function parseShortcut(shortcut: string, platformIsMac: boolean): string {
  const parts = shortcut.split('+').map((s) => s.trim().toLowerCase())
  const table = platformIsMac ? MAC_SYMBOLS : NON_MAC_LABELS

  if (platformIsMac) {
    // Modifiers render as symbols, then the final key as uppercase letter
    return parts.map((p) => table[p] ?? p.toUpperCase()).join('')
  }

  // Modifiers + keys joined with '+'; unknown keys are capitalized
  return parts
    .map((p, i) => {
      if (i === parts.length - 1) return table[p] ?? p.toUpperCase()
      return table[p] ?? p
    })
    .join('+')
}
