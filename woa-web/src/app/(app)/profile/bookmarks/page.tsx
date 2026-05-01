'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Post {
  id: string
  type: string
  media_url: string | null
  title: string | null
  content: string | null
  like_count: number
  user_id: string
  profiles?: { username: string; profile_photo_url: string | null } | null
}

export default function BookmarksPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select('post_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!bookmarks?.length) { setPosts([]); setLoading(false); return }

      const postIds = bookmarks.map((b: any) => b.post_id as string)
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, type, media_url, title, content, like_count, user_id')
        .in('id', postIds)

      if (postsData && postsData.length > 0) {
        const userIds = [...new Set((postsData as Post[]).map(p => p.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, profile_photo_url')
          .in('id', userIds)
        const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))

        const sorted = postIds
          .map((id: string) => (postsData as Post[]).find((p: Post) => p.id === id))
          .filter((post: Post | undefined): post is Post => Boolean(post))
          .map((p: Post) => ({ ...p, profiles: profileMap[p.user_id] ?? null })) as Post[]
        setPosts(sorted)
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleRemove(postId: string) {
    if (!currentUserId) return
    setRemoving(postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    const supabase = createClient()
    await supabase.from('bookmarks').delete().match({ user_id: currentUserId, post_id: postId })
    setRemoving(null)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 11, letterSpacing: '0.1em' }}>← BACK</button>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em' }}>SAVED POSTS</h1>
      </div>

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888880' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.2em', marginBottom: 8 }}>NO SAVED POSTS</p>
          <p style={{ fontSize: 10, letterSpacing: '0.12em', color: '#555' }}>BOOKMARK POSTS FROM THE FEED TO SEE THEM HERE</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 16 }}>{posts.length} SAVED</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {posts.map(post => (
              <div key={post.id} style={{ position: 'relative', aspectRatio: '1/1', background: '#111', overflow: 'hidden' }}>
                <Link href={`/feed/${post.id}`} style={{ display: 'block', width: '100%', height: '100%' }}>
                  {post.type === 'image' && post.media_url ? (
                    <img
                      src={post.media_url}
                      alt={post.title ?? ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : post.type === 'text' ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, background: '#111' }}>
                      <p style={{ fontSize: 8, color: '#fff', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.5, overflow: 'hidden' }}>
                        {(post.content ?? '').slice(0, 60).toUpperCase()}
                      </p>
                    </div>
                  ) : post.type === 'audio' ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', flexDirection: 'column', gap: 6 }}>
                      <span style={{ color: '#c0392b', fontSize: 20 }}>♪</span>
                    </div>
                  ) : post.type === 'video' && post.media_url ? (
                    <video src={post.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 20 }}>◻</div>
                  )}

                  {/* Hover overlay */}
                  <div className="bookmark-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                    <span style={{ fontSize: 10, color: '#fff', letterSpacing: '0.1em' }}>♥ {post.like_count}</span>
                  </div>
                </Link>

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(post.id)}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.7)', border: 'none',
                    color: '#fff', fontSize: 12, cursor: 'pointer',
                    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 2,
                  }}
                  title="Remove bookmark"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`.bookmark-overlay:hover { opacity: 1 !important; }`}</style>
    </div>
  )
}
