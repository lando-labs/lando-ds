import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as an h1 heading by default', () => {
    render(<PageHeader title="Contacts" />)
    expect(
      screen.getByRole('heading', { name: 'Contacts', level: 1 }),
    ).toBeInTheDocument()
  })

  it('renders subtitle text when provided', () => {
    render(<PageHeader title="Contacts" subtitle="Manage your list" />)
    expect(screen.getByText('Manage your list')).toBeInTheDocument()
  })

  it('renders actions slot content', () => {
    render(
      <PageHeader title="Contacts" actions={<button>Add Contact</button>} />,
    )
    expect(
      screen.getByRole('button', { name: 'Add Contact' }),
    ).toBeInTheDocument()
  })

  it('forwards children as escape hatch, bypassing structured props', () => {
    render(
      <PageHeader title="Ignored">
        <span>Raw content</span>
      </PageHeader>,
    )
    expect(screen.getByText('Raw content')).toBeInTheDocument()
    // `title` prop is bypassed when children are provided
    expect(screen.queryByText('Ignored')).not.toBeInTheDocument()
  })

  it('respects titleAs override for semantic heading level', () => {
    render(<PageHeader title="Settings" titleAs={2} />)
    expect(
      screen.getByRole('heading', { name: 'Settings', level: 2 }),
    ).toBeInTheDocument()
  })

  // #255 — title and subtitle accept ReactNode so consumers can render
  // inline adornments (badges, icons) without dropping into the children
  // escape hatch and losing structured breadcrumbs/actions.
  it('renders a ReactNode title alongside structured slots', () => {
    render(
      <PageHeader
        breadcrumbs={<nav aria-label="Breadcrumb">Home / Projects</nav>}
        title={
          <>
            <span>asset-forge</span>
            <span data-testid="title-badge">Observability On</span>
          </>
        }
        actions={<button>Deploy</button>}
      />,
    )

    expect(screen.getByText('asset-forge')).toBeInTheDocument()
    expect(screen.getByTestId('title-badge')).toBeInTheDocument()
    expect(screen.getByText('Home / Projects')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeInTheDocument()
  })

  it('renders a ReactNode subtitle', () => {
    render(
      <PageHeader
        title="Contacts"
        subtitle={
          <>
            <span data-testid="subtitle-prefix">3</span> contacts selected
          </>
        }
      />,
    )

    expect(screen.getByTestId('subtitle-prefix')).toBeInTheDocument()
    expect(screen.getByText(/contacts selected/)).toBeInTheDocument()
  })
})
