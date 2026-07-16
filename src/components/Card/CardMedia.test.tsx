/**
 * CardMedia Component Tests
 *
 * Sprint 17 (#86 / v0.11.0) — covers wrapper styling, aspect-ratio,
 * position variants, side-positioned width, child media object-fit
 * scoping, placeholder + fallback slots, and a jest-axe smoke test.
 *
 * CSS Modules hash class names at build time, so tests prefer
 * data-attribute / inline-style queries over className matching.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Card, CardBody, CardMedia } from './index'

describe('CardMedia — wrapper basics', () => {
  it('renders children inside a wrapper div', () => {
    render(
      <CardMedia data-testid="media">
        <img src="/x.jpg" alt="cover" />
      </CardMedia>
    )
    const wrapper = screen.getByTestId('media')
    expect(wrapper.tagName).toBe('DIV')
    expect(screen.getByAltText('cover')).toBeInTheDocument()
  })

  it('renders the data-card-media-position attribute (default top)', () => {
    render(
      <CardMedia data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(screen.getByTestId('media')).toHaveAttribute(
      'data-card-media-position',
      'top'
    )
  })

  it('forwards a ref to the wrapper element', () => {
    const ref = { current: null as HTMLDivElement | null }
    render(
      <CardMedia ref={ref} data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(ref.current).not.toBeNull()
    expect(ref.current?.getAttribute('data-testid')).toBe('media')
  })

  it('preserves consumer-supplied className alongside the module class', () => {
    render(
      <CardMedia data-testid="media" className="custom-class">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(screen.getByTestId('media').className).toMatch(/custom-class/)
    expect(screen.getByTestId('media').className).toMatch(/media/)
  })
})

describe('CardMedia — aspect ratio', () => {
  it('forwards aspectRatio="16/9" to the inline style', () => {
    render(
      <CardMedia aspectRatio="16/9" data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(screen.getByTestId('media').style.aspectRatio).toBe('16/9')
  })

  it('forwards aspectRatio="1/1" to the inline style', () => {
    render(
      <CardMedia aspectRatio="1/1" data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(screen.getByTestId('media').style.aspectRatio).toBe('1/1')
  })

  it('omits aspect-ratio when prop is not provided', () => {
    render(
      <CardMedia data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(screen.getByTestId('media').style.aspectRatio).toBe('')
  })
})

describe('CardMedia — position + width', () => {
  it('applies the position-top class for default position', () => {
    render(
      <CardMedia data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(screen.getByTestId('media').className).toMatch(/position-top/)
  })

  it('applies the position-left class', () => {
    render(
      <CardMedia position="left" data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    const el = screen.getByTestId('media')
    expect(el.className).toMatch(/position-left/)
    expect(el).toHaveAttribute('data-card-media-position', 'left')
  })

  it('applies the position-right class', () => {
    render(
      <CardMedia position="right" data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    const el = screen.getByTestId('media')
    expect(el.className).toMatch(/position-right/)
    expect(el).toHaveAttribute('data-card-media-position', 'right')
  })

  it('applies px width when position is left/right and width is a number', () => {
    render(
      <CardMedia position="left" width={120} data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(screen.getByTestId('media').style.width).toBe('120px')
  })

  it('applies width string verbatim when position is left/right', () => {
    render(
      <CardMedia position="right" width="20%" data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    expect(screen.getByTestId('media').style.width).toBe('20%')
  })

  it('ignores width when position is top', () => {
    render(
      <CardMedia position="top" width={120} data-testid="media">
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    // Width should NOT be applied for top-positioned media — it spans
    // the full Card width naturally.
    expect(screen.getByTestId('media').style.width).toBe('')
  })

  it('merges user-supplied style over the prop-derived style', () => {
    render(
      <CardMedia
        aspectRatio="16/9"
        style={{ aspectRatio: '4/3', backgroundColor: 'red' }}
        data-testid="media"
      >
        <img src="/x.jpg" alt="" />
      </CardMedia>
    )
    const el = screen.getByTestId('media')
    // Consumer style spreads last → wins.
    expect(el.style.aspectRatio).toBe('4/3')
    expect(el.style.backgroundColor).toBe('red')
  })
})

describe('CardMedia — placeholder slot', () => {
  it('renders placeholder when children is null/undefined', () => {
    render(
      <CardMedia
        placeholder={<div data-testid="ph">Loading…</div>}
        data-testid="media"
      />
    )
    expect(screen.getByTestId('ph')).toBeInTheDocument()
  })

  it('does NOT render placeholder when children are provided', () => {
    render(
      <CardMedia
        placeholder={<div data-testid="ph">Loading…</div>}
        data-testid="media"
      >
        <img src="/x.jpg" alt="cover" />
      </CardMedia>
    )
    expect(screen.queryByTestId('ph')).not.toBeInTheDocument()
    expect(screen.getByAltText('cover')).toBeInTheDocument()
  })
})

describe('CardMedia — fallback on image error', () => {
  it('renders the original child by default', () => {
    render(
      <CardMedia
        fallback={<div data-testid="fb">Image unavailable</div>}
        data-testid="media"
      >
        <img src="/x.jpg" alt="cover" />
      </CardMedia>
    )
    expect(screen.getByAltText('cover')).toBeInTheDocument()
    expect(screen.queryByTestId('fb')).not.toBeInTheDocument()
  })

  it('swaps in the fallback when the child img errors', () => {
    render(
      <CardMedia
        fallback={<div data-testid="fb">Image unavailable</div>}
        data-testid="media"
      >
        <img src="/broken.jpg" alt="cover" />
      </CardMedia>
    )
    const img = screen.getByAltText('cover')
    fireEvent.error(img)
    // After the synthetic error, fallback should be in the DOM and the
    // original img should be gone.
    expect(screen.getByTestId('fb')).toBeInTheDocument()
    expect(screen.queryByAltText('cover')).not.toBeInTheDocument()
  })

  it('chains the consumer-supplied onError handler before flipping to fallback', () => {
    const consumerHandler = vi.fn()
    render(
      <CardMedia
        fallback={<div data-testid="fb">!</div>}
        data-testid="media"
      >
        <img src="/broken.jpg" alt="cover" onError={consumerHandler} />
      </CardMedia>
    )
    fireEvent.error(screen.getByAltText('cover'))
    expect(consumerHandler).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('fb')).toBeInTheDocument()
  })

  it('keeps rendering the child when no fallback is provided, even on error', () => {
    render(
      <CardMedia data-testid="media">
        <img src="/broken.jpg" alt="cover" />
      </CardMedia>
    )
    fireEvent.error(screen.getByAltText('cover'))
    // Without a fallback slot, the img stays in the DOM (consumer can
    // wire their own onError if they want to handle it manually).
    expect(screen.getByAltText('cover')).toBeInTheDocument()
  })
})

describe('CardMedia — composes inside Card', () => {
  it('renders inside a Card with CardBody as siblings', () => {
    render(
      <Card data-testid="card">
        <CardMedia data-testid="media" aspectRatio="16/9">
          <img src="/x.jpg" alt="hero" />
        </CardMedia>
        <CardBody>Body content</CardBody>
      </Card>
    )
    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByTestId('media')).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByAltText('hero')).toBeInTheDocument()
  })

  // #379 — CardMedia must be edge-to-edge (no Card padding) above
  // CardBody. Visual proof of negative margins is a CSS-computed-value
  // concern jsdom cannot evaluate, but we can lock in the structural
  // contract: CardMedia is the FIRST child of Card and renders with
  // position-top + the .media class. The negative-margin rule in
  // CardMedia.module.css then cancels Card's `--card-padding` (added
  // alongside this change) so it renders flush to the rounded edge.
  it('CardMedia sits as Card first-child with position-top (#379 contract)', () => {
    render(
      <Card data-testid="card">
        <CardMedia data-testid="media">
          <img src="/x.jpg" alt="hero" />
        </CardMedia>
        <CardBody data-testid="body">Body</CardBody>
      </Card>
    )
    const card = screen.getByTestId('card')
    const media = screen.getByTestId('media')
    expect(card.firstElementChild).toBe(media)
    expect(media).toHaveAttribute('data-card-media-position', 'top')
    // The CSS class that the edge-to-edge rule keys on is present.
    expect(media.className).toMatch(/position-top/)
  })
})

describe('CardMedia — a11y', () => {
  it('has no a11y violations (axe) — top position with image', async () => {
    const { container } = render(
      <Card>
        <CardMedia aspectRatio="16/9">
          <img src="/x.jpg" alt="A descriptive alt" />
        </CardMedia>
        <CardBody>
          <p>Card body copy.</p>
        </CardBody>
      </Card>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no a11y violations (axe) — side position with image', async () => {
    const { container } = render(
      <Card>
        <CardMedia aspectRatio="1/1" position="left" width={96}>
          <img src="/thumb.jpg" alt="Thumbnail" />
        </CardMedia>
        <CardBody>
          <p>Side-positioned media.</p>
        </CardBody>
      </Card>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

