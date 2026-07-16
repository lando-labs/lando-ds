/**
 * Dropdown Component Tests
 *
 * A11y regression coverage for issue #13:
 *  - The cloned trigger receives `aria-haspopup="menu"` and `aria-expanded`
 *    so screen-reader users know a menu exists and whether it's open.
 *  - Consumer-supplied aria-haspopup / aria-expanded values win over defaults.
 *
 * Behavior regression coverage for issue #103 (was #8fb96df fix):
 *  - DropdownItem.onClick fires exactly once per click. Prior to the v0.12.0
 *    fix, Dropdown's cloned onSelect handler re-invoked the consumer's
 *    onClick before closing the menu, while DropdownItem.handleClick was
 *    independently calling it as well — netting two invocations per click.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Dropdown } from './Dropdown'
import { DropdownItem } from './DropdownItem'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => {
    vi.runOnlyPendingTimers()
  })
  vi.useRealTimers()
})

function flushRaf(times = 3) {
  for (let i = 0; i < times; i++) {
    act(() => {
      vi.advanceTimersByTime(16)
    })
  }
}

describe('Dropdown — a11y (#13)', () => {
  it('adds aria-haspopup="menu" to the cloned trigger by default', () => {
    render(
      <Dropdown trigger={<button>Menu</button>}>
        <DropdownItem>One</DropdownItem>
      </Dropdown>
    )
    const trigger = screen.getByRole('button', { name: 'Menu' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('toggles aria-expanded when the dropdown opens/closes', () => {
    render(
      <Dropdown trigger={<button>Menu</button>}>
        <DropdownItem>One</DropdownItem>
      </Dropdown>
    )
    const trigger = screen.getByRole('button', { name: 'Menu' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    flushRaf()

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('respects consumer-supplied aria-haspopup (listbox instead of menu)', () => {
    render(
      <Dropdown
        trigger={
          <button aria-haspopup="listbox">Custom</button>
        }
      >
        <DropdownItem>One</DropdownItem>
      </Dropdown>
    )
    const trigger = screen.getByRole('button', { name: 'Custom' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
  })
})

describe('Dropdown — onClick fires exactly once (#103)', () => {
  it('DropdownItem.onClick fires exactly once per click', () => {
    // Regression guard for the v0.12.0 fix in commit 8fb96df. Prior to that
    // fix, Dropdown cloned each child to inject an onSelect that ALSO
    // re-invoked the original onClick before closing — DropdownItem.handle
    // Click already calls the consumer onClick, so consumer code ran twice
    // per click. This test asserts the contract: one user click → one
    // onClick invocation.
    const onClick = vi.fn()
    render(
      <Dropdown trigger={<button>Menu</button>}>
        <DropdownItem onClick={onClick}>Save</DropdownItem>
      </Dropdown>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    flushRaf()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Dropdown — passthrough (#423)', () => {
  it('forwards data-testid and style to the menu (visual root)', () => {
    render(
      <Dropdown
        trigger={<button>Menu</button>}
        data-testid="my-menu"
        style={{ color: 'rgb(1, 2, 3)' }}
      >
        <DropdownItem>One</DropdownItem>
      </Dropdown>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    flushRaf()

    const menu = screen.getByTestId('my-menu')
    expect(menu).toBe(screen.getByRole('menu'))
    expect(menu).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('does not let a consumer role override the internal menu role', () => {
    render(
      <Dropdown
        trigger={<button>Menu</button>}
        data-testid="role-menu"
        role="listbox"
      >
        <DropdownItem>One</DropdownItem>
      </Dropdown>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    flushRaf()

    const menu = screen.getByTestId('role-menu')
    expect(menu).toHaveAttribute('role', 'menu')
  })
})

describe('DropdownItem — passthrough (#423)', () => {
  it('forwards data-testid and style to the menuitem (visual root)', () => {
    render(
      <Dropdown trigger={<button>Menu</button>}>
        <DropdownItem data-testid="my-item" style={{ color: 'rgb(1, 2, 3)' }}>
          Save
        </DropdownItem>
      </Dropdown>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    flushRaf()

    const item = screen.getByTestId('my-item')
    expect(item).toBe(screen.getByRole('menuitem', { name: 'Save' }))
    expect(item).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })

  it('does not let a consumer role override the internal menuitem role', () => {
    render(
      <Dropdown trigger={<button>Menu</button>}>
        <DropdownItem data-testid="role-item" role="tab">
          Save
        </DropdownItem>
      </Dropdown>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    flushRaf()

    const item = screen.getByTestId('role-item')
    expect(item).toHaveAttribute('role', 'menuitem')
  })
})
