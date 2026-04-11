'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PostType = 'text' | 'image' | 'video' | 'audio'
type ArtistSuggestion = {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  role?: string | null
}

const STORAGE_BUCKETS: Record<Exclude<PostType, 'text'>, string[]> = {
  image: ['post-images', 'posts'],
  video: ['post-videos', 'posts'],
  audio: ['post-audio', 'posts'],
}

const TYPES: { key: PostType; label: string; icon: string }[] = [
  { key: 'text', label: 'TEXT', icon: '◻' },
  { key: 'image', label: 'IMAGE', icon: '◈' },
  { key: 'video', label: 'VIDEO', icon: '▷' },
  { key: 'audio', label: 'AUDIO', icon: '♪' },
]

const TAGS = [
  'COMMISSION WORK', 'GIG', 'PERSONAL PROJECT', 'EXHIBITION',
  'ARCHIVE', 'FEATURED WORK', 'COLLABORATION', 'SKETCH WORK',
  'STUDIO SESSIONS', 'PUBLISHED WORK',
]

export default function NewPostPage() {
  const router = useRouter()
  const [editPostId, setEditPostId] = useState<string | null>(null)
  const isEditMode = !!editPostId
  const [type, setType] = useState<PostType>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [collaboratorQuery, setCollaboratorQuery] = useState('')
  const [collaboratorSuggestions, setCollaboratorSuggestions] = useState<ArtistSuggestion[]>([])
  const [selectedCollaborator, setSelectedCollaborator] = useState<ArtistSuggestion | null>(null)
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setEditPostId(new URLSearchParams(window.location.search).get('edit'))
  }, [])

  async function uploadToFirstWorkingBucket(type: Exclude<PostType, 'text'>, path: string, file: File) {
    let lastError: string | null = null
    const supabase = createClient()

    for (const bucket of STORAGE_BUCKETS[type]) {
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        return urlData.publicUrl
      }
      lastError = upErr.message
    }

    throw new Error(lastError ?? 'Upload failed')
  }

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      if (editPostId && user?.id) {
        setLoadingExisting(true)
        const { data: post } = await supabase
          .from('posts')
          .select('id, user_id, type, title, content, media_url, tags')
          .eq('id', editPostId)
          .eq('user_id', user.id)
          .single()

        if (!post) {
          setError('POST NOT FOUND.')
          setLoadingExisting(false)
          return
        }

        setType(post.type as PostType)
        setTitle(post.title ?? '')
        setContent(post.content ?? '')
        setSelectedTag(post.tags?.[0] ?? null)
        setExistingMediaUrl(post.media_url ?? null)
        setLoadingExisting(false)
      }
    }
    loadUser()
  }, [editPostId])

  useEffect(() => {
    if (!collaboratorQuery.trim() || collaboratorQuery.trim().length < 2) {
      setCollaboratorSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      const supabase = createClient()
      const q = collaboratorQuery.trim().toLowerCase()
      const [byUsername, byName] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name, profile_photo_url, role')
          .ilike('username', `%${q}%`)
          .limit(10),
        supabase
          .from('profiles')
          .select('id, username, full_name, profile_photo_url, role')
          .ilike('full_name', `%${q}%`)
          .limit(10),
      ])
      const combined = [...(byUsername.data ?? []), ...(byName.data ?? [])]
      const seen = new Set<string>()
      const unique = combined.filter((p: any) => {
        if (seen.has(p.id)) return false
        if (p.id === currentUserId) return false
        if (p.role === 'GIG_POSTER') return false
        seen.add(p.id)
        return true
      })
      setCollaboratorSuggestions(unique.slice(0, 6) as ArtistSuggestion[])
    }, 300)

    return () => clearTimeout(timer)
  }, [collaboratorQuery, currentUserId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    if (!title.trim()) { setError('TITLE IS REQUIRED.'); setUploading(false); return }

    let mediaUrl: string | null = existingMediaUrl

    if (file && type !== 'text') {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      try {
        mediaUrl = await uploadToFirstWorkingBucket(type, path, file)
      } catch (uploadError: any) {
        setError(uploadError?.message ?? 'Upload failed')
        setUploading(false)
        return
      }
    }

    const tagList = selectedTag ? [selectedTag] : []
    let postId = editPostId

    if (isEditMode && editPostId) {
      const { error: updateError } = await supabase
        .from('posts')
        .update({
          title: title.trim() || null,
          content: content.trim() || null,
          media_url: mediaUrl,
          tags: tagList,
        })
        .eq('id', editPostId)
        .eq('user_id', user.id)

      if (updateError) {
        setError(updateError.message)
        setUploading(false)
        return
      }
    } else {
      const { data: insertedPost, error: postErr } = await supabase.from('posts').insert({
        user_id: user.id,
        type,
        title: title.trim() || null,
        content: content.trim() || null,
        media_url: mediaUrl,
        tags: tagList,
        like_count: 0,
        comment_count: 0,
      }).select('id').single()

      if (postErr) { setError(postErr.message); setUploading(false); return }
      postId = insertedPost?.id ?? null
    }

    if (!isEditMode && selectedCollaborator && postId) {
      const { error: collabErr } = await supabase.from('post_collaborators').insert({
        post_id: postId,
        collaborator_id: selectedCollaborator.id,
        accepted: false,
      })

      if (!collabErr) {
        await supabase.from('notifications').insert({
          user_id: selectedCollaborator.id,
          type: 'co_post_invite',
          actor_id: user.id,
          reference_id: postId,
          reference_type: 'post',
          preview_text: 'TAP TO ACCEPT THIS CO-POST INVITE.',
          is_read: false,
        })
      }
    }
    router.push('/feed')
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ marginBottom: 24, fontSize: 11, letterSpacing: '0.1em' }}>
        ← BACK
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 28 }}>
        {isEditMode ? 'EDIT POST' : 'NEW POST'}
      </h1>

      {loadingExisting && (
        <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em', marginBottom: 18 }}>
          LOADING POST...
        </p>
      )}

      {/* Type selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {TYPES.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            disabled={isEditMode}
            style={{
              flex: 1,
              padding: '10px 0',
              border: `1px solid ${type === t.key ? '#c0392b' : 'rgba(255,255,255,0.15)'}`,
              background: type === t.key ? 'rgba(192,57,43,0.08)' : 'transparent',
              color: type === t.key ? '#fff' : '#888880',
              fontSize: 10,
              letterSpacing: '0.12em',
              cursor: isEditMode ? 'default' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              gap: 4,
              opacity: isEditMode && type !== t.key ? 0.45 : 1,
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="woa-input-label">TITLE *</label>
          <input className="woa-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your post a title" />
        </div>

        {type === 'text' && (
          <div>
            <label className="woa-input-label">CONTENT</label>
            <textarea
              className="woa-input"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="WHAT'S ON YOUR MIND?"
              rows={6}
              required
              style={{ resize: 'vertical' }}
            />
          </div>
        )}

        {type !== 'text' && (
          <div>
            <label className="woa-input-label">
              {type === 'image' ? 'IMAGE FILE' : type === 'video' ? 'VIDEO FILE' : 'AUDIO FILE'}
            </label>
            <input
              type="file"
              accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*'}
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="woa-input"
              required={!isEditMode && !existingMediaUrl}
              style={{ cursor: 'pointer' }}
            />
            {existingMediaUrl && !file && (
              <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em', marginTop: 8 }}>
                CURRENT MEDIA WILL STAY UNLESS YOU CHOOSE A NEW FILE.
              </p>
            )}
          </div>
        )}

        {type !== 'text' && (
          <div>
            <label className="woa-input-label">CAPTION (OPTIONAL)</label>
            <textarea
              className="woa-input"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Describe your work..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
        )}

        <div>
          <label className="woa-input-label">TAG (OPTIONAL · CHOOSE ONE)</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TAGS.map(tag => {
              const active = selectedTag === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(active ? null : tag)}
                  style={{
                    border: `1px solid ${active ? '#c0392b' : 'rgba(255,255,255,0.15)'}`,
                    background: active ? 'rgba(192,57,43,0.08)' : 'transparent',
                    color: active ? '#c0392b' : '#888880',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {!isEditMode && (
        <div>
          <label className="woa-input-label">CO-POST WITH (OPTIONAL)</label>
          {selectedCollaborator ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.15)', padding: '12px 0' }}>
              <span style={{ fontSize: 11, letterSpacing: '0.06em', color: '#c0392b' }}>
                @{selectedCollaborator.username ?? selectedCollaborator.full_name ?? 'ARTIST'}
              </span>
              <button
                type="button"
                onClick={() => { setSelectedCollaborator(null); setCollaboratorQuery('') }}
                style={{ background: 'none', border: 'none', color: '#888880', fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                REMOVE
              </button>
            </div>
          ) : (
            <>
              <input
                className="woa-input"
                value={collaboratorQuery}
                onChange={e => setCollaboratorQuery(e.target.value)}
                placeholder="Search by name or @username"
              />
              {collaboratorSuggestions.length > 0 && (
                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none' }}>
                  {collaboratorSuggestions.map(artist => (
                    <button
                      key={artist.id}
                      type="button"
                      onClick={() => {
                        setSelectedCollaborator(artist)
                        setCollaboratorQuery('')
                        setCollaboratorSuggestions([])
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: '#0a0a0a',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        color: '#fff',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 11, letterSpacing: '0.06em' }}>
                        {(artist.full_name ?? '').toUpperCase()}
                      </span>
                      {artist.username && (
                        <span style={{ fontSize: 10, letterSpacing: '0.06em', color: '#c0392b', marginLeft: 8 }}>
                          @{artist.username}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        )}

        {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

        <button type="submit" className="btn-primary" disabled={uploading} style={{ marginTop: 8 }}>
          {uploading ? (isEditMode ? 'SAVING...' : 'POSTING...') : (isEditMode ? 'SAVE CHANGES' : 'POST')}
        </button>
      </form>
    </div>
  )
}
