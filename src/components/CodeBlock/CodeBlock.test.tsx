import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CodeBlock } from './CodeBlock'

describe('CodeBlock', () => {
  it('renders the code content', () => {
    render(<CodeBlock code="echo hello" language="bash" />)
    expect(screen.getByText(/echo/)).toBeInTheDocument()
    expect(screen.getByText(/hello/)).toBeInTheDocument()
  })

  it('renders the title in the header when provided', () => {
    render(<CodeBlock title="Example" code="echo hello" language="bash" />)
    expect(screen.getByText('Example')).toBeInTheDocument()
  })

  it('renders the language label in the toolbar', () => {
    render(<CodeBlock code="const x = 1" language="typescript" />)
    expect(screen.getByText('typescript')).toBeInTheDocument()
  })

  it('renders an accessible copy button', () => {
    render(<CodeBlock code="echo hello" language="bash" />)
    expect(
      screen.getByRole('button', { name: 'Copy code to clipboard' }),
    ).toBeInTheDocument()
  })

  it('renders line numbers when showLineNumbers is true', () => {
    render(
      <CodeBlock
        code={'line one\nline two\nline three'}
        language="typescript"
        showLineNumbers
      />,
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  // #256 — regression: prior to the semantic-token migration, default rules
  // referenced --color-primary-darkest/-darker/-dark which left consumers
  // on light theme with an invisible block. Verify the structural classes
  // are applied (CSS module is loaded) so the migrated semantic-token
  // rules can take effect at runtime.
  it('applies the container, codeWrapper, and code classes from the CSS module', () => {
    const { container } = render(<CodeBlock code="echo hello" language="bash" />)

    // #270 — the outermost element is now a zero-box `.sizer` container-query
    // wrapper; the styled `.container` box is its child. Query the class
    // anywhere in the subtree (the regression intent is "the module class is
    // applied", not "it is the root element").
    const outer = container.firstElementChild
    expect(outer?.className).toMatch(/sizer/)

    const block = container.querySelector('[class*="container"]')
    expect(block).not.toBeNull()

    const codeWrapper = container.querySelector('[class*="codeWrapper"]')
    expect(codeWrapper).not.toBeNull()

    const code = container.querySelector('code')
    expect(code?.className).toMatch(/code/)
  })

  /* ------------------------------------------------------------------ *
   *  #319 — Highlighter XSS regression
   *
   *  The hand-rolled highlighter feeds its output to
   *  dangerouslySetInnerHTML. Prior to this fix, escapeHtml escaped only
   *  `& < >`, so a `"` or `'` (or a smuggled sentinel byte) in `code`
   *  could break out of the highlighter's own attribute/markup and inject
   *  attacker-controlled HTML. Invariant under test: every character that
   *  originates from `code` is HTML-escaped in the rendered output — the
   *  ONLY raw markup is the highlighter's fixed `<span class="token-…">`
   *  wrappers. So the DOM must contain NO injected <img>/<script> element
   *  and NO live event-handler attribute.
   * ------------------------------------------------------------------ */
  describe('XSS hardening (#319)', () => {
    // The component splits on \n and renders one dangerouslySetInnerHTML
    // span per line; concatenate the raw innerHTML of every line so the
    // assertions see the actual serialized markup (entities included).
    const renderedHtml = (markup: HTMLElement): string =>
      Array.from(markup.querySelectorAll('[class*="lineContent"]'))
        .map((el) => el.innerHTML)
        .join('\n')

    it('does not inject an <img> when a string breaks out of an attribute (ts)', () => {
      const evil = String.raw`const x = "\"><img src=x onerror=alert(1)>"`
      const { container } = render(<CodeBlock code={evil} language="typescript" />)

      // No real <img> element made it into the DOM.
      expect(container.querySelector('img')).toBeNull()
      // No live handler attribute anywhere.
      expect(container.querySelector('[onerror]')).toBeNull()

      const html = renderedHtml(container as unknown as HTMLElement)
      // The angle brackets survive only as escaped entities in the serialized
      // markup — there is no live `<img` tag.
      expect(html).not.toMatch(/<img/i)
      expect(html).toContain('&lt;img')
      // The double-quote that tried to close the attribute landed as inert
      // text data (it decodes back to a literal `"` in textContent), proving
      // it did NOT terminate the highlighter's own attribute.
      expect(container.textContent).toContain('"><img')
    })

    it('does not inject a <script> via a forged closing span', () => {
      const evil = `</span><script>alert(1)</script>`
      const { container } = render(<CodeBlock code={evil} language="typescript" />)

      expect(container.querySelector('script')).toBeNull()
      const html = renderedHtml(container as unknown as HTMLElement)
      expect(html).not.toMatch(/<script/i)
      // Both the injected </span> and the <script> open survive only escaped.
      expect(html).toContain('&lt;/span&gt;')
      expect(html).toContain('&lt;script&gt;')
    })

    it('escapes single quotes in a string literal (no apostrophe breakout)', () => {
      const evil = String.raw`const x = '\'><img src=x onerror=alert(1)>'`
      const { container } = render(<CodeBlock code={evil} language="typescript" />)

      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('[onerror]')).toBeNull()

      const html = renderedHtml(container as unknown as HTMLElement)
      // No live <img>, and the angle bracket survived only as an entity.
      expect(html).not.toMatch(/<img/i)
      expect(html).toContain('&lt;img')
      // The apostrophes landed as inert text data (single quotes were escaped
      // to `&#39;` in the markup, which decodes back to a literal `'`).
      expect(container.textContent).toContain("'>")
    })

    it('strips smuggled sentinel/control bytes so the placeholder→attribute conversion cannot be forged', () => {
      //  /  are the highlighter's internal placeholder sentinels.
      // If they survived, an attacker could forge a `class="…"` attribute and
      // escape the intended span. They must be stripped before processing.
      const evil = `const x = "abc"`
      const { container } = render(<CodeBlock code={evil} language="typescript" />)

      const html = renderedHtml(container as unknown as HTMLElement)
      // The raw control bytes are gone from the output entirely.
      expect(html).not.toContain('')
      expect(html).not.toContain('')
      // No injected element / handler resulted.
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('script')).toBeNull()
      // The only class attributes present are the highlighter's token-* ones.
      Array.from(container.querySelectorAll('[class*="lineContent"] *')).forEach(
        (el) => {
          const cls = el.getAttribute('class') || ''
          if (cls) expect(cls).toMatch(/^token-/)
        },
      )
    })

    it('keeps string highlighting working on escaped quotes (fidelity preserved)', () => {
      const { container } = render(
        <CodeBlock code={`const greeting = "hello"`} language="typescript" />,
      )
      // The highlighter emits literal (un-hashed) `class="token-…"` markup.
      // The double-quoted string must still be wrapped in a token-string span,
      // proving the regex update kept matching strings against the escaped
      // entities. textContent decodes the entities back to the literal quotes.
      const tokenString = container.querySelector('span[class="token-string"]')
      expect(tokenString).not.toBeNull()
      expect(tokenString?.textContent).toBe('"hello"')
    })

    it('does not inject markup through a malicious bash string', () => {
      const evil = `echo "</span><img src=x onerror=alert(1)>"`
      const { container } = render(<CodeBlock code={evil} language="bash" />)

      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('[onerror]')).toBeNull()
      const html = renderedHtml(container as unknown as HTMLElement)
      expect(html).not.toMatch(/<img/i)
      expect(html).toContain('&lt;img')
    })

    it('does not inject markup through a malicious json value', () => {
      const evil = `{"key": "</span><script>alert(1)</script>"}`
      const { container } = render(<CodeBlock code={evil} language="json" />)

      expect(container.querySelector('script')).toBeNull()
      const html = renderedHtml(container as unknown as HTMLElement)
      expect(html).not.toMatch(/<script/i)
    })

    it('does not inject markup through a malicious css value', () => {
      const evil = `.x { background: url("x");}</style><img src=x onerror=alert(1)>`
      const { container } = render(<CodeBlock code={evil} language="css" />)

      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('[onerror]')).toBeNull()
      const html = renderedHtml(container as unknown as HTMLElement)
      expect(html).not.toMatch(/<img/i)
      expect(html).toContain('&lt;img')
    })
  })
})

/* ------------------------------------------------------------------ *
 *  #422 — className / style / ...rest pass-through to the outer wrapper
 *
 *  Per the #270 container-query design, the OUTERMOST `.sizer` <div>
 *  (container.firstChild) is the element that carries the forwarded ref
 *  and the consumer className. Consumer style / ...rest must land there
 *  too — not on the inner `.container` block.
 * ------------------------------------------------------------------ */
describe('CodeBlock — root pass-through (#422)', () => {
  it('forwards a consumer data-testid onto the outer wrapper', () => {
    const { container } = render(
      <CodeBlock code="echo hi" language="bash" data-testid="cb-root" />
    )
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('data-testid')).toBe('cb-root')
  })

  it('lets a consumer style win on the outer wrapper', () => {
    const { container } = render(
      <CodeBlock
        code="echo hi"
        language="bash"
        style={{ color: 'rgb(1, 2, 3)' }}
      />
    )
    const root = container.firstChild as HTMLElement
    expect(root.style.color).toBe('rgb(1, 2, 3)')
  })

  it('merges a consumer className onto the outer wrapper', () => {
    const { container } = render(
      <CodeBlock code="echo hi" language="bash" className="consumer-cb" />
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('consumer-cb')
    expect(root.className.split(' ').length).toBeGreaterThan(1)
  })
})
