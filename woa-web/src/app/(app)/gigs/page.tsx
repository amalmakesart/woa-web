'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SignUpPrompt } from '@/components/SignUpPrompt'

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
  image_url: string | null
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

function parseLocationParts(location: string | null) {
  const raw = location?.trim()
  if (!raw) return { country: null as string | null, city: null as string | null }
  if (raw.toLowerCase() === 'remote') {
    return { country: 'Remote', city: null }
  }

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(', '),
      country: parts[parts.length - 1],
    }
  }

  return { country: raw, city: null }
}

function FilterModal({
  visible, title, options, selected, onSelect, onClear, onClose,
}: {
  visible: boolean
  title: string
  options: string[]
  selected: string | null
  onSelect: (v: string) => void
  onClear: () => void
  onClose: () => void
}) {
  if (!visible) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0a0a0a',
          borderTop: '1px solid #222',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #1a1a1a',
          }}
        >
          <span style={{ fontSize: 12, letterSpacing: '0.2em', color: '#fff' }}>{title}</span>
          <div style={{ display: 'flex', gap: 16 }}>
            {selected && (
              <button
                onClick={() => { onClear(); onClose() }}
                style={{ background: 'none', border: 'none', color: '#c0392b', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                CLEAR
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#888880', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {options.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
              NO OPTIONS
            </div>
          ) : options.map(opt => (
            <button
              key={opt}
              onClick={() => { onSelect(opt); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '14px 20px',
                background: 'none', border: 'none', borderBottom: '1px solid #111',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, letterSpacing: '0.1em', color: selected === opt ? '#fff' : '#ccc', fontWeight: selected === opt ? 700 : 400 }}>
                {opt.toUpperCase()}
              </span>
              {selected === opt && <span style={{ color: '#c0392b', fontSize: 12 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Chip({
  label, active, onPress, onClear,
}: {
  label: string
  active: boolean
  onPress: () => void
  onClear: () => void
}) {
  return (
    <button
      onClick={active ? onClear : onPress}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        border: `1px solid ${active ? '#fff' : '#c0392b'}`,
        borderRadius: 20,
        padding: '7px 14px',
        background: active ? '#111' : 'transparent',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: '0.1em', color: active ? '#fff' : '#c0392b' }}>
        {label}
      </span>
      {active && <span style={{ color: '#fff', fontSize: 10 }}>✕</span>}
    </button>
  )
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
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<'type' | 'country' | 'city' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [showSignUp, setShowSignUp] = useState(false)

  const loadGigs = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      let role: string | null = null
      if (user) {
        const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        role = (me as any)?.role ?? null
        setCurrentUserRole(role)
      }

      const isMyGigsView = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mine') === 'true'

      let query = supabase
        .from('gigs')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

      if (isMyGigsView && user) {
        query = query.eq('poster_id', user.id)
      } else if (role === 'GIG_POSTER' && user) {
        query = query.eq('poster_id', user.id)
      } else {
        query = query.eq('status', 'active')
      }

      const { data } = await query
      setGigs((data as Gig[]) ?? [])
    } catch (e) {
      console.error('Failed to load gigs:', e)
      setGigs([])
    } finally {
      setLoading(false)
    }
  }, [filterType])

  useEffect(() => { loadGigs() }, [loadGigs])

  const availableCountries = useMemo(() =>
    [...new Set(gigs.map((gig) => parseLocationParts(gig.location).country).filter(Boolean) as string[])].sort(),
    [gigs]
  )

  const availableCities = useMemo(() => {
    const source = countryFilter
      ? gigs.filter((gig) => parseLocationParts(gig.location).country === countryFilter)
      : gigs
    return [...new Set(source.map((gig) => parseLocationParts(gig.location).city).filter(Boolean) as string[])].sort()
  }, [gigs, countryFilter])

  const filteredGigs = useMemo(() => gigs.filter((gig) => {
    const location = parseLocationParts(gig.location)
    if (filterType && gig.art_type !== filterType) return false
    if (countryFilter && location.country !== countryFilter) return false
    if (cityFilter && location.city !== cityFilter) return false
    return true
  }), [gigs, filterType, countryFilter, cityFilter])

  const hasFilters = !!(filterType || countryFilter || cityFilter)

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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>{currentUserRole === 'GIG_POSTER' ? 'MY GIGS' : 'GIG BOARD'}</h1>
          {currentUserId && currentUserRole === 'GIG_POSTER' ? (
            <Link href="/gigs/new" className="btn-red" style={{ fontSize: 10, padding: '6px 14px' }}>
              POST A GIG ↗
            </Link>
          ) : !currentUserId ? (
            <button onClick={() => setShowSignUp(true)} className="btn-red" style={{ fontSize: 10, padding: '6px 14px', cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
              POST A GIG ↗
            </button>
          ) : null}
        </div>
        <p style={{ fontSize: 11, color: '#f5c842', letterSpacing: '0.1em', marginBottom: 16 }}>
          HIRE ARTISTS FOR YOUR NEXT PROJECT, SHOOT, EVENT, OR CAMPAIGN.
        </p>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'center' }}>
          <Chip
            label={filterType ? filterType.toUpperCase() : 'ART TYPE'}
            active={!!filterType}
            onPress={() => setActiveModal('type')}
            onClear={() => setFilterType('')}
          />
          <Chip
            label={countryFilter ? countryFilter.toUpperCase() : 'COUNTRY'}
            active={!!countryFilter}
            onPress={() => setActiveModal('country')}
            onClear={() => { setCountryFilter(null); setCityFilter(null) }}
          />
          <Chip
            label={cityFilter ? cityFilter.toUpperCase() : 'CITY'}
            active={!!cityFilter}
            onPress={() => setActiveModal('city')}
            onClear={() => setCityFilter(null)}
          />
          {hasFilters && (
            <button
              onClick={() => { setFilterType(''); setCountryFilter(null); setCityFilter(null) }}
              style={{
                border: '1px solid #c0392b', borderRadius: 20, padding: '7px 14px',
                background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.1em', color: '#c0392b', flexShrink: 0,
              }}
            >
              CLEAR ALL
            </button>
          )}
        </div>
      </div>

      {/* Gig list */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '60px 0' }}>
          LOADING...
        </div>
      ) : filteredGigs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '60px 0' }}>
          {gigs.length === 0 ? 'NO OPEN GIGS' : 'NO MATCHING GIGS'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredGigs.map(gig => (
            <Link key={gig.id} href={`/gigs/${gig.id}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ border: '1px solid rgba(255,255,255,0.1)', background: '#0a0a0a', cursor: 'pointer', transition: 'border-color 0.2s' }} className="gig-card-hover">
                {/* Image */}
                {gig.image_url ? (
                  <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                    <img src={gig.image_url} alt={gig.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {gig.is_featured && (
                      <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: '#f6c55a', background: 'rgba(0,0,0,0.75)', border: '1px solid #f6c55a', padding: '2px 7px', letterSpacing: '0.14em' }}>
                        ★ FEATURED
                      </span>
                    )}
                  </div>
                ) : gig.is_featured ? (
                  <div style={{ padding: '10px 16px 0' }}>
                    <span style={{ fontSize: 9, color: '#f6c55a', border: '1px solid #f6c55a', padding: '2px 7px', letterSpacing: '0.14em' }}>★ FEATURED</span>
                  </div>
                ) : null}

                {/* Body */}
                <div style={{ padding: '14px 16px 16px' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', color: '#fff', lineHeight: 1.3, marginBottom: 8 }}>{gig.title}</p>
                  <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em', marginBottom: 12, lineHeight: 1.6 }}>
                    {[gig.company_name ?? gig.poster_name, gig.art_type, gig.location].filter(Boolean).join(' · ').toUpperCase()}
                  </p>
                  {gig.date_timeframe && (
                    <p style={{ fontSize: 10, color: '#666', letterSpacing: '0.06em', marginBottom: 12 }}>{gig.date_timeframe.toUpperCase()}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{formatBudget(gig.budget_min, gig.budget_max)}</span>
                    <span style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.08em' }}>{gig.interest_count} INTERESTED</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showSignUp && (
        <SignUpPrompt
          message="JOIN WOA TO POST A GIG"
          onClose={() => setShowSignUp(false)}
        />
      )}

      <FilterModal
        visible={activeModal === 'type'}
        title="SELECT ART TYPE"
        options={GIG_TYPES}
        selected={filterType || null}
        onSelect={(value) => setFilterType(value)}
        onClear={() => setFilterType('')}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'country'}
        title="SELECT COUNTRY"
        options={availableCountries}
        selected={countryFilter}
        onSelect={(value) => { setCountryFilter(value); setCityFilter(null) }}
        onClear={() => { setCountryFilter(null); setCityFilter(null) }}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'city'}
        title="SELECT CITY"
        options={availableCities}
        selected={cityFilter}
        onSelect={setCityFilter}
        onClear={() => setCityFilter(null)}
        onClose={() => setActiveModal(null)}
      />

      <style>{`
        .gig-row-hover:hover { padding-left: 12px !important; }
      `}</style>
    </div>
  )
}
