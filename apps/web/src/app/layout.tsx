import type { Metadata } from 'next'
import './globals.css'
import { Plus_Jakarta_Sans, DM_Mono } from 'next/font/google'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'WDCC Projects Health Dashboard',
  description: 'A dashboard for tracking WDCC project health',
}
import { Navbar } from '@/components/navbar/Navbar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} ${dmMono.variable} font-sans`}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
