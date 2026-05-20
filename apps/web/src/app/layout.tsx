import type { Metadata } from 'next'
import './globals.css'
import { Plus_Jakarta_Sans, DM_Mono, Figtree } from 'next/font/google'
import localFont from 'next/font/local'
import { Navbar } from '@/components/navbar/Navbar'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

const cartographMonoCf = localFont({
  src: '../fonts/cartograph-mono-cf.otf',
  variable: '--font-cartograph-mono-cf',
})

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
})

export const metadata: Metadata = {
  title: 'WDCC Projects Health Dashboard',
  description: 'A dashboard for tracking WDCC project health',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${dmMono.variable} ${cartographMonoCf.variable} ${figtree.variable} font-sans`}
      >
        <Navbar />

        <main>{children}</main>
      </body>
    </html>
  )
}
