// GOLDEN-PATH CSS ORDER (issue #462) — import order matters here.
//
// 1. The layer-order primer FIRST. It emits only
//    `@layer app-reset, ll.reset, ll.tokens, ll.base, ll.components, ll.utilities, app;`
//    which fixes cascade-layer precedence before any layered CSS is seen, so our
//    reset can safely sit BELOW the DS layers.
import '@lando-labs/lando-ds/layer-order.css'
// 2. Our global CSS: an aggressive reset bucketed into the `app-reset` layer
//    (plus an `app` override layer). Without step 1 this reset would zero the
//    padding/margins of every DS component. See app/globals.css.
import './globals.css'
// 3. The DS component styles (all inside the ll.* layers).
import '@lando-labs/lando-ds/styles'
import type { Metadata } from 'next'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'RSC Validation - Lando Design System',
  description:
    'Validates #265 (RSC leaves, zero client JS) and #462 (DS + a CSS reset via the layer-order primer)',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
