/**
 * List + ListItem Component Tests
 *
 * List uses a discriminated `variant` prop (ordered | unordered | plain).
 * When variant === 'ordered' the component renders <ol>, otherwise <ul>.
 *
 * ListItem renders <li> with optional icon/actions/onClick. When onClick is
 * provided, the item becomes keyboard-interactive (role=button, tabIndex=0)
 * and Enter/Space trigger the handler.
 */

import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { List } from './List'
import { ListItem } from './ListItem'

function classAttr(el: ChildNode | null): string {
  if (!el || !(el instanceof HTMLElement)) return ''
  return el.getAttribute('class') ?? ''
}

describe('List', () => {
  it('renders as <ul> by default (variant=unordered)', () => {
    const { container } = render(
      <List>
        <ListItem>One</ListItem>
      </List>
    )
    expect((container.firstChild as HTMLElement).tagName).toBe('UL')
  })

  it('renders as <ol> when variant="ordered"', () => {
    const { container } = render(
      <List variant="ordered">
        <ListItem>One</ListItem>
      </List>
    )
    expect((container.firstChild as HTMLElement).tagName).toBe('OL')
  })

  it('renders as <ul> when variant="plain"', () => {
    const { container } = render(
      <List variant="plain">
        <ListItem>One</ListItem>
      </List>
    )
    // plain still renders <ul>, just with different styling
    expect((container.firstChild as HTMLElement).tagName).toBe('UL')
  })

  it('renders ListItem children', () => {
    render(
      <List>
        <ListItem>Apple</ListItem>
        <ListItem>Banana</ListItem>
      </List>
    )
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
  })

  it('applies spacing class', () => {
    const { container } = render(
      <List spacing="lg">
        <ListItem>One</ListItem>
      </List>
    )
    expect(classAttr(container.firstChild)).toMatch(/spacing-lg/)
  })

  it('applies divider class when enabled', () => {
    const { container } = render(
      <List divider>
        <ListItem>One</ListItem>
      </List>
    )
    expect(classAttr(container.firstChild)).toMatch(/divider/)
  })

  it('forwards ref to the list element', () => {
    const ref = createRef<HTMLUListElement | HTMLOListElement>()
    render(
      <List ref={ref}>
        <ListItem>One</ListItem>
      </List>
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('UL')
  })

  it('forwards ref correctly for ordered list', () => {
    const ref = createRef<HTMLUListElement | HTMLOListElement>()
    render(
      <List variant="ordered" ref={ref}>
        <ListItem>One</ListItem>
      </List>
    )
    expect(ref.current?.tagName).toBe('OL')
  })
})

describe('ListItem', () => {
  it('renders children as <li>', () => {
    render(
      <List>
        <ListItem>Hello</ListItem>
      </List>
    )
    const item = screen.getByText('Hello').closest('li')
    expect(item).toBeInTheDocument()
  })

  it('renders icon slot', () => {
    render(
      <List>
        <ListItem icon={<span data-testid="icon">*</span>}>Content</ListItem>
      </List>
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders actions slot', () => {
    render(
      <List>
        <ListItem actions={<button>Edit</button>}>Content</ListItem>
      </List>
    )
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('fires onClick and sets role=button when clickable', () => {
    const onClick = vi.fn()
    render(
      <List>
        <ListItem onClick={onClick}>Click me</ListItem>
      </List>
    )
    const item = screen.getByRole('button', { name: /click me/i })
    fireEvent.click(item)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('activates onClick via Enter and Space keys', () => {
    const onClick = vi.fn()
    render(
      <List>
        <ListItem onClick={onClick}>Press me</ListItem>
      </List>
    )
    const item = screen.getByRole('button', { name: /press me/i })
    fireEvent.keyDown(item, { key: 'Enter' })
    fireEvent.keyDown(item, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <List>
        <ListItem onClick={onClick} disabled>
          Disabled
        </ListItem>
      </List>
    )
    const item = screen.getByText('Disabled').closest('li') as HTMLElement
    fireEvent.click(item)
    fireEvent.keyDown(item, { key: 'Enter' })
    expect(onClick).not.toHaveBeenCalled()
    expect(item.getAttribute('aria-disabled')).toBe('true')
  })

  it('applies active class when active', () => {
    render(
      <List>
        <ListItem active>Selected</ListItem>
      </List>
    )
    const item = screen.getByText('Selected').closest('li')
    expect(classAttr(item)).toMatch(/active/)
  })
})

describe('ListItem — consumer passthrough (#422, regression)', () => {
  it('lands consumer data-testid on the <li> visual root', () => {
    render(
      <List>
        <ListItem data-testid="li-item">Item</ListItem>
      </List>,
    )
    expect(screen.getByTestId('li-item').tagName).toBe('LI')
  })

  it('applies consumer style to the <li> visual root', () => {
    render(
      <List>
        <ListItem data-testid="li-item" style={{ color: 'rgb(1, 2, 3)' }}>
          Item
        </ListItem>
      </List>,
    )
    expect(screen.getByTestId('li-item')).toHaveStyle({ color: 'rgb(1, 2, 3)' })
  })
})

// #424 — Layer-7 polymorphism via asChild. Bypasses the variant-driven
// <ol>/<ul> choice to render a caller-supplied root.
describe('List asChild (#424)', () => {
  it('renders the child element carrying the List root class + forwarded className/style', () => {
    render(
      <List asChild className="extra" style={{ color: 'rgb(1, 2, 3)' }}>
        <nav data-testid="x">
          <ListItem>Item</ListItem>
        </nav>
      </List>,
    )
    const el = screen.getByTestId('x')
    // Renders as the <nav>, not a <ul>/<ol>.
    expect(el.tagName).toBe('NAV')
    expect(el.className).toMatch(/list/)
    expect(el.className).toMatch(/extra/)
    expect(el).toHaveStyle({ color: 'rgb(1, 2, 3)' })
    // No standalone <ul>/<ol> should be emitted at the root.
    expect(el.querySelector('ul, ol')).toBeNull()
  })
})
