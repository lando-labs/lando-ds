'use client'

// Browser-verify harness for Sprint 50 / v0.30.0:
//   - NavTabs (#377): horizontal area-switcher with active underline.
//   - CommandPalette (#378): listbox-rooted ⌘K palette.

import { useState } from 'react'
import {
  Button,
  NavTabs,
  NavTabsItem,
  CommandPalette,
  CommandPaletteGroup,
  CommandPaletteItem,
} from '@lando-labs/lando-ds'

export default function S50Page() {
  const [active, setActive] = useState('overview')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [lastInvoked, setLastInvoked] = useState<string | null>(null)

  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }} data-verify="s50-root">
      <h1>Sprint 50 — Lab new components (#377, #378)</h1>

      <section data-verify="nav-tabs">
        <h2>NavTabs (#377)</h2>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: 60 + 'ch' }}>
          Horizontal nav with a CSS-only sliding indicator. Active state is consumer-driven.
        </p>
        <NavTabs aria-label="S50 demo nav">
          {[
            ['overview', 'Overview'],
            ['settings', 'Settings'],
            ['billing', 'Billing'],
            ['team', 'Team'],
          ].map(([id, label]) => (
            <NavTabsItem
              key={id}
              href={`#${id}`}
              active={active === id}
              onClick={(e) => { e.preventDefault(); setActive(id) }}
            >
              {label}
            </NavTabsItem>
          ))}
        </NavTabs>
        <p style={{ marginTop: '1rem' }}>
          Active: <strong data-verify="nav-active">{active}</strong>
        </p>
      </section>

      <section data-verify="command-palette">
        <h2>CommandPalette (#378)</h2>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: 60 + 'ch' }}>
          Listbox-rooted ⌘K palette composed over the v0.29 native &lt;dialog&gt; Modal.
        </p>
        <Button onClick={() => setPaletteOpen(true)} data-testid="open-palette">
          Open command palette
        </Button>
        <p style={{ marginTop: '1rem' }}>
          Last invoked: <strong data-verify="cmd-last">{lastInvoked ?? '(none)'}</strong>
        </p>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          placeholder="Type to search…"
        >
          <CommandPaletteGroup heading="Navigation">
            <CommandPaletteItem onSelect={() => { setLastInvoked('Open dashboard'); setPaletteOpen(false) }} shortcut="⌘D">
              Open dashboard
            </CommandPaletteItem>
            <CommandPaletteItem onSelect={() => { setLastInvoked('Open settings'); setPaletteOpen(false) }} shortcut="⌘,">
              Open settings
            </CommandPaletteItem>
            <CommandPaletteItem onSelect={() => { setLastInvoked('Open team'); setPaletteOpen(false) }}>
              Open team
            </CommandPaletteItem>
          </CommandPaletteGroup>
          <CommandPaletteGroup heading="Actions">
            <CommandPaletteItem onSelect={() => { setLastInvoked('New project'); setPaletteOpen(false) }} shortcut="⌘N">
              New project
            </CommandPaletteItem>
            <CommandPaletteItem onSelect={() => { setLastInvoked('Invite teammate'); setPaletteOpen(false) }}>
              Invite teammate
            </CommandPaletteItem>
            <CommandPaletteItem onSelect={() => {}} disabled>
              Archive workspace (disabled)
            </CommandPaletteItem>
          </CommandPaletteGroup>
        </CommandPalette>
      </section>
    </main>
  )
}
