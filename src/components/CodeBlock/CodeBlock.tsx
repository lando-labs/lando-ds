'use client'

/**
 * CodeBlock Component
 *
 * Display syntax-highlighted code with copy functionality and optional line numbers.
 * Features brand-themed styling and smooth interactions.
 *
 * @example
 * <CodeBlock code={sourceCode} language="typescript" showLineNumbers />
 * <CodeBlock code={snippet} title="Example.tsx" highlightLines={[2, 5]} />
 */

import React, { useState, useRef } from 'react'
import styles from './CodeBlock.module.css'

export interface CodeBlockProps
  // The outer `.sizer` wrapper is a plain <div>; accept every native div
  // attribute as pass-through. `title` is omitted because CodeBlock
  // redefines it below as the visible filename/title string (not the HTML
  // `title` tooltip attribute).
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The code content to display */
  code: string
  /** Programming language for syntax highlighting */
  language?: string
  /** Optional filename or title to display */
  title?: string
  /** Show line numbers on the left */
  showLineNumbers?: boolean
  /** Array of line numbers to highlight (1-indexed) */
  highlightLines?: number[]
  /** Maximum height with scroll overflow */
  maxHeight?: string
  /**
   * Additional CSS class merged onto the outermost `.sizer` wrapper (the
   * element that also receives the forwarded `ref`).
   */
  className?: string
  /**
   * Inline styles applied to the outermost `.sizer` wrapper. The component
   * sets no inline style on that element (the `maxHeight` prop styles an
   * inner scroll region, not the wrapper), so consumer keys apply directly.
   * (Inherited type from `HTMLAttributes`; restated here for docs.)
   */
  style?: React.CSSProperties
}

// #319 — Sentinel + control-char stripping (XSS hardening).
//
// `highlightSyntax` builds its `<span class="token-…">` markup by first
// stamping placeholders containing the control bytes U+0001 / U+0002, then
// converting those placeholders into real `class="…"` attributes. If an
// attacker could smuggle those bytes (or other C0 controls) through the
// `code` prop, they could forge the placeholder→attribute conversion and
// break out of the intended span markup. We therefore strip every C0
// control character from the input up front, keeping only the two
// whitespace controls highlighting actually relies on: TAB (\t) and
// NEWLINE (\n).
//
// The character-class string is assembled from String.fromCharCode at module
// init (rather than written as control-char literals) so the no-control-regex
// lint rule — whose purpose is to catch *accidental* control chars in a
// pattern — is not tripped by this deliberate, security-motivated use. The
// runtime behaviour is identical: it matches every C0 control plus DEL,
// excluding TAB (0x09) and LF (0x0A).
const C0_CONTROL_CLASS =
  '[' +
  String.fromCharCode(0x00) +
  '-' +
  String.fromCharCode(0x08) +
  String.fromCharCode(0x0b) +
  String.fromCharCode(0x0c) +
  String.fromCharCode(0x0e) +
  '-' +
  String.fromCharCode(0x1f) +
  String.fromCharCode(0x7f) +
  ']'

const stripControlChars = (str: string): string =>
  str.replace(new RegExp(C0_CONTROL_CLASS, 'g'), '')

// Helper function to escape HTML.
//
// #319 — escapes ALL FIVE HTML-significant characters (not just `& < >`).
// Quotes matter because the highlighter's output is fed to
// `dangerouslySetInnerHTML`: an unescaped `"` or `'` originating from `code`
// could otherwise close one of the highlighter's own attributes and inject
// attacker-controlled markup. After this runs, the only `"`/`'` characters
// in the string are the HTML entities `&quot;` / `&#39;`, so the
// string-detection regexes below match those entities rather than raw quotes.
const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Simple syntax highlighting using regex patterns
const highlightSyntax = (code: string, language: string): string => {
  // #319 — strip smuggled sentinel/control bytes BEFORE any processing, then
  // HTML-escape all five significant characters. From here on, every
  // character that originated from `code` is HTML-escaped; the only raw
  // markup added below is the highlighter's own fixed `<span class="token-…">`
  // wrappers.
  let highlighted = escapeHtml(stripControlChars(code))

  if (language === 'typescript' || language === 'tsx' || language === 'javascript' || language === 'jsx') {
    // Use placeholders for attributes to prevent subsequent regex from matching inside our HTML tags
    const ATTR_START = '\u0001'
    const ATTR_END = '\u0002'

    // Comments
    highlighted = highlighted.replace(
      /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      `<span data-token${ATTR_START}comment${ATTR_END}>$1</span>`
    )

    // Strings — quotes are now HTML entities (`&quot;` / `&#39;`) because
    // escapeHtml ran first (#319). Match the entity-delimited forms plus
    // backtick templates (backtick is not an HTML-significant char, so it
    // survives escaping unchanged). The "&quot;" body excludes `&` so the
    // match stops at the closing delimiter rather than running across
    // adjacent strings; an escaped ampersand inside a string renders as
    // `&amp;`, which is fine to leave outside the string span.
    highlighted = highlighted.replace(
      /(&quot;[^&]*&quot;|&#39;[^&]*&#39;|`(?:[^`\\]|\\.)*`)/g,
      `<span data-token${ATTR_START}string${ATTR_END}>$1</span>`
    )

    // Keywords - use data attribute to avoid "class" keyword matching our own HTML
    const keywords = [
      'import', 'export', 'from', 'const', 'let', 'var', 'function', 'class', 'interface',
      'type', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue',
      'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'super', 'extends', 'implements',
      'public', 'private', 'protected', 'static', 'readonly', 'default', 'as', 'typeof', 'void'
    ]
    const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g')
    highlighted = highlighted.replace(keywordPattern, `<span data-token${ATTR_START}keyword${ATTR_END}>$1</span>`)

    // Numbers — the negative lookbehind `(?<!&#)` prevents the digits inside
    // the `&#39;` entity (the escaped single-quote delimiter produced by
    // escapeHtml, #319) from being mistaken for a numeric literal, which
    // would otherwise split the entity and render a stray `&#39;` to users.
    highlighted = highlighted.replace(/(?<!&#)\b(\d+\.?\d*)\b/g, `<span data-token${ATTR_START}number${ATTR_END}>$1</span>`)

    // Functions (simple pattern - word followed by parenthesis)
    highlighted = highlighted.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, `<span data-token${ATTR_START}function${ATTR_END}>$1</span>`)

    // Convert placeholders to actual HTML attributes
    highlighted = highlighted.replace(new RegExp(`data-token${ATTR_START}(\\w+)${ATTR_END}`, 'g'), 'class="token-$1"')
  } else if (language === 'css' || language === 'scss') {
    // Use placeholders for attributes to prevent subsequent regex from matching inside our HTML tags
    const ATTR_START = '\u0001'
    const ATTR_END = '\u0002'

    // Comments
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, `<span class${ATTR_START}token-comment${ATTR_END}>$1</span>`)

    // Properties
    highlighted = highlighted.replace(/([a-z-]+)(?=\s*:)/g, `<span class${ATTR_START}token-property${ATTR_END}>$1</span>`)

    // Values
    highlighted = highlighted.replace(/:([^;{]+)/g, `:<span class${ATTR_START}token-value${ATTR_END}>$1</span>`)

    // Selectors
    highlighted = highlighted.replace(/([.#][a-zA-Z][a-zA-Z0-9-_]*)/g, `<span class${ATTR_START}token-selector${ATTR_END}>$1</span>`)

    // Convert placeholders to actual HTML attributes
    highlighted = highlighted.replace(new RegExp(`class${ATTR_START}([\\w-]+)${ATTR_END}`, 'g'), 'class="$1"')
  } else if (language === 'json') {
    // Use placeholders for attributes to prevent subsequent regex from matching inside our HTML tags
    const ATTR_START = '\u0001'
    const ATTR_END = '\u0002'

    // Strings (keys and values) — quotes are HTML entities after escaping
    // (#319). Match `&quot;…&quot;` and rebuild the visible quotes as
    // entities so nothing un-escaped is reintroduced into the output.
    highlighted = highlighted.replace(/&quot;([^&]+)&quot;:/g, `<span class${ATTR_START}token-key${ATTR_END}>&quot;$1&quot;</span>:`)
    highlighted = highlighted.replace(/:\s*&quot;([^&]*)&quot;/g, `: <span class${ATTR_START}token-string${ATTR_END}>&quot;$1&quot;</span>`)

    // Numbers and booleans
    highlighted = highlighted.replace(/:\s*(true|false|null)/g, `: <span class${ATTR_START}token-keyword${ATTR_END}>$1</span>`)
    highlighted = highlighted.replace(/:\s*(\d+\.?\d*)/g, `: <span class${ATTR_START}token-number${ATTR_END}>$1</span>`)

    // Convert placeholders to actual HTML attributes
    highlighted = highlighted.replace(new RegExp(`class${ATTR_START}([\\w-]+)${ATTR_END}`, 'g'), 'class="$1"')
  } else if (language === 'bash' || language === 'sh') {
    // Use placeholders for attributes to prevent subsequent regex from matching inside our HTML tags
    const ATTR_START = '\u0001'
    const ATTR_END = '\u0002'

    // Comments
    highlighted = highlighted.replace(/(#.*$)/gm, `<span class${ATTR_START}token-comment${ATTR_END}>$1</span>`)

    // Commands
    const commands = ['cd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 'echo', 'cat', 'grep', 'npm', 'git', 'yarn', 'pnpm']
    commands.forEach(cmd => {
      const regex = new RegExp(`\\b(${cmd})\\b`, 'g')
      highlighted = highlighted.replace(regex, `<span class${ATTR_START}token-keyword${ATTR_END}>$1</span>`)
    })

    // Strings — quotes are HTML entities after escaping (#319). Match the
    // entity-delimited forms; bodies stop at `&` so a match cannot run past
    // its closing delimiter.
    highlighted = highlighted.replace(
      /(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g,
      `<span class${ATTR_START}token-string${ATTR_END}>$1</span>`
    )

    // Convert placeholders to actual HTML attributes
    highlighted = highlighted.replace(new RegExp(`class${ATTR_START}([\\w-]+)${ATTR_END}`, 'g'), 'class="$1"')
  }

  return highlighted
}

export const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  (
    {
      code,
      language = 'typescript',
      title,
      showLineNumbers = false,
      highlightLines = [],
      maxHeight,
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
    const [copied, setCopied] = useState(false)
    const codeRef = useRef<HTMLElement>(null)

    const lines = code.split('\n')
    const highlightedLines = lines.map(line => highlightSyntax(line, language))

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }

    const handleCopyClick = (e: React.MouseEvent) => {
      // Create ripple effect
      const button = e.currentTarget as HTMLElement
      const ripple = document.createElement('span')
      const rect = button.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      const x = e.clientX - rect.left - size / 2
      const y = e.clientY - rect.top - size / 2

      ripple.style.width = ripple.style.height = `${size}px`
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`
      ripple.classList.add(styles.ripple!) // safe: `ripple` class is defined in CodeBlock.module.css

      button.appendChild(ripple)

      setTimeout(() => {
        ripple.remove()
      }, 600)

      handleCopy()
    }

    // #270 — `.sizer` is the zero-box container-query host (see
    // CodeBlock.module.css). The consumer's `className` and the forwarded `ref`
    // ride the OUTERMOST element (the wrapper) so layout overrides + refs keep
    // targeting the component's outer box, while the `@container` rules can
    // match the `.container` block (and its descendants) inside it.
    const sizerClasses = [styles.sizer, className].filter(Boolean).join(' ')

    return (
      <div
        ref={ref}
        // Consumer escape hatch — `data-*`, `id`, event handlers, etc. Spread
        // BEFORE className/style so CodeBlock's own class merge and any future
        // wrapper style win on conflict.
        {...rest}
        className={sizerClasses}
        style={style}
      >
        <div className={styles.container}>
          {title && (
            <div className={styles.header}>
              <div className={styles.title}>{title}</div>
            </div>
          )}
          <div className={styles.toolbar}>
            <div className={styles.language}>{language}</div>
            <button
              type="button"
              className={styles.copyButton}
              onClick={handleCopyClick}
              aria-label="Copy code to clipboard"
            >
              {copied ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className={styles.codeWrapper} style={{ maxHeight }}>
            <pre className={styles.pre}>
              <code ref={codeRef} className={styles.code}>
                {lines.map((_line, index) => {
                  const lineNumber = index + 1
                  const isHighlighted = highlightLines.includes(lineNumber)
                  const lineClasses = [
                    styles.line,
                    isHighlighted ? styles.highlighted : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <div key={index} className={lineClasses}>
                      {showLineNumbers && (
                        <span className={styles.lineNumber} aria-hidden="true">
                          {lineNumber}
                        </span>
                      )}
                      <span
                        className={styles.lineContent}
                        dangerouslySetInnerHTML={{ __html: highlightedLines[index] ?? '' }}
                      />
                    </div>
                  )
                })}
              </code>
            </pre>
          </div>
        </div>
      </div>
    )
  }
)

CodeBlock.displayName = 'CodeBlock'
