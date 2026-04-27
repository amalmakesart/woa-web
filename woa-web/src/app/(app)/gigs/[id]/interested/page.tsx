'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/admin'

interface Interest {
  id: string
  artist_id: string
  suggested_fee: number | null
  note: string | null
  created_at: string
  profile: {
    id: string
    username: string | null
    full_name: string | null
    profile_photo_url: string | null
    art_type: string | null
    city: string | null
    country: string | null
    discipline: string | null
  } | null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'TODAY'
  if (d === 1) return '1 DAY AGO'
  if (d < 7) return `${d} DAYS AGO`
  return Math.floor(d / 7) + 'W AGO'
}

export default function InterestedArtistsPage() {
  const params = useParams()
  const router = useRouter()
  const gigId = params.id as string

  const [interests, setInterests] = useState<Interest[]>([])
  const [gigTitle, setGigTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [messagingId, setMessagingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)
      const admin = isAdminEmail(user.email)
      setIsAdmin(admin)

      // Verify user owns this gig (or is admin)
      const { data: gig } = await supabase
        .from('gigs')
        .select('title, poster_id')
        .eq('id', gigId)
        .single()

      if (!gig) { setLoading(false); return }
      if (!admin && (gig as any).poster_id !== user.id) {
        router.push('/gigs')
        return
      }
      setGigTitle((gig as any).title ?? 'GIG')

      const { data: rows } = await supabase
        .from('gig_interests')
        .select('id, artist_id, suggested_fee, note, created_at')
        .eq('gig_id', gigId)
        .order('created_at', { ascending: false })

      if (!rows || rows.length === 0) { setInterests([]); setLoading(false); return }

      const artistIds = (rows as any[]).map(r => r.artist_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, profile_photo_url, art_type, city, country, discipline')
        .in('id', artistIds)

      const profileMap = Object.fromEntries(((profiles as any[]) ?? []).map(p => [p.id, p]))

      setInterests((rows as any[]).map(r => ({
        ...r,
        profile: profileMap[r.artist_id] ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [gigId, router])

  async function handleMessage(artistId: string) {
    if (!currentUserId) return
    setMessagingId(artistId)
    const supabase = createClient()
    // Find or create conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('gig_id', gigId)
      .eq('artist_id', artistId)
      .eq('gig_poster_id', currentUserId)
      .maybeSingle()

    if (existing) {
      router.push(`/messages/${(existing as any).id}`)
      return
    }

    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ gig_id: gigId, artist_id: artistId, gig_poster_id: currentUserId })
      .select('id')
      .single()

    setMessagingId(null)
    if (newConv) router.push(`/messages/${(newConv as any).id}`)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ marginBottom: 24, fontSize: 11, letterSpacing: '0.1em' }}>
        ← BACK
      </button>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>
          INTERESTED ARTISTS
        </h1>
        <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em' }}>
          {gigTitle.toUpperCase()} · {interests.length} {interests.length === 1 ? 'APPLICANT' : 'APPLICANTS'}
        </p>
      </div>

      {interests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555', fontSize: 11, letterSpacing: '0.1em' }}>
          NO ONE HAS EXPRESSED INTEREST YET
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {interests.map(interest => {
            const p = interest.profile
            const name = (p?.full_name ?? p?.username ?? 'ARTIST').toUpperCase()
            const discipline = (p?.discipline ?? p?.art_type ?? '').toUpperCase()
            const location = [p?.city, p?.country].filter(Boolean).join(', ').toUpperCase()
            return (
              <div key={interest.id} style={{ padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Link href={`/artists/${interest.artist_id}`} style={{ flexShrink: 0 }}>
                  {p?.profile_photo_url ? (
                    <img src={p.profile_photo_url} alt={name} className="oct-avatar" style={{ width: 52, height: 52 }} />
                  ) : (
                    <div className="oct-avatar" style={{ width: 52, height: 52, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 20 }}>◯</div>
                  )}
                </Link>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                    <div>
                      <Link href={`/artists/${interest.artist_id}`} style={{ textDecoration: 'none' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#fff' }}>{name}</span>
                      </Link>
                      {discipline && <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em', display: 'block', marginTop: 1 }}>{discipline}</span>}
                      {location && <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.06em', display: 'block' }}>{location}</span>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {interest.suggested_fee != null && (
                        <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#fff' }}>
                          ${interest.suggested_fee.toLocaleString()}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>{timeAgo(interest.created_at)}</span>
                    </div>
                  </div>

                  {interest.note && (
                    <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.7, marginBottom: 10, fontStyle: 'italic' }}>
                      "{interest.note}"
                    </p>
                  )}

                  <button
                    onClick={() => handleMessage(interest.artist_id)}
                    disabled={messagingId === interest.artist_id}
                    className="btn-primary"
                    style={{ fontSize: 10, padding: '7px 16px' }}
                  >
                    {messagingId === interest.artist_id ? '...' : 'MESSAGE'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
