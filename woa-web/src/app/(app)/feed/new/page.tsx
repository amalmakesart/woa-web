'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PostType = 'text' | 'image' | 'video' | 'audio'

const TYPES: { key: PostType; label: string; icon: string }[] = [
  { key: 'text', label: 'TEXT', icon: '◻' },
  { key: 'image', label: 'IMAGE', icon: '◈' },
  { key: 'video', label: 'VIDEO', icon: '▷' },
  { key: 'audio', label: 'AUDIO', icon: '♪' },
]

export default function NewPostPage() {
  const router = useRouter()
  const [type, setType] = useState<PostType>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    let mediaUrl: string | null = null

    if (file && type !== 'text') {
      const ext = file.name.split('.').pop()
      const bucket = type === 'image' ? 'post-images' : type === 'video' ? 'post-videos' : 'post-audio'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file)
      if (upErr) { setError(upErr.message); setUploading(false); return }
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
      mediaUrl = urlData.publicUrl
    }

    const tagList = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)

    const { error: postErr } = await supabase.from('posts').insert({
      user_id: user.id,
      type,
      title: title.trim() || null,
      content: content.trim() || null,
      media_url: mediaUrl,
      tags: tagList,
      like_count: 0,
      comment_count: 0,
    })

    if (postErr) { setError(postErr.message); setUploading(false); return }
    router.push('/feed')
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ marginBottom: 24, fontSize: 11, letterSpacing: '0.1em' }}>
        ← BACK
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 28 }}>NEW POST</h1>

      {/* Type selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: `1px solid ${type === t.key ? '#c0392b' : 'rgba(255,255,255,0.15)'}`,
              background: type === t.key ? 'rgba(192,57,43,0.08)' : 'transparent',
              color: type === t.key ? '#fff' : '#888880',
              fontSize: 10,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="woa-input-label">TITLE (OPTIONAL)</label>
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
              required
              style={{ cursor: 'pointer' }}
            />
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
          <label className="woa-input-label">TAGS (COMMA SEPARATED)</label>
          <input
            className="woa-input"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="painting, abstract, oil"
          />
        </div>

        {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

        <button type="submit" className="btn-primary" disabled={uploading} style={{ marginTop: 8 }}>
          {uploading ? 'POSTING...' : 'POST'}
        </button>
      </form>
    </div>
  )
}
