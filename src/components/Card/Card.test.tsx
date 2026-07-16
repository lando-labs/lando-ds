/**
 * Card Component Tests
 *
 * Covers base Card rendering + composition (Header/Body/Footer), Sprint 9
 * (#55) auto-header props (title/subtitle/actions/titleAs), Sprint 10
 * (#59) brand-by-default variant semantics (default vs flat), Sprint 12
 * (#14) coverage expansion (variants, clickable, a11y), and CardBody
 * layout helpers.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Card, CardHeader, CardBody, CardFooter, CardTitle } from './index'

// Note: CSS Modules hash class names at build time, so tests avoid
// className string matching and prefer attribute/role-based queries.

describe('Card', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <CardBody>Card content</CardBody>
      </Card>
    )
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders with header, body, and footer', () => {
    render(
      <Card>
        <CardHeader>Header</CardHeader>
        <CardBody>Body</CardBody>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('shows loading skeleton when loading prop is true', () => {
    const { container } = render(<Card loading />)
    const skeleton = container.querySelector('[aria-busy="true"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveAttribute('aria-live', 'polite')
  })

  it('auto-renders a header when title prop is set', () => {
    render(
      <Card title="Tasks">
        <CardBody>Body</CardBody>
      </Card>
    )
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    // Default titleAs=3 => h3 element
    expect(screen.getByText('Tasks').tagName).toBe('H3')
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('respects titleAs for semantic heading level', () => {
    render(<Card title="Dashboard" titleAs={2} />)
    expect(screen.getByText('Dashboard').tagName).toBe('H2')
  })

  it('renders subtitle and actions in the auto-header', () => {
    render(
      <Card
        title="Tasks"
        subtitle="3 open"
        actions={<button type="button">Add</button>}
      />
    )
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('3 open')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('does not render an auto-header when no title/subtitle/actions are set', () => {
    const { container } = render(
      <Card>
        <CardBody>Plain</CardBody>
      </Card>
    )
    // The auto-header renders CardHeader which contains the title block.
    // With no title/subtitle/actions, no CardHeader should be emitted.
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    expect(headings.length).toBe(0)
  })

  // #424 — Layer-7 polymorphism. asChild delegates the root element to the
  // single child, merging the .card root class + variant + forwarded className
  // / style onto it, with no wrapper <div> emitted.
  it('asChild renders the child element as the root, carrying the card class', () => {
    render(
      <Card
        asChild
        variant="elevated"
        className="consumer-cls"
        style={{ color: 'rgb(13, 14, 15)' }}
      >
        <article data-testid="card-root">
          <CardBody>Delegated body</CardBody>
        </article>
      </Card>
    )
    const root = screen.getByTestId('card-root')
    // Root is the consumer's <article>, not a wrapper <div>.
    expect(root.tagName).toBe('ARTICLE')
    // Primary module class + variant + forwarded className all land on it.
    expect(root.className).toMatch(/card/)
    expect(root.className).toMatch(/elevated/)
    expect(root).toHaveClass('consumer-cls')
    expect(root).toHaveStyle({ color: 'rgb(13, 14, 15)' })
    // The child's own content is preserved.
    expect(root).toHaveTextContent('Delegated body')
  })

  it('asChild does not emit the default div wrapper', () => {
    const { container } = render(
      <Card asChild>
        <article data-testid="card-root">content</article>
      </Card>
    )
    // Only the delegated <article> should carry the card class — no extra
    // wrapping div with the card class around it.
    const carded = container.querySelectorAll('[class*="card"]')
    expect(carded.length).toBe(1)
    expect((carded[0] as HTMLElement).tagName).toBe('ARTICLE')
  })
})

/* ---------------------------------------------------------------------- *
 *  Sprint 10 (#59) — Brand-by-default smoke tests
 *
 *  Card default variant now carries a subtle ocean-tinted shadow, and a
 *  new `variant="flat"` provides an explicit opt-out to the pre-Sprint-10
 *  look. These tests lock in the non-breaking path so later refactors
 *  can't silently drop the shadow on `default` or break the `flat` escape
 *  hatch.
 * ---------------------------------------------------------------------- */
describe('Card — brand defaults (#59)', () => {
  it('applies the default variant class by default (ocean-tinted shadow)', () => {
    render(<Card data-testid="card">x</Card>)
    const el = screen.getByTestId('card')
    // CSS Modules hash class names, so we match on the substring
    // "default" — the variant class name is embedded in the hash output.
    expect(el.className).toMatch(/default/)
  })

  it('opts out of the shadow with variant="flat"', () => {
    render(
      <Card variant="flat" data-testid="card">
        x
      </Card>
    )
    const el = screen.getByTestId('card')
    expect(el.className).toMatch(/flat/)
    // The default class should NOT be stacked on top of flat.
    expect(el.className).not.toMatch(/default/)
  })

  it('preserves existing outlined and elevated variants', () => {
    const { rerender } = render(
      <Card variant="outlined" data-testid="card">
        x
      </Card>
    )
    expect(screen.getByTestId('card').className).toMatch(/outlined/)

    rerender(
      <Card variant="elevated" data-testid="card">
        x
      </Card>
    )
    expect(screen.getByTestId('card').className).toMatch(/elevated/)
  })
})

describe('CardTitle', () => {
  it('renders as an h3 by default', () => {
    render(<CardTitle>Title</CardTitle>)
    const el = screen.getByText('Title')
    expect(el.tagName).toBe('H3')
  })

  it('supports custom heading level via `as`', () => {
    render(<CardTitle as={1}>Top</CardTitle>)
    expect(screen.getByText('Top').tagName).toBe('H1')
  })

  // #423 — rest-prop passthrough. Consumer data-* / id / style land on the
  // rendered heading (previously CardTitle silently dropped everything but
  // as / className / style).
  it('forwards rest HTML attributes (data-testid, id) and merges style', () => {
    render(
      <CardTitle
        data-testid="card-title"
        id="widget-title"
        style={{ color: 'rgb(16, 17, 18)' }}
      >
        Tasks
      </CardTitle>
    )
    const el = screen.getByTestId('card-title')
    expect(el.tagName).toBe('H3')
    expect(el).toHaveAttribute('id', 'widget-title')
    // Consumer style.color lands on the visual root (merged with the
    // component's internal font-size/line-height inline styles).
    expect(el).toHaveStyle({ color: 'rgb(16, 17, 18)' })
  })
})

describe('CardBody layout props', () => {
  it('defaults to plain block layout (no inline flex styles)', () => {
    render(<CardBody data-testid="cb">content</CardBody>)
    const el = screen.getByTestId('cb')
    // No `stack`/`inline` → no inline display override; element falls
    // back to its CSS class default (plain block).
    expect(el.style.display).toBe('')
    expect(el.style.flexDirection).toBe('')
    expect(el.style.gap).toBe('')
  })

  it('applies flex column when stack is true', () => {
    render(
      <CardBody stack data-testid="cb">
        content
      </CardBody>
    )
    const el = screen.getByTestId('cb')
    expect(el.style.display).toBe('flex')
    expect(el.style.flexDirection).toBe('column')
  })

  it('applies flex row when inline is true', () => {
    render(
      <CardBody inline data-testid="cb">
        content
      </CardBody>
    )
    const el = screen.getByTestId('cb')
    expect(el.style.display).toBe('flex')
    expect(el.style.flexDirection).toBe('row')
  })

  it('prefers stack over inline when both are set', () => {
    render(
      <CardBody stack inline data-testid="cb">
        content
      </CardBody>
    )
    const el = screen.getByTestId('cb')
    expect(el.style.flexDirection).toBe('column')
  })

  it('maps gap token to a CSS var when flex is active', () => {
    render(
      <CardBody stack gap="sm" data-testid="cb">
        content
      </CardBody>
    )
    expect(screen.getByTestId('cb').style.gap).toMatch(/var\(--spacing-sm\)/)
  })

  it('ignores gap when neither stack nor inline is set', () => {
    render(
      <CardBody gap="sm" data-testid="cb">
        content
      </CardBody>
    )
    // `gap` alone must not implicitly enable flex — stays a no-op.
    expect(screen.getByTestId('cb').style.display).toBe('')
    expect(screen.getByTestId('cb').style.gap).toBe('')
  })

  it('applies align and justify when flex is active', () => {
    render(
      <CardBody inline align="center" justify="between" data-testid="cb">
        content
      </CardBody>
    )
    const el = screen.getByTestId('cb')
    expect(el.style.alignItems).toBe('center')
    expect(el.style.justifyContent).toBe('space-between')
  })

  it('merges user-supplied style prop (user style wins)', () => {
    render(
      <CardBody
        stack
        gap="sm"
        style={{ gap: '42px', padding: '10px' }}
        data-testid="cb"
      >
        content
      </CardBody>
    )
    const el = screen.getByTestId('cb')
    // User style spreads last, so their explicit gap overrides the token.
    expect(el.style.gap).toBe('42px')
    expect(el.style.padding).toBe('10px')
    // Flex display from `stack` is still applied.
    expect(el.style.display).toBe('flex')
  })
})

/* ---------------------------------------------------------------------- *
 *  Sprint 12 (#14) — coverage backfill
 *
 *  Additions to the existing Card suite: clickable semantics, loading
 *  skeleton, gradient opt-in, and jest-axe a11y smoke.
 * ---------------------------------------------------------------------- */
describe('Card — clickable semantics', () => {
  it('renders as a <button> when clickable', () => {
    render(
      <Card clickable data-testid="card">
        <CardBody>Click me</CardBody>
      </Card>
    )
    // Card.tsx lines 132–140: clickable variant renders as <button type="button">.
    const el = screen.getByTestId('card')
    expect(el.tagName).toBe('BUTTON')
    expect(el).toHaveAttribute('type', 'button')
  })

  it('fires onClick when clicked in clickable mode', () => {
    const handleClick = vi.fn()
    render(
      <Card clickable onClick={handleClick} data-testid="card">
        <CardBody>Pressable</CardBody>
      </Card>
    )
    fireEvent.click(screen.getByTestId('card'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('fires onClick when clicked with clickable prop', () => {
    // Regression guard for the existing <button> render path (#105).
    const handleClick = vi.fn()
    render(
      <Card clickable onClick={handleClick} data-testid="card">
        <CardBody>Pressable</CardBody>
      </Card>
    )
    fireEvent.click(screen.getByTestId('card'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('fires onClick when clicked without clickable prop', () => {
    // Bug #105: the <div> render path destructured onClick separately and
    // didn't include it in the spread, silently dropping the handler.
    // TypeScript accepted the prop because CardProps extends
    // HTMLAttributes<HTMLDivElement>.
    const handleClick = vi.fn()
    render(
      <Card onClick={handleClick} data-testid="card">
        <CardBody>Pressable</CardBody>
      </Card>
    )
    fireEvent.click(screen.getByTestId('card'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('non-clickable Card renders as a <div> (not a button)', () => {
    render(
      <Card data-testid="card">
        <CardBody>Plain</CardBody>
      </Card>
    )
    expect(screen.getByTestId('card').tagName).toBe('DIV')
  })
})

/* ---------------------------------------------------------------------- *
 *  Sprint 19 (#106) — outlined variant CSS class
 *
 *  The .outlined CSS rule is now a 1px hairline border per the documented
 *  JSDoc contract on CardProps.variant. .clickable's button-reset no
 *  longer overrides border/background, so the variant border survives
 *  when both classes are applied to the same element.
 * ---------------------------------------------------------------------- */
describe('Card — outlined variant (#106)', () => {
  it('applies outlined class when variant is outlined', () => {
    render(
      <Card variant="outlined" data-testid="card">
        <CardBody>Bordered</CardBody>
      </Card>
    )
    // CSS Modules hash class names — match the substring "outlined".
    expect(screen.getByTestId('card').className).toMatch(/outlined/i)
  })

  it('outlined variant retains border when clickable', () => {
    render(
      <Card variant="outlined" clickable onClick={() => {}} data-testid="card">
        <CardBody>Bordered + clickable</CardBody>
      </Card>
    )
    const el = screen.getByTestId('card')
    // Both the variant class and the clickable class must be in the list,
    // so the variant's border survives the clickable button-reset.
    expect(el.className).toMatch(/outlined/i)
    expect(el.className).toMatch(/clickable/i)
  })

  it('outlined variant preserves --card-outline-color override on style', () => {
    // #116 — Card.module.css exposes a `--card-outline-color` CSS custom
    // property hook on .outlined so consumers can render semantic-colored
    // outlined cards (red error, green success, etc.) per-instance via
    // inline style. jsdom doesn't resolve CSS variables to the actual
    // border color, but we can assert the inline style is preserved on
    // the element and the outlined class is still applied.
    render(
      <Card
        variant="outlined"
        style={{ '--card-outline-color': 'red' } as React.CSSProperties}
        data-testid="card"
      >
        <CardBody>Error-state outlined card</CardBody>
      </Card>
    )
    const el = screen.getByTestId('card')
    expect(el.className).toMatch(/outlined/i)
    // The custom property survives Card's prop-spreading onto the root.
    expect(el.style.getPropertyValue('--card-outline-color')).toBe('red')
  })
})

describe('Card — loading + gradient', () => {
  it('loading skeleton replaces children content', () => {
    render(
      <Card loading>
        <CardBody>Hidden while loading</CardBody>
      </Card>
    )
    // Card.tsx lines 111–117: when loading, skeleton renders in place of
    // `autoHeader + children`. Children should NOT appear.
    expect(screen.queryByText('Hidden while loading')).not.toBeInTheDocument()
  })

  it('applies gradient class when gradient prop is true', () => {
    render(
      <Card gradient data-testid="card">
        <CardBody>Ocean</CardBody>
      </Card>
    )
    // CSS Modules hash class names — match the substring "gradient".
    expect(screen.getByTestId('card').className).toMatch(/gradient/)
  })
})

/* ---------------------------------------------------------------------- *
 *  Sprint 30 (#240) — RN parity: `fullWidth` prop
 *
 *  The React Native `Card` primitive ships with a `fullWidth` prop that
 *  applies `alignSelf: 'stretch'` + `width: '100%'`. The web `Card` now
 *  exposes the same prop (web equivalent: `width: 100%`) so consumers
 *  writing cross-platform code can use one shared prop name.
 * ---------------------------------------------------------------------- */
describe('Card — fullWidth (#240 parity)', () => {
  it('does not apply the fullWidth class by default', () => {
    render(
      <Card data-testid="card">
        <CardBody>Default width</CardBody>
      </Card>
    )
    expect(screen.getByTestId('card').className).not.toMatch(/fullWidth/)
  })

  it('applies the fullWidth class when fullWidth is true', () => {
    render(
      <Card fullWidth data-testid="card">
        <CardBody>Stretched</CardBody>
      </Card>
    )
    // CSS Modules hash class names — match the substring "fullWidth".
    expect(screen.getByTestId('card').className).toMatch(/fullWidth/)
  })

  it('fullWidth composes with variant classes', () => {
    render(
      <Card variant="outlined" fullWidth data-testid="card">
        <CardBody>Outlined + stretched</CardBody>
      </Card>
    )
    const el = screen.getByTestId('card')
    expect(el.className).toMatch(/outlined/)
    expect(el.className).toMatch(/fullWidth/)
  })

  it('fullWidth composes with clickable (still renders as <button>)', () => {
    render(
      <Card fullWidth clickable data-testid="card">
        <CardBody>Stretched + clickable</CardBody>
      </Card>
    )
    const el = screen.getByTestId('card')
    expect(el.tagName).toBe('BUTTON')
    expect(el.className).toMatch(/fullWidth/)
    expect(el.className).toMatch(/clickable/)
  })
})

describe('Card — a11y', () => {
  it('has no a11y violations (axe) — static content', async () => {
    const { container } = render(
      <Card title="Tasks" subtitle="3 open">
        <CardBody>
          <p>Task list goes here.</p>
        </CardBody>
      </Card>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no a11y violations (axe) — clickable variant', async () => {
    const { container } = render(
      <Card clickable aria-label="Open settings">
        <CardBody>Settings</CardBody>
      </Card>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
