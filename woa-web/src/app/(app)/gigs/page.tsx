'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const GIG_TYPES = [
  'Photographer', 'Videographer', 'Filmmaker', 'Musician', 'Singer', 'DJ', 'Producer',
  'Model', 'Actor', 'Dancer', 'Choreographer', 'Visual Artist', 'Painter', 'Illustrator',
  'Graphic Designer', 'Animator', 'Muralist', 'Sculptor', 'Tattoo Artist', 'Fashion Designer',
  'Makeup Artist', 'Hair Stylist', 'Writer', 'Chef', 'Performer', 'Other',
]

interface Gig {
  id: string
  title: string
  description: string | null
  art_type: string | null
  location: string | null
  date_timeframe: string | null
  budget_min: number | null
  budget_max: number | null
  poster_name: string | null
  company_name: string | null
  is_featured: boolean
  status: 'active' | 'closed'
  interest_count: number
  created_at: string
}

function formatBudget(min: number | null, max: number | null) {
  if (!min && !max) return 'NEGOTIABLE'
  if (min && max) return `$${min.toLocaleString()} — $${max.toLocaleString()}`
  if (min) return `FROM $${min.toLocaleString()}`
  return `UP TO $${max!.toLocaleString()}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'TODAY'
  if (d === 1) return 'YESTERDAY'
  if (d < 7) return d + 'D AGO'
  return Math.floor(d / 7) + 'W AGO'
}

export default function GigsPage() {
  const [gigs, setGigs] = useState<Gig[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadGigs = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    let query = supabase
      .from('gigs')
      .select('*')
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (filterType) query = query.eq('art_type', filterType)

    const { data } = await query
    setGigs((data as Gig[]) ?? [])
    setLoading(false)
  }, [filterType])

  useEffect(() => { loadGigs() }, [loadGigs])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
          padding: '16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>GIG BOARD</h1>
          {currentUserId && (
            <Link href="/gigs/new" className="btn-red" style={{ fontSize: 10, padding: '6px 14px' }}>
              POST A GIG ↗
            </Link>
          )}
        </div>

        <select
          className="woa-input"
          style={{ cursor: 'pointer', maxWidth: 260 }}
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">ALL ART TYPES</option>
          {GIG_TYPES.map(t => (
            <option key={t} value={t} style={{ background: '#111' }}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Gig list */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '60px 0' }}>
          LOADING...
        </div>
      ) : gigs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '60px 0' }}>
          NO OPEN GIGS
        </div>
      ) : (
        gigs.map(gig => (
          <Link
            key={gig.id}
            href={`/gigs/${gig.id}`}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '24px 0',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                gap: 16,
                cursor: 'pointer',
                transition: 'padding-left 0.2s',
              }}
              className="gig-row-hover"
            >
              <div style={{ flex: 1 }}>
                {gig.is_featured && (
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 9,
                      color: '#c0392b',
                      letterSpacing: '0.14em',
                      border: '1px solid #c0392b',
                      padding: '2px 6px',
                      marginBottom: 8,
                    }}
                  >
                    FEATURED
                  </span>
                )}
                <span
                  style={{
                    display: 'block',
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    lineHeight: 1.2,
                    marginBottom: 8,
                    color: '#fff',
                  }}
                >
                  {gig.title}
                </span>
                <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>
                  {[
                    gig.company_name ?? gig.poster_name,
                    gig.art_type,
                    gig.location,
                    gig.date_timeframe,
                  ].filter(Boolean).join(' · ').toUpperCase()}
                </span>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: 4,
                  }}
                >
                  {formatBudget(gig.budget_min, gig.budget_max)}
                </span>
                <span style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.08em' }}>
                  {gig.interest_count} INTERESTED
                </span>
              </div>
            </div>
          </Link>
        ))
      )}

      <style>{`
        .gig-row-hover:hover { padding-left: 12px !important; }
      `}</style>
    </div>
  )
}
