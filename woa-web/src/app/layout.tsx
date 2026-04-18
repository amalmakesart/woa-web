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
  metadataBase: new URL('https://workerofart.com'),
  title: {
    default: 'WORK(ER) OF ART — The Artist Platform',
    template: '%s | WORK(ER) OF ART',
  },
  description: 'Discover artists. Post gigs. Find collaborators. Build your portfolio. A platform built for artists by artists — free to use, no commission.',
  keywords: ['artist platform', 'find artists', 'hire artists', 'art gigs', 'artist portfolio', 'creative community', 'photographer', 'videographer', 'musician', 'visual artist', 'art jobs', 'creative jobs'],
  icons: { icon: '/favicon.png' },
  openGraph: {
    type: 'website',
    siteName: 'WORK(ER) OF ART',
    title: 'WORK(ER) OF ART — The Artist Platform',
    description: 'Discover artists. Post gigs. Find collaborators. Build your portfolio. A platform built for artists by artists.',
    url: 'https://workerofart.com',
    images: [{ url: '/marketing/artist1.jpg', width: 1200, height: 630, alt: 'WORK(ER) OF ART' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WORK(ER) OF ART — The Artist Platform',
    description: 'Discover artists. Post gigs. Find collaborators. Build your portfolio.',
    images: ['/marketing/artist1.jpg'],
  },
  alternates: {
    canonical: 'https://workerofart.com',
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    title: 'WORK(ER) OF ART',
    statusBarStyle: 'black',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceMono.variable}>
      <body>{children}</body>
    </html>
  )
}
