'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  art_type: string | null
  city: string | null
  country: string | null
  role: string | null
  follower_count: number
  rating: number | null
  rating_count: number
  is_verified: boolean
}

interface Post {
  id: string
  type: string
  media_url: string | null
  title: string | null
  like_count: number
  created_at: string
}

const MENU = [
  { label: 'MY POSTS', href: '/profile/posts' },
  { label: 'BOOKMARKS', href: '/profile/bookmarks' },
  { label: 'EDIT PROFILE', href: '/profile/edit' },
  { label: 'SETTINGS', href: '/profile/settings' },
]

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [postCount, setPostCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [showVerifiedCheckout, setShowVerifiedCheckout] = useState(false)
  const [checkoutVersion] = useState(() => Date.now().toString())
  const [profileTab, setProfileTab] = useState<'posts' | 'portfolio' | 'shows'>('posts')
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [shows, setShows] = useState<any[]>([])

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: prof }, { data: ownedPosts, count }, { count: followCount }, { data: collaboratorRows }, { data: portfolioData }, { data: showsData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('posts').select('id, type, media_url, title, like_count, created_at', { count: 'exact' })
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
      supabase.from('post_collaborators').select('post_id').eq('collaborator_id', user.id).eq('accepted', true),
      supabase.from('portfolio_sections').select('id, title, cover_image_url, display_order').eq('artist_id', user.id).order('display_order'),
      supabase.from('shows').select('*').eq('artist_id', user.id).order('show_date', { ascending: false }).limit(40),
    ])

    const collaboratorPostIds = [...new Set((collaboratorRows ?? []).map((row: any) => row.post_id))]
    const { data: collaboratorPosts } = collaboratorPostIds.length > 0
      ? await supabase
          .from('posts')
          .select('id, type, media_url, title, like_count, created_at')
          .in('id', collaboratorPostIds)
          .order('created_at', { ascending: false })
          .limit(12)
      : { data: [] as any[] }

    const recentPosts = [...((ownedPosts as Post[]) ?? []), ...((collaboratorPosts as Post[]) ?? [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12)

    setProfile(prof as Profile)
    setPosts(recentPosts)
    setPostCount(count ?? 0)
    setFollowingCount(followCount ?? 0)
    setPortfolio((portfolioData as any[]) ?? [])
    setShows((showsData as any[]) ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  // Listen for verified payment success from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data?.type === 'verified_success') {
          setShowVerifiedCheckout(false)
          loadData()
        }
      } catch {}
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [loadData])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
        LOADING...
      </div>
    )
  }

  if (!profile) return null

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px' }}>
      {/* Profile header */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 32 }}>
        {profile.profile_photo_url ? (
          <img
            src={profile.profile_photo_url}
            alt={profile.username ?? ''}
            className="oct-avatar"
            style={{ width: 80, height: 80, flexShrink: 0 }}
          />
        ) : (
          <div
            className="oct-avatar"
            style={{
              width: 80,
              height: 80,
              background: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: '#888880',
              flexShrink: 0,
            }}
          >
            ◯
          </div>
        )}

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' }}>
              {(profile.username ?? profile.full_name ?? '').toUpperCase()}
            </h1>
            {profile.is_verified && (
              <span style={{ fontSize: 10, color: '#c0392b' }}>● VERIFIED</span>
            )}
          </div>

          {profile.full_name && profile.username && (
            <p style={{ fontSize: 12, color: '#888880', letterSpacing: '0.08em', marginBottom: 4 }}>
              {profile.full_name}
            </p>
          )}

          {profile.art_type && (
            <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.1em', marginBottom: 4 }}>
              {profile.art_type.toUpperCase()}
            </p>
          )}

          {(profile.city || profile.country) && (
            <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em', marginBottom: 12 }}>
              {[profile.city, profile.country].filter(Boolean).join(', ').toUpperCase()}
            </p>
          )}

          {/* Stats */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, display: 'block' }}>{postCount}</span>
              <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.1em' }}>POSTS</span>
            </div>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, display: 'block' }}>{profile.follower_count}</span>
              <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.1em' }}>FOLLOWERS</span>
            </div>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, display: 'block' }}>{followingCount}</span>
              <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.1em' }}>FOLLOWING</span>
            </div>
            {profile.rating && (
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, display: 'block' }}>{profile.rating.toFixed(1)}</span>
                <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.1em' }}>RATING</span>
              </div>
            )}
          </div>

          <Link href="/profile/edit" className="btn-primary" style={{ padding: '8px 20px', fontSize: 10, letterSpacing: '0.12em' }}>
            EDIT PROFILE
          </Link>
        </div>
      </div>

      {/* Profile tabs */}
      {profile && (profile.role === 'ARTIST' || profile.role === 'COLLECTIVE') && (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 0 }}>
          {(['posts', 'portfolio', 'shows'] as const).map(t => (
            <button key={t} type="button" onClick={() => setProfileTab(t)}
              style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: profileTab === t ? '2px solid #c0392b' : '2px solid transparent', color: profileTab === t ? '#fff' : '#888880', fontSize: 10, letterSpacing: '0.14em', cursor: 'pointer', fontFamily: 'inherit', fontWeight: profileTab === t ? 700 : 400 }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Posts grid */}
      {(profileTab === 'posts' || (profile?.role !== 'ARTIST' && profile?.role !== 'COLLECTIVE')) && posts.length > 0 && (
        <div style={{ paddingTop: 24, marginBottom: 32 }}>
          <p className="woa-section-label">RECENT POSTS</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {posts.map(post => (
              <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ aspectRatio: '1/1', background: '#111', position: 'relative', overflow: 'hidden' }}>
                  {post.media_url && post.type === 'image' ? (
                    <img src={post.media_url} alt={post.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 24 }}>
                      {post.type === 'video' ? '▷' : post.type === 'audio' ? '♪' : '◻'}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio tab */}
      {profileTab === 'portfolio' && (
        <div style={{ paddingTop: 24, marginBottom: 32 }}>
          {portfolio.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#555', fontSize: 11, letterSpacing: '0.1em', padding: '40px 0' }}>NO PORTFOLIO SECTIONS YET — ADD THEM FROM THE APP</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {portfolio.map((section: any) => (
                <div key={section.id} style={{ border: '1px solid rgba(255,255,255,0.08)', padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
                  {section.cover_image_url ? (
                    <img src={section.cover_image_url} alt={section.title} style={{ width: 56, height: 56, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 56, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, color: '#333' }}>◈</div>
                  )}
                  <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>{section.title.toUpperCase()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shows tab */}
      {profileTab === 'shows' && (
        <div style={{ paddingTop: 24, marginBottom: 32 }}>
          {shows.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#555', fontSize: 11, letterSpacing: '0.1em', padding: '40px 0' }}>NO SHOWS ADDED YET — ADD THEM FROM THE APP</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {shows.map((show: any) => {
                const d = new Date(show.show_date)
                const isPast = d < new Date()
                return (
                  <div key={show.id} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: isPast ? 0.6 : 1 }}>
                    <div style={{ minWidth: 48, textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{d.getDate()}</span>
                      <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>{d.toLocaleString('en', { month: 'short' }).toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 2 }}>{show.title}</p>
                      <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em' }}>{[show.venue, show.city].filter(Boolean).join(' · ').toUpperCase()}</p>
                      {isPast && <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>PAST</span>}
                    </div>
                    {show.ticket_url && (
                      <a href={show.ticket_url} target="_blank" rel="noopener noreferrer" className="btn-red" style={{ fontSize: 9, padding: '4px 12px', alignSelf: 'flex-start', display: 'inline-block' }}>TICKETS ↗</a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Verified badge banner — artists only, not yet verified */}
      {profile.role !== 'GIG_POSTER' && !profile.is_verified && (
        <button
          onClick={() => {
            const meetsPost = postCount >= 6
            const meetsFollow = profile.follower_count + followingCount >= 15
            if (!meetsPost || !meetsFollow) {
              alert(
                `TO GET VERIFIED YOU NEED:\n` +
                `• ${meetsPost ? '✓' : '✗'} AT LEAST 6 POSTS (you have ${postCount})\n` +
                `• ${meetsFollow ? '✓' : '✗'} AT LEAST 15 TOTAL FOLLOWERS + FOLLOWING (you have ${profile.follower_count + followingCount})`
              )
              return
            }
            setShowVerifiedCheckout(true)
          }}
          style={{
            width: '100%', textAlign: 'left', background: '#0a0800',
            border: '1px solid #f6c55a', padding: '16px 20px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16, marginBottom: 24, fontFamily: 'inherit',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: '#f6c55a', border: '1px solid #f6c55a', padding: '2px 6px', letterSpacing: '0.1em', fontWeight: 700 }}>WOA ●</span>
              <span style={{ fontSize: 13, color: '#f6c55a', letterSpacing: '0.16em', fontWeight: 700 }}>GET VERIFIED</span>
            </div>
            <p style={{ fontSize: 10, color: '#d6b95a', letterSpacing: '0.08em', lineHeight: 1.6 }}>
              ONLY VERIFIED ARTISTS WILL BE SCOUTED & FEATURED BY WOA
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#f6c55a' }}>$30</p>
            <p style={{ fontSize: 9, color: '#d6b95a', letterSpacing: '0.08em' }}>ONE TIME</p>
          </div>
        </button>
      )}

      {/* Menu */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24 }}>
        {MENU.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12, letterSpacing: '0.1em', color: '#fff' }}>{item.label}</span>
              <span style={{ color: '#888880', fontSize: 18 }}>›</span>
            </div>
          </Link>
        ))}

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            width: '100%',
            fontFamily: 'inherit',
          } as React.CSSProperties}
        >
          <span style={{ fontSize: 12, letterSpacing: '0.1em', color: '#c0392b' }}>SIGN OUT</span>
          <span style={{ color: '#888880', fontSize: 18 }}>›</span>
        </button>
      </div>

      {/* Verified checkout modal */}
      {showVerifiedCheckout && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', flexDirection: 'column' }}
          onClick={e => { if (e.target === e.currentTarget) setShowVerifiedCheckout(false) }}
        >
          <div style={{ background: '#000', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 520, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#f6c55a' }}>GET VERIFIED</span>
              <button onClick={() => setShowVerifiedCheckout(false)} style={{ background: 'none', border: 'none', color: '#888880', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
            <iframe
              src={`https://workerofart.com/checkout/verified.html?v=${checkoutVersion}&user_id=${profile.id}`}
              style={{ flex: 1, border: 'none', background: '#000' }}
              title="Get Verified"
            />
          </div>
        </div>
      )}
    </div>
  )
}
