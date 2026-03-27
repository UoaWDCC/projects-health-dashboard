import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WDCC Projects Health Dashboard',
  description: 'A dashboard for tracking WDCC project health',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
