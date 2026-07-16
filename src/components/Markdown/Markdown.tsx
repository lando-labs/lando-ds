/**
 * Markdown Component
 *
 * Renders markdown content with GitHub-Flavored Markdown (GFM) support and
 * built-in XSS sanitization. Internals are powered by `react-markdown` +
 * `remark-gfm` + `rehype-sanitize` (default GitHub-style schema).
 *
 * Public API (preserved from the v0.8.x hand-rolled parser):
 *   - `content: string` — raw markdown source
 *   - `className?: string` — extra class on the wrapper `<div>`
 *
 * Notes for consumers:
 * - All HTML output is sanitized. `<script>` tags, inline event handler
 *   attributes (`onerror`, `onclick`, `onload`, ...), and unsafe URL
 *   protocols (`javascript:`, `data:`) are stripped before render.
 * - Fenced code with a language hint (```ts) delegates to the design-system
 *   `<CodeBlock>` for syntax highlighting + copy-to-clipboard.
 * - External links (http/https/mailto/...) are opened in a new tab with
 *   `rel="noopener noreferrer"`. Relative/anchor links keep default behavior.
 *
 * @example
 * <Markdown content="# Hello World\n\nThis is **bold** and *italic*." />
 */

import React from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { CodeBlock } from '../CodeBlock'
import { safeHref, isExternalHref } from '../../utils/safeHref'
import styles from './Markdown.module.css'

export interface MarkdownProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Markdown content to render */
  content: string
  /** Additional CSS class */
  className?: string
  /** Inline style overrides merged onto the wrapper element. */
  style?: React.CSSProperties
}

const markdownComponents: Components = {
  // Fenced code blocks with a language hint route through the design-system
  // CodeBlock for syntax highlighting + copy. Inline `code` and language-less
  // fences fall through to the default <code> element (styled via CSS).
  //
  // react-markdown v10 removed the `inline` prop. The convention is: block
  // code (from ``` fences) gets a `language-xxx` className via remark; inline
  // code does not. We use that to discriminate.
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    if (match) {
      const code = String(children).replace(/\n$/, '')
      return <CodeBlock code={code} language={match[1]} />
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },

  // The CodeBlock above renders its own <pre>. react-markdown still wraps
  // the original <code> in a <pre>, producing <pre><CodeBlock /></pre>. To
  // avoid double-<pre>, unwrap when the only child is our highlighted block.
  //
  // Detection uses component identity (`children.type === CodeBlock`) rather
  // than a `displayName === 'CodeBlock'` string compare: our `code` renderer
  // returns a real <CodeBlock> element, so its `type` IS the imported
  // component reference. Identity survives minification and any displayName
  // rename, where the string match would silently break and re-introduce the
  // double-<pre> bug.
  pre({ children, ...props }) {
    if (React.isValidElement(children) && children.type === CodeBlock) {
      return <>{children}</>
    }
    return <pre {...props}>{children}</pre>
  },

  // Links are double-guarded: rehype-sanitize neutralizes unsafe protocols at
  // the hast layer, and `safeHref` re-checks the rendered href as
  // defense-in-depth (#320). External links open in a new tab with safe rel.
  //
  // #324 — spread order matters: `{...props}` is applied FIRST, then the
  // component's own sanitized `href` / `rel` / `target` LAST, so a malicious
  // parsed/consumer prop cannot override the safe values we computed.
  a({ href, children, ...props }) {
    const sanitized = safeHref(href)
    const external = isExternalHref(href)
    // Applied LAST and unconditionally (target/rel resolve to undefined for
    // internal links) so neither a parsed prop nor a stale value can flip an
    // internal link into a new-tab one or override the sanitized href.
    return (
      <a
        {...props}
        href={sanitized}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    )
  },
}

export const Markdown = React.forwardRef<HTMLDivElement, MarkdownProps>(
  ({ content, className = '', style, ...rest }, ref) => {
    // #281 — the OUTER element is both the container-query host (`.sizer`) AND the
    // public root: it keeps the forwarded `ref` and the consumer `className`, so
    // the outermost element a consumer measures / styles is unchanged from before
    // the wrapper existed. The INNER `.markdown` element carries the typographic
    // styling and is a DESCENDANT of the host, so the `@container markdown` rules
    // (which target `.markdown` and its children) match without a self-rule no-op.
    const outerClasses = [styles.sizer, className].filter(Boolean).join(' ')

    return (
      <div ref={ref} className={outerClasses} style={style} {...rest}>
        <div className={styles.markdown}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    )
  }
)

Markdown.displayName = 'Markdown'
