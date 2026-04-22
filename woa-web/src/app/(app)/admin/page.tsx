'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/admin'

type AdminTab = 'reports' | 'posts' | 'gigs' | 'projects' | 'features' | 'artists'

type ProfileLite = {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  role?: string | null
}

type ReportRow = {
  id: string
  reporter_id: string | null
  target_type: string
  target_id: string
  target_user_id: string | null
  reason: string | null
  status: string
  created_at: string
}

type PostRow = {
  id: string
  user_id: string
  title: string | null
  content: string | null
  type: string
  is_pinned: boolean
  like_count: number
  comment_count: number
  created_at: string
}

type GigRow = {
  id: string
  poster_id: string
  title: string
  status: string
  is_featured: boolean
  interest_count: number
  location: string | null
  created_at: string
}

type ProjectRow = {
  id: string
  user_id: string
  title: string
  is_closed: boolean
  comment_count: number
  location: string | null
  created_at: string
}

type FeatureRow = {
  id: string
  artist_id: string | null
  title: string
  thumbnail_url: string | null
  created_at: string
}

type ArtistRow = {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  role: string | null
  is_verified: boolean | null
  follower_count: number | null
  city: string | null
  country: string | null
  created_at: string
}

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'reports', label: 'REPORTS' },
  { key: 'posts', label: 'POSTS' },
  { key: 'gigs', label: 'GIGS' },
  { key: 'projects', label: 'COLLABS' },
  { key: 'features', label: 'FEATURES' },
  { key: 'artists', label: 'ARTISTS' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'NOW'
  if (m < 60) return `${m}M`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}H`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}D`
  return `${Math.floor(d / 7)}W`
}

function displayName(profile?: ProfileLite | ArtistRow | null) {
  if (!profile) return 'UNKNOWN'
  return (profile.username ? `@${profile.username}` : profile.full_name ?? 'UNKNOWN').toUpperCase()
}

function AdminButton({
  children,
  onClick,
  danger,
  gold,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
  gold?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${danger ? '#c0392b' : gold ? '#f5c842' : 'rgba(255,255,255,0.14)'}`,
        color: danger ? '#c0392b' : gold ? '#f5c842' : '#fff',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 10,
        letterSpacing: '0.12em',
        padding: '8px 10px',
      }}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.09)', padding: 14, background: '#050505' }}>
      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ color: '#888880', fontSize: 10, letterSpacing: '0.14em', marginTop: 5 }}>{label}</div>
    </div>
  )
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('reports')
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileMap, setProfileMap] = useState<Record<string, ProfileLite>>({})
  const [reports, setReports] = useState<ReportRow[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
  const [gigs, setGigs] = useState<GigRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [features, setFeatures] = useState<FeatureRow[]>([])
  const [artists, setArtists] = useState<ArtistRow[]>([])

  const stats = useMemo(() => ({
    reports: reports.filter((report) => report.status === 'open').length,
    posts: posts.length,
    gigs: gigs.filter((gig) => gig.status === 'active').length,
    projects: projects.filter((project) => !project.is_closed).length,
    artists: artists.length,
  }), [artists.length, gigs, posts.length, projects, reports])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const [
        reportsResult,
        postsResult,
        gigsResult,
        projectsResult,
        featuresResult,
        artistsResult,
      ] = await Promise.all([
        supabase.from('reports').select('id, reporter_id, target_type, target_id, target_user_id, reason, status, created_at').order('created_at', { ascending: false }).limit(80),
        supabase.from('posts').select('id, user_id, title, content, type, is_pinned, like_count, comment_count, created_at').order('created_at', { ascending: false }).limit(80),
        supabase.from('gigs').select('id, poster_id, title, status, is_featured, interest_count, location, created_at').order('created_at', { ascending: false }).limit(80),
        supabase.from('projects').select('id, user_id, title, is_closed, comment_count, location, created_at').order('created_at', { ascending: false }).limit(80),
        supabase.from('features').select('id, artist_id, title, thumbnail_url, created_at').order('created_at', { ascending: false }).limit(80),
        supabase.from('profiles').select('id, username, full_name, profile_photo_url, role, is_verified, follower_count, city, country, created_at').order('created_at', { ascending: false }).limit(120),
      ])

      const firstError = [reportsResult, postsResult, gigsResult, projectsResult, featuresResult, artistsResult].find((result) => result.error)?.error
      if (firstError) throw firstError

      const nextReports = (reportsResult.data as ReportRow[]) ?? []
      const nextPosts = (postsResult.data as PostRow[]) ?? []
      const nextGigs = (gigsResult.data as GigRow[]) ?? []
      const nextProjects = (projectsResult.data as ProjectRow[]) ?? []
      const nextFeatures = (featuresResult.data as FeatureRow[]) ?? []
      const nextArtists = (artistsResult.data as ArtistRow[]) ?? []

      const ids = [...new Set([
        ...nextReports.flatMap((row) => [row.reporter_id, row.target_user_id]),
        ...nextPosts.map((row) => row.user_id),
        ...nextGigs.map((row) => row.poster_id),
        ...nextProjects.map((row) => row.user_id),
        ...nextFeatures.map((row) => row.artist_id),
        ...nextArtists.map((row) => row.id),
      ].filter(Boolean))] as string[]

      const nextProfileMap: Record<string, ProfileLite> = {}
      if (ids.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name, profile_photo_url, role')
          .in('id', ids)
        if (profilesError) throw profilesError
        ;((profiles as ProfileLite[]) ?? []).forEach((profile) => {
          nextProfileMap[profile.id] = profile
        })
      }

      setReports(nextReports)
      setPosts(nextPosts)
      setGigs(nextGigs)
      setProjects(nextProjects)
      setFeatures(nextFeatures)
      setArtists(nextArtists)
      setProfileMap(nextProfileMap)
    } catch (err: any) {
      setError(err?.message ?? 'Could not load admin data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const admin = isAdminEmail(user?.email)
      setAllowed(admin)
      setChecking(false)
      if (admin) await loadData()
    }
    checkAdmin()
  }, [loadData])

  async function updateReport(id: string, status: 'open' | 'reviewed' | 'dismissed') {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('reports')
      .update({ status, reviewed_at: status === 'open' ? null : new Date().toISOString() })
      .eq('id', id)
    if (updateError) return window.alert(updateError.message.toUpperCase())
    setReports((prev) => prev.map((report) => report.id === id ? { ...report, status } : report))
  }

  async function deleteTarget(type: string, id: string) {
    const tableMap: Record<string, string> = {
      post: 'posts',
      gig: 'gigs',
      project: 'projects',
      feature: 'features',
    }
    const table = tableMap[type]
    if (!table) return window.alert('THIS TYPE CANNOT BE DELETED FROM HERE YET.')
    if (!window.confirm(`DELETE THIS ${type.toUpperCase()}? THIS CANNOT BE UNDONE.`)) return
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) return window.alert(deleteError.message.toUpperCase())
    await loadData()
  }

  async function deleteRow(table: 'posts' | 'gigs' | 'projects' | 'features', id: string, label: string) {
    if (!window.confirm(`DELETE THIS ${label}? THIS CANNOT BE UNDONE.`)) return
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) return window.alert(deleteError.message.toUpperCase())
    await loadData()
  }

  async function updateRow(table: 'posts' | 'gigs' | 'projects' | 'profiles', id: string, values: Record<string, any>) {
    const supabase = createClient()
    const { error: updateError } = await supabase.from(table).update(values).eq('id', id)
    if (updateError) return window.alert(updateError.message.toUpperCase())
    await loadData()
  }

  if (checking) {
    return <AdminShell><EmptyState text="CHECKING ADMIN ACCESS..." /></AdminShell>
  }

  if (!allowed) {
    return (
      <AdminShell>
        <div style={{ padding: 24, border: '1px solid rgba(255,255,255,0.1)', background: '#050505' }}>
          <p className="woa-section-label">ADMIN</p>
          <h1 style={{ fontSize: 28, marginBottom: 10 }}>ACCESS RESTRICTED</h1>
          <p style={{ color: '#888880', fontSize: 13, lineHeight: 1.7 }}>
            Sign in as the WOA admin account to manage reports, posts, gigs, collabs, features, and artists.
          </p>
          <Link href="/login" className="btn-red" style={{ display: 'inline-block', marginTop: 18, fontSize: 11 }}>
            LOG IN
          </Link>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      <header style={{ padding: '22px 0 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="woa-section-label">CONTROL ROOM</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 32, letterSpacing: '-0.03em', margin: '6px 0' }}>WOA ADMIN</h1>
            <p style={{ color: '#888880', fontSize: 12, letterSpacing: '0.08em' }}>
              MODERATE CONTENT, REVIEW REPORTS, AND KEEP THE STACK CLEAN.
            </p>
          </div>
          <AdminButton onClick={loadData} gold>REFRESH</AdminButton>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, padding: '18px 0' }}>
        <StatCard label="OPEN REPORTS" value={stats.reports} />
        <StatCard label="RECENT POSTS" value={stats.posts} />
        <StatCard label="ACTIVE GIGS" value={stats.gigs} />
        <StatCard label="OPEN COLLABS" value={stats.projects} />
        <StatCard label="ARTISTS" value={stats.artists} />
      </section>

      <nav style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 18 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #c0392b' : '2px solid transparent',
              color: activeTab === tab.key ? '#fff' : '#888880',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.14em',
              padding: '10px 14px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? <div style={{ color: '#c0392b', fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>{error.toUpperCase()}</div> : null}
      {loading ? <EmptyState text="LOADING ADMIN DATA..." /> : null}

      {!loading && activeTab === 'reports' && (
        <AdminList
          emptyText="NO REPORTS YET"
          rows={reports.map((report) => ({
            id: report.id,
            eyebrow: `${report.target_type.toUpperCase()} REPORT · ${report.status.toUpperCase()} · ${timeAgo(report.created_at)}`,
            title: `${displayName(profileMap[report.target_user_id ?? ''])}`,
            meta: `REPORTED BY ${displayName(profileMap[report.reporter_id ?? ''])}`,
            body: report.reason ?? 'No reason provided.',
            href: hrefForTarget(report.target_type, report.target_id, report.target_user_id),
            actions: (
              <>
                <AdminButton onClick={() => updateReport(report.id, report.status === 'reviewed' ? 'open' : 'reviewed')} gold>
                  {report.status === 'reviewed' ? 'REOPEN' : 'REVIEWED'}
                </AdminButton>
                <AdminButton onClick={() => updateReport(report.id, 'dismissed')}>DISMISS</AdminButton>
                <AdminButton onClick={() => deleteTarget(report.target_type, report.target_id)} danger>DELETE TARGET</AdminButton>
              </>
            ),
          }))}
        />
      )}

      {!loading && activeTab === 'posts' && (
        <AdminList
          emptyText="NO POSTS"
          rows={posts.map((post) => ({
            id: post.id,
            eyebrow: `${post.type.toUpperCase()} · ${post.is_pinned ? 'PINNED · ' : ''}${timeAgo(post.created_at)}`,
            title: post.title ?? post.content?.slice(0, 70) ?? 'UNTITLED POST',
            meta: `${displayName(profileMap[post.user_id])} · ${post.like_count} LIKES · ${post.comment_count} COMMENTS`,
            href: `/feed/${post.id}`,
            actions: (
              <>
                <AdminButton onClick={() => updateRow('posts', post.id, { is_pinned: !post.is_pinned })} gold>
                  {post.is_pinned ? 'UNPIN' : 'PIN'}
                </AdminButton>
                <AdminButton onClick={() => deleteRow('posts', post.id, 'POST')} danger>DELETE</AdminButton>
              </>
            ),
          }))}
        />
      )}

      {!loading && activeTab === 'gigs' && (
        <AdminList
          emptyText="NO GIGS"
          rows={gigs.map((gig) => ({
            id: gig.id,
            eyebrow: `${gig.status.toUpperCase()} · ${gig.is_featured ? 'FEATURED · ' : ''}${timeAgo(gig.created_at)}`,
            title: gig.title,
            meta: `${displayName(profileMap[gig.poster_id])} · ${gig.location ?? 'NO LOCATION'} · ${gig.interest_count} INTERESTED`,
            href: `/gigs/${gig.id}`,
            actions: (
              <>
                <AdminButton onClick={() => updateRow('gigs', gig.id, { status: gig.status === 'closed' ? 'active' : 'closed' })}>
                  {gig.status === 'closed' ? 'REOPEN' : 'CLOSE'}
                </AdminButton>
                <AdminButton onClick={() => updateRow('gigs', gig.id, { is_featured: !gig.is_featured })} gold>
                  {gig.is_featured ? 'UNFEATURE' : 'FEATURE'}
                </AdminButton>
                <AdminButton onClick={() => deleteRow('gigs', gig.id, 'GIG')} danger>DELETE</AdminButton>
              </>
            ),
          }))}
        />
      )}

      {!loading && activeTab === 'projects' && (
        <AdminList
          emptyText="NO COLLABS"
          rows={projects.map((project) => ({
            id: project.id,
            eyebrow: `${project.is_closed ? 'CLOSED' : 'OPEN'} · ${timeAgo(project.created_at)}`,
            title: project.title,
            meta: `${displayName(profileMap[project.user_id])} · ${project.location ?? 'NO LOCATION'} · ${project.comment_count} COMMENTS`,
            href: `/projects/${project.id}`,
            actions: (
              <>
                <AdminButton onClick={() => updateRow('projects', project.id, { is_closed: !project.is_closed })}>
                  {project.is_closed ? 'REOPEN' : 'CLOSE'}
                </AdminButton>
                <AdminButton onClick={() => deleteRow('projects', project.id, 'COLLAB')} danger>DELETE</AdminButton>
              </>
            ),
          }))}
        />
      )}

      {!loading && activeTab === 'features' && (
        <AdminList
          emptyText="NO FEATURES"
          rows={features.map((feature) => ({
            id: feature.id,
            eyebrow: timeAgo(feature.created_at),
            title: feature.title,
            meta: `LINKED ARTIST: ${displayName(profileMap[feature.artist_id ?? ''])}`,
            href: '/features',
            actions: (
              <AdminButton onClick={() => deleteRow('features', feature.id, 'FEATURE')} danger>DELETE</AdminButton>
            ),
          }))}
        />
      )}

      {!loading && activeTab === 'artists' && (
        <AdminList
          emptyText="NO ARTISTS"
          rows={artists.map((artist) => ({
            id: artist.id,
            eyebrow: `${artist.role ?? 'ARTIST'} · ${artist.is_verified ? 'VERIFIED · ' : ''}${timeAgo(artist.created_at)}`,
            title: displayName(artist),
            meta: `${[artist.city, artist.country].filter(Boolean).join(', ') || 'NO LOCATION'} · ${artist.follower_count ?? 0} FOLLOWERS`,
            href: `/artists/${artist.id}`,
            avatar: artist.profile_photo_url,
            actions: (
              <AdminButton onClick={() => updateRow('profiles', artist.id, { is_verified: !artist.is_verified })} gold>
                {artist.is_verified ? 'UNVERIFY' : 'VERIFY'}
              </AdminButton>
            ),
          }))}
        />
      )}
    </AdminShell>
  )
}

function hrefForTarget(type: string, id: string, targetUserId: string | null) {
  if (type === 'profile' && targetUserId) return `/artists/${targetUserId}`
  if (type === 'post') return `/feed/${id}`
  if (type === 'gig') return `/gigs/${id}`
  if (type === 'project') return `/projects/${id}`
  if (type === 'feature') return '/features'
  return null
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 20px 42px' }}>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '56px 20px', textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.12em' }}>
      {text}
    </div>
  )
}

function AdminList({
  rows,
  emptyText,
}: {
  rows: {
    id: string
    eyebrow: string
    title: string
    meta: string
    body?: string
    href?: string | null
    avatar?: string | null
    actions: React.ReactNode
  }[]
  emptyText: string
}) {
  if (rows.length === 0) return <EmptyState text={emptyText} />

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((row) => (
        <article key={row.id} style={{ border: '1px solid rgba(255,255,255,0.09)', background: '#050505', padding: 14 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {row.avatar ? (
              <img src={row.avatar} alt="" className="oct-avatar" style={{ width: 42, height: 42, flexShrink: 0 }} />
            ) : (
              <div className="oct-avatar" style={{ width: 42, height: 42, flexShrink: 0, background: '#111' }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#c0392b', fontSize: 9, letterSpacing: '0.16em', marginBottom: 5 }}>
                {row.eyebrow}
              </div>
              {row.href ? (
                <Link href={row.href} style={{ color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                  {row.title.toUpperCase()}
                </Link>
              ) : (
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{row.title.toUpperCase()}</div>
              )}
              <div style={{ color: '#888880', fontSize: 11, letterSpacing: '0.06em', marginTop: 6 }}>
                {row.meta.toUpperCase()}
              </div>
              {row.body ? (
                <p style={{ color: '#b5b5b5', fontSize: 12, lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>
                  {row.body}
                </p>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {row.actions}
          </div>
        </article>
      ))}
    </div>
  )
}
