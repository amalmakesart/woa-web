import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Collab — Find Collaborators',
  description: 'Artists and collectives seeking collaborators. Start a collab, set the discipline, location, and budget, and build the right creative team.',
  openGraph: {
    title: 'Collab | WORK(ER) OF ART',
    description: 'Artists and collectives seeking collaborators. Post your collab and find the right creatives.',
  },
}

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children
}
