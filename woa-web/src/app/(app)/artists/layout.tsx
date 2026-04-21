import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Artist Directory',
  description: 'Discover and connect with photographers, videographers, musicians, visual artists, animators, and creatives of all disciplines.',
  openGraph: {
    title: 'Artist Directory | WORK(ER) OF ART',
    description: 'Discover and connect with creative talent across every discipline.',
  },
}

export default function ArtistsLayout({ children }: { children: React.ReactNode }) {
  return children
}
