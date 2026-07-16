/**
 * ArticleCard Component Tests
 *
 * Sprint 15 (#94) — editorial foundation. Locks in:
 *   - Three headline scales (lead / supporting / brief)
 *   - Optional hero image and pull-quote
 *   - Standalone Byline / Lede / PullQuote primitives
 *   - Single-anchor invariant when href is set (no nested anchors)
 *   - Heading-level override via headlineAs
 *   - jest-axe a11y smoke
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ArticleCard, Byline, Lede, PullQuote } from './index'

describe('ArticleCard', () => {
  it('renders as a semantic <article> element', () => {
    render(<ArticleCard headline="A headline" />)
    const article = screen.getByRole('article')
    expect(article.tagName).toBe('ARTICLE')
  })

  it('renders headline at all three scales with correct heading level', () => {
    const { rerender } = render(
      <ArticleCard headline="Lead story" scale="lead" />
    )
    expect(screen.getByText('Lead story').tagName).toBe('H2')

    rerender(<ArticleCard headline="Supporting story" scale="supporting" />)
    expect(screen.getByText('Supporting story').tagName).toBe('H2')

    rerender(<ArticleCard headline="Brief item" scale="brief" />)
    expect(screen.getByText('Brief item').tagName).toBe('H2')
  })

  it('applies the scale class so headline size differs per scale', () => {
    const { rerender, container } = render(
      <ArticleCard headline="Lead" scale="lead" />
    )
    // CSS Modules hash class names — match on the substring.
    expect(container.querySelector('article')?.className).toMatch(/scale-lead/)

    rerender(<ArticleCard headline="Sup" scale="supporting" />)
    expect(container.querySelector('article')?.className).toMatch(
      /scale-supporting/
    )

    rerender(<ArticleCard headline="Brief" scale="brief" />)
    expect(container.querySelector('article')?.className).toMatch(/scale-brief/)
  })

  it('renders without a hero by default and with a hero when supplied', () => {
    const { rerender, container } = render(
      <ArticleCard headline="No hero" />
    )
    expect(container.querySelector('img')).not.toBeInTheDocument()

    rerender(
      <ArticleCard
        headline="With hero"
        hero={<img src="/x.jpg" alt="alt text" />}
      />
    )
    expect(screen.getByAltText('alt text')).toBeInTheDocument()
  })

  it('renders without a pull-quote by default and with one when supplied', () => {
    const { rerender } = render(<ArticleCard headline="No quote" />)
    expect(screen.queryByRole('blockquote')).not.toBeInTheDocument()

    rerender(
      <ArticleCard
        headline="With quote"
        pullQuote="The most striking thing was how predictable it all became."
      />
    )
    // <blockquote> doesn't have an implicit ARIA role in jsdom — query by tag.
    const blockquote = document.querySelector('blockquote')
    expect(blockquote).toBeInTheDocument()
    expect(blockquote?.textContent).toContain(
      'The most striking thing was how predictable it all became.'
    )
  })

  it('renders byline and date when provided', () => {
    render(
      <ArticleCard
        headline="Bylined article"
        byline="Claude Opus 4.7"
        date="April 26, 2026"
      />
    )
    expect(screen.getByText('Claude Opus 4.7')).toBeInTheDocument()
    expect(screen.getByText('April 26, 2026')).toBeInTheDocument()
  })

  it('renders article body content as children', () => {
    render(
      <ArticleCard headline="With body">
        <p>The opening paragraph.</p>
      </ArticleCard>
    )
    expect(screen.getByText('The opening paragraph.')).toBeInTheDocument()
  })

  it('produces exactly one anchor when href is set (no nested anchors)', () => {
    const { container } = render(
      <ArticleCard headline="Click me" href="/articles/click-me" />
    )
    const anchors = container.querySelectorAll('a')
    expect(anchors.length).toBe(1)
    expect(anchors[0]).toHaveAttribute('href', '/articles/click-me')
  })

  it('produces zero anchors when href is omitted', () => {
    const { container } = render(<ArticleCard headline="Static" />)
    expect(container.querySelectorAll('a').length).toBe(0)
  })

  /* #320 — sanitize the whole-card href against script-bearing schemes. */
  it('neutralizes a javascript: href to the fallback', () => {
    const { container } = render(
      <ArticleCard headline="Click me" href="javascript:alert(1)" />
    )
    const anchor = container.querySelector('a')
    expect(anchor?.getAttribute('href')).toBe('#')
    expect(anchor?.getAttribute('href')).not.toContain('javascript:')
  })

  it('passes through a safe href unchanged', () => {
    const { container } = render(
      <ArticleCard headline="Story" href="/articles/story" />
    )
    expect(container.querySelector('a')).toHaveAttribute(
      'href',
      '/articles/story',
    )
  })

  it('respects headlineAs override (h1)', () => {
    render(<ArticleCard headline="Top story" headlineAs="h1" />)
    expect(screen.getByText('Top story').tagName).toBe('H1')
  })

  it('respects headlineAs override (h3)', () => {
    render(<ArticleCard headline="Sub item" headlineAs="h3" />)
    expect(screen.getByText('Sub item').tagName).toBe('H3')
  })

  // #424 — Layer-7 polymorphism. asChild delegates the root <article> to the
  // single child, merging the .article root class + forwarded className / style
  // onto it, and preserving the child's own semantics + the article content.
  it('asChild renders the child element as the root, carrying the root class', () => {
    render(
      <ArticleCard
        asChild
        headline="Delegated headline"
        scale="lead"
        className="consumer-cls"
        style={{ color: 'rgb(10, 11, 12)' }}
      >
        <section data-testid="article-root" />
      </ArticleCard>
    )
    const root = screen.getByTestId('article-root')
    expect(root.tagName).toBe('SECTION')
    expect(root.className).toMatch(/article/)
    expect(root.className).toMatch(/scale-lead/)
    expect(root).toHaveClass('consumer-cls')
    expect(root).toHaveStyle({ color: 'rgb(10, 11, 12)' })
    // Article content still renders inside the delegated root.
    expect(root).toHaveTextContent('Delegated headline')
    // The headline heading is preserved.
    expect(screen.getByText('Delegated headline').tagName).toBe('H2')
  })

  it('has no a11y violations (axe) — full editorial layout', async () => {
    const { container } = render(
      <ArticleCard
        headline="The morning headline"
        scale="lead"
        byline="Claude Opus 4.7"
        date="April 26, 2026"
        hero={<img src="/hero.jpg" alt="A descriptive alt for the hero." />}
        pullQuote="The most striking thing was how predictable it all became."
      >
        <p>The article body, in serif type.</p>
      </ArticleCard>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Byline (standalone)', () => {
  it('renders name only when date is omitted', () => {
    render(<Byline name="Ada Lovelace" />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    // No <time> element when date isn't provided.
    expect(document.querySelector('time')).not.toBeInTheDocument()
  })

  it('renders name and date together', () => {
    render(<Byline name="Ada Lovelace" date="December 10, 1815" />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    const time = document.querySelector('time')
    expect(time).toBeInTheDocument()
    expect(time?.textContent).toBe('December 10, 1815')
  })
})

describe('Lede (standalone)', () => {
  it('renders as a paragraph with the supplied content', () => {
    render(<Lede>The lede sets the tone of the article.</Lede>)
    const p = screen.getByText('The lede sets the tone of the article.')
    expect(p.tagName).toBe('P')
  })
})

describe('PullQuote (standalone)', () => {
  it('renders as a <blockquote>', () => {
    render(
      <PullQuote>
        &quot;The Analytical Engine has no pretensions whatever.&quot;
      </PullQuote>
    )
    const blockquote = document.querySelector('blockquote')
    expect(blockquote).toBeInTheDocument()
    expect(blockquote?.textContent).toContain(
      'The Analytical Engine has no pretensions whatever.'
    )
  })

  it('renders attribution when provided', () => {
    render(
      <PullQuote attribution="Ada Lovelace">
        &quot;The Analytical Engine has no pretensions whatever.&quot;
      </PullQuote>
    )
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  })
})
