'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Post {
  id: string
  user_id: string
  type: string
  media_url: string | null
  title: string | null
  content: string | null
  like_count: number
  comment_count: number
  created_at: string
  is_copost?: boolean
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'NOW'
  if (m < 60) return m + 'M'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'H'
  const d = Math.floor(h / 24)
  return d + 'D'
}

export default function MyPostsPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)
      const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setCurrentUserRole((me as any)?.role ?? null)

      const [{ data: ownedPosts }, { data: collaboratorRows }] = await Promise.all([
        supabase
          .from('posts')
          .select('id, user_id, type, media_url, title, content, like_count, comment_count, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('post_collaborators')
          .select('post_id')
          .eq('collaborator_id', user.id)
          .eq('accepted', true),
      ])

      const collaboratorPostIds = [...new Set((collaboratorRows ?? []).map((row: any) => row.post_id))]
      const { data: collaboratorPosts } = collaboratorPostIds.length > 0
        ? await supabase
            .from('posts')
            .select('id, user_id, type, media_url, title, content, like_count, comment_count, created_at')
            .in('id', collaboratorPostIds)
            .order('created_at', { ascending: false })
        : { data: [] as any[] }

      const merged = [
        ...((ownedPosts as Post[]) ?? []),
        ...(((collaboratorPosts as Post[]) ?? []).map(post => ({ ...post, is_copost: true }))),
      ]
      const uniquePosts = Array.from(new Map(merged.map(post => [post.id, post])).values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setPosts(uniquePosts)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleDelete(postId: string) {
    const supabase = createClient()
    setPosts(prev => prev.filter(p => p.id !== postId))
    setConfirmDelete(null)
    await supabase.from('posts').delete().eq('id', postId)
  }

  function handleEdit(postId: string) {
    router.push(`/feed/new?edit=${postId}`)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 11, letterSpacing: '0.1em' }}>← BACK</button>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', flex: 1 }}>MY POSTS</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setView('grid')}
            style={{ background: 'none', border: view === 'grid' ? '1px solid #fff' : '1px solid #333', color: view === 'grid' ? '#fff' : '#555', padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em' }}
          >GRID</button>
          <button
            onClick={() => setView('list')}
            style={{ background: 'none', border: view === 'list' ? '1px solid #fff' : '1px solid #333', color: view === 'list' ? '#fff' : '#555', padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em' }}
          >LIST</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>{posts.length} POSTS</p>
        {currentUserRole !== 'ART_LOVER' && (
          <Link href="/feed/new" className="btn-red" style={{ fontSize: 10, padding: '8px 16px' }}>+ NEW POST</Link>
        )}
      </div>

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888880' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.2em', marginBottom: 8 }}>NO POSTS YET</p>
          <p style={{ fontSize: 10, letterSpacing: '0.12em', color: '#555', marginBottom: 20 }}>SHARE YOUR WORK WITH THE COMMUNITY</p>
          {currentUserRole !== 'ART_LOVER' && (
            <Link href="/feed/new" className="btn-primary" style={{ padding: '10px 24px', fontSize: 11 }}>CREATE A POST</Link>
          )}
        </div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
          {posts.map(post => (
            <div key={post.id} style={{ position: 'relative', aspectRatio: '1/1', background: '#111', overflow: 'hidden' }}>
              <Link href={`/feed/${post.id}`} style={{ display: 'block', width: '100%', height: '100%' }}>
                {post.type === 'image' && post.media_url ? (
                  <img src={post.media_url} alt={post.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : post.type === 'text' ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, background: '#111' }}>
                    <p style={{ fontSize: 8, color: '#fff', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.5 }}>
                      {(post.content ?? '').slice(0, 60).toUpperCase()}
                    </p>
                  </div>
                ) : post.type === 'audio' ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', flexDirection: 'column', gap: 6 }}>
                    <span style={{ color: '#c0392b', fontSize: 24 }}>♪</span>
                  </div>
                ) : post.type === 'video' && post.media_url ? (
                  <video src={post.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 24 }}>◻</div>
                )}

                {/* Stats overlay */}
                <div className="post-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0, transition: 'opacity 0.2s' }}>
                  <span style={{ fontSize: 10, color: '#fff', letterSpacing: '0.08em' }}>♥ {post.like_count}</span>
                  <span style={{ fontSize: 10, color: '#fff', letterSpacing: '0.08em' }}>◻ {post.comment_count}</span>
                </div>
              </Link>

              {/* Delete button */}
              {!post.is_copost && currentUserId === post.user_id && (
              <button
                onClick={() => setConfirmDelete(post.id)}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'rgba(192,57,43,0.85)', border: 'none',
                  color: '#fff', fontSize: 10, cursor: 'pointer',
                  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 2, fontFamily: 'inherit',
                }}
              >✕</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div>
          {posts.map(post => (
            <div key={post.id} style={{ display: 'flex', gap: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 0', alignItems: 'center' }}>
              {/* Thumb */}
              <Link href={`/feed/${post.id}`} style={{ flexShrink: 0, display: 'block', width: 60, height: 60, background: '#111', overflow: 'hidden', position: 'relative' }}>
                {post.type === 'image' && post.media_url ? (
                  <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 18 }}>
                    {post.type === 'audio' ? '♪' : post.type === 'video' ? '▷' : '◻'}
                  </div>
                )}
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.title ?? (post.content?.slice(0, 40) ?? '').toUpperCase() ?? 'UNTITLED'}
                  </p>
                </Link>
                {post.is_copost && (
                  <p style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.08em', marginBottom: 4 }}>CO-POST</p>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em' }}>♥ {post.like_count}</span>
                  <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em' }}>◻ {post.comment_count}</span>
                  <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.06em' }}>{timeAgo(post.created_at)}</span>
                </div>
              </div>
              {!post.is_copost && currentUserId === post.user_id ? (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleEdit(post.id)}
                    style={{ background: 'none', border: '1px solid #888880', color: '#fff', padding: '6px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em' }}
                  >EDIT</button>
                  <button
                    onClick={() => setConfirmDelete(post.id)}
                    style={{ background: 'none', border: '1px solid #c0392b', color: '#c0392b', padding: '6px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em' }}
                  >DELETE</button>
                </div>
              ) : (
                <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.06em', flexShrink: 0 }}>ACCEPTED</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#111', border: '1px solid #222', padding: 28, maxWidth: 320, width: '100%' }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>DELETE POST?</p>
            <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.06em', marginBottom: 24 }}>THIS ACTION CANNOT BE UNDONE.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-red" style={{ flex: 1 }}>DELETE</button>
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost" style={{ flex: 1 }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.post-overlay { opacity: 0 !important; } .post-overlay:hover { opacity: 1 !important; }`}</style>
    </div>
  )
}
