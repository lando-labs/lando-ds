/**
 * Icon Component Tests
 *
 * Covers the children-based Icon API (v0.3.0+):
 * - renders the lucide child element
 * - applies size prop (wrapper width/height + cloned child size)
 * - applies color via inline style
 * - passes aria-label to wrapper and sets role="img" when labelled
 * - marks child aria-hidden when no aria-label
 * - forwards ref to the wrapper span
 * - fires onClick handler
 *
 * Note: Icon renders a <span> wrapper and clones the child to inject
 * size/strokeWidth/color via React.cloneElement.
 */

import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Icon } from './Icon'

function classAttr(el: Element | null): string {
  if (!el) return ''
  return el.getAttribute('class') ?? ''
}

describe('Icon', () => {
  it('renders the child element inside a span wrapper', () => {
    const { container, getByTestId } = render(
      <Icon>
        <svg data-testid="icon-child" />
      </Icon>
    )
    expect((container.firstChild as HTMLElement).tagName).toBe('SPAN')
    expect(getByTestId('icon-child')).toBeInTheDocument()
  })

  it('applies size prop to wrapper (width/height)', () => {
    const { container } = render(
      <Icon size="lg">
        <svg />
      </Icon>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.width).toBe('24px')
    expect(wrapper.style.height).toBe('24px')
  })

  it('applies size for each supported value', () => {
    const sizes = [
      ['xs', '12px'],
      ['sm', '16px'],
      ['md', '20px'],
      ['lg', '24px'],
      ['xl', '32px'],
      ['2xl', '40px'],
    ] as const
    for (const [size, px] of sizes) {
      const { container } = render(
        <Icon size={size}>
          <svg />
        </Icon>
      )
      expect((container.firstChild as HTMLElement).style.width).toBe(px)
    }
  })

  it('applies color via inline style on wrapper', () => {
    const { container } = render(
      <Icon color="rgb(1, 2, 3)">
        <svg />
      </Icon>
    )
    expect((container.firstChild as HTMLElement).style.color).toBe(
      'rgb(1, 2, 3)'
    )
  })

  it('sets role="img" and aria-label when aria-label provided', () => {
    const { container } = render(
      <Icon aria-label="Search">
        <svg />
      </Icon>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBe('img')
    expect(wrapper.getAttribute('aria-label')).toBe('Search')
  })

  it('marks child aria-hidden when no aria-label (decorative)', () => {
    const { getByTestId } = render(
      <Icon>
        <svg data-testid="child" />
      </Icon>
    )
    // cloneElement injects aria-hidden="true" when no ariaLabel
    expect(getByTestId('child').getAttribute('aria-hidden')).toBe('true')
  })

  it('forwards ref to the wrapper span', () => {
    const ref = createRef<HTMLSpanElement>()
    render(
      <Icon ref={ref}>
        <svg />
      </Icon>
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('SPAN')
  })

  it('fires onClick on the wrapper', () => {
    const onClick = vi.fn()
    const { container } = render(
      <Icon onClick={onClick}>
        <svg />
      </Icon>
    )
    fireEvent.click(container.firstChild as Element)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies spinning class when spinning=true', () => {
    const { container } = render(
      <Icon spinning>
        <svg />
      </Icon>
    )
    expect(classAttr(container.firstChild as Element)).toMatch(/spinning/)
  })
})

// ===========================================================================
// #376 — String-name resolution + `icon` prop polymorphism
// ===========================================================================

describe('Icon — name prop (#376)', () => {
  it('renders an SVG when name resolves to a known icon', () => {
    const { container } = render(<Icon name="search" aria-label="Search" />)
    // lucide icons render as <svg>; assert one is in the wrapper.
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.tagName).toBe('SPAN')
    expect(wrapper.querySelector('svg')).not.toBeNull()
  })

  it('accepts the PascalCase lucide spelling as an alias', () => {
    const { container } = render(
      <Icon name="MessageSquare" aria-label="Messages" />
    )
    expect((container.firstChild as HTMLElement).querySelector('svg')).not.toBeNull()
  })

  it('renders null icon child for an unknown name (warns in dev)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(<Icon name="totally-bogus" />)
    const wrapper = container.firstChild as HTMLElement
    // Wrapper is still in the DOM so layout/onClick wiring survives.
    expect(wrapper.tagName).toBe('SPAN')
    // No SVG was rendered for the unknown name.
    expect(wrapper.querySelector('svg')).toBeNull()
    // Dev warn was triggered (NODE_ENV is 'test', which !== 'production').
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('name takes precedence over icon and children', () => {
    const Custom = ({ size }: { size?: number | string }) => (
      <svg data-testid="custom" width={size} />
    )
    const { container, queryByTestId } = render(
      <Icon name="search" icon={Custom}>
        <svg data-testid="child" />
      </Icon>
    )
    // The lucide Search wins; neither the icon prop nor the child render.
    expect(queryByTestId('custom')).toBeNull()
    expect(queryByTestId('child')).toBeNull()
    expect((container.firstChild as HTMLElement).querySelector('svg')).not.toBeNull()
  })
})

describe('Icon — icon prop (#376)', () => {
  it('renders the component referenced by the icon prop', () => {
    const Custom = ({ size }: { size?: number | string }) => (
      <svg data-testid="custom-icon" width={size} />
    )
    const { getByTestId } = render(<Icon icon={Custom} size="lg" />)
    const svg = getByTestId('custom-icon')
    // Size is forwarded via cloneElement.
    expect(svg.getAttribute('width')).toBe('24')
  })

  it('falls through to children when icon and name are both omitted', () => {
    const { getByTestId } = render(
      <Icon>
        <svg data-testid="child-svg" />
      </Icon>
    )
    expect(getByTestId('child-svg')).toBeInTheDocument()
  })

  /* ------------------------------------------------------------------ *
   *  #423 — consumer ...rest pass-through to the <span> wrapper root
   *  (style was already supported; this locks the rest-spread in.)
   * ------------------------------------------------------------------ */
  describe('consumer passthrough (#423)', () => {
    it('lands consumer data-testid on the <span> visual root', () => {
      const { container } = render(
        <Icon data-testid="icon-root">
          <svg />
        </Icon>
      )
      const el = container.firstChild as HTMLElement
      expect(el.tagName).toBe('SPAN')
      expect(el).toHaveAttribute('data-testid', 'icon-root')
    })

    it('applies consumer style.color to the <span> visual root', () => {
      const { container } = render(
        <Icon style={{ color: 'rgb(1, 2, 3)' }}>
          <svg />
        </Icon>
      )
      const el = container.firstChild as HTMLElement
      expect(el.style.color).toBe('rgb(1, 2, 3)')
    })

    it('keeps the internal role authoritative and forwards arbitrary rest (id)', () => {
      const { container } = render(
        <Icon aria-label="Search" id="search-icon" title="tt">
          <svg />
        </Icon>
      )
      const el = container.firstChild as HTMLElement
      expect(el).toHaveAttribute('id', 'search-icon')
      expect(el).toHaveAttribute('title', 'tt')
      // Dedicated aria-label triggers role="img"; rest cannot clobber it.
      expect(el).toHaveAttribute('role', 'img')
    })
  })
})

