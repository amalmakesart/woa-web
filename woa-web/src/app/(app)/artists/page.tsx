'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SignUpPrompt } from '@/components/SignUpPrompt'

const DISCIPLINES = [
  'Photographer', 'Musician', 'Videographer', 'Model', 'Dancer', 'Filmmaker',
  'Visual Artist', 'Graphic Designer', 'Muralist', 'Actor', 'DJ', 'Tattoo Artist',
  'Fashion Designer', 'Animator', 'Illustrator', 'Writer', 'Chef', 'Makeup Artist',
  'Hair Stylist', 'Sculptor', 'Ceramicist', 'Textile Artist', 'Painter',
  'Choreographer', 'Singer', 'Producer', 'Interdisciplinary Artist',
]

interface Artist {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  art_type: string | null
  art_types: string[] | null
  discipline: string | null
  city: string | null
  country: string | null
  follower_count: number
  is_verified: boolean
  is_available: boolean
}

// ── Filter Modal (bottom sheet) ───────────────────────────────────────────────

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
        {/* Header */}
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

        {/* Options list */}
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
                borderBottom: '1px solid #111',
                background: 'none', border: 'none',
                borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#111',
                cursor: 'pointer',
                fontFamily: 'inherit',
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

// ── Filter Chip ───────────────────────────────────────────────────────────────

function Chip({
  label, active, onPress, onClear,
}: {
  label: string; active: boolean; onPress: () => void; onClear: () => void
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
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: '0.1em', color: active ? '#fff' : '#c0392b' }}>
        {label}
      </span>
      {active && <span style={{ color: '#fff', fontSize: 10 }}>✕</span>}
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ArtistsPage() {
  const router = useRouter()
  const [allArtists, setAllArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined)
  const [showSignUp, setShowSignUp] = useState(false)

  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [activeModal, setActiveModal] = useState<'country' | 'city' | 'discipline' | 'tag' | null>(null)
  const [search, setSearch] = useState('')

  const loadArtists = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, art_type, art_types, discipline, is_available, is_verified, profile_photo_url, city, country, follower_count')
      .in('role', ['ARTIST', 'COLLECTIVE'])
      .order('created_at', { ascending: false })
      .limit(300)
    const mapped = ((data as any[]) ?? []).map(a => ({
      ...a,
      art_types: a.art_types ?? [],
      discipline: a.discipline ?? null,
      is_available: a.is_available ?? false,
      is_verified: a.is_verified ?? false,
    }))
    setAllArtists(mapped as Artist[])
    setLoading(false)
  }, [])

  useEffect(() => { loadArtists() }, [loadArtists])

  // Dynamic filter options derived from loaded data
  const availableCountries = useMemo(() =>
    [...new Set(allArtists.map(a => a.country).filter(Boolean) as string[])].sort(),
    [allArtists]
  )
  const availableCities = useMemo(() => {
    const source = countryFilter ? allArtists.filter(a => a.country === countryFilter) : allArtists
    return [...new Set(source.map(a => a.city).filter(Boolean) as string[])].sort()
  }, [allArtists, countryFilter])
  const availableDisciplines = useMemo(() =>
    DISCIPLINES.filter(d => allArtists.some(a =>
      a.discipline?.toLowerCase() === d.toLowerCase() ||
      a.art_type?.toLowerCase() === d.toLowerCase()
    )),
    [allArtists]
  )
  const availableTags = useMemo(() =>
    [...new Set(allArtists.flatMap(a => a.art_types ?? []))].sort(),
    [allArtists]
  )

  // Apply filters
  const displayed = useMemo(() => {
    let result = allArtists
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.username?.toLowerCase().includes(q) ||
        a.full_name?.toLowerCase().includes(q) ||
        a.art_type?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q)
      )
    }
    if (countryFilter) result = result.filter(a => a.country === countryFilter)
    if (cityFilter) result = result.filter(a => a.city === cityFilter)
    if (disciplineFilter) result = result.filter(a =>
      a.discipline?.toLowerCase() === disciplineFilter.toLowerCase() ||
      a.art_type?.toLowerCase() === disciplineFilter.toLowerCase()
    )
    if (tagFilter) result = result.filter(a =>
      (a.art_types ?? []).some(t => t.toLowerCase() === tagFilter.toLowerCase())
    )
    if (availableOnly) result = result.filter(a => a.is_available)
    if (verifiedOnly) result = result.filter(a => a.is_verified)
    return result
  }, [allArtists, search, countryFilter, cityFilter, disciplineFilter, tagFilter, availableOnly, verifiedOnly])

  function shuffle() {
    setAllArtists(prev => {
      const a = [...prev]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
      }
      return a
    })
  }

  function resetFilters() {
    setCountryFilter(null); setCityFilter(null)
    setDisciplineFilter(null); setTagFilter(null)
    setAvailableOnly(false); setVerifiedOnly(false)
    setSearch('')
  }

  const hasFilters = !!(countryFilter || cityFilter || disciplineFilter || tagFilter)
  const border = '1px solid #111111'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* TOP BAR */}
      <div style={{ borderBottom: border, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ fontSize: 13, letterSpacing: '0.18em', fontWeight: 400 }}>ARTIST DIRECTORY</h1>
        <button
          onClick={() => router.push('/search')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          ⌕ SEARCH
        </button>
      </div>

      {/* SEARCH BAR */}
      <div style={{ borderBottom: border, padding: '8px 12px', flexShrink: 0 }}>
        <input
          className="woa-input"
          placeholder="SEARCH ARTISTS..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 11 }}
        />
      </div>

      {/* FILTER CHIP ROW */}
      <div style={{ borderBottom: border, display: 'flex', alignItems: 'center', paddingRight: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', gap: 8, padding: '10px 12px', overflowX: 'auto', alignItems: 'center' }}>
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
          <Chip
            label={disciplineFilter ? disciplineFilter.toUpperCase() : 'DISCIPLINE'}
            active={!!disciplineFilter}
            onPress={() => setActiveModal('discipline')}
            onClear={() => setDisciplineFilter(null)}
          />
          <Chip
            label={tagFilter ? tagFilter.toUpperCase() : 'TAG'}
            active={!!tagFilter}
            onPress={() => setActiveModal('tag')}
            onClear={() => setTagFilter(null)}
          />
          {hasFilters && (
            <button
              onClick={resetFilters}
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

        {/* Shuffle button */}
        <button
          onClick={shuffle}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#c0392b', border: 'none',
            cursor: 'pointer', color: '#fff', fontSize: 16, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Shuffle"
        >
          ⇌
        </button>
      </div>

      {/* TOGGLE ROW — Available + Verified */}
      <div style={{ borderBottom: border, display: 'flex', flexShrink: 0 }}>
        <button
          onClick={() => setAvailableOnly(v => !v)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 0',
            background: availableOnly ? '#001a0a' : 'transparent',
            border: 'none', borderRight: border,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: availableOnly ? '#2a7a4f' : '#333', display: 'inline-block' }} />
          <span style={{ fontSize: 10, letterSpacing: '0.12em', color: availableOnly ? '#2a7a4f' : '#9a9a9a' }}>AVAILABLE</span>
        </button>
        <button
          onClick={() => setVerifiedOnly(v => !v)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 0',
            background: verifiedOnly ? '#0a0800' : 'transparent',
            border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 12, color: verifiedOnly ? '#f6c55a' : '#555' }}>✓</span>
          <span style={{ fontSize: 10, letterSpacing: '0.12em', color: verifiedOnly ? '#f6c55a' : '#9a9a9a' }}>VERIFIED ONLY</span>
        </button>
      </div>

      {/* COUNT ROW */}
      <div style={{ borderBottom: border, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.15em', color: '#b5b5b5' }}>{displayed.length} ARTISTS FOUND</span>
      </div>

      {/* GRID */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#111' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ aspectRatio: '1/1', background: '#1a1a1a' }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 20px' }}>
            <span style={{ fontSize: 12, letterSpacing: '0.2em', color: '#fff' }}>NO ARTISTS FOUND</span>
            <span style={{ fontSize: 10, letterSpacing: '0.15em', color: '#b5b5b5' }}>TRY ADJUSTING YOUR FILTERS</span>
            <button onClick={resetFilters} className="btn-red" style={{ marginTop: 8, padding: '8px 16px', fontSize: 10 }}>
              RESET FILTERS
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {displayed.map(artist => (
              <div
                key={artist.id}
                onClick={() => {
                  if (currentUserId) router.push(`/artists/${artist.id}`)
                  else setShowSignUp(true)
                }}
                style={{ textDecoration: 'none', display: 'block', cursor: 'pointer' }}
              >
                <div
                  style={{ position: 'relative', aspectRatio: '1/1', overflow: 'hidden', background: '#1a1a1a', cursor: 'pointer' }}
                  className="artist-card-hover"
                >
                  {artist.profile_photo_url ? (
                    <img
                      src={artist.profile_photo_url}
                      alt={artist.username ?? ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75)', transition: 'filter 0.3s, transform 0.4s' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'rgba(255,255,255,0.1)' }}>◈</div>
                  )}

                  {/* Available dot */}
                  {artist.is_available && (
                    <span style={{ position: 'absolute', top: 8, left: 8, width: 7, height: 7, borderRadius: '50%', background: '#2a7a4f', display: 'block' }} />
                  )}

                  {/* Verified */}
                  {artist.is_verified && (
                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: '#f6c55a' }}>✓</span>
                  )}

                  {/* Info overlay */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 8px 8px', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)' }}>
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#fff', marginBottom: 2 }}>
                      {(artist.username ?? artist.full_name ?? '').toUpperCase()}
                    </span>
                    {(artist.discipline ?? artist.art_type) && (
                      <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.08em' }}>
                        {(artist.discipline ?? artist.art_type ?? '').toUpperCase()}
                      </span>
                    )}
                  </div>

                  {artist.city && (
                    <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 9, color: '#c0392b', letterSpacing: '0.06em' }}>
                      {artist.city.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Modals */}
      <FilterModal
        visible={activeModal === 'country'} title="SELECT COUNTRY"
        options={availableCountries} selected={countryFilter}
        onSelect={c => { setCountryFilter(c); setCityFilter(null) }}
        onClear={() => { setCountryFilter(null); setCityFilter(null) }}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'city'} title="SELECT CITY"
        options={availableCities} selected={cityFilter}
        onSelect={setCityFilter} onClear={() => setCityFilter(null)}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'discipline'} title="SELECT DISCIPLINE"
        options={availableDisciplines} selected={disciplineFilter}
        onSelect={setDisciplineFilter} onClear={() => setDisciplineFilter(null)}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'tag'} title="SELECT TAG"
        options={availableTags} selected={tagFilter}
        onSelect={setTagFilter} onClear={() => setTagFilter(null)}
        onClose={() => setActiveModal(null)}
      />

      {showSignUp && (
        <SignUpPrompt
          message="JOIN WOA TO VIEW ARTIST PROFILES"
          onClose={() => setShowSignUp(false)}
        />
      )}

      <style>{`
        .artist-card-hover:hover img { filter: brightness(0.55) !important; transform: scale(1.04); }
      `}</style>
    </div>
  )
}
