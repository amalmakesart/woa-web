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
type Collection = { id: string; name: string; post_count: number }

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

  // Single-file for video/audio, multi-file for images
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [singleFile, setSingleFile] = useState<File | null>(null)

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  // Collections
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [showCollectionPicker, setShowCollectionPicker] = useState(false)

  // Co-post
  const [collaboratorQuery, setCollaboratorQuery] = useState('')
  const [collaboratorSuggestions, setCollaboratorSuggestions] = useState<ArtistSuggestion[]>([])
  const [selectedCollaborator, setSelectedCollaborator] = useState<ArtistSuggestion | null>(null)

  // Existing media (edit mode)
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null)
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([])

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
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = (me as any)?.role
      if (role === 'ART_LOVER' || role === 'GIG_POSTER') { router.replace('/feed'); return }

      if (user?.id) {
        const { data: cols } = await supabase
          .from('collections')
          .select('id, name, post_count')
          .eq('user_id', user.id)
          .order('name')
        if (cols) setCollections(cols as Collection[])
      }

      if (editPostId && user?.id) {
        setLoadingExisting(true)
        const { data: post } = await supabase
          .from('posts')
          .select('id, user_id, type, title, content, media_url, media_urls, tags, collection_id')
          .eq('id', editPostId)
          .eq('user_id', user.id)
          .single()

        if (!post) {
          setError('POST NOT FOUND.')
          setLoadingExisting(false)
          return
        }

        const p = post as any
        setType(p.type as PostType)
        setTitle(p.title ?? '')
        setContent(p.content ?? '')
        setSelectedTag(p.tags?.[0] ?? null)
        setExistingMediaUrl(p.media_url ?? null)
        setExistingMediaUrls(Array.isArray(p.media_urls) && p.media_urls.length > 0 ? p.media_urls : p.media_url ? [p.media_url] : [])
        setSelectedCollectionId(p.collection_id ?? null)
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
        supabase.from('profiles').select('id, username, full_name, profile_photo_url, role').ilike('username', `%${q}%`).limit(10),
        supabase.from('profiles').select('id, username, full_name, profile_photo_url, role').ilike('full_name', `%${q}%`).limit(10),
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

  function handleImageFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4)
    setImageFiles(files)
    setImagePreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    if (!title.trim()) { setError('TITLE IS REQUIRED.'); setUploading(false); return }

    let mediaUrl: string | null = existingMediaUrl
    let mediaUrls: string[] = existingMediaUrls

    try {
      if (type === 'image' && imageFiles.length > 0) {
        const uploaded: string[] = []
        for (const [i, file] of imageFiles.entries()) {
          const ext = file.name.split('.').pop()
          const path = `${user.id}/${Date.now()}-${i}.${ext}`
          uploaded.push(await uploadToFirstWorkingBucket('image', path, file))
        }
        mediaUrls = uploaded
        mediaUrl = uploaded[0] ?? null
      } else if ((type === 'video' || type === 'audio') && singleFile) {
        const ext = singleFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        mediaUrl = await uploadToFirstWorkingBucket(type, path, singleFile)
        mediaUrls = [mediaUrl]
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
            media_urls: mediaUrls.length > 0 ? mediaUrls : null,
            tags: tagList,
            collection_id: selectedCollectionId ?? null,
          })
          .eq('id', editPostId)
          .eq('user_id', user.id)

        if (updateError) { setError(updateError.message); setUploading(false); return }
      } else {
        const { data: insertedPost, error: postErr } = await supabase.from('posts').insert({
          user_id: user.id,
          type,
          title: title.trim() || null,
          content: content.trim() || null,
          media_url: mediaUrl,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          tags: tagList,
          collection_id: selectedCollectionId ?? null,
          like_count: 0,
          comment_count: 0,
        }).select('id').single()

        if (postErr) { setError(postErr.message); setUploading(false); return }
        postId = insertedPost?.id ?? null

        if (selectedCollectionId) {
          try {
            await supabase.rpc('increment_collection_count', { collection_id: selectedCollectionId })
          } catch { /* ignore */ }
        }
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
    } catch (uploadError: any) {
      setError(uploadError?.message ?? 'Upload failed')
      setUploading(false)
    }
  }

  const selectedCollection = collections.find(c => c.id === selectedCollectionId)

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ marginBottom: 24, fontSize: 11, letterSpacing: '0.1em' }}>
        ← BACK
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 28 }}>
        {isEditMode ? 'EDIT POST' : 'NEW POST'}
      </h1>

      {loadingExisting && (
        <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em', marginBottom: 18 }}>LOADING POST...</p>
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
          <input
            className="woa-input"
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 25))}
            placeholder="Give your post a title"
            maxLength={25}
          />
          <p style={{ fontSize: 10, color: title.length >= 25 ? '#c0392b' : '#444', marginTop: 4, letterSpacing: '0.04em' }}>
            {title.length}/25
          </p>
        </div>

        {type === 'text' && (
          <div>
            <label className="woa-input-label">CONTENT</label>
            <textarea
              className="woa-input"
              value={content}
              onChange={e => setContent(e.target.value.slice(0, 2500))}
              placeholder="WHAT'S ON YOUR MIND?"
              rows={6}
              required
              style={{ resize: 'vertical' }}
            />
            <p style={{ fontSize: 10, color: content.length > 2000 ? '#c0392b' : '#444', marginTop: 4, letterSpacing: '0.04em' }}>
              {content.length}/2500
            </p>
          </div>
        )}

        {type === 'image' && (
          <div>
            <label className="woa-input-label">IMAGES (UP TO 4)</label>
            {imagePreviews.length > 0 ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
                  {imagePreviews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Image ${i + 1}`}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {imagePreviews.length}/4 SELECTED
                </p>
              </div>
            ) : existingMediaUrls.length > 0 && isEditMode ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
                  {existingMediaUrls.map((src, i) => (
                    <img key={i} src={src} alt={`Existing ${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  ))}
                </div>
                <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em' }}>
                  CURRENT IMAGES — SELECT NEW FILES TO REPLACE
                </p>
              </div>
            ) : null}
            <label style={{
              display: 'block',
              border: '1px dashed #333',
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
            }}>
              <p style={{ fontSize: 12, letterSpacing: '0.1em', color: '#888880', marginBottom: 4 }}>
                {imagePreviews.length > 0 ? 'CHANGE IMAGES' : '+ SELECT UP TO 4 IMAGES OR GIFS'}
              </p>
              <p style={{ fontSize: 10, letterSpacing: '0.08em', color: '#555' }}>CLICK OR DRAG TO UPLOAD</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageFilesChange}
                style={{ display: 'none' }}
                required={!isEditMode && existingMediaUrls.length === 0}
              />
            </label>
          </div>
        )}

        {(type === 'video' || type === 'audio') && (
          <div>
            <label className="woa-input-label">
              {type === 'video' ? 'VIDEO FILE (MAX 60 SECONDS)' : 'AUDIO FILE'}
            </label>
            <input
              type="file"
              accept={type === 'video' ? 'video/*' : 'audio/*'}
              onChange={e => setSingleFile(e.target.files?.[0] ?? null)}
              className="woa-input"
              required={!isEditMode && !existingMediaUrl}
              style={{ cursor: 'pointer' }}
            />
            {singleFile && (
              <p style={{ fontSize: 10, color: '#2a7a4f', letterSpacing: '0.06em', marginTop: 4 }}>
                ✓ {singleFile.name}
              </p>
            )}
            {existingMediaUrl && !singleFile && (
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

        {/* Collection picker */}
        <div>
          <label className="woa-input-label">COLLECTION (OPTIONAL)</label>
          <button
            type="button"
            onClick={() => setShowCollectionPicker(!showCollectionPicker)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.15)',
              color: selectedCollection ? '#fff' : '#888880',
              padding: '10px 0',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              letterSpacing: '0.06em',
              textAlign: 'left',
            }}
          >
            <span>{selectedCollection ? selectedCollection.name.toUpperCase() : 'SELECT COLLECTION'}</span>
            <span style={{ color: '#666', fontSize: 14 }}>▾</span>
          </button>
          {showCollectionPicker && collections.length > 0 && (
            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderTop: 'none', background: '#0a0a0a' }}>
              <button
                type="button"
                onClick={() => { setSelectedCollectionId(null); setShowCollectionPicker(false) }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #111', color: '#666', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.06em' }}
              >
                NONE
              </button>
              {collections.map(col => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => { setSelectedCollectionId(col.id); setShowCollectionPicker(false) }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: selectedCollectionId === col.id ? 'rgba(192,57,43,0.08)' : 'none',
                    border: 'none',
                    borderBottom: '1px solid #111',
                    color: selectedCollectionId === col.id ? '#fff' : '#888880',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{col.name.toUpperCase()}</span>
                  {selectedCollectionId === col.id && <span style={{ color: '#c0392b', fontSize: 12 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          {showCollectionPicker && collections.length === 0 && (
            <p style={{ fontSize: 10, color: '#666', letterSpacing: '0.06em', padding: '10px 0' }}>
              NO COLLECTIONS YET — CREATE ONE FROM YOUR PROFILE.
            </p>
          )}
        </div>

        {/* Tag selector */}
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
                        onClick={() => { setSelectedCollaborator(artist); setCollaboratorQuery(''); setCollaboratorSuggestions([]) }}
                        style={{ width: '100%', textAlign: 'left', background: '#0a0a0a', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
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
