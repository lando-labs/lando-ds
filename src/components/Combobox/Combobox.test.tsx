/**
 * Combobox tests (#310).
 *
 * Coverage targets the WAI-ARIA combobox-with-listbox pattern + the
 * sync/async filter contract. Avoids `userEvent` (the rest of the DS
 * tests use fireEvent + findByRole for jsdom-portal compatibility) so
 * this file plugs into the existing Vitest setup without surprises.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { Combobox, type ComboboxOption } from './Combobox'

const fruits: ComboboxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian' },
  { value: 'elderberry', label: 'Elderberry' },
]

describe('Combobox', () => {
  // ----------------------------------------------------------------- //
  // Basic rendering                                                   //
  // ----------------------------------------------------------------- //

  it('renders a combobox input with the placeholder', () => {
    render(<Combobox options={fruits} placeholder="Pick a fruit" />)
    const input = screen.getByRole('combobox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Pick a fruit')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
  })

  it('renders the label and wires htmlFor to the input id', () => {
    render(<Combobox options={fruits} label="Fruit" />)
    const input = screen.getByRole('combobox')
    const label = screen.getByText('Fruit')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('for', input.id)
  })

  // ----------------------------------------------------------------- //
  // Open / close lifecycle                                            //
  // ----------------------------------------------------------------- //

  it('opens the listbox on click and reflects aria-expanded', async () => {
    render(<Combobox options={fruits} />)
    const input = screen.getByRole('combobox')

    expect(input).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')

    const listbox = await screen.findByRole('listbox')
    expect(listbox).toBeInTheDocument()
    // aria-controls wired only when open
    expect(input).toHaveAttribute('aria-controls', listbox.id)
  })

  it('opens the listbox on input focus', async () => {
    render(<Combobox options={fruits} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
  })

  it('closes the listbox on Escape WITHOUT clearing the selection', async () => {
    render(<Combobox options={fruits} defaultValue="apple" />)
    const input = screen.getByRole('combobox') as HTMLInputElement

    // Open via click
    fireEvent.click(input)
    await screen.findByRole('listbox')

    // Escape closes
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')

    // Selection should still be Apple — input displays the label again.
    expect(input.value).toBe('Apple')
  })

  it('closes the listbox on outside click', async () => {
    render(
      <div>
        <Combobox options={fruits} />
        <button>outside</button>
      </div>
    )
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    await screen.findByRole('listbox')

    // Outside click — wrapped in act + awaited microtask since the
    // listener is attached via setTimeout(0).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
      fireEvent.mouseDown(screen.getByText('outside'))
    })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------- //
  // Filtering — sync path                                             //
  // ----------------------------------------------------------------- //

  it('filters options by case-insensitive substring match on label', async () => {
    render(<Combobox options={fruits} />)
    const input = screen.getByRole('combobox') as HTMLInputElement

    fireEvent.click(input)
    await screen.findByRole('listbox')
    expect(screen.getAllByRole('option')).toHaveLength(5)

    fireEvent.change(input, { target: { value: 'er' } })
    // "Cherry" and "Elderberry" both contain "er" (case-insensitive)
    const opts = screen.getAllByRole('option')
    const labels = opts.map((o) => o.textContent)
    expect(labels).toEqual(expect.arrayContaining(['Cherry', 'Elderberry']))
    expect(labels).toHaveLength(2)
  })

  it('shows the empty message when the filter matches zero options', async () => {
    render(<Combobox options={fruits} emptyMessage="Nothing here" />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    fireEvent.change(input, { target: { value: 'xyz_no_match' } })
    expect(await screen.findByText('Nothing here')).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  // ----------------------------------------------------------------- //
  // Async filtering (onSearch)                                         //
  // ----------------------------------------------------------------- //

  it('calls onSearch on every keystroke when provided', async () => {
    const onSearch = vi.fn()
    render(<Combobox options={fruits} onSearch={onSearch} />)
    const input = screen.getByRole('combobox')

    fireEvent.click(input)
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ap' } })
    fireEvent.change(input, { target: { value: 'app' } })

    expect(onSearch).toHaveBeenCalledWith('a')
    expect(onSearch).toHaveBeenCalledWith('ap')
    expect(onSearch).toHaveBeenCalledWith('app')
  })

  it('async mode: does NOT sync-filter — renders options as-is', async () => {
    const onSearch = vi.fn()
    // Hand over a single option; type something that wouldn't normally match.
    render(
      <Combobox
        options={[{ value: 'remote', label: 'Remote Result' }]}
        onSearch={onSearch}
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    fireEvent.change(input, { target: { value: 'zzzz' } })

    // The single option still renders — sync filter would have hidden it.
    expect(await screen.findByText('Remote Result')).toBeInTheDocument()
    expect(onSearch).toHaveBeenCalledWith('zzzz')
  })

  it('renders a spinner when loading=true (regardless of options length)', async () => {
    render(<Combobox options={fruits} loading />)
    fireEvent.click(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    // Spinner renders with role="status"
    expect(listbox.querySelector('[role="status"]')).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  // ----------------------------------------------------------------- //
  // Keyboard navigation                                                //
  // ----------------------------------------------------------------- //

  it('ArrowDown moves aria-activedescendant', async () => {
    render(<Combobox options={fruits} />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)

    const listbox = await screen.findByRole('listbox')
    const opts = listbox.querySelectorAll('[role="option"]')

    // Initial active = first option
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[0]?.id)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[1]?.id)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[2]?.id)
  })

  it('ArrowUp from the first option wraps to the last', async () => {
    render(<Combobox options={fruits} />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)

    const listbox = await screen.findByRole('listbox')
    const opts = listbox.querySelectorAll('[role="option"]')

    // Initial active = first (index 0). ArrowUp should wrap to last.
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.getAttribute('aria-activedescendant')).toBe(
      opts[opts.length - 1]?.id
    )
  })

  it('Home / End jump to first / last option', async () => {
    render(<Combobox options={fruits} />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)

    const listbox = await screen.findByRole('listbox')
    const opts = listbox.querySelectorAll('[role="option"]')

    fireEvent.keyDown(input, { key: 'End' })
    expect(input.getAttribute('aria-activedescendant')).toBe(
      opts[opts.length - 1]?.id
    )

    fireEvent.keyDown(input, { key: 'Home' })
    expect(input.getAttribute('aria-activedescendant')).toBe(opts[0]?.id)
  })

  it('Enter selects the active option and closes the listbox', async () => {
    const onChange = vi.fn()
    render(<Combobox options={fruits} onChange={onChange} />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    await screen.findByRole('listbox')

    fireEvent.keyDown(input, { key: 'ArrowDown' }) // → banana
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('banana')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------- //
  // Mouse selection                                                    //
  // ----------------------------------------------------------------- //

  it('mouse-clicking an option selects it and closes the listbox', async () => {
    const onChange = vi.fn()
    render(<Combobox options={fruits} onChange={onChange} />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)

    const cherry = await screen.findByText('Cherry')
    fireEvent.click(cherry)

    expect(onChange).toHaveBeenCalledWith('cherry')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------- //
  // Controlled vs uncontrolled                                         //
  // ----------------------------------------------------------------- //

  it('controlled mode: value prop is the source of truth', () => {
    const { rerender } = render(
      <Combobox options={fruits} value="apple" onChange={() => {}} />
    )
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input.value).toBe('Apple')

    rerender(
      <Combobox options={fruits} value="banana" onChange={() => {}} />
    )
    expect(input.value).toBe('Banana')
  })

  it('uncontrolled mode: defaultValue seeds initial selection', () => {
    render(<Combobox options={fruits} defaultValue="durian" />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input.value).toBe('Durian')
  })

  it('uncontrolled mode: selecting an option updates the displayed label', async () => {
    function Harness() {
      return <Combobox options={fruits} />
    }
    render(<Harness />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.click(input)
    fireEvent.click(await screen.findByText('Banana'))
    expect(input.value).toBe('Banana')
  })

  // ----------------------------------------------------------------- //
  // Disabled                                                           //
  // ----------------------------------------------------------------- //

  it('disabled — clicking does not open the listbox', () => {
    render(<Combobox options={fruits} disabled />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-disabled', 'true')
  })

  // ----------------------------------------------------------------- //
  // Form integration                                                   //
  // ----------------------------------------------------------------- //

  it('renders a hidden input for FormData when `name` is provided', () => {
    const { container } = render(
      <Combobox options={fruits} name="fruit" value="cherry" onChange={() => {}} />
    )
    const hidden = container.querySelector<HTMLInputElement>(
      'input[type="hidden"]'
    )
    expect(hidden).not.toBeNull()
    expect(hidden!.name).toBe('fruit')
    expect(hidden!.value).toBe('cherry')
  })

  // ----------------------------------------------------------------- //
  // Disabled options                                                   //
  // ----------------------------------------------------------------- //

  it('disabled options are skipped by ArrowDown navigation', async () => {
    const opts: ComboboxOption[] = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta', disabled: true },
      { value: 'c', label: 'Gamma' },
    ]
    render(<Combobox options={opts} />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    const listbox = await screen.findByRole('listbox')
    const rendered = listbox.querySelectorAll('[role="option"]')

    // Initial active = first selectable (Alpha)
    expect(input.getAttribute('aria-activedescendant')).toBe(rendered[0]?.id)

    // ArrowDown skips Beta → Gamma
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe(rendered[2]?.id)
  })

  // ----------------------------------------------------------------- //
  // Erasing the input clears the selection                             //
  // ----------------------------------------------------------------- //

  it('erasing typed text clears the committed selection', () => {
    const onChange = vi.fn()
    function Harness() {
      const [v, setV] = useState<string | undefined>('apple')
      return (
        <Combobox
          options={fruits}
          value={v}
          onChange={(next) => {
            setV(next)
            onChange(next)
          }}
        />
      )
    }
    render(<Harness />)
    const input = screen.getByRole('combobox') as HTMLInputElement

    // Open switches the input from "showing selected label" → "showing live
    // query" (empty). Type a character, then erase it back to empty —
    // erasing-while-having-a-committed-selection clears the selection.
    fireEvent.click(input)
    fireEvent.change(input, { target: { value: 'b' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  // #423 — full-customizability contract: consumer `style` + rest props land
  // on the visual-root container (the element `className` forwards to), and
  // the input keeps its combobox role.
  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the visual root', () => {
      render(
        <Combobox
          options={fruits}
          data-testid="my-combobox"
          style={{ color: 'rgb(4, 5, 6)' }}
        />
      )
      const root = screen.getByTestId('my-combobox')
      // The input (role=combobox) lives INSIDE the styled container root.
      const input = screen.getByRole('combobox')
      expect(root).toContainElement(input)
      expect(root.style.color).toBe('rgb(4, 5, 6)')
    })

    it('does not clobber the input combobox role when consumer sets role on root', () => {
      render(
        <Combobox options={fruits} data-testid="roled-combobox" role="group" />
      )
      // Consumer role lands on the outer container; the a11y-critical
      // combobox role stays on the input untouched.
      expect(screen.getByTestId('roled-combobox')).toHaveAttribute(
        'role',
        'group'
      )
      expect(screen.getByRole('combobox').tagName).toBe('INPUT')
    })
  })
})
