/**
 * VisuallyHidden Component Tests
 * Smoke + a11y semantics. The content must stay in the DOM (so screen
 * readers can announce it) — visual hiding is via CSS only.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { VisuallyHidden } from './VisuallyHidden'

describe('VisuallyHidden', () => {
  it('renders its children into the DOM (AT can still read them)', () => {
    render(<VisuallyHidden>Hidden label</VisuallyHidden>)
    expect(screen.getByText('Hidden label')).toBeInTheDocument()
  })

  it('defaults to a <span> element', () => {
    render(<VisuallyHidden>x</VisuallyHidden>)
    expect(screen.getByText('x').tagName).toBe('SPAN')
  })

  it('renders as a different element when `as` is set', () => {
    render(<VisuallyHidden as="label">field-name</VisuallyHidden>)
    expect(screen.getByText('field-name').tagName).toBe('LABEL')
  })

  it('has no a11y violations (axe)', async () => {
    const { container } = render(
      <button type="button">
        <span aria-hidden="true">X</span>
        <VisuallyHidden>Close dialog</VisuallyHidden>
      </button>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
