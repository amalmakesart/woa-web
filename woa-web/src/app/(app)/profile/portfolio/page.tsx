'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Section {
  id: string
  title: string
  cover_image_url: string | null
  display_order: number
}

export default function ManagePortfolioPage() {
  const router = useRouter()
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('portfolio_sections')
        .select('id, title, cover_image_url, display_order')
        .eq('artist_id', user.id)
        .order('display_order')
      setSections((data as Section[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) { setError('SECTION TITLE IS REQUIRED.'); return }
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.from('portfolio_sections').insert({
      artist_id: userId,
      title: newTitle.trim(),
      display_order: sections.length,
    }).select('id, title, cover_image_url, display_order').single()
    if (err) { setError(err.message); setSaving(false); return }
    setSections(prev => [...prev, data as Section])
    setNewTitle('')
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('DELETE THIS PORTFOLIO SECTION? THIS CANNOT BE UNDONE.')) return
    const supabase = createClient()
    await supabase.from('portfolio_sections').delete().eq('id', id)
    setSections(prev => prev.filter(s => s.id !== id))
  }

  async function handleCoverUpload(sectionId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploadingFor(sectionId)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/portfolio-${sectionId}.${ext}`
    const { error: upErr } = await supabase.storage.from('posts').upload(path, file, { upsert: true })
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path)
      const url = urlData.publicUrl
      await supabase.from('portfolio_sections').update({ cover_image_url: url }).eq('id', sectionId)
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, cover_image_url: url } : s))
    }
    setUploadingFor(null)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 11, letterSpacing: '0.1em' }}>← BACK</button>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em' }}>MY PORTFOLIO</h1>
        <button onClick={() => setShowForm(v => !v)} className="btn-red" style={{ fontSize: 10, padding: '8px 14px' }}>
          {showForm ? 'CANCEL' : '+ ADD SECTION'}
        </button>
      </div>

      <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em', marginBottom: 24, lineHeight: 1.7 }}>
        PORTFOLIO SECTIONS APPEAR ON YOUR PUBLIC PROFILE. ADD SECTIONS TO GROUP YOUR WORK BY THEME OR PROJECT.
      </p>

      {showForm && (
        <form onSubmit={handleAdd} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.16em', marginBottom: 4 }}>NEW SECTION</p>
          <div>
            <label className="woa-input-label">SECTION TITLE *</label>
            <input className="woa-input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="E.G. PORTRAITS, STREET PHOTOGRAPHY, ALBUM ART..." required />
          </div>
          {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'SAVING...' : 'CREATE SECTION'}</button>
        </form>
      )}

      {sections.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#555', fontSize: 11, letterSpacing: '0.1em', padding: '40px 0' }}>NO PORTFOLIO SECTIONS YET</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map(section => (
            <div key={section.id} style={{ border: '1px solid rgba(255,255,255,0.08)', padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                {section.cover_image_url ? (
                  <img src={section.cover_image_url} alt={section.title} style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: 64, height: 64, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 20 }}>◈</div>
                )}
                <label style={{ display: 'block', marginTop: 6, fontSize: 9, color: '#888880', letterSpacing: '0.08em', cursor: 'pointer', textAlign: 'center' }}>
                  {uploadingFor === section.id ? '...' : 'SET COVER'}
                  <input type="file" accept="image/*" onChange={e => handleCoverUpload(section.id, e)} style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>{section.title.toUpperCase()}</p>
                <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.06em', marginTop: 4 }}>ITEMS MANAGED FROM THE APP</p>
              </div>
              <button onClick={() => handleDelete(section.id)} style={{ background: 'none', border: 'none', color: '#c0392b', fontSize: 18, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
