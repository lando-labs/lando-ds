// NO 'use client' directive — this is a React Server Component.
// If the RSC compiler rejects any import here, that is the #265 finding.
//
// DEEP IMPORTS (v0.22.0, #276): each server-safe leaf is imported from its own
// per-module subpath via the `./components/*` export, NOT from the barrel
// `@lando-labs/lando-ds`. The barrel co-mingles all 61 'use client'
// components behind one module, so importing ANY leaf through it drags the
// entire client surface (recharts, ThemeBuilder, Chat, CodeBlock) into the
// bundle — even when nothing on the page renders them. Importing each leaf
// deeply lets the bundler include ONLY the modules this page actually uses, so
// a Server Component page rendering only server-safe leaves ships ~baseline
// First Load JS with zero unrendered client JS.
//
// Compound components are separate per-module files: `Card/Card`, `Card/CardBody`,
// etc. each export only their own symbol (the aggregate `Card/index` barrel is
// types-only). The tree-mirror specifier (`components/<Dir>/<Module>`) reaches
// every emitted module, including these sub-parts.
import { Badge } from '@lando-labs/lando-ds/components/Badge/Badge'
import { Card } from '@lando-labs/lando-ds/components/Card/Card'
import { CardHeader } from '@lando-labs/lando-ds/components/Card/CardHeader'
import { CardBody } from '@lando-labs/lando-ds/components/Card/CardBody'
import { CardTitle } from '@lando-labs/lando-ds/components/Card/CardTitle'
import { StatusDot } from '@lando-labs/lando-ds/components/StatusDot/StatusDot'
import { Chip } from '@lando-labs/lando-ds/components/Chip/Chip'
import { EmptyState } from '@lando-labs/lando-ds/components/EmptyState/EmptyState'
import { PageHeader } from '@lando-labs/lando-ds/components/PageHeader/PageHeader'
import { StepProgress } from '@lando-labs/lando-ds/components/StepProgress/StepProgress'
import { IconButton } from '@lando-labs/lando-ds/components/IconButton/IconButton'
import { ArticleCard } from '@lando-labs/lando-ds/components/ArticleCard/ArticleCard'
import { Byline } from '@lando-labs/lando-ds/components/ArticleCard/Byline'
import { Lede } from '@lando-labs/lando-ds/components/ArticleCard/Lede'
import { PullQuote } from '@lando-labs/lando-ds/components/ArticleCard/PullQuote'

export default function ServerPage() {
  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h1>RSC Validation — Server-Safe Leaves via Deep Imports (#265, #276)</h1>
      <p>
        This page is a Server Component with NO &lsquo;use client&rsquo; directive.
        Every component is imported from its own per-module subpath (the
        <code>./components/*</code> deep export added in v0.22.0), NOT from the
        barrel. Importing deeply means the bundle contains only the modules this
        page actually renders — so it ships ~baseline First Load JS with zero
        unrendered client components (no recharts, ThemeBuilder, Chat, or
        CodeBlock). Compare the First Load JS of <code>/</code> against what the
        barrel-import variant produced (~316&nbsp;kB before this change).
      </p>

      {/* #462 — CSS reset coexistence */}
      <section
        style={{
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          background: 'var(--color-surface-elevated)',
        }}
      >
        <h2>Consuming the DS alongside a CSS reset (#462)</h2>
        <p>
          This app also demonstrates the golden path for issue #462. An
          aggressive, create-next-app-style reset is active
          (<code>* {'{'} margin: 0; padding: 0 {'}'}</code>, in{' '}
          <code>app/globals.css</code>) — yet every component below keeps its
          padding and spacing.
        </p>
        <p>
          The trick: <code>app/layout.tsx</code> imports{' '}
          <code>@lando-labs/lando-ds/layer-order.css</code> first, which
          declares the cascade-layer order and buckets our reset into the{' '}
          <code>app-reset</code> layer <em>below</em> the DS layers. Without that
          primer the unlayered reset would beat the DS&rsquo;s layered component
          styles and zero out all spacing. See{' '}
          <code>reference/css-layers.md</code> →&nbsp;&ldquo;Consuming alongside
          a CSS reset&rdquo;.
        </p>
      </section>

      {/* PageHeader */}
      <section>
        <h2>PageHeader</h2>
        <PageHeader
          title="Dashboard Overview"
          subtitle="All metrics are current as of today"
        />
      </section>

      {/* Badge */}
      <section>
        <h2>Badge</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Badge variant="default">Default</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
          <Badge colorScheme="sky" pill>Sky</Badge>
        </div>
      </section>

      {/* StatusDot */}
      <section>
        <h2>StatusDot</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <StatusDot variant="success" aria-label="Online" />
          <StatusDot variant="warning" aria-label="Degraded" />
          <StatusDot variant="danger" aria-label="Down" />
          <StatusDot variant="neutral" aria-label="Unknown" />
          <StatusDot variant="info" aria-label="Informational" />
        </div>
      </section>

      {/* Chip */}
      <section>
        <h2>Chip</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Chip>React</Chip>
          <Chip>TypeScript</Chip>
          <Chip>Next.js</Chip>
        </div>
      </section>

      {/* Card + CardHeader + CardBody + CardTitle */}
      <section>
        <h2>Card + CardHeader + CardBody + CardTitle</h2>
        <Card variant="elevated" style={{ maxWidth: '400px' }}>
          <CardHeader>
            <CardTitle>Server-Rendered Card</CardTitle>
          </CardHeader>
          <CardBody>
            <p>This card and all its sub-components render entirely on the server.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <Badge variant="success">Live</Badge>
              <StatusDot variant="success" aria-label="Active" />
            </div>
          </CardBody>
        </Card>
      </section>

      {/* StepProgress */}
      <section>
        <h2>StepProgress</h2>
        <StepProgress
          steps={[
            { label: 'Plan', status: 'completed' },
            { label: 'Build', status: 'active' },
            { label: 'Validate', status: 'upcoming' },
            { label: 'Ship', status: 'upcoming' },
          ]}
          variant="numbered"
        />
      </section>

      {/* IconButton */}
      <section>
        <h2>IconButton</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <IconButton aria-label="Edit" variant="ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </IconButton>
          <IconButton aria-label="Delete" variant="outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </IconButton>
        </div>
      </section>

      {/* EmptyState */}
      <section>
        <h2>EmptyState</h2>
        <EmptyState
          variant="no-data"
          title="No results found"
          description="Try adjusting your search or filters to find what you are looking for."
        />
      </section>

      {/* ArticleCard + Byline + Lede + PullQuote */}
      <section>
        <h2>ArticleCard (+ Byline / Lede / PullQuote sub-components)</h2>
        <ArticleCard
          headline="RSC Support Lands in the Lando Design System"
          scale="supporting"
          headlineAs="h3"
          byline="Landon Owens"
          date="2026-06-20"
          lede="The design system now ships with per-module builds that preserve 'use client' directives 1:1, enabling server-safe leaves to render with zero client JS in React Server Components."
        />

        <div style={{ marginTop: '1rem' }}>
          <p><strong>Byline (standalone):</strong></p>
          <Byline name="Landon Owens" date="2026-06-20" />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <p><strong>Lede (standalone):</strong></p>
          <Lede>A standalone lede paragraph with introductory prose for a news article or blog post.</Lede>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <p><strong>PullQuote (standalone):</strong></p>
          <PullQuote>Server components are the future of React — and now the design system is ready.</PullQuote>
        </div>
      </section>

      <hr />
      <p>
        <a href="/interactive">Go to interactive page (client components)</a>
      </p>
      <p>
        <a href="/container-queries">Go to container-query cards demo (#269)</a>
      </p>
    </main>
  )
}
