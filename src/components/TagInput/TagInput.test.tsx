/**
 * TagInput Component Tests
 *
 * Sprint 16 (#83) — TagInput primitive. Covers:
 *   - Free-text Enter commit + delimiter commit
 *   - Backspace-on-empty deletion
 *   - Tab commits then advances focus
 *   - Suggestion arrow-key navigation + Enter commit
 *   - allowCustom={false} rejection
 *   - maxTags clamp + disabled-input behavior
 *   - validateTag predicate
 *   - error / helperText / required wiring
 *   - FormData hidden-input emission
 *   - jest-axe smoke
 */

import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { TagInput } from './TagInput'

/**
 * Tiny stateful host that mirrors `value` from `onChange` so we can drive
 * the controlled API through user-event without rewiring it in every test.
 */
function Host(props: {
  initial?: string[]
  suggestions?: string[]
  allowCustom?: boolean
  delimiter?: string
  maxTags?: number
  validateTag?: (t: string) => boolean
  name?: string
  label?: string
  helperText?: string
  error?: string
  placeholder?: string
}) {
  const [tags, setTags] = useState<string[]>(props.initial ?? [])
  return (
    <TagInput
      value={tags}
      onChange={setTags}
      suggestions={props.suggestions}
      allowCustom={props.allowCustom}
      delimiter={props.delimiter}
      maxTags={props.maxTags}
      validateTag={props.validateTag}
      name={props.name}
      label={props.label}
      helperText={props.helperText}
      error={props.error}
      placeholder={props.placeholder ?? 'Add tags...'}
    />
  )
}

describe('TagInput', () => {
  it('commits typed text on Enter, clears the input, and reports onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} placeholder="Add tags..." />)

    const input = screen.getByPlaceholderText('Add tags...')
    await user.type(input, 'react')
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith(['react'])
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('commits text when the delimiter character is typed', async () => {
    const user = userEvent.setup()
    render(<Host placeholder="Add tags..." />)

    const input = screen.getByPlaceholderText('Add tags...') as HTMLInputElement
    await user.type(input, 'react,')

    // Chip should now be present, input cleared.
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(input.value).toBe('')
  })

  it('renders existing chips and removes via the chip remove button', async () => {
    const user = userEvent.setup()
    render(<Host initial={['react', 'typescript']} />)

    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()

    const remove = screen.getByRole('button', { name: 'Remove react' })
    await user.click(remove)

    expect(screen.queryByText('react')).not.toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()
  })

  it('Backspace on empty input removes the last chip', async () => {
    const user = userEvent.setup()
    // Placeholder is suppressed once chips are present (intentional UX),
    // so we look up the editor input by role=textbox instead.
    render(<Host initial={['react', 'typescript']} label="Tags" />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.keyboard('{Backspace}')

    expect(screen.queryByText('typescript')).not.toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
  })

  it('Tab commits the pending text and then moves focus', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Host placeholder="Add tags..." />
        <button type="button">Next</button>
      </>
    )

    const input = screen.getByPlaceholderText('Add tags...')
    await user.click(input)
    await user.type(input, 'react')
    await user.tab()

    expect(screen.getByText('react')).toBeInTheDocument()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Next' })
    )
  })

  it('blur commits any pending text', () => {
    render(<Host placeholder="Add tags..." />)
    const input = screen.getByPlaceholderText('Add tags...') as HTMLInputElement

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'react' } })
    fireEvent.blur(input)

    expect(screen.getByText('react')).toBeInTheDocument()
    expect(input.value).toBe('')
  })

  it('arrows through suggestions and Enter commits the highlighted suggestion', async () => {
    const user = userEvent.setup()
    render(
      <Host
        suggestions={['react', 'react-native', 'vue']}
        placeholder="Add tags..."
      />
    )

    const input = screen.getByPlaceholderText('Add tags...')
    await user.click(input)
    await user.type(input, 'rea')

    // Suggestion list opens with two matches.
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()

    await user.keyboard('{ArrowDown}') // highlight react
    await user.keyboard('{ArrowDown}') // highlight react-native
    await user.keyboard('{Enter}')

    expect(screen.getByText('react-native')).toBeInTheDocument()
  })

  it('Escape closes the suggestion list while keeping focus', async () => {
    const user = userEvent.setup()
    render(<Host suggestions={['react']} placeholder="Add tags..." />)

    const input = screen.getByPlaceholderText('Add tags...')
    await user.click(input)
    await user.type(input, 'r')

    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(input)
  })

  it('allowCustom={false} rejects values not in suggestions', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <TagInput
        value={[]}
        onChange={onChange}
        suggestions={['react', 'vue']}
        allowCustom={false}
        placeholder="Add tags..."
      />
    )

    const input = screen.getByPlaceholderText('Add tags...')
    await user.type(input, 'xyz')
    await user.keyboard('{Enter}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('maxTags clamps the count and disables the input once reached', async () => {
    const user = userEvent.setup()
    render(<Host initial={['a', 'b']} maxTags={2} label="Tags" />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toBeDisabled()
    expect(screen.getByText('Max 2 tags')).toBeInTheDocument()

    // Even attempting to type/Enter does nothing because the input is disabled.
    await user.type(input, 'c')
    await user.keyboard('{Enter}')

    expect(screen.queryByText('c')).not.toBeInTheDocument()
  })

  it('validateTag rejects invalid tags', async () => {
    const user = userEvent.setup()
    const validate = vi.fn((tag: string) => tag.length >= 3)
    const onChange = vi.fn()
    render(
      <TagInput
        value={[]}
        onChange={onChange}
        validateTag={validate}
        placeholder="Add tags..."
      />
    )

    const input = screen.getByPlaceholderText('Add tags...')
    await user.type(input, 'ab')
    await user.keyboard('{Enter}')

    expect(validate).toHaveBeenCalledWith('ab')
    expect(onChange).not.toHaveBeenCalled()

    await user.type(input, 'c')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(['abc'])
  })

  it('error prop renders alert message and applies error styling', () => {
    render(<Host error="Tags are required" placeholder="Add tags..." />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Tags are required')

    // aria-invalid wires through to the underlying input
    const input = screen.getByPlaceholderText('Add tags...')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('helperText is suppressed when error is present', () => {
    render(
      <Host
        helperText="Press Enter to add"
        error="Required"
        placeholder="Add tags..."
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
    expect(screen.queryByText('Press Enter to add')).not.toBeInTheDocument()
  })

  it('renders a hidden input per tag when name is provided (FormData parity)', () => {
    const { container } = render(
      <Host initial={['a', 'b', 'c']} name="tags" />
    )
    const hiddens = container.querySelectorAll<HTMLInputElement>(
      'input[type="hidden"][name="tags"]'
    )
    expect(hiddens).toHaveLength(3)
    expect(Array.from(hiddens).map((h) => h.value)).toEqual(['a', 'b', 'c'])
  })

  it('exposes role=combobox with aria-expanded toggling on suggestion open', async () => {
    const user = userEvent.setup()
    render(<Host suggestions={['react']} placeholder="Add tags..." />)

    const combo = screen.getByRole('combobox')
    expect(combo).toHaveAttribute('aria-expanded', 'false')

    const input = screen.getByPlaceholderText('Add tags...')
    await user.click(input)
    await user.type(input, 'r')

    expect(combo).toHaveAttribute('aria-expanded', 'true')
    // aria-controls points at the listbox while open.
    const listbox = screen.getByRole('listbox')
    expect(combo).toHaveAttribute('aria-controls', listbox.id)
  })

  it('does not duplicate when committing an already-present tag', async () => {
    const user = userEvent.setup()
    render(<Host initial={['react']} label="Tags" />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    await user.type(input, 'react')
    await user.keyboard('{Enter}')

    // Still one chip — duplicate suppressed, but input cleared.
    expect(screen.getAllByText('react')).toHaveLength(1)
    expect(input.value).toBe('')
  })

  // #422 — consumer className / style / testid land on the VISUAL ROOT (the
  // role="combobox" element), not the outer field `.container`.
  it('routes data-testid to the combobox-role element, not the outer container', () => {
    render(<TagInput value={[]} onChange={() => {}} data-testid="tags" />)
    const combo = screen.getByRole('combobox')
    expect(screen.getByTestId('tags')).toBe(combo)
    // The outer field container is the combobox's parent and must NOT carry it.
    expect(
      (combo.parentElement as HTMLElement).getAttribute('data-testid')
    ).toBeNull()
  })

  it('consumer inline style wins on the combobox visual root', () => {
    render(
      <TagInput
        value={[]}
        onChange={() => {}}
        style={{ color: 'rgb(1, 2, 3)' }}
      />
    )
    expect(screen.getByRole('combobox')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('consumer className lands on the combobox, not the outer container', () => {
    render(
      <TagInput value={[]} onChange={() => {}} className="custom-cls" />
    )
    const combo = screen.getByRole('combobox')
    expect(combo).toHaveClass('custom-cls')
    expect(combo.parentElement as HTMLElement).not.toHaveClass('custom-cls')
  })

  it('wrapperClassName / wrapperStyle land on the outer field container', () => {
    render(
      <TagInput
        value={[]}
        onChange={() => {}}
        wrapperClassName="wrap-cls"
        wrapperStyle={{ marginTop: '8px' }}
      />
    )
    const container = screen.getByRole('combobox').parentElement as HTMLElement
    expect(container).toHaveClass('wrap-cls')
    expect(container).toHaveStyle({ marginTop: '8px' })
    expect(screen.getByRole('combobox')).not.toHaveClass('wrap-cls')
  })

  it('clicking the combobox still focuses the editor after the passthrough change', async () => {
    // Guards the load-bearing onClick — `...rest` is spread BEFORE the internal
    // onClick so focus-on-click is preserved.
    const user = userEvent.setup()
    render(<TagInput value={['react']} onChange={() => {}} label="Tags" />)
    const combo = screen.getByRole('combobox')
    await user.click(combo)
    expect(document.activeElement).toBe(screen.getByRole('textbox'))
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <div>
        <Host
          label="Tags"
          helperText="Press Enter to add"
          initial={['react']}
        />
        <Host
          label="Topics"
          suggestions={['react', 'vue']}
          allowCustom={false}
        />
        <Host label="Errored" error="Required" />
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  describe('uncontrolled (#508)', () => {
    it('commits tags internally via defaultValue (no controlling parent)', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<TagInput defaultValue={['react']} onChange={onChange} />)
      expect(screen.getByText('react')).toBeInTheDocument()
      // No parent feeds `value` back — the new chip must appear via internal state.
      await user.type(screen.getByRole('textbox'), 'vue{Enter}')
      expect(screen.getByText('vue')).toBeInTheDocument()
      expect(onChange).toHaveBeenLastCalledWith(['react', 'vue'])
    })

    it('works with neither value nor onChange (pure uncontrolled)', async () => {
      const user = userEvent.setup()
      render(<TagInput />)
      await user.type(screen.getByRole('textbox'), 'solid{Enter}')
      expect(screen.getByText('solid')).toBeInTheDocument()
    })
  })
})
