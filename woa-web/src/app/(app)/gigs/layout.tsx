import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gig Board — Hire Artists',
  description: 'Post and find creative gigs. Connect with photographers, videographers, musicians, visual artists, and more for your next project, shoot, or event.',
  openGraph: {
    title: 'Gig Board | WORK(ER) OF ART',
    description: 'Post and find creative gigs. Connect with photographers, videographers, musicians, and more.',
  },
}

export default function GigsLayout({ children }: { children: React.ReactNode }) {
  return children
}
