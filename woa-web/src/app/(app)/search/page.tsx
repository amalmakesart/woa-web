'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

type SearchTab = 'artists' | 'gigs' | 'posts'

interface Artist {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  art_type: string | null
  city: string | null
  country: string | null
  is_available: boolean
  is_verified: boolean
  follower_count: number
}

interface Gig {
  id: string
  title: string
  venue: string | null
  city: string | null
  country: string | null
  gig_date: string | null
  budget_min: number | null
  budget_max: number | null
  art_type: string | null
  is_open: boolean
}

interface Post {
  id: string
  user_id: string
  type: string
  title: string | null
  content: string | null
  media_url: string | null
  like_count: number
  created_at: string
  profiles?: { username: string | null; profile_photo_url: string | null } | null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'NOW'
  if (m < 60) return m + 'M'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'H'
  const d = Math.floor(h / 24)
  return d + 'D'
}

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<SearchTab>('artists')
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [artists, setArtists] = useState<Artist[]>([])
  const [gigs, setGigs] = useState<Gig[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    const supabase = createClient()
    const term = q.trim()

    const [{ data: artistData }, { data: gigData }, { data: postData }] = await Promise.all([
      supabase.from('profiles')
        .select('id, username, full_name, profile_photo_url, art_type, city, country, is_available, is_verified, follower_count')
        .neq('role', 'GIG_POSTER')
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%,art_type.ilike.%${term}%,city.ilike.%${term}%,bio.ilike.%${term}%`)
        .limit(30),
      supabase.from('gigs')
        .select('id, title, venue, city, country, gig_date, budget_min, budget_max, art_type, is_open')
        .or(`title.ilike.%${term}%,venue.ilike.%${term}%,city.ilike.%${term}%,art_type.ilike.%${term}%,description.ilike.%${term}%`)
        .eq('is_open', true)
        .limit(30),
      supabase.from('posts')
        .select('id, user_id, type, title, content, media_url, like_count, created_at')
        .or(`title.ilike.%${term}%,content.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    setArtists((artistData as Artist[]) ?? [])
    setGigs((gigData as Gig[]) ?? [])

    const rawPosts = (postData as Post[]) ?? []
    if (rawPosts.length > 0) {
      const userIds = [...new Set(rawPosts.map(p => p.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, username, profile_photo_url').in('id', userIds)
      const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
      setPosts(rawPosts.map(p => ({ ...p, profiles: pMap[p.user_id] ?? null })))
    } else {
      setPosts([])
    }

    setLoading(false)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    doSearch(query)
  }

  const TABS: { key: SearchTab; label: string; count: number }[] = [
    { key: 'artists', label: 'ARTISTS', count: artists.length },
    { key: 'gigs', label: 'GIGS', count: gigs.length },
    { key: 'posts', label: 'POSTS', count: posts.length },
  ]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', marginBottom: 20 }}>SEARCH</h1>

      {/* Search bar */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          className="woa-input"
          style={{ flex: 1 }}
          placeholder="SEARCH ARTISTS, GIGS, POSTS..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn-primary" style={{ padding: '12px 20px', flexShrink: 0 }} disabled={loading || !query.trim()}>
          {loading ? '...' : 'SEARCH'}
        </button>
      </form>

      {!searched ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.2em', marginBottom: 8 }}>DISCOVER ARTISTS, GIGS & POSTS</p>
          <p style={{ fontSize: 10, letterSpacing: '0.1em', color: '#444' }}>TYPE ABOVE TO SEARCH</p>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>SEARCHING...</div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: tab === t.key ? '2px solid #c0392b' : '2px solid transparent',
                  color: tab === t.key ? '#fff' : '#888880',
                  fontSize: 10, letterSpacing: '0.14em',
                  padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: tab === t.key ? 700 : 400,
                  marginBottom: -1,
                }}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {/* Results */}
          {tab === 'artists' && (
            <div>
              {artists.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: 11, letterSpacing: '0.1em' }}>NO ARTISTS FOUND</p>
              ) : artists.map(artist => (
                <Link key={artist.id} href={`/artists/${artist.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="search-row">
                    {artist.profile_photo_url ? (
                      <img src={artist.profile_photo_url} alt="" className="oct-avatar" style={{ width: 44, height: 44, flexShrink: 0 }} />
                    ) : (
                      <div className="oct-avatar" style={{ width: 44, height: 44, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', flexShrink: 0 }}>◯</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
                          {(artist.full_name ?? artist.username ?? '').toUpperCase()}
                        </span>
                        {artist.is_verified && <span style={{ fontSize: 9, color: '#c0392b' }}>✓</span>}
                        {artist.is_available && <span style={{ fontSize: 8, color: '#2ecc71', background: 'rgba(46,204,113,0.1)', padding: '1px 5px', letterSpacing: '0.06em' }}>AVAIL</span>}
                      </div>
                      {artist.art_type && <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>{artist.art_type.toUpperCase()}</span>}
                      {(artist.city || artist.country) && (
                        <span style={{ display: 'block', fontSize: 10, color: '#555', letterSpacing: '0.06em' }}>
                          {[artist.city, artist.country].filter(Boolean).join(', ').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.06em', flexShrink: 0 }}>›</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {tab === 'gigs' && (
            <div>
              {gigs.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: 11, letterSpacing: '0.1em' }}>NO GIGS FOUND</p>
              ) : gigs.map(gig => (
                <Link key={gig.id} href={`/gigs/${gig.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="search-row">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#fff', marginBottom: 4 }}>
                          {gig.title.toUpperCase()}
                        </p>
                        {gig.venue && (
                          <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em', marginBottom: 2 }}>{gig.venue.toUpperCase()}</p>
                        )}
                        {(gig.city || gig.country) && (
                          <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.06em' }}>
                            {[gig.city, gig.country].filter(Boolean).join(', ').toUpperCase()}
                          </p>
                        )}
                      </div>
                      {(gig.budget_min || gig.budget_max) && (
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <p style={{ fontSize: 11, color: '#c0392b', fontWeight: 700 }}>
                            {gig.budget_min && gig.budget_max
                              ? `$${gig.budget_min}–$${gig.budget_max}`
                              : gig.budget_min ? `FROM $${gig.budget_min}` : `UP TO $${gig.budget_max}`}
                          </p>
                        </div>
                      )}
                    </div>
                    {gig.art_type && (
                      <span style={{ display: 'inline-block', marginTop: 6, fontSize: 9, color: '#c0392b', border: '1px solid rgba(192,57,43,0.3)', padding: '2px 8px', letterSpacing: '0.08em' }}>
                        {gig.art_type.toUpperCase()}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {tab === 'posts' && (
            <div>
              {posts.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: 11, letterSpacing: '0.1em' }}>NO POSTS FOUND</p>
              ) : posts.map(post => (
                <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }} className="search-row">
                    <div style={{ width: 56, height: 56, background: '#111', flexShrink: 0, overflow: 'hidden' }}>
                      {post.type === 'image' && post.media_url ? (
                        <img src={post.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 20 }}>
                          {post.type === 'audio' ? '♪' : post.type === 'video' ? '▷' : '◻'}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {post.profiles?.username && (
                        <span style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>
                          @{post.profiles.username.toUpperCase()}
                        </span>
                      )}
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.04em', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.title ?? (post.content?.slice(0, 50) ?? 'UNTITLED').toUpperCase()}
                      </p>
                      <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.06em' }}>♥ {post.like_count} · {timeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`.search-row:hover { opacity: 0.75; }`}</style>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>}>
      <SearchContent />
    </Suspense>
  )
}
