/**
 * sanitizeRestProps — strip dangerous keys from pass-through `...rest` props
 * before they are spread onto a rendered anchor/button/Slot.
 *
 * #320 — Two classes of risk:
 *   - `dangerouslySetInnerHTML`: would let a consumer inject raw HTML into the
 *     node, defeating the rest of the design system's XSS posture.
 *   - String-valued `on*` handlers (e.g. `onClick="alert(1)"`): React only
 *     honors function handlers, so a string handler is a clear injection signal
 *     — drop it rather than forward it.
 *
 * Everything else (data-*, aria-*, title, style, FUNCTION event handlers, …) is
 * preserved so legitimate consumer customization still works. Function handlers
 * and `style` are intentionally NOT stripped — they are normal React props, and
 * removing them would break DX for no real security gain (modern browsers do not
 * execute script from a `style` value).
 *
 * Shared by the nav components that spread consumer `...rest` onto an anchor
 * (SidebarNavItem, BottomNavItem). Centralized so the deny-list hardens in one
 * place. Enforced by `src/test/no-unguarded-anchor-href.test.ts`.
 */
export function sanitizeRestProps(
  rest: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (key === 'dangerouslySetInnerHTML') continue
    if (/^on[A-Z]/.test(key) && typeof value === 'string') continue
    safe[key] = value
  }
  return safe
}
