/**
 * Tabs Component Tests
 *
 * Behavioral coverage for the Tabs compound component:
 * Tabs (root/provider) + TabList + Tab + TabPanel.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs } from './Tabs'
import { TabList } from './TabList'
import { Tab } from './Tab'
import { TabPanel } from './TabPanel'

interface BasicTabsProps {
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
}

function BasicTabs({
  defaultValue = 'one',
  value,
  onChange,
}: BasicTabsProps = {}) {
  return (
    <Tabs defaultValue={defaultValue} value={value} onChange={onChange}>
      <TabList>
        <Tab value="one">One</Tab>
        <Tab value="two">Two</Tab>
        <Tab value="three">Three</Tab>
      </TabList>
      <TabPanel value="one">Panel 1</TabPanel>
      <TabPanel value="two">Panel 2</TabPanel>
      <TabPanel value="three">Panel 3</TabPanel>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('renders only the active tab panel', () => {
    render(<BasicTabs defaultValue="two" />)

    // Only panel 2 should be in the DOM (TabPanel returns null when inactive).
    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument()
    expect(screen.getByText('Panel 2')).toBeInTheDocument()
    expect(screen.queryByText('Panel 3')).not.toBeInTheDocument()
  })

  it('switches panel on tab click', async () => {
    const user = userEvent.setup()
    render(<BasicTabs defaultValue="one" />)

    expect(screen.getByText('Panel 1')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Three' }))

    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument()
    expect(screen.getByText('Panel 3')).toBeInTheDocument()
  })

  it('calls onChange with new value on tab click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BasicTabs defaultValue="one" onChange={onChange} />)

    await user.click(screen.getByRole('tab', { name: 'Two' }))

    expect(onChange).toHaveBeenCalledWith('two')
  })

  it('supports controlled value prop', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    // Controlled: value stays 'one' regardless of user interaction.
    render(<BasicTabs value="one" onChange={onChange} />)

    await user.click(screen.getByRole('tab', { name: 'Two' }))

    // onChange still fires so parent can update, but internal state is frozen.
    expect(onChange).toHaveBeenCalledWith('two')
    expect(screen.getByText('Panel 1')).toBeInTheDocument()
    expect(screen.queryByText('Panel 2')).not.toBeInTheDocument()
  })

  it('applies role="tablist" with aria-orientation on TabList', () => {
    render(<BasicTabs />)
    const tabList = screen.getByRole('tablist')
    expect(tabList).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('applies role="tab" and aria-selected on each Tab', () => {
    render(<BasicTabs defaultValue="two" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('applies role="tabpanel" on the rendered TabPanel', () => {
    render(<BasicTabs defaultValue="one" />)
    const panels = screen.getAllByRole('tabpanel')
    // Only the active panel is rendered; others return null.
    expect(panels).toHaveLength(1)
    expect(panels[0]).toHaveTextContent('Panel 1')
  })

  it('moves focus and selection with ArrowRight', async () => {
    const user = userEvent.setup()
    render(<BasicTabs defaultValue="one" />)

    const firstTab = screen.getByRole('tab', { name: 'One' })
    firstTab.focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus()
    // The tab component also activates the newly focused tab.
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('moves focus with ArrowLeft and wraps from first to last', async () => {
    const user = userEvent.setup()
    render(<BasicTabs defaultValue="one" />)

    const firstTab = screen.getByRole('tab', { name: 'One' })
    firstTab.focus()
    await user.keyboard('{ArrowLeft}')

    // Wraps to the last tab.
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()
  })

  it('jumps to first tab on Home and last tab on End', async () => {
    const user = userEvent.setup()
    render(<BasicTabs defaultValue="two" />)

    const secondTab = screen.getByRole('tab', { name: 'Two' })
    secondTab.focus()

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus()
  })
})

describe('Tabs — passthrough (#423)', () => {
  it('forwards data-testid + style to Tabs, TabList, Tab, and TabPanel roots', () => {
    render(
      <Tabs
        defaultValue="one"
        data-testid="tabs-root"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <TabList data-testid="tablist" style={{ color: 'rgb(1, 2, 3)' }}>
          <Tab value="one" data-testid="tab-one" style={{ color: 'rgb(1, 2, 3)' }}>
            One
          </Tab>
        </TabList>
        <TabPanel value="one" data-testid="panel-one" style={{ color: 'rgb(1, 2, 3)' }}>
          Panel 1
        </TabPanel>
      </Tabs>
    )

    for (const id of ['tabs-root', 'tablist', 'tab-one', 'panel-one']) {
      expect(screen.getByTestId(id)).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    }
    // The passthrough lands on the role-bearing visual roots.
    expect(screen.getByTestId('tablist')).toBe(screen.getByRole('tablist'))
    expect(screen.getByTestId('tab-one')).toBe(screen.getByRole('tab'))
    expect(screen.getByTestId('panel-one')).toBe(screen.getByRole('tabpanel'))
  })

  it('does not let consumer roles override the internal tab/tablist/tabpanel roles', () => {
    render(
      <Tabs defaultValue="one">
        <TabList data-testid="tablist" role="menu">
          <Tab value="one" data-testid="tab-one" role="menuitem">
            One
          </Tab>
        </TabList>
        <TabPanel value="one" data-testid="panel-one" role="region">
          Panel 1
        </TabPanel>
      </Tabs>
    )

    expect(screen.getByTestId('tablist')).toHaveAttribute('role', 'tablist')
    expect(screen.getByTestId('tab-one')).toHaveAttribute('role', 'tab')
    expect(screen.getByTestId('panel-one')).toHaveAttribute('role', 'tabpanel')
  })
})
