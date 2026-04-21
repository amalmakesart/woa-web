'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SignUpPrompt } from '@/components/SignUpPrompt'

interface Project {
  id: string
  user_id: string
  title: string
  description: string
  discipline: string | null
  location: string | null
  budget: string | null
  is_closed: boolean
  comment_count: number
  created_at: string
  profiles?: { username: string | null; profile_photo_url: string | null; art_type: string | null; discipline: string | null } | null
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'TODAY'
  if (d === 1) return 'YESTERDAY'
  if (d < 7) return d + 'D AGO'
  return Math.floor(d / 7) + 'W AGO'
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [canPost, setCanPost] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null)
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<'discipline' | 'country' | 'city' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).single()
        setCanPost((profile as any)?.role !== 'GIG_POSTER')
      }

      const { data } = await supabase
        .from('projects')
        .select('id, user_id, title, description, discipline, location, budget, is_closed, comment_count, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      const rows = (data as Project[]) ?? []

      if (rows.length > 0) {
        const userIds = [...new Set(rows.map(p => p.user_id))]
        const { data: profiles } = await supabase
          .from('profiles').select('id, username, profile_photo_url, art_type, discipline').in('id', userIds)
        const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
        setProjects(rows.map(r => ({ ...r, profiles: pMap[r.user_id] ?? null })))
      } else {
        setProjects([])
      }
    } catch (e) {
      console.error('Failed to load projects:', e)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handlePostClick() {
    if (!currentUserId) { setShowSignUp(true); return }
    if (!canPost) { window.alert('ONLY ARTISTS AND COLLECTIVES CAN POST COLLABS.'); return }
    router.push('/projects/new')
  }

  const availableDisciplines = useMemo(() =>
    [...new Set(projects.map((project) => project.discipline).filter(Boolean) as string[])].sort(),
    [projects]
  )

  const availableCountries = useMemo(() =>
    [...new Set(projects.map((project) => parseLocationParts(project.location).country).filter(Boolean) as string[])].sort(),
    [projects]
  )

  const availableCities = useMemo(() => {
    const source = countryFilter
      ? projects.filter((project) => parseLocationParts(project.location).country === countryFilter)
      : projects
    return [...new Set(source.map((project) => parseLocationParts(project.location).city).filter(Boolean) as string[])].sort()
  }, [projects, countryFilter])

  const displayedProjects = useMemo(() => projects.filter((project) => {
    const location = parseLocationParts(project.location)
    if (disciplineFilter && project.discipline !== disciplineFilter) return false
    if (countryFilter && location.country !== countryFilter) return false
    if (cityFilter && location.city !== cityFilter) return false
    return true
  }), [projects, disciplineFilter, countryFilter, cityFilter])

  const hasFilters = !!(disciplineFilter || countryFilter || cityFilter)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px' }}>
      <div
        style={{
          position: 'sticky', top: 0,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)',
          zIndex: 10, padding: '16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>COLLAB</h1>
          <button
            onClick={handlePostClick}
            className="btn-red"
            style={{ fontSize: 10, padding: '6px 14px', cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
          >
            POST A COLLAB ↗
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#f5c842', letterSpacing: '0.1em' }}>
          COLLAB — ARTISTS AND COLLECTIVES POST PROJECTS, FIND HELP, AND BUILD CREATIVE TEAMS.
        </p>
      </div>

      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', paddingBottom: 18, marginBottom: 8 }}>
        <div style={{ flex: 1, display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'center' }}>
          <Chip
            label={disciplineFilter ? disciplineFilter.toUpperCase() : 'DISCIPLINE'}
            active={!!disciplineFilter}
            onPress={() => setActiveModal('discipline')}
            onClear={() => setDisciplineFilter(null)}
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
              onClick={() => { setDisciplineFilter(null); setCountryFilter(null); setCityFilter(null) }}
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

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '60px 0' }}>
          LOADING...
        </div>
      ) : displayedProjects.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '60px 0' }}>
          {projects.length === 0 ? 'NO COLLABS YET — BE THE FIRST TO POST' : 'NO MATCHING COLLABS'}
        </div>
      ) : (
        displayedProjects.map(project => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div
              style={{
                padding: '24px 0',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                transition: 'padding-left 0.2s',
              }}
              className="project-row-hover"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {project.profiles?.profile_photo_url ? (
                  <img src={project.profiles.profile_photo_url} alt="" className="oct-avatar" style={{ width: 28, height: 28, flexShrink: 0 }} />
                ) : (
                  <div className="oct-avatar" style={{ width: 28, height: 28, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 10, flexShrink: 0 }}>◯</div>
                )}
                <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>
                  {(project.profiles?.username ?? 'UNKNOWN').toUpperCase()}
                  {(project.profiles?.discipline ?? project.profiles?.art_type)
                    ? ` · ${(project.profiles?.discipline ?? project.profiles?.art_type)?.toUpperCase()}`
                    : ''}
                  {' · ' + timeAgo(project.created_at)}
                </span>
              </div>

              <span style={{ display: 'block', fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2, marginBottom: 8, color: '#fff' }}>
                {project.title}
              </span>

              <p style={{ fontSize: 12, color: '#888880', lineHeight: 1.6, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                {project.description}
              </p>

              {(project.discipline || project.location) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {project.discipline ? (
                    <span style={{ fontSize: 9, color: '#c0392b', letterSpacing: '0.1em' }}>
                      {project.discipline.toUpperCase()}
                    </span>
                  ) : null}
                  {project.location ? (
                    <span style={{ fontSize: 9, color: '#c0392b', letterSpacing: '0.1em' }}>
                      {project.location.toUpperCase()}
                    </span>
                  ) : null}
                </div>
              )}

              {project.budget && (
                <div style={{ fontSize: 10, color: '#f5c842', letterSpacing: '0.08em', marginBottom: 10 }}>
                  BUDGET: {project.budget.toUpperCase()}
                </div>
              )}

              {project.is_closed && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.12em', border: '1px solid rgba(255,255,255,0.16)', padding: '3px 8px' }}>
                    CLOSED
                  </span>
                </div>
              )}

              <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em' }}>
                {project.comment_count} {project.comment_count === 1 ? 'COMMENT' : 'COMMENTS'}
              </span>
            </div>
          </Link>
        ))
      )}

      {showSignUp && (
        <SignUpPrompt message="JOIN WOA TO POST A COLLAB" onClose={() => setShowSignUp(false)} />
      )}

      <FilterModal
        visible={activeModal === 'discipline'}
        title="SELECT DISCIPLINE"
        options={availableDisciplines}
        selected={disciplineFilter}
        onSelect={setDisciplineFilter}
        onClear={() => setDisciplineFilter(null)}
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

      <style>{`.project-row-hover:hover { padding-left: 12px !important; }`}</style>
    </div>
  )
}
