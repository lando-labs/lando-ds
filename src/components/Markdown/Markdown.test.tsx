/**
 * Markdown Component Tests
 *
 * Sprint 15 / #96 — internals were rewritten on top of `react-markdown` +
 * `remark-gfm` + `rehype-sanitize` to close an XSS gap. The previous
 * implementation used `dangerouslySetInnerHTML` against a hand-rolled
 * regex parser with no sanitization, exposing every consumer (chat and
 * newsroom surfaces, etc.) to script injection.
 *
 * This suite has two responsibilities:
 *   1. Pin the public API (`<Markdown content={...} />` / `MarkdownProps`)
 *      so consumers do not have to migrate.
 *   2. Lock down the security posture with an explicit XSS regression
 *      suite that any future internals swap must keep passing.
 *
 * Coverage:
 *   - XSS: <script>, inline event handlers, javascript:/data: URLs
 *   - GFM: tables, task lists, strikethrough, autolinks, footnotes,
 *     blockquotes, nested lists
 *   - Code: fenced (delegates to <CodeBlock>) + inline
 *   - External links: target/rel attributes
 *   - Baseline: paragraphs, headings, lists still render
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  describe('baseline rendering (regression from v0.8.x parser)', () => {
    it('renders a plain paragraph', () => {
      render(<Markdown content="Hello, world." />)
      expect(screen.getByText('Hello, world.')).toBeInTheDocument()
    })

    it('renders headings h1–h6 with correct semantic level', () => {
      const md = `# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6`
      render(<Markdown content={md} />)
      expect(screen.getByRole('heading', { level: 1, name: 'H1' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'H2' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3, name: 'H3' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 4, name: 'H4' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 5, name: 'H5' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 6, name: 'H6' })).toBeInTheDocument()
    })

    it('renders an unordered list with multiple items', () => {
      render(<Markdown content={`- one\n- two\n- three`} />)
      const list = screen.getByRole('list')
      const items = screen.getAllByRole('listitem')
      expect(list).toBeInTheDocument()
      expect(items).toHaveLength(3)
      expect(items[0]).toHaveTextContent('one')
    })

    it('renders bold and italic emphasis', () => {
      const { container } = render(
        <Markdown content="This is **bold** and *italic*." />
      )
      expect(container.querySelector('strong')).toHaveTextContent('bold')
      expect(container.querySelector('em')).toHaveTextContent('italic')
    })

    it('forwards ref to the wrapper div', () => {
      let captured: HTMLDivElement | null = null
      render(
        <Markdown
          content="ref test"
          ref={(node) => {
            captured = node
          }}
        />
      )
      expect(captured).not.toBeNull()
      expect((captured as unknown as HTMLElement).tagName).toBe('DIV')
    })

    it('applies custom className alongside the internal markdown class', () => {
      const { container } = render(
        <Markdown content="hi" className="my-custom-class" />
      )
      const wrapper = container.firstElementChild as HTMLElement
      expect(wrapper.className).toContain('my-custom-class')
    })
  })

  describe('XSS regression (rehype-sanitize)', () => {
    it('strips a literal <script> tag, no execution and no DOM injection', () => {
      const evil = `Hello <script>window.__pwned = true</script> world`
      const { container } = render(<Markdown content={evil} />)
      // Sanitization removes the script element entirely.
      expect(container.querySelector('script')).toBeNull()
      // The plain text "Hello" / "world" still appears.
      expect(container.textContent).toContain('Hello')
      expect(container.textContent).toContain('world')
      // No global side effect.
      expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined()
    })

    it('strips inline onerror= handler from <img>', () => {
      const evil = `<img src="x" onerror="window.__pwnedOnerror = true">`
      const { container } = render(<Markdown content={evil} />)
      const img = container.querySelector('img')
      // Either the img is dropped or the onerror attribute is gone — both
      // are acceptable. What's NOT acceptable is the handler firing.
      if (img) {
        expect(img.getAttribute('onerror')).toBeNull()
      }
      expect((window as unknown as { __pwnedOnerror?: boolean }).__pwnedOnerror).toBeUndefined()
    })

    it('strips inline onclick= handler from a tag', () => {
      const evil = `<a href="https://example.com" onclick="window.__pwnedOnclick = true">click</a>`
      const { container } = render(<Markdown content={evil} />)
      const a = container.querySelector('a')
      if (a) {
        expect(a.getAttribute('onclick')).toBeNull()
      }
    })

    it('strips inline onload= handler', () => {
      const evil = `<svg onload="window.__pwnedOnload = true"></svg>`
      const { container } = render(<Markdown content={evil} />)
      // hast-util-sanitize default schema does not allow <svg> at all,
      // so it's stripped wholesale. Either way, the handler must not fire.
      expect(container.querySelector('svg')).toBeNull()
      expect((window as unknown as { __pwnedOnload?: boolean }).__pwnedOnload).toBeUndefined()
    })

    it('neutralizes javascript: URL in markdown link', () => {
      const evil = `[click me](javascript:alert(1))`
      const { container } = render(<Markdown content={evil} />)
      const a = container.querySelector('a')
      if (a) {
        const href = a.getAttribute('href') || ''
        expect(href.toLowerCase()).not.toContain('javascript:')
      }
    })

    it('neutralizes data: URL in markdown link', () => {
      const evil = `[click](data:text/html,<script>alert(1)</script>)`
      const { container } = render(<Markdown content={evil} />)
      const a = container.querySelector('a')
      if (a) {
        const href = a.getAttribute('href') || ''
        expect(href.toLowerCase()).not.toContain('data:')
      }
      // And no script tag was injected through the data URL payload.
      expect(container.querySelector('script')).toBeNull()
    })

    it('strips raw <iframe> embeds', () => {
      const evil = `<iframe src="https://evil.example.com"></iframe>`
      const { container } = render(<Markdown content={evil} />)
      expect(container.querySelector('iframe')).toBeNull()
    })
  })

  // ===== External links =====

  describe('external links', () => {
    it('opens external http(s) URLs in a new tab with safe rel', () => {
      render(<Markdown content="[Example](https://example.com)" />)
      const link = screen.getByRole('link', { name: 'Example' })
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('does not add target="_blank" to relative links', () => {
      render(<Markdown content="[Docs](/docs)" />)
      const link = screen.getByRole('link', { name: 'Docs' })
      expect(link).toHaveAttribute('href', '/docs')
      expect(link).not.toHaveAttribute('target')
    })

    it('does not add target="_blank" to anchor (#) links', () => {
      render(<Markdown content="[Top](#top)" />)
      const link = screen.getByRole('link', { name: 'Top' })
      expect(link).toHaveAttribute('href', '#top')
      expect(link).not.toHaveAttribute('target')
    })
  })

  // ===== Code blocks =====

  describe('code blocks', () => {
    it('delegates fenced code with a language hint to <CodeBlock>', () => {
      const md = '```typescript\nconst x = 1\n```'
      const { container } = render(<Markdown content={md} />)
      // CodeBlock renders a copy button, which our default <pre>/<code>
      // path does not.
      const copyButton = container.querySelector('button')
      expect(copyButton).not.toBeNull()
      // And the source line should appear in the rendered output.
      expect(container.textContent).toContain('const x = 1')
    })

    it('renders inline `code` as a <code> element (not a CodeBlock)', () => {
      const { container } = render(<Markdown content="Use the `flag` option." />)
      const inlineCode = container.querySelector('p > code')
      expect(inlineCode).not.toBeNull()
      expect(inlineCode).toHaveTextContent('flag')
      // No copy button — that would mean we accidentally routed through CodeBlock.
      const copyButton = container.querySelector('p button')
      expect(copyButton).toBeNull()
    })
  })

  // ===== GFM features =====

  describe('GFM features', () => {
    it('renders tables with thead/tbody/tr/th/td', () => {
      const md = [
        '| Col A | Col B |',
        '| ----- | ----- |',
        '| a1    | b1    |',
        '| a2    | b2    |',
      ].join('\n')
      const { container } = render(<Markdown content={md} />)
      expect(container.querySelector('table')).not.toBeNull()
      expect(container.querySelector('thead')).not.toBeNull()
      expect(container.querySelector('tbody')).not.toBeNull()
      const headers = container.querySelectorAll('th')
      expect(headers).toHaveLength(2)
      expect(headers[0]).toHaveTextContent('Col A')
      const cells = container.querySelectorAll('tbody td')
      expect(cells).toHaveLength(4)
    })

    it('renders strikethrough as <del>', () => {
      const { container } = render(<Markdown content="This is ~~stricken~~ text." />)
      const del = container.querySelector('del')
      expect(del).not.toBeNull()
      expect(del).toHaveTextContent('stricken')
    })

    it('renders task lists as <input type="checkbox" disabled>', () => {
      const md = `- [x] done\n- [ ] todo`
      const { container } = render(<Markdown content={md} />)
      const checkboxes = container.querySelectorAll('input[type="checkbox"]')
      expect(checkboxes).toHaveLength(2)
      // GFM-emitted checkboxes are disabled by spec.
      checkboxes.forEach((cb) => expect(cb).toHaveAttribute('disabled'))
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true)
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false)
    })

    it('autolinks bare URLs', () => {
      render(<Markdown content="See https://example.com for details." />)
      const link = screen.getByRole('link', { name: 'https://example.com' })
      expect(link).toHaveAttribute('href', 'https://example.com')
      // Autolinks are external, so they get target=_blank too.
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('renders footnote references and the footnotes section', () => {
      const md = `Here is a claim.[^1]\n\n[^1]: With a citation.`
      const { container } = render(<Markdown content={md} />)
      // remark-gfm emits <section data-footnotes class="footnotes">.
      const section = container.querySelector('section.footnotes')
      expect(section).not.toBeNull()
      expect(section?.textContent).toContain('With a citation.')
    })

    it('renders blockquotes', () => {
      const { container } = render(<Markdown content={`> quoted line`} />)
      const bq = container.querySelector('blockquote')
      expect(bq).not.toBeNull()
      expect(bq).toHaveTextContent('quoted line')
    })

    it('renders nested unordered lists', () => {
      const md = `- top\n  - nested-a\n  - nested-b\n- top2`
      const { container } = render(<Markdown content={md} />)
      const outer = container.querySelector('ul')
      expect(outer).not.toBeNull()
      const nested = outer?.querySelector('ul')
      expect(nested).not.toBeNull()
      expect(nested?.querySelectorAll('li')).toHaveLength(2)
    })
  })

  // ===== Consumer passthrough contract (#423) =====
  // MarkdownProps extends React.HTMLAttributes<HTMLDivElement>: a consumer
  // `data-testid` and `style` land on the rendered wrapper (the outer `.sizer`
  // container-query host / public root). The passthrough must NOT weaken the
  // markdown sanitization path, which stays on the inner ReactMarkdown.
  describe('consumer passthrough (#423)', () => {
    it('lands consumer data-testid on the rendered wrapper (visual root)', () => {
      render(<Markdown content="Hello passthrough" data-testid="my-md" />)
      const el = screen.getByTestId('my-md')
      expect(el.tagName).toBe('DIV')
      // the rendered markdown lives inside the wrapper
      expect(el).toContainElement(screen.getByText('Hello passthrough'))
    })

    it('applies consumer style to the rendered wrapper', () => {
      render(
        <Markdown
          content="Styled"
          data-testid="my-md"
          style={{ color: 'rgb(1, 2, 3)' }}
        />
      )
      expect(screen.getByTestId('my-md')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    })

    it('still sanitizes XSS when passthrough props are supplied', () => {
      // Adding {...rest} to the wrapper must not open a hole: the inner
      // rehype-sanitize path still strips <script> from the content.
      const { container } = render(
        <Markdown
          content={'ok<script>window.__xss = true</script>'}
          data-testid="my-md"
        />
      )
      expect(container.querySelector('script')).toBeNull()
      expect(
        (window as unknown as { __xss?: boolean }).__xss
      ).toBeUndefined()
    })
  })
})
