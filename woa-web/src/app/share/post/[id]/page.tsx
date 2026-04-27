import type { Metadata } from 'next'
import { ShareRedirectPage } from '@/components/ShareRedirectPage'
import { APP_ICON_URL, WEBSITE_URL } from '@/lib/share'
import { createClient } from '@/lib/supabase/server'

type SharedPost = {
  id: string
  user_id: string
  title: string | null
  content: string | null
  type: string
  profiles?: {
    username: string | null
    full_name: string | null
  } | null
}

async function loadPost(id: string): Promise<SharedPost | null> {
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('posts')
    .select('id, user_id, title, content, type')
    .eq('id', id)
    .maybeSingle()

  if (!post) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name')
    .eq('id', (post as SharedPost).user_id)
    .maybeSingle()

  return {
    ...(post as SharedPost),
    profiles: (profile as SharedPost['profiles']) ?? null,
  }
}

function trimText(value: string | null | undefined, maxLength: number) {
  if (!value) return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function getPostShareCopy(post: SharedPost | null) {
  const authorName = post?.profiles?.full_name ?? post?.profiles?.username ?? 'An artist'
  const title = trimText(post?.title, 90)
  const body = trimText(post?.content, 140)
  const heading = title || `Post by ${authorName}`
  const description = body || `Open this post by ${authorName} in WORK(ER) OF ART.`

  return { authorName, heading, description }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const post = await loadPost(id)
  const { heading, description } = getPostShareCopy(post)

  return {
    title: `${heading} on WORK(ER) OF ART`,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${heading} on WORK(ER) OF ART`,
      description,
      url: `${WEBSITE_URL}/share/post/${id}`,
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
      title: `${heading} on WORK(ER) OF ART`,
      description,
      images: [APP_ICON_URL],
    },
  }
}

export default async function SharePostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await loadPost(id)
  const { heading, description } = getPostShareCopy(post)

  return (
    <ShareRedirectPage
      title={heading.toUpperCase()}
      subtitle={description.toUpperCase()}
      deepLinkUrl={`workerofart://post/${id}`}
    />
  )
}
