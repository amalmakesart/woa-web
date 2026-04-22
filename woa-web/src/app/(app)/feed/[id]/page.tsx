'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PostActionsMenu } from '@/components/PostActionsMenu'
import { isAdminEmail } from '@/lib/admin'

interface Post {
  id: string
  user_id: string
  type: string
  content: string | null
  title: string | null
  media_url: string | null
  tags: string[]
  like_count: number
  comment_count: number
  created_at: string
  profiles?: { username: string | null; full_name: string | null; profile_photo_url: string | null; art_type: string | null } | null
  collaborators?: { id: string; username: string | null; full_name: string | null }[]
}

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { username: string | null; profile_photo_url: string | null } | null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'NOW'
  if (m < 60) return m + 'M AGO'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'H AGO'
  const d = Math.floor(h / 24)
  if (d < 7) return d + 'D AGO'
  return Math.floor(d / 7) + 'W AGO'
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.id as string

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      setIsAdmin(isAdminEmail(user?.email))

      const [{ data: postData }, { data: commentsData }] = await Promise.all([
        supabase.from('posts').select('*').eq('id', postId).single(),
        supabase.from('comments')
          .select('id, post_id, user_id, content, created_at')
          .eq('post_id', postId)
          .order('created_at', { ascending: true }),
      ])

      if (!postData) { setLoading(false); return }

      // Fetch profile for post author
      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('username, full_name, profile_photo_url, art_type')
        .eq('id', (postData as any).user_id)
        .single()
      const { data: collaboratorRows } = await supabase
        .from('post_collaborators')
        .select('collaborator_id, accepted')
        .eq('post_id', postId)
        .eq('accepted', true)
      const collaboratorIds = [...new Set((collaboratorRows ?? []).map((row: any) => row.collaborator_id))]
      const { data: collaboratorProfiles } = collaboratorIds.length > 0
        ? await supabase.from('profiles').select('id, username, full_name').in('id', collaboratorIds)
        : { data: [] as any[] }

      setPost({
        ...(postData as Post),
        profiles: authorProfile as any,
        collaborators: (collaboratorProfiles as any[]) ?? [],
      })

      // Fetch profiles for comments
      const rawComments = (commentsData as Comment[]) ?? []
      if (rawComments.length > 0) {
        const userIds = [...new Set(rawComments.map(c => c.user_id))]
        const { data: commentProfiles } = await supabase
          .from('profiles')
          .select('id, username, profile_photo_url')
          .in('id', userIds)
        const pMap = Object.fromEntries((commentProfiles ?? []).map((p: any) => [p.id, p]))
        setComments(rawComments.map(c => ({ ...c, profiles: pMap[c.user_id] ?? null })))
      }

      if (user) {
        const [{ data: like }, { data: bookmark }] = await Promise.all([
          supabase.from('likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle(),
          supabase.from('bookmarks').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle(),
        ])
        setIsLiked(!!like)
        setIsBookmarked(!!bookmark)
      }

      setLoading(false)
    }
    load()
  }, [postId])

  async function handleLike() {
    if (!currentUserId || !post) return
    const supabase = createClient()
    const previousPost = post
    const previousLiked = isLiked
    if (isLiked) {
      setIsLiked(false)
      setPost(p => p ? { ...p, like_count: p.like_count - 1 } : p)
      const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', currentUserId)
      if (error) {
        setIsLiked(previousLiked)
        setPost(previousPost)
        window.alert(`LIKE FAILED — ${error.message.toUpperCase()}`)
      }
    } else {
      setIsLiked(true)
      setPost(p => p ? { ...p, like_count: p.like_count + 1 } : p)
      const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId })
      if (error) {
        setIsLiked(previousLiked)
        setPost(previousPost)
        window.alert(`LIKE FAILED — ${error.message.toUpperCase()}`)
      } else if (post.user_id !== currentUserId) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          type: 'post_liked',
          actor_id: currentUserId,
          reference_id: post.id,
          reference_type: 'post',
          preview_text: post.title ?? post.content?.slice(0, 40) ?? null,
          is_read: false,
        })
      }
    }
  }

  async function handleBookmark() {
    if (!currentUserId) return
    const supabase = createClient()
    if (isBookmarked) {
      setIsBookmarked(false)
      await supabase.from('bookmarks').delete().match({ post_id: postId, user_id: currentUserId })
    } else {
      setIsBookmarked(true)
      await supabase.from('bookmarks').insert({ post_id: postId, user_id: currentUserId })
    }
  }

  async function handleDelete() {
    if (!currentUserId || !post || (currentUserId !== post.user_id && !isAdmin)) return
    if (!window.confirm('DELETE THIS POST? THIS CANNOT BE UNDONE.')) return
    const supabase = createClient()
    await supabase.from('posts').delete().eq('id', post.id)
    router.push('/feed')
  }

  function handleEdit() {
    if (!currentUserId || !post || (currentUserId !== post.user_id && !isAdmin)) return
    router.push(`/feed/new?edit=${post.id}`)
  }

  function handleReport() {
    if (!post || currentUserId === post.user_id) return
    window.alert(`REPORTED @${post.profiles?.username?.toUpperCase() ?? 'USER'} — THANK YOU.`)
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || !currentUserId || !post) return
    setSubmitting(true)
    const content = commentText.trim()
    setCommentText('')
    const supabase = createClient()

    const { data: newComment } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: currentUserId, content })
      .select('id, post_id, user_id, content, created_at')
      .single()

    if (newComment) {
      // fetch commenter profile
      const { data: prof } = await supabase
        .from('profiles').select('username, profile_photo_url').eq('id', currentUserId).single()
      setComments(prev => [...prev, { ...(newComment as Comment), profiles: prof as any }])
      setPost(p => p ? { ...p, comment_count: p.comment_count + 1 } : p)
      supabase.rpc('increment_comment_count', { post_id: postId })
    }
    setSubmitting(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>
  }

  if (!post) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>POST NOT FOUND</div>
  }

  const profile = post.profiles
  const collaboratorNames = (post.collaborators ?? [])
    .map(c => c.username ?? c.full_name)
    .filter(Boolean)
    .map(name => `@${String(name).toUpperCase()}`)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 20 }}>
        ← BACK
      </button>

      {/* Post author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Link href={`/artists/${post.user_id}`}>
          {profile?.profile_photo_url ? (
            <img src={profile.profile_photo_url} alt="" className="oct-avatar" style={{ width: 40, height: 40 }} />
          ) : (
            <div className="oct-avatar" style={{ width: 40, height: 40, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880' }}>◯</div>
          )}
        </Link>
        <div style={{ flex: 1 }}>
          <Link href={`/artists/${post.user_id}`} style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#fff', display: 'block' }}>
              {(profile?.username ?? profile?.full_name ?? 'UNKNOWN').toUpperCase()}
            </span>
          </Link>
          {collaboratorNames.length > 0 && (
            <span style={{ display: 'block', fontSize: 10, color: '#c0392b', letterSpacing: '0.06em', marginTop: 2 }}>
              {collaboratorNames.join(' + ')}
            </span>
          )}
          {profile?.art_type && (
            <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>{profile.art_type.toUpperCase()}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em' }}>{timeAgo(post.created_at)}</span>
          <PostActionsMenu
            canManage={currentUserId === post.user_id || isAdmin}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReport={handleReport}
          />
        </div>
      </div>

      {/* Title */}
      {post.title && (
        <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 14 }}>{post.title}</h1>
      )}

      {/* Media */}
      {post.type === 'image' && post.media_url && (
        <div style={{ marginBottom: 16, lineHeight: 0 }}>
          <img src={post.media_url} alt={post.title ?? ''} style={{ width: '100%', maxHeight: 560, objectFit: 'cover' }} />
        </div>
      )}
      {post.type === 'video' && post.media_url && (
        <div style={{ marginBottom: 16 }}>
          <video src={post.media_url} controls style={{ width: '100%', maxHeight: 480, background: '#111' }} />
        </div>
      )}
      {post.type === 'audio' && post.media_url && (
        <div style={{ marginBottom: 16, background: '#111', padding: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
          <audio src={post.media_url} controls style={{ width: '100%' }} />
        </div>
      )}

      {/* Text content */}
      {post.content && (
        <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.8, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
          {post.content}
        </p>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.08em' }}>#{tag.toUpperCase()}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 0', marginBottom: 24 }}>
        <button
          onClick={handleLike}
          style={{ background: 'none', border: 'none', cursor: currentUserId ? 'pointer' : 'default', color: isLiked ? '#c0392b' : '#888880', fontSize: 13, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
        >
          <span>{isLiked ? '♥' : '♡'}</span>
          <span style={{ fontSize: 11 }}>{post.like_count}</span>
        </button>
        <span style={{ fontSize: 13, color: '#888880', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>◻</span>
          <span style={{ fontSize: 11 }}>{post.comment_count}</span>
        </span>
        {currentUserId && (
          <button
            onClick={handleBookmark}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isBookmarked ? '#f39c12' : '#888880', fontSize: 13, letterSpacing: '0.1em', fontFamily: 'inherit', marginLeft: 'auto' }}
          >
            {isBookmarked ? '★' : '☆'}
          </button>
        )}
      </div>

      {/* Comments */}
      <div style={{ marginBottom: 80 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.16em', color: '#888880', marginBottom: 16 }}>
          COMMENTS ({comments.length})
        </p>

        {comments.length === 0 ? (
          <p style={{ fontSize: 11, color: '#444', letterSpacing: '0.1em', textAlign: 'center', padding: '24px 0' }}>
            BE THE FIRST TO COMMENT
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {comments.map(comment => (
              <div key={comment.id} style={{ display: 'flex', gap: 10 }}>
                <Link href={`/artists/${comment.user_id}`}>
                  {comment.profiles?.profile_photo_url ? (
                    <img src={comment.profiles.profile_photo_url} alt="" className="oct-avatar" style={{ width: 30, height: 30, flexShrink: 0 }} />
                  ) : (
                    <div className="oct-avatar" style={{ width: 30, height: 30, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 10, flexShrink: 0 }}>◯</div>
                  )}
                </Link>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                    <Link href={`/artists/${comment.user_id}`} style={{ textDecoration: 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
                        {(comment.profiles?.username ?? 'UNKNOWN').toUpperCase()}
                      </span>
                    </Link>
                    <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.06em' }}>{timeAgo(comment.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Comment input — sticky at bottom */}
      {currentUserId && (
        <form
          onSubmit={handleComment}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#000', borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '12px 20px', display: 'flex', gap: 10,
            maxWidth: 640, margin: '0 auto',
          }}
        >
          <input
            className="woa-input"
            style={{ flex: 1 }}
            placeholder="ADD A COMMENT..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn-red" style={{ padding: '12px 16px', flexShrink: 0 }} disabled={submitting || !commentText.trim()}>
            POST
          </button>
        </form>
      )}
    </div>
  )
}
