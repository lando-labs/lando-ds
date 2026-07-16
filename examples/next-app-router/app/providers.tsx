'use client'

import { ThemeProvider } from '@lando-labs/lando-ds'
// NOTE: global CSS is imported ONCE, in `app/layout.tsx`, in the golden-path
// order (layer-order primer → globals → DS styles). Importing the DS stylesheet
// here too would load it a second time and, more importantly, muddy the
// layer-order demonstration — so it deliberately lives only in the root layout.

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
