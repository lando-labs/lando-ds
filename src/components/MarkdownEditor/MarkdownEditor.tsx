'use client'

/**
 * MarkdownEditor Component
 *
 * Sprint 15 / #93 — wraps `@uiw/react-md-editor` (a CodeMirror-style
 * textarea editor with a live preview pane) so that consumers get a
 * batteries-included markdown authoring surface that is **theme-bridged
 * to `ThemeProvider`** and **renders previews through the design-system's
 * canonical `<Markdown>` component** (the sanitized + GFM build that landed
 * in #96).
 *
 * Why wrap instead of writing from scratch:
 *   - `@uiw/react-md-editor` ships a mature toolbar, keyboard shortcuts
 *     (Cmd-B / Cmd-I / Cmd-K / etc.), draggable resize, and an active
 *     preview / split / edit mode toggle.
 *   - Our wrapper layer narrows the API to the props consumers actually
 *     care about, threads `ThemeProvider` into the editor via
 *     `data-color-mode`, and replaces the editor's bundled preview
 *     renderer with our `<Markdown>` so render parity between read-only
 *     and edit-mode views is guaranteed.
 *
 * Public API:
 *   - `value` / `onChange` — controlled
 *   - `mode` — 'edit' | 'preview' | 'live' (default 'live' / split view)
 *   - `height` — px or CSS height (default 400)
 *   - `placeholder` — placeholder for the editor textarea
 *   - `hasFrontmatter` — when true, YAML frontmatter is stripped from the
 *     preview render (body still renders normally). Default false.
 *   - `toolbar` — visible toolbar toggle. Keyboard shortcuts always work.
 *     Default true.
 *   - `name` — optional form field name; renders a hidden `<input>` so
 *     `FormData` / Server Actions pick the value up. Mirrors the Select
 *     v0.4.1 pattern.
 *   - `className` — extra class on the wrapping `<div>`
 *
 * SSR note: this component is `'use client'`. The underlying editor uses
 * CodeMirror + browser-only APIs and cannot be imported into a React
 * Server Component. Next.js App Router consumers should
 * `dynamic(() => import(...).then(m => m.MarkdownEditor), { ssr: false })`
 * — see `reference/components.md` for the full pattern.
 *
 * @example
 * <MarkdownEditor
 *   value={content}
 *   onChange={setContent}
 *   mode="live"
 *   height={400}
 *   placeholder="Write your skill..."
 * />
 */

import React from 'react'
import MDEditor from '@uiw/react-md-editor'
import { Markdown } from '../Markdown'
import { useTheme } from '../../utils/ThemeProvider'
import styles from './MarkdownEditor.module.css'

export type MarkdownEditorMode = 'edit' | 'preview' | 'live'

export interface MarkdownEditorProps {
  /** Markdown content (controlled) */
  value: string
  /** Change handler — receives the new markdown string */
  onChange: (value: string) => void
  /**
   * Editor mode. 'live' (default) shows split edit + preview; 'edit'
   * shows only the editor; 'preview' shows only the rendered output.
   */
  mode?: MarkdownEditorMode
  /** Editor height — number = px, string = any CSS height. Default 400. */
  height?: number | string
  /** Textarea placeholder when value is empty. */
  placeholder?: string
  /**
   * When true, YAML frontmatter (`---\n...\n---\n`) is stripped from the
   * preview pipeline. The editor still shows the frontmatter in the source
   * view; only the preview hides it. Default false.
   */
  hasFrontmatter?: boolean
  /**
   * Show the visual toolbar above the editor. Keyboard shortcuts always
   * work regardless of this prop. Default true.
   */
  toolbar?: boolean
  /**
   * HTML form field name. When provided, renders a hidden `<input>` so
   * `FormData.get(name)` returns the current value. Matches the Select
   * v0.4.1 form-friendliness pattern.
   */
  name?: string
  /** Extra class on the wrapper element. */
  className?: string
}

/**
 * Strip YAML frontmatter (a leading `---\n...\n---\n` block) from a
 * markdown source string. Lazy match so a body containing `---` later
 * (e.g. a horizontal rule) is preserved. Used only when
 * `hasFrontmatter` is true; the editor source view still shows the
 * frontmatter, this only affects preview rendering.
 */
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/

const stripFrontmatter = (source: string): string =>
  source.replace(FRONTMATTER_RE, '')

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  mode = 'live',
  height = 400,
  placeholder,
  hasFrontmatter = false,
  toolbar = true,
  name,
  className = '',
}) => {
  // Theme bridge: ThemeProvider's resolved theme drives the editor's
  // `data-color-mode` attribute, which the editor's CSS keys off of.
  // ThemeProvider is required in the tree; if it's missing the hook
  // will throw with a clear message ("useTheme must be used within a
  // ThemeProvider"), which matches the rest of the DS conventions.
  const { theme: resolvedTheme } = useTheme()

  const handleChange = React.useCallback(
    (next?: string) => {
      onChange(next ?? '')
    },
    [onChange]
  )

  const wrapperClasses = [styles.editor, className].filter(Boolean).join(' ')

  return (
    <div
      data-color-mode={resolvedTheme}
      className={wrapperClasses}
      data-testid="markdown-editor-wrapper"
    >
      <MDEditor
        value={value}
        onChange={handleChange}
        preview={mode}
        height={height}
        hideToolbar={!toolbar}
        textareaProps={placeholder ? { placeholder } : undefined}
        components={{
          // Replace the editor's bundled markdown renderer with our DS
          // <Markdown> so preview parity with read-only surfaces is
          // guaranteed (same sanitizer, same GFM behavior, same link
          // policy). The editor passes (source, state, dispatch) — we
          // only care about source here.
          preview: (source: string) => (
            <div className={styles.previewSurface}>
              <Markdown
                content={hasFrontmatter ? stripFrontmatter(source) : source}
              />
            </div>
          ),
        }}
      />

      {/* Hidden input so FormData / Server Actions can pick the value up
          without consumers wiring up their own state mirror. Mirrors
          Select v0.4.1's `name` contract. */}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  )
}

MarkdownEditor.displayName = 'MarkdownEditor'
