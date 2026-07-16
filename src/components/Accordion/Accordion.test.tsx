/**
 * Accordion Component Tests
 *
 * Behavioral coverage for Accordion + AccordionItem in both
 * single and multiple expansion modes.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Accordion } from './Accordion'
import { AccordionItem } from './AccordionItem'

function BasicAccordion({
  type = 'single' as 'single' | 'multiple',
  defaultValue,
  onChange,
}: {
  type?: 'single' | 'multiple'
  defaultValue?: string | string[]
  onChange?: (value: string | string[]) => void
} = {}) {
  return (
    <Accordion type={type} defaultValue={defaultValue} onChange={onChange}>
      <AccordionItem value="one" title="Section 1">
        Content 1
      </AccordionItem>
      <AccordionItem value="two" title="Section 2">
        Content 2
      </AccordionItem>
      <AccordionItem value="three" title="Section 3">
        Content 3
      </AccordionItem>
    </Accordion>
  )
}

describe('Accordion', () => {
  it('renders all triggers collapsed by default when no defaultValue', () => {
    render(<BasicAccordion />)

    const triggers = screen.getAllByRole('button')
    expect(triggers).toHaveLength(3)
    for (const trigger of triggers) {
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    }
  })

  it('renders the defaultValue item as expanded in single mode', () => {
    render(<BasicAccordion defaultValue="two" />)

    const triggers = screen.getAllByRole('button')
    expect(triggers[0]).toHaveAttribute('aria-expanded', 'false')
    expect(triggers[1]).toHaveAttribute('aria-expanded', 'true')
    expect(triggers[2]).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands an item on click (single mode)', async () => {
    const user = userEvent.setup()
    render(<BasicAccordion />)

    const trigger = screen.getByRole('button', { name: /Section 1/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('collapses the previously open item when opening another (single mode)', async () => {
    const user = userEvent.setup()
    render(<BasicAccordion defaultValue="one" />)

    const first = screen.getByRole('button', { name: /Section 1/ })
    const second = screen.getByRole('button', { name: /Section 2/ })

    expect(first).toHaveAttribute('aria-expanded', 'true')

    await user.click(second)

    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(second).toHaveAttribute('aria-expanded', 'true')
  })

  it('toggles the same item closed when clicked twice (single mode)', async () => {
    const user = userEvent.setup()
    render(<BasicAccordion defaultValue="one" />)

    const first = screen.getByRole('button', { name: /Section 1/ })
    expect(first).toHaveAttribute('aria-expanded', 'true')

    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'false')
  })

  it('allows multiple expanded items in multiple mode', async () => {
    const user = userEvent.setup()
    render(<BasicAccordion type="multiple" defaultValue={[]} />)

    const first = screen.getByRole('button', { name: /Section 1/ })
    const second = screen.getByRole('button', { name: /Section 2/ })

    await user.click(first)
    await user.click(second)

    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(second).toHaveAttribute('aria-expanded', 'true')
  })

  it('expands on Enter key', async () => {
    const user = userEvent.setup()
    render(<BasicAccordion />)

    const trigger = screen.getByRole('button', { name: /Section 1/ })
    trigger.focus()
    await user.keyboard('{Enter}')

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('expands on Space key', async () => {
    const user = userEvent.setup()
    render(<BasicAccordion />)

    const trigger = screen.getByRole('button', { name: /Section 2/ })
    trigger.focus()
    await user.keyboard(' ')

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('does not toggle when item is disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Accordion type="single" onChange={onChange}>
        <AccordionItem value="one" title="Enabled">
          Content 1
        </AccordionItem>
        <AccordionItem value="two" title="Locked" disabled>
          Content 2
        </AccordionItem>
      </Accordion>
    )

    const locked = screen.getByRole('button', { name: /Locked/ })
    expect(locked).toBeDisabled()
    await user.click(locked)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange with the expanded value (single mode)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BasicAccordion onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Section 2/ }))
    expect(onChange).toHaveBeenCalledWith('two')
  })
})

describe('Accordion — passthrough (#423)', () => {
  it('forwards data-testid + style to the Accordion and AccordionItem roots', () => {
    render(
      <Accordion
        type="single"
        defaultValue="one"
        data-testid="acc-root"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <AccordionItem
          value="one"
          title="Section 1"
          data-testid="acc-item"
          style={{ color: 'rgb(1, 2, 3)' }}
        >
          Content 1
        </AccordionItem>
      </Accordion>
    )

    const root = screen.getByTestId('acc-root')
    const item = screen.getByTestId('acc-item')
    expect(root).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    expect(item).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    // Passthrough lands on the outer item container, not the trigger button.
    expect(item.tagName.toLowerCase()).toBe('div')
    // The item's internal trigger semantics are untouched by the passthrough.
    const trigger = screen.getByRole('button', { name: /Section 1/ })
    expect(item.contains(trigger)).toBe(true)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})
