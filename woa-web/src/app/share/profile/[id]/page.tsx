import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ShareRedirectPage } from '@/components/ShareRedirectPage'
import { APP_ICON_URL, WEBSITE_URL } from '@/lib/share'

async function loadProfile(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, username, full_name, discipline, art_type, city, country')
    .eq('id', id)
    .maybeSingle()

  return data
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const profile = await loadProfile(id)
  const name = profile?.full_name ?? profile?.username ?? 'Artist'
  const descriptor = [profile?.discipline ?? profile?.art_type, profile?.city, profile?.country]
    .filter(Boolean)
    .join(' · ')

  return {
    title: `${name} on WORK(ER) OF ART`,
    description: descriptor || 'Open this artist profile in WORK(ER) OF ART.',
    robots: { index: false, follow: false },
    openGraph: {
      title: `${name} on WORK(ER) OF ART`,
      description: descriptor || 'Open this artist profile in WORK(ER) OF ART.',
      url: `${WEBSITE_URL}/share/profile/${id}`,
      images: [
        {
          url: APP_ICON_URL,
          width: 512,
          height: 512,
          alt: 'WORK(ER) OF ART app icon',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} on WORK(ER) OF ART`,
      description: descriptor || 'Open this artist profile in WORK(ER) OF ART.',
      images: [APP_ICON_URL],
    },
  }
}

export default async function ShareProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await loadProfile(id)
  const name = profile?.full_name ?? profile?.username ?? 'ARTIST'
  const descriptor = [profile?.discipline ?? profile?.art_type, profile?.city, profile?.country]
    .filter(Boolean)
    .join(' · ')

  return (
    <ShareRedirectPage
      title={`${name.toUpperCase()} ON WORK(ER) OF ART`}
      subtitle={descriptor ? descriptor.toUpperCase() : 'OPEN THIS PROFILE IN THE APP.'}
      deepLinkUrl={`workerofart://profile/${id}`}
    />
  )
}
