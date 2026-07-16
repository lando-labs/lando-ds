'use client'

// This page has 'use client' — it tests that genuinely-client components
// work correctly behind a proper client boundary.

import { useState } from 'react'
import {
  Button,
  Modal,
  Switch,
  Alert,
  Avatar,
  Accordion,
  AccordionItem,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@lando-labs/lando-ds'

export default function InteractivePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [switchOn, setSwitchOn] = useState(false)

  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h1>Interactive Page (Client Components)</h1>
      <p>
        All components on this page need a <code>&apos;use client&apos;</code> boundary.
        This page has one at the top.
      </p>

      {/* Alert */}
      <section>
        <h2>Alert</h2>
        <Alert variant="info">This is an informational alert rendered from a client component.</Alert>
      </section>

      {/* Avatar */}
      <section>
        <h2>Avatar</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Avatar initials="JD" status="online" />
          <Avatar initials="AB" status="away" />
          <Avatar initials="XY" status="offline" />
        </div>
      </section>

      {/* Button */}
      <section>
        <h2>Button</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </section>

      {/* Switch */}
      <section>
        <h2>Switch</h2>
        <Switch
          label="Enable notifications"
          checked={switchOn}
          onChange={(checked) => setSwitchOn(checked)}
        />
        <p style={{ marginTop: '0.5rem' }}>Switch is: {switchOn ? 'ON' : 'OFF'}</p>
      </section>

      {/* Tabs */}
      <section>
        <h2>Tabs</h2>
        <Tabs defaultValue="tab1">
          <TabList>
            <Tab value="tab1">Overview</Tab>
            <Tab value="tab2">Details</Tab>
            <Tab value="tab3">Settings</Tab>
          </TabList>
          <TabPanel value="tab1">
            <p>Overview content — client-side tab switching.</p>
          </TabPanel>
          <TabPanel value="tab2">
            <p>Details content.</p>
          </TabPanel>
          <TabPanel value="tab3">
            <p>Settings content.</p>
          </TabPanel>
        </Tabs>
      </section>

      {/* Accordion */}
      <section>
        <h2>Accordion</h2>
        <Accordion>
          <AccordionItem value="what" title="What is #265?">
            <p>A Rollup preserveModules change that emits per-source-module files, preserving &apos;use client&apos; directives.</p>
          </AccordionItem>
          <AccordionItem value="why" title="Why does it matter?">
            <p>Server-safe components no longer carry client JS when tree-shaken by the RSC bundler.</p>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal from Client Component"
        footer={
          <Button variant="primary" onClick={() => setModalOpen(false)}>Close</Button>
        }
      >
        <p>This modal requires a &apos;use client&apos; boundary — it uses portals and focus trapping.</p>
      </Modal>

      <hr />
      <p>
        <a href="/">Back to server page</a>
      </p>
    </main>
  )
}
