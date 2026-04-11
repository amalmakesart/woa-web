import type { Metadata } from 'next'
import { Space_Mono } from 'next/font/google'
import './globals.css'

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'WORK(ER) OF ART',
  description: 'Discover artists. Post gigs. Build your portfolio. A platform built for artists by artists.',
  icons: { icon: '/favicon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceMono.variable}>
      <body>{children}</body>
    </html>
  )
}
