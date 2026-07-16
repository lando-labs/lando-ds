/**
 * Text Component Tests
 *
 * Covers polymorphic Text:
 * - default renders <p>
 * - as prop swaps to span/div/label/a/button
 * - variant/size/weight props emit CSS Module classes
 * - color applies inline style
 * - variant="link" as anchor carries href
 * - variant="link" as button carries onClick and defaults type="button"
 * - link is keyboard-focusable
 * - forwardRef targets the polymorphic element
 * - HTML attributes pass through
 */

import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Text } from './Text'

function classAttr(el: ChildNode | null): string {
  if (!el || !(el instanceof HTMLElement)) return ''
  return el.getAttribute('class') ?? ''
}

describe('Text', () => {
  it('renders as <p> by default', () => {
    const { container } = render(<Text>Body text</Text>)
    const el = container.firstChild as HTMLElement
    expect(el.tagName).toBe('P')
    expect(el.textContent).toBe('Body text')
  })

  it('renders via polymorphic as prop (span/div/label/a/button)', () => {
    const { container: spanContainer } = render(<Text as="span">inline</Text>)
    expect((spanContainer.firstChild as HTMLElement).tagName).toBe('SPAN')

    const { container: divContainer } = render(<Text as="div">block</Text>)
    expect((divContainer.firstChild as HTMLElement).tagName).toBe('DIV')

    const { container: labelContainer } = render(<Text as="label">Label</Text>)
    expect((labelContainer.firstChild as HTMLElement).tagName).toBe('LABEL')

    const { container: anchorContainer } = render(
      <Text as="a" href="/x">link</Text>
    )
    expect((anchorContainer.firstChild as HTMLElement).tagName).toBe('A')

    const { container: buttonContainer } = render(
      <Text as="button">action</Text>
    )
    expect((buttonContainer.firstChild as HTMLElement).tagName).toBe('BUTTON')
  })

  it('applies each variant class', () => {
    const variants = [
      'body',
      'caption',
      'small',
      'overline',
      'link',
      'mono',
    ] as const
    for (const variant of variants) {
      const { container } = render(
        <Text variant={variant}>value</Text>
      )
      expect(classAttr(container.firstChild)).toMatch(
        new RegExp(`variant-${variant}`)
      )
    }
  })

  it('applies size class (sm/md/lg)', () => {
    const { container: smContainer } = render(<Text size="sm">v</Text>)
    expect(classAttr(smContainer.firstChild)).toMatch(/size-sm/)

    const { container: lgContainer } = render(<Text size="lg">v</Text>)
    expect(classAttr(lgContainer.firstChild)).toMatch(/size-lg/)
  })

  it('applies weight class', () => {
    const { container } = render(<Text weight="bold">Strong</Text>)
    expect(classAttr(container.firstChild)).toMatch(/weight-bold/)
  })

  it('applies color via inline style', () => {
    const { container } = render(
      <Text color="rgb(200, 100, 50)">Colored</Text>
    )
    expect((container.firstChild as HTMLElement).style.color).toBe(
      'rgb(200, 100, 50)'
    )
  })

  it('forwards ref through polymorphic type', () => {
    // default polymorphic default element (p)
    const pRef = createRef<HTMLParagraphElement>()
    render(<Text ref={pRef}>Hi</Text>)
    expect(pRef.current?.tagName).toBe('P')

    // polymorphic as span
    const spanRef = createRef<HTMLSpanElement>()
    render(
      <Text as="span" ref={spanRef}>
        Hi
      </Text>
    )
    expect(spanRef.current?.tagName).toBe('SPAN')
  })

  it('passes through HTML attributes (id, data-*, aria-*)', () => {
    render(
      <Text id="greeting" data-testid="text-root" aria-label="Greeting">
        hello
      </Text>
    )
    const el = screen.getByTestId('text-root')
    expect(el.getAttribute('id')).toBe('greeting')
    expect(el.getAttribute('aria-label')).toBe('Greeting')
  })

  it('passes label-specific htmlFor when as=label', () => {
    render(
      <Text as="label" htmlFor="input-x" data-testid="label">
        Email
      </Text>
    )
    const el = screen.getByTestId('label') as HTMLLabelElement
    expect(el.htmlFor).toBe('input-x')
  })
})

describe('Text — link variant', () => {
  it('carries href through to the anchor element', () => {
    render(
      <Text as="a" variant="link" href="/pricing">
        View pricing
      </Text>
    )
    const link = screen.getByRole('link', { name: 'View pricing' })
    expect(link.getAttribute('href')).toBe('/pricing')
    expect(classAttr(link)).toMatch(/variant-link/)
  })

  it('passes anchor attributes (target, rel) through', () => {
    render(
      <Text
        as="a"
        variant="link"
        href="https://example.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        External
      </Text>
    )
    const link = screen.getByRole('link', { name: 'External' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders as a button and fires onClick', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Text as="button" variant="link" onClick={handleClick}>
        Undo
      </Text>
    )
    const btn = screen.getByRole('button', { name: 'Undo' })
    await user.click(btn)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('defaults the button element to type="button"', () => {
    // Prevents an accidental form submit when a link-button sits in a form.
    render(
      <Text as="button" variant="link">
        Action
      </Text>
    )
    const btn = screen.getByRole('button', { name: 'Action' })
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('allows the button type to be overridden', () => {
    render(
      <Text as="button" variant="link" type="submit">
        Submit
      </Text>
    )
    const btn = screen.getByRole('button', { name: 'Submit' })
    expect(btn.getAttribute('type')).toBe('submit')
  })

  it('is keyboard-focusable as an anchor', async () => {
    const user = userEvent.setup()
    render(
      <Text as="a" variant="link" href="/about">
        About
      </Text>
    )
    const link = screen.getByRole('link', { name: 'About' })
    await user.tab()
    expect(link).toHaveFocus()
  })

  it('activates a link-button via the keyboard', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Text as="button" variant="link" onClick={handleClick}>
        Toggle
      </Text>
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when the link-button is disabled', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Text as="button" variant="link" onClick={handleClick} disabled>
        Disabled
      </Text>
    )
    await user.click(screen.getByRole('button', { name: 'Disabled' }))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('applies link variant size classes', () => {
    const { container: smContainer } = render(
      <Text as="a" variant="link" size="sm" href="/x">
        small
      </Text>
    )
    expect(classAttr(smContainer.firstChild)).toMatch(/variant-link/)
    expect(classAttr(smContainer.firstChild)).toMatch(/size-sm/)
  })

  describe('as="a" href safety (#320)', () => {
    it('neutralizes a javascript: href to the fallback', () => {
      render(<Text as="a" href="javascript:alert(1)">link</Text>)
      expect(screen.getByText('link').getAttribute('href')).toBe('#')
    })

    it('neutralizes a data: href to the fallback', () => {
      render(<Text as="a" href="data:text/html,<script>alert(1)</script>">x</Text>)
      expect(screen.getByText('x').getAttribute('href')).toBe('#')
    })

    it('preserves safe relative and http(s) hrefs', () => {
      const { rerender } = render(<Text as="a" href="/pricing">a</Text>)
      expect(screen.getByText('a').getAttribute('href')).toBe('/pricing')
      rerender(<Text as="a" href="https://example.com">b</Text>)
      expect(screen.getByText('b').getAttribute('href')).toBe('https://example.com')
    })
  })
})

// ===========================================================================
// Mono variant (#379)
// ===========================================================================

describe('Text — mono variant (#379)', () => {
  it('applies the variant-mono class', () => {
    const { container } = render(<Text variant="mono">npm install</Text>)
    expect(classAttr(container.firstChild)).toMatch(/variant-mono/)
  })

  it('renders the supplied text content as a <p> by default', () => {
    render(<Text variant="mono">npm run build</Text>)
    expect(screen.getByText('npm run build')).toBeInTheDocument()
    expect(screen.getByText('npm run build').tagName).toBe('P')
  })

  it('composes with as="span" for inline mono runs', () => {
    render(
      <p>
        Run{' '}
        <Text as="span" variant="mono" data-testid="cmd">
          npm test
        </Text>{' '}
        in the project root.
      </p>,
    )
    const span = screen.getByTestId('cmd')
    expect(span.tagName).toBe('SPAN')
    expect(classAttr(span)).toMatch(/variant-mono/)
  })

  it('applies size classes for mono (sm/md/lg)', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      const { container } = render(
        <Text variant="mono" size={size}>
          x
        </Text>,
      )
      expect(classAttr(container.firstChild)).toMatch(/variant-mono/)
      expect(classAttr(container.firstChild)).toMatch(
        new RegExp(`size-${size}`),
      )
    }
  })

  it('combines with the weight prop (e.g. for emphasized identifiers)', () => {
    const { container } = render(
      <Text variant="mono" weight="bold">
        useState
      </Text>,
    )
    expect(classAttr(container.firstChild)).toMatch(/variant-mono/)
    expect(classAttr(container.firstChild)).toMatch(/weight-bold/)
  })
})
