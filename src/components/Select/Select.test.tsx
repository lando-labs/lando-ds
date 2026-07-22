/**
 * Select Component Tests
 *
 * Regression coverage for #1 (Select displays only one option):
 * - a Select opened with 20 options renders all 20 options in the DOM
 * - `.options` container is NOT collapsed by the historical
 *   `max-height: inherit` + `overflow: hidden` + trailing padding bug
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from './Select'

const manyOptions = Array.from({ length: 20 }, (_, i) => ({
  label: `Option ${i + 1}`,
  value: `opt-${i + 1}`,
}))

describe('Select', () => {
  it('renders the placeholder when no value is selected', () => {
    render(<Select options={manyOptions} onChange={() => {}} placeholder="Pick one" />)
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('renders ALL options when opened (#1 regression)', async () => {
    render(<Select options={manyOptions} onChange={() => {}} />)

    // Open the select
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    // Portal is mounted via useEffect, so we need findByRole to wait for it.
    // All 20 options should be present in the DOM (not collapsed to one)
    const listbox = await screen.findByRole('listbox')
    const options = listbox.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(20)

    // Spot-check specific labels at the extremes to be sure
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 10')).toBeInTheDocument()
    expect(screen.getByText('Option 20')).toBeInTheDocument()
  })

  it('fires onChange with the selected value', async () => {
    let selected: string | undefined
    render(
      <Select
        options={manyOptions}
        onChange={(v) => {
          selected = v as string
        }}
      />
    )

    fireEvent.click(screen.getByRole('combobox'))
    const option = await screen.findByText('Option 5')
    fireEvent.click(option)

    expect(selected).toBe('opt-5')
  })

  it('respects the disabled prop', () => {
    render(<Select options={manyOptions} onChange={() => {}} disabled />)
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('aria-disabled', 'true')

    // Clicking a disabled select should not open the listbox
    fireEvent.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  // ------------------------------------------------------------------ //
  // FormData / Server Actions — issue #7                                 //
  // ------------------------------------------------------------------ //

  describe('name prop — hidden input for FormData', () => {
    it('renders no hidden input when name is omitted', () => {
      const { container } = render(
        <Select options={manyOptions} onChange={() => {}} value="opt-1" />
      )
      expect(container.querySelector('input[type="hidden"]')).toBeNull()
    })

    it('renders a single hidden input with the correct name and value (single-select)', () => {
      const { container } = render(
        <Select
          options={manyOptions}
          onChange={() => {}}
          name="role"
          value="opt-3"
        />
      )
      const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')
      expect(hidden).not.toBeNull()
      expect(hidden!.name).toBe('role')
      expect(hidden!.value).toBe('opt-3')
    })

    it('renders an empty string value when no selection (single-select)', () => {
      const { container } = render(
        <Select options={manyOptions} onChange={() => {}} name="role" />
      )
      const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')
      expect(hidden).not.toBeNull()
      expect(hidden!.value).toBe('')
    })

    it('renders one hidden input per selected value (multi-select)', () => {
      const { container } = render(
        <Select
          options={manyOptions}
          onChange={() => {}}
          name="tags"
          multiple
          value={['opt-1', 'opt-2', 'opt-5']}
        />
      )
      const hiddens = container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')
      expect(hiddens).toHaveLength(3)
      const values = Array.from(hiddens).map((h) => h.value)
      expect(values).toEqual(['opt-1', 'opt-2', 'opt-5'])
      Array.from(hiddens).forEach((h) => expect(h.name).toBe('tags'))
    })

    it('renders zero hidden inputs when multi-select has no selection', () => {
      const { container } = render(
        <Select
          options={manyOptions}
          onChange={() => {}}
          name="tags"
          multiple
          value={[]}
        />
      )
      expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(0)
    })

    it('hidden input value updates when selection changes', async () => {
      let current: string | undefined
      const { container, rerender } = render(
        <Select
          options={manyOptions}
          onChange={(v) => { current = v as string }}
          name="role"
          value={current}
        />
      )

      fireEvent.click(screen.getByRole('combobox'))
      const option = await screen.findByText('Option 7')
      fireEvent.click(option)

      // Re-render with the new value (simulating controlled component update)
      rerender(
        <Select
          options={manyOptions}
          onChange={(v) => { current = v as string }}
          name="role"
          value="opt-7"
        />
      )

      const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')
      expect(hidden!.value).toBe('opt-7')
    })
  })

  // ------------------------------------------------------------------ //
  // Clear button signature — issue #328                                  //
  // ------------------------------------------------------------------ //

  describe('clearable — onChange emits undefined on clear (#328)', () => {
    it('single-select clear emits undefined, not empty string', () => {
      const onChange = vi.fn()
      render(
        <Select
          options={manyOptions}
          onChange={onChange}
          value="opt-1"
          clearable
        />
      )
      const clearBtn = screen.getByRole('button', { name: 'Clear selection' })
      fireEvent.click(clearBtn)

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(undefined)
    })

    it('multi-select clear still emits empty array', () => {
      const onChange = vi.fn()
      render(
        <Select
          options={manyOptions}
          onChange={onChange}
          value={['opt-1', 'opt-2']}
          clearable
          multiple
        />
      )
      const clearBtn = screen.getByRole('button', { name: 'Clear selection' })
      fireEvent.click(clearBtn)

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith([])
    })
  })

  // ------------------------------------------------------------------ //
  // a11y regressions — issue #13                                        //
  // ------------------------------------------------------------------ //

  describe('a11y — aria-activedescendant + keyboard nav (#13)', () => {
    it('assigns a stable id to each rendered option', async () => {
      render(<Select options={manyOptions} onChange={() => {}} />)
      fireEvent.click(screen.getByRole('combobox'))

      const listbox = await screen.findByRole('listbox')
      const options = listbox.querySelectorAll('[role="option"]')
      // Every option must have an id so aria-activedescendant can target it.
      options.forEach((opt) => {
        expect(opt.getAttribute('id')).toBeTruthy()
      })
    })

    it('aria-activedescendant on the combobox points at the highlighted option', async () => {
      render(<Select options={manyOptions} onChange={() => {}} />)
      const combobox = screen.getByRole('combobox')
      fireEvent.click(combobox)

      // First open → highlightedIndex 0
      const listbox = await screen.findByRole('listbox')
      const firstOption = listbox.querySelectorAll('[role="option"]')[0] as HTMLElement
      expect(combobox.getAttribute('aria-activedescendant')).toBe(
        firstOption.id
      )

      // ArrowDown moves the highlight
      fireEvent.keyDown(combobox, { key: 'ArrowDown' })
      const secondOption = listbox.querySelectorAll('[role="option"]')[1] as HTMLElement
      expect(combobox.getAttribute('aria-activedescendant')).toBe(
        secondOption.id
      )
    })

    it('searchable combobox still responds to arrow keys while focus is in search', async () => {
      const searchableOptions = [
        { label: 'Apple', value: 'apple' },
        { label: 'Banana', value: 'banana' },
        { label: 'Cherry', value: 'cherry' },
      ]
      render(<Select options={searchableOptions} onChange={() => {}} searchable />)

      fireEvent.click(screen.getByRole('combobox'))
      const listbox = await screen.findByRole('listbox')
      const searchInput = listbox.querySelector('input[type="text"]') as HTMLInputElement
      expect(searchInput).not.toBeNull()

      // Before the fix, this was a no-op because keyDown was on the combobox div.
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' })

      const options = listbox.querySelectorAll('[role="option"]')
      // highlightedIndex should now be 2 (Cherry)
      const combobox = screen.getByRole('combobox')
      expect(combobox.getAttribute('aria-activedescendant')).toBe(
        (options[2] as HTMLElement).id
      )
    })

    it('aria-controls wires the combobox to the listbox id when open', async () => {
      render(<Select options={manyOptions} onChange={() => {}} />)
      const combobox = screen.getByRole('combobox')

      // Closed → no aria-controls
      expect(combobox.hasAttribute('aria-controls')).toBe(false)

      fireEvent.click(combobox)
      const listbox = await screen.findByRole('listbox')
      expect(combobox.getAttribute('aria-controls')).toBe(listbox.id)
    })

    it('Home / End jump highlight to first / last option', async () => {
      render(<Select options={manyOptions} onChange={() => {}} />)
      const combobox = screen.getByRole('combobox')
      fireEvent.click(combobox)

      const listbox = await screen.findByRole('listbox')
      const options = listbox.querySelectorAll('[role="option"]')

      fireEvent.keyDown(combobox, { key: 'End' })
      expect(combobox.getAttribute('aria-activedescendant')).toBe(
        (options[options.length - 1] as HTMLElement).id
      )

      fireEvent.keyDown(combobox, { key: 'Home' })
      expect(combobox.getAttribute('aria-activedescendant')).toBe(
        (options[0] as HTMLElement).id
      )
    })
  })

  // #14 follow-up — a Select rendered inside a Modal (see
  // NestedOverlays.test.tsx for the full nested-Modal scenario) is now
  // reachable via the Popover-API migration, which surfaced a real bug: the
  // Escape handler was unconditionally calling preventDefault(), even when
  // the listbox was already closed. That swallowed every Escape press while
  // the trigger had focus and trapped a parent Modal open, because the
  // native <dialog> Escape-to-close mechanism keys off the keydown event's
  // defaultPrevented flag. Gate the handler on `isOpen` — only consume
  // Escape when there's actually a listbox to close.
  //
  // `fireEvent.keyDown` returns the boolean `element.dispatchEvent()`
  // returns: `false` once some handler called `preventDefault()` on the
  // (cancelable) event, `true` if nothing did. That return value is the
  // trustworthy, harness-agnostic signal for "was this Escape consumed" —
  // jsdom doesn't implement the native <dialog> Escape-to-close mechanism
  // itself, so asserting on Modal closure directly isn't meaningful here.
  describe('Escape key handling (#14 follow-up)', () => {
    it('closes the listbox on Escape and consumes the event (isOpen: true)', async () => {
      render(<Select options={manyOptions} onChange={() => {}} />)
      const combobox = screen.getByRole('combobox')
      fireEvent.click(combobox)
      await screen.findByRole('listbox')

      const notPrevented = fireEvent.keyDown(combobox, { key: 'Escape' })

      expect(notPrevented).toBe(false)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(combobox.getAttribute('aria-expanded')).toBe('false')
    })

    it('does NOT preventDefault on Escape when the listbox is already closed (isOpen: false)', () => {
      render(<Select options={manyOptions} onChange={() => {}} />)
      const combobox = screen.getByRole('combobox')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

      // Listbox was never opened — Escape must be a no-op here so it can
      // bubble un-prevented to a parent Modal's native Escape-to-close.
      const notPrevented = fireEvent.keyDown(combobox, { key: 'Escape' })

      expect(notPrevented).toBe(true)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('re-arms after closing: a second Escape (post-close) is not prevented', async () => {
      render(<Select options={manyOptions} onChange={() => {}} />)
      const combobox = screen.getByRole('combobox')
      fireEvent.click(combobox)
      await screen.findByRole('listbox')

      // First Escape: consumes the event, closes the listbox.
      expect(fireEvent.keyDown(combobox, { key: 'Escape' })).toBe(false)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

      // Second Escape: listbox is already closed — must NOT be prevented.
      expect(fireEvent.keyDown(combobox, { key: 'Escape' })).toBe(true)
    })
  })

  // #423 — full-customizability contract: consumer `style` + arbitrary
  // rest props land on the visual root, and the internal a11y contract
  // (role="combobox") is NOT clobbered by a consumer-supplied `role`.
  describe('style + rest passthrough (#423)', () => {
    it('forwards data-testid and style.color to the visual root', () => {
      render(
        <Select
          options={manyOptions}
          onChange={() => {}}
          data-testid="my-select"
          style={{ color: 'rgb(1, 2, 3)' }}
        />
      )
      const root = screen.getByTestId('my-select')
      expect(root).toBe(screen.getByRole('combobox'))
      expect(root.style.color).toBe('rgb(1, 2, 3)')
    })

    it('keeps the internal combobox role even when the consumer passes role', () => {
      render(
        <Select
          options={manyOptions}
          onChange={() => {}}
          data-testid="roled-select"
          role="presentation"
        />
      )
      // The internal role wins — the widget must stay a combobox for AT.
      expect(screen.getByTestId('roled-select')).toHaveAttribute(
        'role',
        'combobox'
      )
    })
  })

  describe('uncontrolled (#508)', () => {
    it('tracks selection internally via defaultValue (no controlling parent)', async () => {
      const onChange = vi.fn()
      render(
        <Select
          options={[
            { label: 'Apple', value: 'apple' },
            { label: 'Banana', value: 'banana' },
          ]}
          defaultValue="apple"
          onChange={onChange}
        />
      )
      // Default selection surfaces in the trigger.
      expect(screen.getByRole('combobox')).toHaveTextContent('Apple')
      // Pick Banana — selection persists WITHOUT a parent feeding value back.
      // (Options mount in a Portal via useEffect, so wait for them.)
      fireEvent.click(screen.getByRole('combobox'))
      fireEvent.click(await screen.findByText('Banana'))
      expect(onChange).toHaveBeenCalledWith('banana')
      expect(screen.getByRole('combobox')).toHaveTextContent('Banana')
    })

    it('is usable with neither value nor onChange (pure uncontrolled)', async () => {
      render(
        <Select
          options={[
            { label: 'One', value: 1 },
            { label: 'Two', value: 2 },
          ]}
          defaultValue={1}
        />
      )
      fireEvent.click(screen.getByRole('combobox'))
      fireEvent.click(await screen.findByText('Two'))
      expect(screen.getByRole('combobox')).toHaveTextContent('Two')
    })
  })

  describe('controlled with the undefined-cleared sentinel (#328 / #508 regression)', () => {
    const opts = [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
    ]

    it('stays controlled when `value` round-trips through undefined', async () => {
      // A controlled clearable Select starts empty (value === undefined). Because
      // `undefined` is ALSO its "cleared" value (#328), it must remain controlled
      // — never silently fall back to stale internal state.
      const onChange = vi.fn()
      const { rerender } = render(
        <Select options={opts} value={undefined} onChange={onChange} />
      )
      expect(screen.getByRole('combobox')).toHaveTextContent('Select...')

      // User picks Banana; parent mirrors it back as the controlled value.
      fireEvent.click(screen.getByRole('combobox'))
      fireEvent.click(await screen.findByText('Banana'))
      expect(onChange).toHaveBeenCalledWith('banana')
      rerender(<Select options={opts} value={'banana'} onChange={onChange} />)
      expect(screen.getByRole('combobox')).toHaveTextContent('Banana')

      // Parent clears → resets the controlled value to undefined. MUST render the
      // placeholder, not the stale internal 'banana'. (Regression guard: with the
      // naive value!==undefined rule this showed 'Banana'.)
      rerender(<Select options={opts} value={undefined} onChange={onChange} />)
      expect(screen.getByRole('combobox')).toHaveTextContent('Select...')
    })

    it('a value-pinned Select ignores selection when the parent drops onChange', async () => {
      // Truly controlled: value pinned to undefined, onChange ignored → the
      // component must not self-update (would prove it went uncontrolled).
      render(<Select options={opts} value={undefined} onChange={() => {}} />)
      fireEvent.click(screen.getByRole('combobox'))
      fireEvent.click(await screen.findByText('Apple'))
      expect(screen.getByRole('combobox')).toHaveTextContent('Select...')
    })
  })
})
