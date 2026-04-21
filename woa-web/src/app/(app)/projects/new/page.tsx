'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DISCIPLINES = [
  'PHOTOGRAPHER', 'VIDEOGRAPHER', 'FILMMAKER', 'MUSICIAN', 'SINGER', 'DJ', 'PRODUCER',
  'MODEL', 'ACTOR', 'DANCER', 'CHOREOGRAPHER', 'VISUAL ARTIST', 'PAINTER', 'ILLUSTRATOR',
  'GRAPHIC DESIGNER', 'ANIMATOR', 'MURALIST', 'SCULPTOR', 'TATTOO ARTIST', 'FASHION DESIGNER',
  'MAKEUP ARTIST', 'HAIR STYLIST', 'WRITER', 'CHEF', 'PERFORMER', 'INTERDISCIPLINARY ARTIST', 'OTHER',
]

export default function NewProjectPage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [budget, setBudget] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [isRemote, setIsRemote] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if ((profile as any)?.role === 'GIG_POSTER') {
        router.push('/projects')
        return
      }
      setCurrentUserId(user.id)
    }
    load()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('TITLE IS REQUIRED.'); return }
    if (!description.trim()) { setError('DESCRIPTION IS REQUIRED.'); return }
    if (!discipline) { setError('DISCIPLINE IS REQUIRED.'); return }
    if (!isRemote && !country.trim()) { setError('COUNTRY IS REQUIRED.'); return }
    if (!isRemote && !city.trim()) { setError('CITY IS REQUIRED.'); return }
    if (!currentUserId) return

    setSubmitting(true)
    setError('')
    const supabase = createClient()
    const location = isRemote ? 'Remote' : `${city.trim()}, ${country.trim()}`
    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({
        user_id: currentUserId,
        title: title.trim(),
        description: description.trim(),
        art_types_needed: [],
        discipline,
        budget: budget.trim() || null,
        location,
      })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    router.push(`/projects/${(data as any).id}`)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888880', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>‹</button>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em' }}>POST A COLLAB</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', color: '#888880', marginBottom: 8 }}>
            PROJECT TITLE *
          </label>
          <input
            className="woa-input"
            style={{ width: '100%' }}
            placeholder="E.G. SEEKING CREW FOR SHORT FILM"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', color: '#888880', marginBottom: 8 }}>
            DESCRIBE YOUR PROJECT *
          </label>
          <textarea
            className="woa-input"
            style={{ width: '100%', minHeight: 180, resize: 'vertical' }}
            placeholder="DESCRIBE WHAT YOU ARE WORKING ON AND WHO YOU ARE LOOKING FOR. INCLUDE TIMELINE, LOCATION, BUDGET, AND WHAT THE COLLABORATION LOOKS LIKE."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', color: '#888880', marginBottom: 12 }}>
            DISCIPLINE *
          </label>
          <select
            className="woa-input"
            value={discipline}
            onChange={e => setDiscipline(e.target.value)}
            style={{ cursor: 'pointer', width: '100%' }}
          >
            <option value="">SELECT DISCIPLINE</option>
            {DISCIPLINES.map(item => (
              <option key={item} value={item} style={{ background: '#111' }}>{item}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', color: '#888880', marginBottom: 8 }}>
            BUDGET
          </label>
          <input
            className="woa-input"
            style={{ width: '100%' }}
            placeholder="E.G. $500 OR $500 - $1,000"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            maxLength={80}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', color: '#888880', marginBottom: 12 }}>
            LOCATION *
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#888880', letterSpacing: '0.08em', marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={isRemote}
              onChange={e => setIsRemote(e.target.checked)}
            />
            REMOTE COLLAB
          </label>
          {!isRemote && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <input
                className="woa-input"
                placeholder="CITY"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
              <input
                className="woa-input"
                placeholder="COUNTRY"
                value={country}
                onChange={e => setCountry(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.08em' }}>{error}</p>
        )}

        <button
          type="submit"
          className="btn-red"
          style={{ padding: '14px', fontSize: 11, letterSpacing: '0.14em' }}
          disabled={submitting}
        >
          {submitting ? 'POSTING...' : 'POST COLLAB'}
        </button>
      </form>
    </div>
  )
}
