/**
 * MultiSelect tests (#310).
 *
 * Coverage focused on the multi-selection / chip-row affordances. The
 * underlying listbox + activedescendant machinery is exercised in
 * Combobox.test.tsx; here we test what's DIFFERENT — chips, Backspace,
 * maxSelectable, toggle behavior on re-select.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useState } from 'react'
import { MultiSelect } from './MultiSelect'
import type { ComboboxOption } from './Combobox'

const fruits: ComboboxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian' },
]

describe('MultiSelect', () => {
  // ----------------------------------------------------------------- //
  // Chip rendering                                                     //
  // ----------------------------------------------------------------- //

  it('renders one chip per selected value with the option label', () => {
    render(
      <MultiSelect
        options={fruits}
        value={['apple', 'cherry']}
        onChange={() => {}}
      />
    )
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Cherry')).toBeInTheDocument()
    // Removable chips have an aria-label per chip
    expect(screen.getByLabelText('Remove Apple')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove Cherry')).toBeInTheDocument()
  })

  it('falls back to the bare value when the option label is unknown', () => {
    // Async-mode pattern: consumer's `options` may not contain a stale
    // selection — chip falls back to the value string.
    render(
      <MultiSelect
        options={[]}
        value={['ghost-1']}
        onChange={() => {}}
      />
    )
    expect(screen.getByText('ghost-1')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------- //
  // Chip removal                                                       //
  // ----------------------------------------------------------------- //

  it('clicking a chip × removes that value from the selection', () => {
    const onChange = vi.fn()
    render(
      <MultiSelect
        options={fruits}
        value={['apple', 'cherry']}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByLabelText('Remove Apple'))
    expect(onChange).toHaveBeenCalledWith(['cherry'])
  })

  it('Backspace at an empty input removes the last chip', () => {
    const onChange = vi.fn()
    render(
      <MultiSelect
        options={fruits}
        value={['apple', 'banana']}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledWith(['apple'])
  })

  it('Backspace with text in the input does NOT remove a chip', () => {
    const onChange = vi.fn()
    render(
      <MultiSelect
        options={fruits}
        value={['apple']}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('combobox') as HTMLInputElement
    fireEvent.click(input)
    fireEvent.change(input, { target: { value: 'che' } })

    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------- //
  // Selection toggle                                                   //
  // ----------------------------------------------------------------- //

  it('clicking an already-selected option deselects it', async () => {
    const onChange = vi.fn()
    render(
      <MultiSelect
        options={fruits}
        value={['apple', 'banana']}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.click(input)

    // Apple is selected → clicking it again deselects.
    const listbox = await screen.findByRole('listbox')
    const apple = within(listbox).getByText('Apple').closest('[role="option"]')!
    fireEvent.click(apple)
    expect(onChange).toHaveBeenCalledWith(['banana'])
  })

  it('clicking a new option appends to the selection', async () => {
    const onChange = vi.fn()
    render(
      <MultiSelect
        options={fruits}
        value={['apple']}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.click(input)

    const listbox = await screen.findByRole('listbox')
    const cherry = within(listbox)
      .getByText('Cherry')
      .closest('[role="option"]')!
    fireEvent.click(cherry)
    expect(onChange).toHaveBeenCalledWith(['apple', 'cherry'])
  })

  it('listbox stays open after selecting (for multi-pick flows)', async () => {
    function Harness() {
      const [v, setV] = useState<string[]>([])
      return <MultiSelect options={fruits} value={v} onChange={setV} />
    }
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    const cherry = await screen.findByText('Cherry')
    fireEvent.click(cherry)

    // Listbox should still be open after the pick.
    expect(screen.queryByRole('listbox')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------- //
  // maxSelectable                                                      //
  // ----------------------------------------------------------------- //

  it('maxSelectable prevents adding beyond the cap', async () => {
    const onChange = vi.fn()
    render(
      <MultiSelect
        options={fruits}
        value={['apple', 'banana']}
        onChange={onChange}
        maxSelectable={2}
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.click(input)

    const listbox = await screen.findByRole('listbox')
    const cherry = within(listbox)
      .getByText('Cherry')
      .closest('[role="option"]')!

    // Unselected options at max should be aria-disabled so AT announces
    // the state.
    expect(cherry).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(cherry)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('maxSelectable still allows DESELECT at the cap', async () => {
    const onChange = vi.fn()
    render(
      <MultiSelect
        options={fruits}
        value={['apple', 'banana']}
        onChange={onChange}
        maxSelectable={2}
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.click(input)

    // Apple (already selected) should still be clickable to remove.
    const listbox = await screen.findByRole('listbox')
    const apple = within(listbox).getByText('Apple').closest('[role="option"]')!
    fireEvent.click(apple)
    expect(onChange).toHaveBeenCalledWith(['banana'])
  })

  // ----------------------------------------------------------------- //
  // a11y                                                                //
  // ----------------------------------------------------------------- //

  it('listbox has aria-multiselectable="true"', async () => {
    render(<MultiSelect options={fruits} value={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true')
  })

  it('selected options carry aria-selected="true"', async () => {
    render(
      <MultiSelect
        options={fruits}
        value={['banana']}
        onChange={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    const banana = within(listbox)
      .getByText('Banana')
      .closest('[role="option"]')!
    expect(banana).toHaveAttribute('aria-selected', 'true')

    const apple = within(listbox).getByText('Apple').closest('[role="option"]')!
    expect(apple).toHaveAttribute('aria-selected', 'false')
  })

  // ----------------------------------------------------------------- //
  // FormData hidden inputs                                             //
  // ----------------------------------------------------------------- //

  it('renders one hidden input per selected value when `name` is provided', () => {
    const { container } = render(
      <MultiSelect
        options={fruits}
        value={['apple', 'cherry']}
        onChange={() => {}}
        name="fruits"
      />
    )
    const hiddens = container.querySelectorAll<HTMLInputElement>(
      'input[type="hidden"]'
    )
    expect(hiddens).toHaveLength(2)
    expect(Array.from(hiddens).map((h) => h.value)).toEqual([
      'apple',
      'cherry',
    ])
    Array.from(hiddens).forEach((h) => expect(h.name).toBe('fruits'))
  })

  // ----------------------------------------------------------------- //
  // Async filter                                                       //
  // ----------------------------------------------------------------- //

  it('async mode: onSearch fires on every keystroke', () => {
    const onSearch = vi.fn()
    render(
      <MultiSelect
        options={fruits}
        value={[]}
        onChange={() => {}}
        onSearch={onSearch}
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    fireEvent.change(input, { target: { value: 'ch' } })
    expect(onSearch).toHaveBeenCalledWith('ch')
  })

  // ----------------------------------------------------------------- //
  // Disabled                                                            //
  // ----------------------------------------------------------------- //

  it('disabled — clicking does not open the listbox', () => {
    render(
      <MultiSelect
        options={fruits}
        value={[]}
        onChange={() => {}}
        disabled
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.click(input)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------- //
  // Placeholder                                                        //
  // ----------------------------------------------------------------- //

  it('placeholder hides once any chips are present', () => {
    const { rerender } = render(
      <MultiSelect
        options={fruits}
        value={[]}
        onChange={() => {}}
        placeholder="Pick fruits"
      />
    )
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input.placeholder).toBe('Pick fruits')

    rerender(
      <MultiSelect
        options={fruits}
        value={['apple']}
        onChange={() => {}}
        placeholder="Pick fruits"
      />
    )
    expect(input.placeholder).toBe('')
  })

  // ----------------------------------------------------------------- //
  // #423 — style + rest passthrough                                    //
  // ----------------------------------------------------------------- //

  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the visual root', () => {
      render(
        <MultiSelect
          options={fruits}
          value={[]}
          onChange={() => {}}
          data-testid="my-multiselect"
          style={{ color: 'rgb(7, 8, 9)' }}
        />
      )
      const root = screen.getByTestId('my-multiselect')
      const input = screen.getByRole('combobox')
      expect(root).toContainElement(input)
      expect(root.style.color).toBe('rgb(7, 8, 9)')
    })

    it('does not clobber the input combobox role when consumer sets role on root', () => {
      render(
        <MultiSelect
          options={fruits}
          value={[]}
          onChange={() => {}}
          data-testid="roled-multiselect"
          role="group"
        />
      )
      expect(screen.getByTestId('roled-multiselect')).toHaveAttribute(
        'role',
        'group'
      )
      expect(screen.getByRole('combobox').tagName).toBe('INPUT')
    })
  })
})
