/**
 * safeHref — URL sanitizer for `<a href>` sinks.
 *
 * #320 — Component anchors (Footer, Sidebar, Breadcrumb, ArticleCard,
 * Markdown, …) historically passed consumer-supplied `href` values straight
 * through. A value like `javascript:alert(document.cookie)` then executes on
 * click. `safeHref` is an allow-list gate: it returns the URL only when it is
 * a same-document/relative reference or carries an explicitly safe scheme;
 * anything else collapses to `fallback` (default `'#'`).
 *
 * ## Allowed
 * - Relative paths: `/x`, `./x`, `../x`, bare `x`
 * - Fragments: `#section`
 * - Query-only: `?q=1`
 * - Protocol-relative: `//cdn.example.com/a.js`
 * - Empty / nullish → `fallback`
 * - Schemes (case-insensitive): `https:`, `http:`, `mailto:`, `tel:`, `sms:`
 *
 * ## Blocked (→ fallback)
 * - `javascript:`, `data:`, `vbscript:`, `file:`, and every other scheme.
 *
 * ## Obfuscation handling
 * Browsers ignore ASCII whitespace and C0 control characters embedded inside
 * a scheme — `java\tscript:alert(1)` and `\x01javascript:…` both execute.
 * We therefore build a normalized copy with ALL ASCII whitespace + control
 * characters removed and test the scheme against that copy. A `:` that occurs
 * before any `/`, `?`, or `#` is treated as a scheme separator (mirroring how
 * the URL parser distinguishes `scheme:rest` from a relative path that merely
 * contains a colon, e.g. `/a:b`).
 *
 * The original (whitespace-trimmed) string is what gets returned for allowed
 * inputs — normalization is only used for the security decision.
 *
 * @param url The candidate href (consumer-supplied; may be null/undefined).
 * @param fallback Value returned for blocked or empty input. Default `'#'`.
 * @returns A safe href string.
 */

const SAFE_SCHEMES = new Set(['https', 'http', 'mailto', 'tel', 'sms'])

// ASCII whitespace + C0 controls + DEL. Assembled via String.fromCharCode so
// the deliberate control-char range does not trip the no-control-regex lint
// rule (whose purpose is to catch *accidental* control chars in a pattern).
const STRIPPABLE = (() => {
  const ranges: string[] = []
  for (let i = 0x00; i <= 0x20; i += 1) ranges.push(String.fromCharCode(i))
  ranges.push(String.fromCharCode(0x7f))
  return new Set(ranges)
})()

const stripWhitespaceAndControls = (value: string): string => {
  let out = ''
  for (const char of value) {
    if (!STRIPPABLE.has(char)) out += char
  }
  return out
}

export function safeHref(
  url: string | null | undefined,
  fallback = '#',
): string {
  if (url == null) return fallback

  // Trim surrounding ASCII whitespace for the returned value.
  const trimmed = url.trim()
  if (trimmed === '') return fallback

  // Normalized copy used ONLY for the scheme decision: strip every ASCII
  // whitespace + control char so `java\tscript:` etc. can't slip through.
  const normalized = stripWhitespaceAndControls(trimmed)
  if (normalized === '') return fallback

  // Find the scheme separator: the first ':' that appears before any path,
  // query, or fragment delimiter. If there is none, the value is relative /
  // fragment / query / protocol-relative — all allowed.
  const colonIndex = normalized.indexOf(':')
  if (colonIndex === -1) return trimmed

  const firstDelimiter = (() => {
    const candidates = ['/', '?', '#']
      .map((d) => normalized.indexOf(d))
      .filter((i) => i !== -1)
    return candidates.length ? Math.min(...candidates) : -1
  })()

  // A ':' that comes AFTER a path/query/fragment delimiter is not a scheme
  // (e.g. `/foo:bar`, `#a:b`) — treat as relative and allow.
  if (firstDelimiter !== -1 && colonIndex > firstDelimiter) {
    return trimmed
  }

  // Otherwise the prefix before ':' is a scheme. Allow only the safe set.
  const scheme = normalized.slice(0, colonIndex).toLowerCase()
  if (SAFE_SCHEMES.has(scheme)) return trimmed

  return fallback
}

/**
 * isExternalHref — true when a href points to another site (an absolute
 * http(s) URL or a protocol-relative `//host` reference).
 *
 * #321 — External links must open with `target="_blank"` +
 * `rel="noopener noreferrer"` (tabnabbing protection). Relative paths,
 * fragments, query-only refs, and non-navigational schemes (mailto/tel/sms)
 * are NOT treated as external and keep default in-page behavior.
 *
 * Origin comparison is intentionally avoided: the current origin is unknown
 * during SSR, and `rel="noopener noreferrer"` is harmless for same-origin
 * absolute links, so any absolute http(s) / protocol-relative target counts
 * as external here.
 */
export function isExternalHref(url: string | null | undefined): boolean {
  if (url == null) return false
  const trimmed = url.trim()
  if (trimmed === '') return false

  const normalized = stripWhitespaceAndControls(trimmed)
  if (normalized === '') return false

  // Protocol-relative `//host` → external.
  if (normalized.startsWith('//')) return true

  const colonIndex = normalized.indexOf(':')
  if (colonIndex === -1) return false // relative / fragment / query

  const firstDelimiter = (() => {
    const candidates = ['/', '?', '#']
      .map((d) => normalized.indexOf(d))
      .filter((i) => i !== -1)
    return candidates.length ? Math.min(...candidates) : -1
  })()
  if (firstDelimiter !== -1 && colonIndex > firstDelimiter) return false

  const scheme = normalized.slice(0, colonIndex).toLowerCase()
  return scheme === 'http' || scheme === 'https'
}
