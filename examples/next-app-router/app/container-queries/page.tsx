'use client'

// Showcase demo for #269 — container-query responsive cards.
//
// The SAME card is rendered at several fixed container widths (~280 / 340 /
// 600px) plus a user-resizable wrapper. Because each card now declares
// `container: <name> / inline-size` and its compact rules are
// `@container <name> (max-width: 40rem)` (640px), the card reflows by ITS OWN
// width — not the viewport. Drag the resizable panel across 640px to watch a
// single card flip between its comfortable and compact layouts with the
// viewport held perfectly still.
//
// 'use client' only because the resizable panel is illustrative; the cards
// themselves are server-safe.

import {
  StatCard,
  TaskCard,
  Card,
  CardBody,
  Table,
  List,
  ListItem,
  EmptyState,
  Markdown,
  type Column,
} from '@lando-labs/lando-ds'

// Widths chosen to straddle the 640px (40rem) container threshold:
//  - 280px  → well below: fully compact (small value, 36px icon, etc.)
//  - 340px  → the autoFill Grid track width that motivated #269 — still compact
//  - 600px  → just under threshold: compact
//  - 760px  → just over threshold: comfortable (proves no change at >= 640px)
const FIXED_WIDTHS = [280, 340, 600, 760] as const

function WidthFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const overThreshold = width >= 640
  return (
    <div>
      <div
        style={{
          fontSize: '0.75rem',
          fontFamily: 'ui-monospace, monospace',
          color: overThreshold ? '#1B7FA8' : '#9333ea',
          marginBottom: '0.5rem',
        }}
      >
        {width}px container {overThreshold ? '(>= 640px — comfortable)' : '(< 640px — compact)'}
      </div>
      <div
        style={{
          width,
          maxWidth: '100%',
          border: '1px dashed #cbd5e1',
          borderRadius: 12,
          padding: 12,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default function ContainerQueriesPage() {
  const stat = (
    <StatCard
      label="Monthly Active Users"
      value="12,408"
      subtitle="excluding internal accounts"
      trend={{ value: 8.2, direction: 'up' }}
      trendLabel="vs last month"
      color="primary"
    />
  )

  const task = (
    <TaskCard
      status="in-progress"
      title="Wire container queries into the card system"
      description="Cards should reflow by their own width, not the viewport, so a card in a narrow grid track adopts its compact layout on a wide screen."
      tags={['design-system', 'css', 'sprint-40']}
      assignee={{ name: 'Landon Owens' }}
      dueDate="2026-06-30"
    />
  )

  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <header>
        <h1>Container-Query Responsive Components (#269 cards, #270 sweep)</h1>
        <p style={{ maxWidth: '60ch' }}>
          Every frame below renders the <strong>same</strong> card at a different{' '}
          <em>container</em> width while the viewport stays fixed. Cards reflow off their own
          width via <code>@container (max-width: 40rem)</code> — the dashed box is the container.
        </p>
      </header>

      {/* StatCard across fixed container widths */}
      <section>
        <h2>StatCard at fixed container widths</h2>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            alignItems: 'flex-start',
          }}
        >
          {FIXED_WIDTHS.map((w) => (
            <WidthFrame key={w} width={w}>
              {stat}
            </WidthFrame>
          ))}
        </div>
      </section>

      {/* TaskCard across fixed container widths (second container name) */}
      <section>
        <h2>TaskCard at fixed container widths</h2>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            alignItems: 'flex-start',
          }}
        >
          {FIXED_WIDTHS.map((w) => (
            <WidthFrame key={w} width={w}>
              {task}
            </WidthFrame>
          ))}
        </div>
      </section>

      {/* Live resizable wrapper — drag the handle across 640px */}
      <section>
        <h2>Resizable container (drag the bottom-right handle across 640px)</h2>
        <p style={{ maxWidth: '60ch' }}>
          The wrapper is <code>resize: horizontal</code>. As you drag it past 40rem (640px) the
          card flips between compact and comfortable — with the page width unchanged.
        </p>
        <div
          style={{
            resize: 'horizontal',
            overflow: 'auto',
            width: 360,
            minWidth: 240,
            maxWidth: '100%',
            border: '1px dashed #cbd5e1',
            borderRadius: 12,
            padding: 12,
          }}
        >
          {stat}
        </div>
      </section>

      {/* Real-world proof: an autoFill grid (the motivating layout) */}
      <section>
        <h2>autoFill grid — 4-up on wide screens (the bug this fixes)</h2>
        <p style={{ maxWidth: '60ch' }}>
          Each track is <code>minmax(220px, 1fr)</code>, narrower than 640px, so every StatCard
          stays compact even though the page is wide — a viewport <code>@media</code> could never
          see this.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          <StatCard label="Revenue" value="$48.2k" trend={{ value: 4.1, direction: 'up' }} trendLabel="MoM" color="success" />
          <StatCard label="Churn" value="1.8%" trend={{ value: 0.3, direction: 'down' }} trendLabel="MoM" color="error" />
          <StatCard label="Signups" value="934" trend={{ value: 12, direction: 'up' }} trendLabel="MoM" color="primary" />
          <StatCard label="Tickets" value="27" trend={{ value: 2, direction: 'neutral' }} trendLabel="open" color="warning" />
        </div>
      </section>

      {/* ===================================================================== */}
      {/* #270 — cross-context compositions: a component reflows by the width   */}
      {/* of WHATEVER slot it's dropped into, including another DS component.    */}
      {/* ===================================================================== */}
      <header style={{ borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
        <h1>Cross-context reflow (#270)</h1>
        <p style={{ maxWidth: '70ch' }}>
          The same idea, now for non-card components. Each example places a component in a slot
          narrower than 640px so it adopts its compact layout off <em>its own</em> container width —
          something a viewport <code>@media</code> could never see, because the page is wide.
        </p>
      </header>

      {/* Composition 1 — Table inside a narrow Card. */}
      <section>
        <h2>Table inside a narrow Card</h2>
        <p style={{ maxWidth: '70ch' }}>
          The <code>Table</code> establishes a <code>container: table / inline-size</code> on its
          scroll wrapper. Inside this ~360px Card it drops to compact cell padding (≤48rem) and
          forces horizontal scrolling (≤40rem) — while the identical table on the right, in a wide
          slot, stays comfortable. Sticky-header / overflow behavior is unchanged.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
          <div>
            <div style={CTX_LABEL_COMPACT}>360px Card slot — compact + scroll</div>
            <Card variant="outlined" padding="sm" style={{ width: 360, maxWidth: '100%' }}>
              <CardBody>
                <Table data={INVOICES} columns={INVOICE_COLUMNS} />
              </CardBody>
            </Card>
          </div>
          <div style={{ flex: 1, minWidth: 420 }}>
            <div style={CTX_LABEL_WIDE}>Wide Card slot — comfortable (proves no change ≥ 640px)</div>
            <Card variant="outlined" padding="sm">
              <CardBody>
                <Table data={INVOICES} columns={INVOICE_COLUMNS} />
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* Composition 2 — List inside a narrow sidebar-width container. */}
      <section>
        <h2>List inside a narrow sidebar-width container</h2>
        <p style={{ maxWidth: '70ch' }}>
          A navigation <code>List</code> in a 240px sidebar tightens its row gap/padding via{' '}
          <code>@container list (max-width: 40rem)</code>, independent of the page width. The same
          list in the main column keeps its roomier spacing.
        </p>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Sidebar-width rail */}
          <aside
            style={{
              width: 240,
              flexShrink: 0,
              border: '1px dashed #cbd5e1',
              borderRadius: 12,
              padding: 12,
              background: '#f8fafc',
            }}
          >
            <div style={CTX_LABEL_COMPACT}>240px sidebar — compact rows</div>
            <List variant="plain" spacing="lg" divider>
              {NAV_ITEMS.map((item) => (
                <ListItem key={item} icon={<span aria-hidden>•</span>}>
                  {item}
                </ListItem>
              ))}
            </List>
          </aside>
          {/* Main column */}
          <div style={{ flex: 1, minWidth: 360 }}>
            <div style={CTX_LABEL_WIDE}>Wide main column — roomy rows (unchanged ≥ 640px)</div>
            <List variant="plain" spacing="lg" divider>
              {NAV_ITEMS.map((item) => (
                <ListItem key={item} icon={<span aria-hidden>•</span>}>
                  {item}
                </ListItem>
              ))}
            </List>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* #281 — (D)-bucket: content components reflow by their slot width via a */}
      {/* `.sizer` container-host wrapper (Chat/ChatInput/Markdown/EmptyState)   */}
      {/* or a root container (ThemeBuilder). Same proof: narrow slot → compact. */}
      {/* ===================================================================== */}
      <header style={{ borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
        <h1>Content-component reflow (#281)</h1>
        <p style={{ maxWidth: '70ch' }}>
          <code>EmptyState</code> and <code>Markdown</code> now establish their own{' '}
          <code>container: … / inline-size</code> (via a <code>.sizer</code> wrapper) and reflow off
          their slot width, not the viewport — at 360px they go compact; at 760px they stay roomy.
        </p>
      </header>

      <section data-verify="empty-state">
        <h2>EmptyState — 360px vs 760px container</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
          {[360, 760].map((w) => (
            <WidthFrame key={w} width={w}>
              <EmptyState
                variant="create"
                title="No projects yet"
                description="Create your first project to get started."
                action={{ label: 'Create project', onClick: () => {} }}
              />
            </WidthFrame>
          ))}
        </div>
      </section>

      <section data-verify="markdown">
        <h2>Markdown — 360px vs 760px container</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
          {[360, 760].map((w) => (
            <WidthFrame key={w} width={w}>
              <Markdown content={'# Heading one\n\nBody copy with **bold** and a [link](https://example.com).\n\n- one\n- two'} />
            </WidthFrame>
          ))}
        </div>
      </section>
    </main>
  )
}

/* ----- #270 cross-context fixtures ----- */

const CTX_LABEL_COMPACT: React.CSSProperties = {
  fontSize: '0.75rem',
  fontFamily: 'ui-monospace, monospace',
  color: '#9333ea',
  marginBottom: '0.5rem',
}

const CTX_LABEL_WIDE: React.CSSProperties = {
  fontSize: '0.75rem',
  fontFamily: 'ui-monospace, monospace',
  color: '#1B7FA8',
  marginBottom: '0.5rem',
}

interface Invoice {
  id: string
  client: string
  amount: string
  status: string
}

const INVOICE_COLUMNS: Column<Invoice>[] = [
  { key: 'id', label: 'Invoice' },
  { key: 'client', label: 'Client' },
  { key: 'amount', label: 'Amount', align: 'right' },
  { key: 'status', label: 'Status' },
]

const INVOICES: Invoice[] = [
  { id: 'INV-1042', client: 'Tidewater Co.', amount: '$4,200', status: 'Paid' },
  { id: 'INV-1043', client: 'Harbor Logistics', amount: '$1,875', status: 'Pending' },
  { id: 'INV-1044', client: 'Reef Analytics', amount: '$9,640', status: 'Overdue' },
]

const NAV_ITEMS = ['Dashboard', 'Invoices', 'Customers', 'Reports', 'Settings'] as const
