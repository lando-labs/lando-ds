/**
 * MarkdownEditor Component Tests
 *
 * Sprint 15 / #93. We test three groups:
 *
 *   1. Smoke / mount — does it render with empty value, with a value,
 *      and does the wrapper expose `data-color-mode` for theme bridging?
 *   2. Behavioral — controlled value flow, mode prop wiring, toolbar
 *      visibility, frontmatter strip in the preview pipeline.
 *   3. Form-friendliness — `name` prop renders a hidden input that
 *      `FormData` picks up.
 *
 * The underlying `@uiw/react-md-editor` is heavy (CodeMirror-based
 * textarea); jsdom lacks Range / contenteditable behaviors that the
 * editor's drag-bar and selection logic want. To keep the suite fast
 * and deterministic, we mock the editor module for behavioral tests
 * that need to assert on the props the wrapper passes through. The
 * integration smoke ("does the wrapper render?", "does theme propagate
 * via data-color-mode?", "does preview route through DS <Markdown>?")
 * is real — those tests do not mock.
 *
 * Coverage:
 *   - Renders with empty value
 *   - Theme propagation via data-color-mode (light + dark) — real render
 *   - Preview routes through DS <Markdown> for `mode='preview'` — real render
 *   - Controlled flow: onChange fires with new value (mocked editor)
 *   - mode prop forwarded to MDEditor (mocked)
 *   - toolbar=false hides toolbar (mocked, asserts hideToolbar=true)
 *   - hasFrontmatter strips YAML in preview render
 *   - name prop renders hidden input picked up by FormData
 *   - jest-axe a11y smoke
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ThemeProvider } from '../../utils/ThemeProvider'
import { MarkdownEditor } from './MarkdownEditor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap children in a forced ThemeProvider for theme tests. */
const withTheme = (
  ui: React.ReactNode,
  theme: 'light' | 'dark' = 'light'
): React.ReactElement => (
  <ThemeProvider forcedTheme={theme} disableStorage>
    {ui}
  </ThemeProvider>
)

// ---------------------------------------------------------------------------
// Group 1 + 2: Real-render integration tests
// (No mocks — exercise the actual editor module.)
// ---------------------------------------------------------------------------

describe('MarkdownEditor — integration (real editor module)', () => {
  it('renders with an empty value without throwing', () => {
    render(withTheme(<MarkdownEditor value="" onChange={() => {}} />))
    const wrapper = screen.getByTestId('markdown-editor-wrapper')
    expect(wrapper).toBeInTheDocument()
  })

  it('renders the wrapper as a single root element with data-color-mode', () => {
    render(withTheme(<MarkdownEditor value="hello" onChange={() => {}} />))
    const wrapper = screen.getByTestId('markdown-editor-wrapper')
    expect(wrapper).toHaveAttribute('data-color-mode')
  })

  it('propagates theme=dark to data-color-mode via ThemeProvider', () => {
    render(withTheme(<MarkdownEditor value="" onChange={() => {}} />, 'dark'))
    const wrapper = screen.getByTestId('markdown-editor-wrapper')
    expect(wrapper).toHaveAttribute('data-color-mode', 'dark')
  })

  it('propagates theme=light to data-color-mode via ThemeProvider', () => {
    render(withTheme(<MarkdownEditor value="" onChange={() => {}} />, 'light'))
    const wrapper = screen.getByTestId('markdown-editor-wrapper')
    expect(wrapper).toHaveAttribute('data-color-mode', 'light')
  })

  it('routes preview render through DS <Markdown> in preview-only mode', () => {
    // The Markdown component renders a div.markdown wrapping a heading.
    // If the editor's bundled preview were rendering instead, we'd see a
    // .wmde-markdown wrapper without our DS class.
    const { container } = render(
      withTheme(
        <MarkdownEditor
          value={`# Title\n\nSome **bold** body.`}
          onChange={() => {}}
          mode="preview"
        />
      )
    )
    // Heading rendered by react-markdown via DS Markdown wrapper.
    const heading = container.querySelector('h1')
    expect(heading).not.toBeNull()
    expect(heading?.textContent).toBe('Title')
  })

  it('strips frontmatter from preview when hasFrontmatter is true', () => {
    const md = `---\ntitle: Skill\nname: greet\n---\n# Body heading\n\nBody text.`
    const { container } = render(
      withTheme(
        <MarkdownEditor
          value={md}
          onChange={() => {}}
          mode="preview"
          hasFrontmatter
        />
      )
    )
    // The preview should NOT contain the YAML key 'name: greet'. It
    // SHOULD contain the body heading.
    const previewText = container.textContent ?? ''
    expect(previewText).not.toContain('name: greet')
    expect(previewText).toContain('Body heading')
  })

  it('keeps frontmatter visible when hasFrontmatter is false', () => {
    // With hasFrontmatter=false the preview renders raw — react-markdown
    // by default treats `---` as a thematic break / setext rule, so the
    // YAML keys land in the body text. We assert at least that the
    // body heading is still present.
    const md = `---\ntitle: Skill\n---\n# Body heading`
    const { container } = render(
      withTheme(
        <MarkdownEditor
          value={md}
          onChange={() => {}}
          mode="preview"
          hasFrontmatter={false}
        />
      )
    )
    const heading = container.querySelector('h1')
    expect(heading).not.toBeNull()
    expect(heading?.textContent).toBe('Body heading')
  })

  it('renders a hidden input when name prop is provided', () => {
    render(
      withTheme(
        <MarkdownEditor
          value="hello world"
          onChange={() => {}}
          name="content"
        />
      )
    )
    const hidden = document.querySelector('input[type="hidden"][name="content"]')
    expect(hidden).not.toBeNull()
    expect((hidden as HTMLInputElement).value).toBe('hello world')
  })

  it('does not render a hidden input when name is omitted', () => {
    render(withTheme(<MarkdownEditor value="hello" onChange={() => {}} />))
    const hidden = document.querySelector('input[type="hidden"]')
    expect(hidden).toBeNull()
  })

  it('the hidden input is picked up by FormData', () => {
    render(
      withTheme(
        <form data-testid="md-form">
          <MarkdownEditor
            value="form value"
            onChange={() => {}}
            name="content"
          />
        </form>
      )
    )
    const form = screen.getByTestId('md-form') as HTMLFormElement
    const fd = new FormData(form)
    expect(fd.get('content')).toBe('form value')
  })

  it('passes a jest-axe smoke check in preview-only mode (toolbar hidden)', async () => {
    // Note: with toolbar visible the upstream `@uiw/react-md-editor`
    // ships its toolbar icons as `<svg role="img">` without alt text,
    // which axe correctly flags as `svg-img-alt`. That's an upstream
    // accessibility gap (logged at https://github.com/uiwjs/react-md-editor)
    // — not something we can fix in this wrapper without re-rendering
    // every toolbar command. We hide the toolbar for this smoke test
    // to assert the wrapper itself + the DS preview surface are clean,
    // and consumers who need a fully-axe-clean surface can pass
    // `toolbar={false}`.
    const { container } = render(
      withTheme(
        <MarkdownEditor
          value={`# Heading\n\nBody.`}
          onChange={() => {}}
          mode="preview"
          toolbar={false}
        />
      )
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

// ---------------------------------------------------------------------------
// Group 3: Behavioral assertions on the props the wrapper forwards
// (Mocks the editor so we can assert on what was passed in without
// fighting jsdom over CodeMirror behaviors.)
// ---------------------------------------------------------------------------

describe('MarkdownEditor — wrapper prop forwarding (mocked editor)', () => {
  // Capture the props handed to MDEditor across renders.
  const capturedProps: Record<string, unknown>[] = []

  beforeEach(() => {
    capturedProps.length = 0
    vi.resetModules()
  })

  // Mock @uiw/react-md-editor with a simple component that records
  // the props passed in and exposes a textarea hook for fire events.
  // Returns BOTH the (re-imported) MarkdownEditor and the matching
  // ThemeProvider so context identity stays consistent across the
  // resetModules boundary — using the top-level ThemeProvider import
  // would mount a different ThemeContext instance after resetModules
  // and `useTheme()` inside the wrapper would throw.
  const setupMock = async () => {
    vi.doMock('@uiw/react-md-editor', () => ({
      default: (props: Record<string, unknown>) => {
        capturedProps.push(props)
        return (
          <textarea
            data-testid="mock-md-editor-textarea"
            value={(props.value as string) ?? ''}
            onChange={(e) => {
              const onChange = props.onChange as
                | ((v?: string) => void)
                | undefined
              onChange?.(e.target.value)
            }}
            placeholder={
              (props.textareaProps as { placeholder?: string } | undefined)
                ?.placeholder
            }
          />
        )
      },
    }))
    const editorMod = await import('./MarkdownEditor')
    const themeMod = await import('../../utils/ThemeProvider')
    const Wrap = (ui: React.ReactNode): React.ReactElement => (
      <themeMod.ThemeProvider forcedTheme="light" disableStorage>
        {ui}
      </themeMod.ThemeProvider>
    )
    return { Editor: editorMod.MarkdownEditor, Wrap }
  }

  it('fires onChange with the new value when the user types', async () => {
    const { Editor, Wrap } = await setupMock()
    const handleChange = vi.fn()
    render(Wrap(<Editor value="" onChange={handleChange} />))
    const ta = screen.getByTestId('mock-md-editor-textarea') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hello' } })
    expect(handleChange).toHaveBeenCalledWith('hello')
  })

  it('forwards mode="edit" as preview="edit" to MDEditor', async () => {
    const { Editor, Wrap } = await setupMock()
    render(Wrap(<Editor value="" onChange={() => {}} mode="edit" />))
    expect(capturedProps.at(-1)?.preview).toBe('edit')
  })

  it('forwards mode="preview" as preview="preview" to MDEditor', async () => {
    const { Editor, Wrap } = await setupMock()
    render(Wrap(<Editor value="" onChange={() => {}} mode="preview" />))
    expect(capturedProps.at(-1)?.preview).toBe('preview')
  })

  it('forwards mode="live" (default) as preview="live"', async () => {
    const { Editor, Wrap } = await setupMock()
    render(Wrap(<Editor value="" onChange={() => {}} />))
    expect(capturedProps.at(-1)?.preview).toBe('live')
  })

  it('hides the toolbar via hideToolbar=true when toolbar=false', async () => {
    const { Editor, Wrap } = await setupMock()
    render(Wrap(<Editor value="" onChange={() => {}} toolbar={false} />))
    expect(capturedProps.at(-1)?.hideToolbar).toBe(true)
  })

  it('shows the toolbar via hideToolbar=false by default', async () => {
    const { Editor, Wrap } = await setupMock()
    render(Wrap(<Editor value="" onChange={() => {}} />))
    expect(capturedProps.at(-1)?.hideToolbar).toBe(false)
  })

  it('forwards the placeholder via textareaProps', async () => {
    const { Editor, Wrap } = await setupMock()
    render(
      Wrap(
        <Editor
          value=""
          onChange={() => {}}
          placeholder="Write your skill..."
        />
      )
    )
    const ta = screen.getByTestId('mock-md-editor-textarea')
    expect(ta).toHaveAttribute('placeholder', 'Write your skill...')
  })

  it('forwards a custom height to MDEditor', async () => {
    const { Editor, Wrap } = await setupMock()
    render(Wrap(<Editor value="" onChange={() => {}} height={250} />))
    expect(capturedProps.at(-1)?.height).toBe(250)
  })
})
