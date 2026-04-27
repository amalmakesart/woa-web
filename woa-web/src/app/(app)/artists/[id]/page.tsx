'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/admin'
import { WEBSITE_URL } from '@/lib/share'

type ProfileTab = 'posts' | 'portfolio' | 'calendar'

interface Profile {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  art_type: string | null
  art_types: string[] | null
  discipline: string | null
  city: string | null
  country: string | null
  bio: string | null
  experience: number | null
  instagram: string | null
  facebook: string | null
  website: string | null
  spotify_url: string | null
  is_available: boolean
  is_verified: boolean
  follower_count: number
  rating: number | null
  rating_count: number
  booked_count: number | null
  role: string | null
  collective_type: string | null
}

interface Post {
  id: string
  type: string
  media_url: string | null
  title: string | null
  like_count: number
  created_at: string
}

interface PortfolioSection {
  id: string
  title: string
  cover_image_url: string | null
  display_order: number
  items?: PortfolioItem[]
}

interface PortfolioItem {
  id: string
  post_id: string
  posts: { type: string; media_url: string | null; title: string | null }
}

interface Show {
  id: string
  title: string
  venue: string | null
  city: string | null
  show_date: string
  ticket_url: string | null
  description: string | null
}

interface Review {
  id: string
  rating: number
  body: string | null
  created_at: string
  profiles: { username: string | null; profile_photo_url: string | null } | null
}

interface FollowUser {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  art_type: string | null
  city: string | null
  country: string | null
  is_verified: boolean
}

export default function ArtistProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioSection[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [postCount, setPostCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [tab, setTab] = useState<ProfileTab>('posts')
  const [messagingLoading, setMessagingLoading] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null)
  const [followList, setFollowList] = useState<FollowUser[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      setIsAdmin(isAdminEmail(user?.email))
      if (user) {
        const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setCurrentUserRole((me as any)?.role ?? null)
      }

      const [
        { data: prof },
        { data: ownedPosts, count },
        { data: followData },
        { count: followingCountRaw },
        { data: portfolioData },
        { data: showsData },
        { data: reviewsData },
        { data: collaboratorRows },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('posts').select('id, type, media_url, title, like_count, created_at', { count: 'exact' })
          .eq('user_id', id).order('created_at', { ascending: false }).limit(30),
        user ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
        supabase.from('portfolio_sections').select('id, title, cover_image_url, display_order').eq('artist_id', id).order('display_order'),
        supabase.from('shows').select('*').eq('artist_id', id).order('show_date', { ascending: false }).limit(40),
        supabase.from('reviews').select('id, rating, body, created_at, profiles:reviewer_id(username, profile_photo_url)').eq('reviewee_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('post_collaborators').select('post_id').eq('collaborator_id', id).eq('accepted', true),
      ])

      const collaboratorPostIds = [...new Set((collaboratorRows ?? []).map((row: any) => row.post_id))]
      const { data: collaboratorPosts } = collaboratorPostIds.length > 0
        ? await supabase
            .from('posts')
            .select('id, type, media_url, title, like_count, created_at')
            .in('id', collaboratorPostIds)
            .order('created_at', { ascending: false })
            .limit(30)
        : { data: [] as any[] }

      const mergedPosts = [...((ownedPosts as Post[]) ?? []), ...((collaboratorPosts as Post[]) ?? [])]
      const uniquePosts = Array.from(new Map(mergedPosts.map(post => [post.id, post])).values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setProfile(prof as Profile)
      setPosts(uniquePosts)
      setPostCount(uniquePosts.length || count || 0)
      setIsFollowing(!!followData)
      setFollowingCount(followingCountRaw ?? 0)
      setShows((showsData as Show[]) ?? [])
      setReviews((reviewsData as unknown as Review[]) ?? [])

      // Load portfolio items
      if (portfolioData?.length) {
        const sections = portfolioData as PortfolioSection[]
        const itemsRes = await Promise.all(
          sections.map(s =>
            supabase.from('portfolio_items').select('id, post_id, posts(type, media_url, title)').eq('section_id', s.id).order('display_order')
          )
        )
        const enriched = sections.map((s, i) => ({ ...s, items: (itemsRes[i].data as unknown as PortfolioItem[]) ?? [] }))
        setPortfolio(enriched)
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function handleFollow() {
    if (!currentUserId) { router.push('/login'); return }
    const supabase = createClient()
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', id)
      setIsFollowing(false)
      setProfile(p => p ? { ...p, follower_count: p.follower_count - 1 } : p)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: id })
      setIsFollowing(true)
      setProfile(p => p ? { ...p, follower_count: p.follower_count + 1 } : p)
    }
  }

  async function handleMessage() {
    if (!currentUserId) { router.push('/login'); return }
    setMessagingLoading(true)
    const supabase = createClient()

    // Search both orderings — conversation may have been created either way
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('conversation_type', 'direct')
      .or(`and(gig_poster_id.eq.${currentUserId},artist_id.eq.${id}),and(gig_poster_id.eq.${id},artist_id.eq.${currentUserId})`)
      .maybeSingle()

    if (existing) {
      router.push(`/messages/${(existing as any).id}`)
      return
    }

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ gig_poster_id: currentUserId, artist_id: id, gig_id: null, conversation_type: 'direct', gig_poster_unread: 0, artist_unread: 0 })
      .select('id')
      .single()

    if (newConv) {
      router.push(`/messages/${(newConv as any).id}`)
    } else {
      console.error('Could not create conversation', error)
    }
    setMessagingLoading(false)
  }

  async function handleShareProfile() {
    const shareUrl = `${WEBSITE_URL}/share/profile/${id}`
    const shareTitle = profile?.full_name ?? profile?.username ?? 'WORK(ER) OF ART'
    setShareLoading(true)
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: `${shareTitle} on WORK(ER) OF ART`,
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        window.alert('PROFILE LINK COPIED')
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        window.alert('COULD NOT SHARE PROFILE')
      }
    } finally {
      setShareLoading(false)
    }
  }

  async function handleBlock() {
    if (!currentUserId) return
    if (!window.confirm('BLOCK THIS USER? YOU WILL NO LONGER SEE THEIR CONTENT.')) return
    const supabase = createClient()
    await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: id })
    router.back()
  }

  async function openFollowModal(mode: 'followers' | 'following') {
    setFollowModal(mode)
    setFollowListLoading(true)
    setFollowList([])
    const supabase = createClient()

    const query = mode === 'followers'
      ? supabase.from('follows').select('follower_id').eq('following_id', id)
      : supabase.from('follows').select('following_id').eq('follower_id', id)

    const { data } = await query.order('created_at', { ascending: false })
    const ids = (data ?? []).map((row: any) => mode === 'followers' ? row.follower_id : row.following_id) as string[]

    if (ids.length === 0) { setFollowListLoading(false); return }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, profile_photo_url, art_type, city, country, is_verified')
      .in('id', ids)

    const pMap = new Map(((profiles ?? []) as FollowUser[]).map(p => [p.id, p]))
    setFollowList(ids.map(uid => pMap.get(uid)).filter(Boolean) as FollowUser[])
    setFollowListLoading(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>
  if (!profile) return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>ARTIST NOT FOUND</div>

  const isOwn = currentUserId === id
  const displayName = (profile.full_name ?? profile.username ?? '').toUpperCase()
  const location = [profile.city, profile.country].filter(Boolean).join(', ').toUpperCase()
  const discipline = (profile.discipline ?? profile.art_type ?? '').toUpperCase()
  const avgRating = profile.rating ?? 0

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888880', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 24 }}>← ARTISTS</button>

      {/* ── PROFILE HEADER ── */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {profile.profile_photo_url ? (
            <img src={profile.profile_photo_url} alt={displayName} className="oct-avatar" style={{ width: 90, height: 90 }} />
          ) : (
            <div className="oct-avatar" style={{ width: 90, height: 90, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#888880' }}>◯</div>
          )}
          {profile.is_available && (
            <span style={{ position: 'absolute', bottom: 4, right: 4, width: 12, height: 12, borderRadius: '50%', background: '#2a7a4f', border: '2px solid #000', display: 'block' }} />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em' }}>{displayName}</h1>
            {profile.is_verified && <span style={{ fontSize: 9, fontWeight: 700, background: '#f6c55a', color: '#000', padding: '3px 9px', letterSpacing: '0.18em', display: 'inline-block' }}>WOA</span>}
            {profile.is_available && <span style={{ fontSize: 9, color: '#2a7a4f', border: '1px solid #2a7a4f', padding: '2px 6px', letterSpacing: '0.1em' }}>● AVAILABLE</span>}
          </div>

          {profile.username && profile.full_name && (
            <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.08em', marginBottom: 4 }}>@{profile.username}</p>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            {discipline && <span style={{ fontSize: 11, color: '#888880', letterSpacing: '0.1em' }}>{discipline}</span>}
            {location && <><span style={{ color: '#333' }}>·</span><span style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em' }}>{location}</span></>}
            {profile.experience != null && (
              <><span style={{ color: '#333' }}>·</span><span style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em' }}>{profile.experience} YRS EXP</span></>
            )}
          </div>

          {/* Art type tags */}
          {profile.art_types?.length ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {profile.art_types.slice(0, 5).map(t => (
                <span key={t} style={{ fontSize: 9, color: '#c0392b', border: '1px solid rgba(192,57,43,0.4)', padding: '2px 7px', letterSpacing: '0.08em' }}>{t.toUpperCase()}</span>
              ))}
            </div>
          ) : null}

          {/* Stats */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{postCount}</span>
              <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.12em' }}>POSTS</span>
            </div>
            <button
              onClick={() => openFollowModal('followers')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
            >
              <span style={{ display: 'block', fontSize: 18, fontWeight: 700, color: '#fff' }}>{profile.follower_count}</span>
              <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.12em' }}>FOLLOWERS</span>
            </button>
            <button
              onClick={() => openFollowModal('following')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
            >
              <span style={{ display: 'block', fontSize: 18, fontWeight: 700, color: '#fff' }}>{followingCount}</span>
              <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.12em' }}>FOLLOWING</span>
            </button>
            {profile.booked_count != null && (
              <div>
                <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{profile.booked_count}</span>
                <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.12em' }}>BOOKED</span>
              </div>
            )}
            {avgRating > 0 && (
              <div>
                <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{'★'.repeat(Math.round(avgRating))}</span>
                <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.12em' }}>{profile.rating_count} REVIEWS</span>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isOwn ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={handleFollow} className={isFollowing ? '' : 'btn-primary'}
                style={{ padding: '8px 22px', fontSize: 10, letterSpacing: '0.12em', border: isFollowing ? '1px solid rgba(255,255,255,0.2)' : undefined, background: isFollowing ? 'transparent' : undefined, color: isFollowing ? '#888880' : undefined, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isFollowing ? '✓ FOLLOWING' : 'FOLLOW'}
              </button>
              {currentUserRole !== 'GIG_POSTER' && (
                <button onClick={handleMessage} className="btn-red" style={{ padding: '8px 22px', fontSize: 10, letterSpacing: '0.12em' }} disabled={messagingLoading}>
                  {messagingLoading ? '...' : 'MESSAGE'}
                </button>
              )}
              <button
                onClick={handleShareProfile}
                style={{ padding: '8px 22px', fontSize: 10, letterSpacing: '0.12em', border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                disabled={shareLoading}
              >
                {shareLoading ? '...' : 'SHARE'}
              </button>
              {currentUserId && (
                <button
                  onClick={handleBlock}
                  style={{ padding: '8px 22px', fontSize: 10, letterSpacing: '0.12em', border: '1px solid rgba(192,57,43,0.4)', background: 'transparent', color: '#c0392b', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  BLOCK
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => router.push(`/profile/edit?target=${id}`)}
                  className="btn-primary"
                  style={{ padding: '8px 22px', fontSize: 10, letterSpacing: '0.12em' }}
                >
                  ADMIN EDIT
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/profile/edit" className="btn-primary" style={{ padding: '8px 22px', fontSize: 10, letterSpacing: '0.12em', display: 'inline-block' }}>EDIT PROFILE</Link>
              <button
                onClick={handleShareProfile}
                style={{ padding: '8px 22px', fontSize: 10, letterSpacing: '0.12em', border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                disabled={shareLoading}
              >
                {shareLoading ? '...' : 'SHARE'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── BIO ── */}
      {profile.bio && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{profile.bio}</p>
        </div>
      )}

      {/* ── SOCIAL LINKS ── */}
      {(profile.instagram || profile.facebook || profile.website || profile.spotify_url) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {profile.instagram && (
            <a href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: '#888880', letterSpacing: '0.1em', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)', padding: '6px 14px', transition: 'color 0.2s' }}>
              INSTAGRAM ↗
            </a>
          )}
          {profile.facebook && (
            <a href={profile.facebook.startsWith('http') ? profile.facebook : `https://facebook.com/${profile.facebook}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: '#888880', letterSpacing: '0.1em', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)', padding: '6px 14px' }}>
              FACEBOOK ↗
            </a>
          )}
          {profile.website && (
            <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: '#888880', letterSpacing: '0.1em', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)', padding: '6px 14px' }}>
              WEBSITE ↗
            </a>
          )}
          {profile.spotify_url && (
            <a href={profile.spotify_url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: '#1db954', letterSpacing: '0.1em', textDecoration: 'none', border: '1px solid #1db954', padding: '6px 14px' }}>
              SPOTIFY ↗
            </a>
          )}
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
        {(['posts', 'portfolio', 'calendar'] as ProfileTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #c0392b' : '2px solid transparent', color: tab === t ? '#fff' : '#888880', fontSize: 11, letterSpacing: '0.14em', padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: tab === t ? 700 : 400, marginBottom: -1 }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── POSTS TAB ── */}
      {tab === 'posts' && (
        posts.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '40px 0' }}>NO POSTS YET</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {posts.map(post => (
              <Link key={post.id} href={`/feed/${post.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ aspectRatio: '1/1', background: '#111', position: 'relative', overflow: 'hidden' }} className="post-thumb-hover">
                  {post.media_url && post.type === 'image' ? (
                    <img src={post.media_url} alt={post.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 24 }}>
                      {post.type === 'video' ? '▷' : post.type === 'audio' ? '♪' : '◻'}
                    </div>
                  )}
                  <div className="post-thumb-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', letterSpacing: '0.08em', gap: 12 }}>
                    <span>♥ {post.like_count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {/* ── PORTFOLIO TAB ── */}
      {tab === 'portfolio' && (
        portfolio.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '40px 0' }}>NO PORTFOLIO SECTIONS YET</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {portfolio.map(section => (
              <div key={section.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  {section.cover_image_url && (
                    <img src={section.cover_image_url} alt={section.title} style={{ width: 48, height: 48, objectFit: 'cover' }} />
                  )}
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>{section.title.toUpperCase()}</h3>
                    <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>{section.items?.length ?? 0} PIECES</span>
                  </div>
                </div>
                {section.items?.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                    {section.items.map(item => (
                      <Link key={item.id} href={`/feed/${item.post_id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ aspectRatio: '1/1', background: '#111', overflow: 'hidden' }}>
                          {item.posts?.media_url && item.posts.type === 'image' ? (
                            <img src={item.posts.media_url} alt={item.posts.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 24 }}>
                              {item.posts?.type === 'video' ? '▷' : item.posts?.type === 'audio' ? '♪' : '◻'}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : <div style={{ color: '#888880', fontSize: 11, letterSpacing: '0.08em' }}>NO ITEMS IN THIS SECTION</div>}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── CALENDAR TAB ── */}
      {tab === 'calendar' && (
        shows.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '40px 0' }}>NO UPCOMING SHOWS</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {shows.map(show => (
              <div key={show.id} style={{ padding: '18px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 48 }}>
                  <span style={{ display: 'block', fontSize: 20, fontWeight: 700 }}>{new Date(show.show_date).getDate()}</span>
                  <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>{new Date(show.show_date).toLocaleString('en', { month: 'short' }).toUpperCase()}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>{show.title.toUpperCase()}</h3>
                  {show.venue && <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em', marginBottom: 4 }}>{show.venue.toUpperCase()}</p>}
                  {show.city && <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em' }}>{show.city.toUpperCase()}</p>}
                  {show.ticket_url && (
                    <a href={/^https?:\/\//i.test(show.ticket_url) ? show.ticket_url : `https://${show.ticket_url}`} target="_blank" rel="noopener noreferrer" className="btn-red" style={{ fontSize: 9, padding: '4px 12px', marginTop: 8, display: 'inline-block' }}>TICKETS ↗</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── REVIEWS ── */}
      {reviews.length > 0 && (
        <div style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24 }}>
          <p className="woa-section-label">REVIEWS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reviews.map(review => (
              <div key={review.id} style={{ padding: '16px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {review.profiles?.profile_photo_url ? (
                    <img src={review.profiles.profile_photo_url} alt="" className="oct-avatar" style={{ width: 28, height: 28 }} />
                  ) : (
                    <div className="oct-avatar" style={{ width: 28, height: 28, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 12 }}>◯</div>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>{(review.profiles?.username ?? '').toUpperCase()}</span>
                  <span style={{ color: '#f6c55a', fontSize: 12, marginLeft: 'auto' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                </div>
                {review.body && <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>{review.body}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .post-thumb-hover:hover .post-thumb-overlay { display: flex !important; }
        .follow-row:hover { opacity: 0.75; }
      `}</style>

      {/* ── FOLLOWERS / FOLLOWING MODAL ── */}
      {followModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setFollowModal(null) }}
        >
          <div style={{ background: '#0d0d0d', border: '1px solid #222', width: '100%', maxWidth: 520, maxHeight: '75vh', display: 'flex', flexDirection: 'column', borderRadius: '8px 8px 0 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em' }}>
                {followModal === 'followers' ? 'FOLLOWERS' : 'FOLLOWING'}
              </span>
              <button onClick={() => setFollowModal(null)} style={{ background: 'none', border: 'none', color: '#888880', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>✕</button>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              {followListLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>
              ) : followList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: 11, letterSpacing: '0.1em' }}>
                  {followModal === 'followers' ? 'NO FOLLOWERS YET' : 'NOT FOLLOWING ANYONE YET'}
                </div>
              ) : followList.map(user => (
                <Link
                  key={user.id}
                  href={`/artists/${user.id}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                  onClick={() => setFollowModal(null)}
                >
                  <div className="follow-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {user.profile_photo_url ? (
                      <img src={user.profile_photo_url} alt="" className="oct-avatar" style={{ width: 44, height: 44, flexShrink: 0 }} />
                    ) : (
                      <div className="oct-avatar" style={{ width: 44, height: 44, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', flexShrink: 0 }}>◯</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#fff' }}>
                          {(user.full_name ?? user.username ?? '').toUpperCase()}
                        </span>
                        {user.is_verified && <span style={{ fontSize: 9, color: '#f6c55a' }}>✓</span>}
                      </div>
                      {user.username && user.full_name && (
                        <span style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.06em', display: 'block' }}>@{user.username}</span>
                      )}
                      {user.art_type && (
                        <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>{user.art_type.toUpperCase()}</span>
                      )}
                      {(user.city || user.country) && (
                        <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.06em', display: 'block' }}>
                          {[user.city, user.country].filter(Boolean).join(', ').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span style={{ color: '#555', fontSize: 18, flexShrink: 0 }}>›</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
