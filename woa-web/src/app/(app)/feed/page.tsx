'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SignUpPrompt } from '@/components/SignUpPrompt'

type FeedTab = 'foryou' | 'following' | 'arttype' | 'location'

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'foryou', label: 'FOR YOU' },
  { key: 'following', label: 'FOLLOWING' },
  { key: 'arttype', label: 'ART TYPE' },
  { key: 'location', label: 'LOCATION' },
]

interface Post {
  id: string
  user_id: string
  type: 'image' | 'text' | 'audio' | 'video'
  content: string | null
  title: string | null
  media_url: string | null
  tags: string[]
  like_count: number
  comment_count: number
  created_at: string
  profiles?: {
    username: string
    profile_photo_url: string | null
    art_type: string | null
    full_name: string | null
  } | null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'NOW'
  if (m < 60) return m + 'M'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'H'
  const d = Math.floor(h / 24)
  if (d < 7) return d + 'D'
  return Math.floor(d / 7) + 'W'
}

function PostCard({
  post,
  currentUserId,
  likedIds,
  bookmarkedIds,
  onLike,
  onBookmark,
  onSignUp,
}: {
  post: Post
  currentUserId: string | null
  likedIds: Set<string>
  bookmarkedIds: Set<string>
  onLike: (id: string) => void
  onBookmark: (id: string) => void
  onSignUp: () => void
}) {
  const isLiked = likedIds.has(post.id)
  const isBookmarked = bookmarkedIds.has(post.id)
  const profile = post.profiles

  return (
    <article
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '20px 0',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Link href={`/artists/${post.user_id}`}>
          {profile?.profile_photo_url ? (
            <img
              src={profile.profile_photo_url}
              alt={profile.username}
              className="oct-avatar"
              style={{ width: 36, height: 36 }}
            />
          ) : (
            <div
              className="oct-avatar"
              style={{
                width: 36,
                height: 36,
                background: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: '#888880',
              }}
            >
              ◯
            </div>
          )}
        </Link>
        <div style={{ flex: 1 }}>
          <Link
            href={`/artists/${post.user_id}`}
            style={{ textDecoration: 'none' }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: '#fff',
              }}
            >
              {profile?.username?.toUpperCase() ?? 'UNKNOWN'}
            </span>
            {profile?.art_type && (
              <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>
                {profile.art_type.toUpperCase()}
              </span>
            )}
          </Link>
        </div>
        <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>
          {timeAgo(post.created_at)}
        </span>
      </div>

      {/* Title */}
      {post.title && (
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.04em',
            marginBottom: 10,
            color: '#fff',
          }}
        >
          {post.title}
        </p>
      )}

      {/* Media */}
      {post.type === 'image' && post.media_url && (
        <div style={{ marginBottom: 14, lineHeight: 0 }}>
          <img
            src={post.media_url}
            alt={post.title ?? 'Post image'}
            style={{ width: '100%', maxHeight: 480, objectFit: 'cover' }}
          />
        </div>
      )}

      {post.type === 'video' && post.media_url && (
        <div style={{ marginBottom: 14 }}>
          <video
            src={post.media_url}
            controls
            style={{ width: '100%', maxHeight: 480, background: '#111' }}
          />
        </div>
      )}

      {post.type === 'audio' && post.media_url && (
        <div
          style={{
            marginBottom: 14,
            background: '#111',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <audio src={post.media_url} controls style={{ width: '100%' }} />
        </div>
      )}

      {/* Text content */}
      {post.content && (
        <p
          style={{
            fontSize: 13,
            color: '#ccc',
            lineHeight: 1.7,
            marginBottom: 12,
            whiteSpace: 'pre-wrap',
          }}
        >
          {post.content}
        </p>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {post.tags.map(tag => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                color: '#c0392b',
                letterSpacing: '0.08em',
              }}
            >
              #{tag.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <button
          onClick={() => currentUserId ? onLike(post.id) : onSignUp()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: isLiked ? '#c0392b' : '#888880',
            fontSize: 11,
            letterSpacing: '0.1em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'inherit',
            transition: 'color 0.2s',
          }}
        >
          <span>{isLiked ? '♥' : '♡'}</span>
          <span>{post.like_count}</span>
        </button>
        <Link
          href={`/feed/${post.id}`}
          style={{
            color: '#888880',
            fontSize: 11,
            letterSpacing: '0.1em',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>◻</span>
          <span>{post.comment_count}</span>
        </Link>
        <button
          onClick={() => currentUserId ? onBookmark(post.id) : onSignUp()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: isBookmarked ? '#f39c12' : '#888880',
            fontSize: 13,
            letterSpacing: '0.1em',
            fontFamily: 'inherit',
            marginLeft: 'auto',
            transition: 'color 0.2s',
          }}
          title={isBookmarked ? 'Remove bookmark' : 'Save post'}
        >
          {isBookmarked ? '★' : '☆'}
        </button>
      </div>
    </article>
  )
}

export default function FeedPage() {
  const [tab, setTab] = useState<FeedTab>('foryou')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [showSignUp, setShowSignUp] = useState(false)

  const loadFeed = useCallback(async (activeTab: FeedTab) => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    let postsQuery = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (activeTab === 'following' && user) {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const ids = (follows ?? []).map((f: any) => f.following_id)
      if (ids.length > 0) postsQuery = postsQuery.in('user_id', ids)
      else { setPosts([]); setLoading(false); return }
    }

    const { data: postsData } = await postsQuery
    const posts = (postsData as Post[]) ?? []

    // Fetch profiles separately to avoid join issues
    if (posts.length > 0) {
      const userIds = [...new Set(posts.map(p => p.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, profile_photo_url, art_type, full_name')
        .in('id', userIds)
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
      const enriched = posts.map(p => ({ ...p, profiles: profileMap[p.user_id] ?? null }))
      setPosts(enriched)
    } else {
      setPosts([])
    }

    if (user && posts.length > 0) {
      const postIds = posts.map(p => p.id)
      const [{ data: likes }, { data: bookmarks }] = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      ])
      setLikedIds(new Set((likes ?? []).map((l: any) => l.post_id)))
      setBookmarkedIds(new Set((bookmarks ?? []).map((b: any) => b.post_id)))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadFeed(tab) }, [tab, loadFeed])

  async function handleBookmark(postId: string) {
    if (!currentUserId) return
    const supabase = createClient()
    const isBookmarked = bookmarkedIds.has(postId)
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      isBookmarked ? next.delete(postId) : next.add(postId)
      return next
    })
    if (isBookmarked) {
      await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', currentUserId)
    } else {
      await supabase.from('bookmarks').insert({ post_id: postId, user_id: currentUserId })
    }
  }

  async function handleLike(postId: string) {
    if (!currentUserId) return
    const supabase = createClient()
    const isLiked = likedIds.has(postId)
    setLikedIds(prev => {
      const next = new Set(prev)
      isLiked ? next.delete(postId) : next.add(postId)
      return next
    })
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, like_count: p.like_count + (isLiked ? -1 : 1) } : p
    ))
    if (isLiked) {
      await supabase.from('post_likes').delete()
        .eq('post_id', postId).eq('user_id', currentUserId)
      await supabase.rpc('decrement_like_count', { post_id: postId })
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUserId })
      await supabase.rpc('increment_like_count', { post_id: postId })
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px' }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
          padding: '16px 0 0',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' }}>WOA</span>
            <span style={{ color: '#c0392b', fontSize: 8 }}>●</span>
          </div>
          {currentUserId ? (
            <Link href="/feed/new" className="btn-red" style={{ fontSize: 10, padding: '6px 14px' }}>
              + POST
            </Link>
          ) : (
            <button onClick={() => setShowSignUp(true)} className="btn-red" style={{ fontSize: 10, padding: '6px 14px', cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
              + POST
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid #c0392b' : '2px solid transparent',
                color: tab === t.key ? '#fff' : '#888880',
                fontSize: 10,
                letterSpacing: '0.14em',
                padding: '8px 16px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                fontWeight: tab === t.key ? 700 : 400,
                transition: 'color 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
          LOADING...
        </div>
      ) : posts.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
          {tab === 'following' ? 'FOLLOW ARTISTS TO SEE THEIR POSTS' : 'NO POSTS YET'}
        </div>
      ) : (
        posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            likedIds={likedIds}
            bookmarkedIds={bookmarkedIds}
            onLike={handleLike}
            onBookmark={handleBookmark}
            onSignUp={() => setShowSignUp(true)}
          />
        ))
      )}
      {showSignUp && (
        <SignUpPrompt onClose={() => setShowSignUp(false)} />
      )}
    </div>
  )
}
