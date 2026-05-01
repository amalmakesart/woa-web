'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CITIES_BY_COUNTRY, COUNTRIES } from '@/lib/locationData'

interface Show {
  id: string
  title: string
  venue: string | null
  city: string | null
  show_date: string
  show_time: string | null
  ticket_url: string | null
}

export default function ManageShowsPage() {
  const router = useRouter()
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // New show form
  const [title, setTitle] = useState('')
  const [venue, setVenue] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [showDate, setShowDate] = useState('')
  const [showTime, setShowTime] = useState('')
  const [ticketUrl, setTicketUrl] = useState('')
  const [showForm, setShowForm] = useState(false)
  const availableCities = useMemo(() => country ? (CITIES_BY_COUNTRY[country] ?? []) : [], [country])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('shows')
        .select('id, title, venue, city, show_date, show_time, ticket_url')
        .eq('artist_id', user.id)
        .order('show_date', { ascending: false })
      setShows((data as Show[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !showDate) { setError('TITLE AND DATE ARE REQUIRED.'); return }
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.from('shows').insert({
      artist_id: userId,
      title: title.trim(),
      venue: venue.trim() || null,
      city: country && city ? `${city}, ${country}` : null,
      show_date: showDate,
      show_time: showTime || null,
      ticket_url: ticketUrl.trim() || null,
    }).select('id, title, venue, city, show_date, ticket_url').single()
    if (err) { setError(err.message); setSaving(false); return }
    setShows(prev => [data as Show, ...prev])
    setTitle(''); setVenue(''); setCountry(''); setCity(''); setShowDate(''); setShowTime(''); setTicketUrl('')
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('DELETE THIS SHOW?')) return
    const supabase = createClient()
    await supabase.from('shows').delete().eq('id', id)
    setShows(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 11, letterSpacing: '0.1em' }}>← BACK</button>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em' }}>MY SHOWS</h1>
        <button onClick={() => setShowForm(v => !v)} className="btn-red" style={{ fontSize: 10, padding: '8px 14px' }}>
          {showForm ? 'CANCEL' : '+ ADD SHOW'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.16em', marginBottom: 4 }}>NEW SHOW</p>
          <div>
            <label className="woa-input-label">SHOW / EVENT TITLE *</label>
            <input className="woa-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="E.G. LIVE AT THE JAZZ ROOM" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="woa-input-label">DATE *</label>
                <input className="woa-input" type="date" value={showDate} onChange={e => setShowDate(e.target.value)} style={{ colorScheme: 'dark' }} required />
              </div>
              <div>
                <label className="woa-input-label">TIME (OPTIONAL)</label>
                <input className="woa-input" type="time" value={showTime} onChange={e => setShowTime(e.target.value)} style={{ colorScheme: 'dark' }} />
              </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="woa-input-label">VENUE (OPTIONAL)</label>
              <input className="woa-input" value={venue} onChange={e => setVenue(e.target.value)} placeholder="VENUE NAME" />
            </div>
            <div>
              <label className="woa-input-label">COUNTRY (OPTIONAL)</label>
              <select
                className="woa-input"
                value={country}
                onChange={e => { setCountry(e.target.value); setCity('') }}
                style={{ cursor: 'pointer' }}
              >
                <option value="">SELECT COUNTRY</option>
                {COUNTRIES.map(item => <option key={item} value={item} style={{ background: '#111' }}>{item}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="woa-input-label">CITY (OPTIONAL)</label>
            <select
              className="woa-input"
              value={city}
              onChange={e => setCity(e.target.value)}
              style={{ cursor: country ? 'pointer' : 'not-allowed', opacity: country ? 1 : 0.5 }}
              disabled={!country}
            >
              <option value="">{country ? 'SELECT CITY' : 'SELECT COUNTRY FIRST'}</option>
              {availableCities.map(item => <option key={item} value={item} style={{ background: '#111' }}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="woa-input-label">TICKET URL (OPTIONAL)</label>
            <input className="woa-input" type="url" value={ticketUrl} onChange={e => setTicketUrl(e.target.value)} placeholder="https://tickets.example.com/..." />
          </div>
          {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'SAVING...' : 'ADD SHOW'}</button>
        </form>
      )}

      {shows.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#555', fontSize: 11, letterSpacing: '0.1em', padding: '40px 0' }}>NO SHOWS YET — ADD YOUR FIRST ONE ABOVE</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {shows.map(show => {
            const d = new Date(show.show_date)
            const isPast = d < new Date()
            return (
              <div key={show.id} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'flex-start', opacity: isPast ? 0.65 : 1 }}>
                <div style={{ minWidth: 48, textAlign: 'center', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{d.getDate()}</span>
                  <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>{d.toLocaleString('en', { month: 'short' }).toUpperCase()}</span>
                  <span style={{ display: 'block', fontSize: 9, color: '#555', letterSpacing: '0.06em' }}>{d.getFullYear()}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 2 }}>{show.title}</p>
                  <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em' }}>
                    {[show.venue, show.city].filter(Boolean).join(' · ').toUpperCase()}
                    {show.show_time && <span style={{ color: '#555' }}> · {show.show_time}</span>}
                  </p>
                  {isPast && <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>PAST</span>}
                  {show.ticket_url && (
                    <a href={/^https?:\/\//i.test(show.ticket_url) ? show.ticket_url : `https://${show.ticket_url}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 9, color: '#c0392b', letterSpacing: '0.1em' }}>
                      TICKETS ↗
                    </a>
                  )}
                </div>
                <button onClick={() => handleDelete(show.id)} style={{ background: 'none', border: 'none', color: '#c0392b', fontSize: 18, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
