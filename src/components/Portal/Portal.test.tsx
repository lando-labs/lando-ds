/**
 * Portal — smoke tests (Sprint 59 / trust: "every component has a test")
 *
 * Portal uses `createPortal` to render its children into a DOM node outside
 * the parent component's hierarchy (default `document.body`, or an explicit
 * `container`). The mount node is resolved in a `useEffect`, so children
 * appear after the effect flushes — Testing Library's `render` flushes
 * effects synchronously via `act`, so a plain `getByTestId` sees them.
 *
 * These are intentionally minimal but meaningful: they prove children mount
 * into `document.body` by default, do NOT land in the immediate parent
 * container, and follow an explicit `container` when provided.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Portal } from './Portal'

describe('Portal — smoke', () => {
  it('renders children into document.body by default', () => {
    render(
      <Portal>
        <div data-testid="portal-child">Hello from the portal</div>
      </Portal>,
    )
    const child = screen.getByTestId('portal-child')
    expect(child).toBeInTheDocument()
    // The child escaped the React tree and lives under <body>.
    expect(document.body).toContainElement(child)
  })

  it('does NOT render children inside the immediate parent container', () => {
    const { container } = render(
      <Portal>
        <div data-testid="portal-child">Escaped</div>
      </Portal>,
    )
    // `container` is the wrapper div Testing Library mounts the tree into.
    // Because the child is portalled to <body>, it must not be a descendant.
    const child = screen.getByTestId('portal-child')
    expect(container).not.toContainElement(child)
    expect(container.querySelector('[data-testid="portal-child"]')).toBeNull()
  })

  it('renders children into an explicit container element', () => {
    const target = document.createElement('div')
    target.setAttribute('data-testid', 'portal-target')
    document.body.appendChild(target)

    render(
      <Portal container={target}>
        <div data-testid="portal-child">In custom container</div>
      </Portal>,
    )

    const child = screen.getByTestId('portal-child')
    expect(target).toContainElement(child)

    document.body.removeChild(target)
  })
})
