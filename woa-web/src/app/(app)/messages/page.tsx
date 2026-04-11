'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  id: string
  gig_poster_id: string
  artist_id: string
  gig_id: string | null
  conversation_type: string | null
  last_message: string | null
  last_message_at: string | null
  gig_poster_unread: number
  artist_unread: number
  // enriched
  otherUserId: string
  otherUserName: string | null
  otherUserUsername: string | null
  otherUserAvatar: string | null
  gigTitle: string | null
  unread: number
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'NOW'
  if (m < 60) return m + 'M'
  if (h < 24) return h + 'H'
  return d + 'D'
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [isGigPoster, setIsGigPoster] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: me } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const gigPoster = (me as any)?.role === 'GIG_POSTER'
    setIsGigPoster(gigPoster)

    const { data: convData } = await supabase
      .from('conversations')
      .select('id, gig_poster_id, artist_id, gig_id, conversation_type, last_message, last_message_at, gig_poster_unread, artist_unread')
      .or(`gig_poster_id.eq.${user.id},artist_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    if (!convData?.length) { setConversations([]); setLoading(false); return }

    // Fetch other user profiles
    const otherIds = (convData as any[]).map(c =>
      c.gig_poster_id === user.id ? c.artist_id : c.gig_poster_id
    )
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, profile_photo_url').in('id', [...new Set(otherIds)])
    const profileMap: Record<string, any> = {}
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })

    // Fetch gig titles
    const gigIds = (convData as any[]).filter(c => c.gig_id).map((c: any) => c.gig_id)
    const gigMap: Record<string, string> = {}
    if (gigIds.length > 0) {
      const { data: gigs } = await supabase.from('gigs').select('id, title').in('id', gigIds)
      ;(gigs ?? []).forEach((g: any) => { gigMap[g.id] = g.title })
    }

    const enriched: Conversation[] = (convData as any[]).map(c => {
      const isInitiator = c.gig_poster_id === user.id
      const otherId = isInitiator ? c.artist_id : c.gig_poster_id
      const other = profileMap[otherId] ?? {}
      return {
        ...c,
        otherUserId: otherId,
        otherUserName: other.full_name ?? other.username ?? null,
        otherUserUsername: other.username ?? null,
        otherUserAvatar: other.profile_photo_url ?? null,
        gigTitle: c.gig_id ? (gigMap[c.gig_id] ?? null) : null,
        unread: isInitiator ? (c.gig_poster_unread ?? 0) : (c.artist_unread ?? 0),
      }
    })

    setConversations(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
      <h1 style={{
        fontSize: 13, letterSpacing: '0.18em', fontWeight: 400,
        marginBottom: 24, paddingBottom: 16,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        MESSAGES
      </h1>

      {loading ? (
        <div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 60, background: '#0a0a0a', borderBottom: '1px solid #111', marginBottom: 1 }} />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '60px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 12, letterSpacing: '0.3em', color: '#fff' }}>NO MESSAGES YET</span>
          <span style={{ fontSize: 10, letterSpacing: '0.12em', color: '#666', maxWidth: 260 }}>
            {isGigPoster ? 'MESSAGE ARTISTS FROM YOUR GIG APPLICANTS' : 'GIG POSTERS WILL CONTACT YOU HERE'}
          </span>
        </div>
      ) : (
        conversations.map(conv => (
          <Link
            key={conv.id}
            href={`/messages/${conv.id}`}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 0', borderBottom: '1px solid #111',
              cursor: 'pointer',
            }}
              className="conv-hover"
            >
              {/* Avatar */}
              {conv.otherUserAvatar ? (
                <img src={conv.otherUserAvatar} alt="" className="oct-avatar" style={{ width: 36, height: 36, flexShrink: 0 }} />
              ) : (
                <div className="oct-avatar" style={{ width: 36, height: 36, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', flexShrink: 0 }}>◯</div>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {conv.gigTitle ? (
                  <span style={{ display: 'block', fontSize: 10, color: '#666', letterSpacing: '0.12em', marginBottom: 2 }}>
                    RE: {conv.gigTitle.toUpperCase()}
                  </span>
                ) : conv.conversation_type === 'direct' ? (
                  <span style={{ display: 'block', fontSize: 9, color: '#2a7a4f', letterSpacing: '0.15em', marginBottom: 2 }}>DIRECT MESSAGE</span>
                ) : null}
                <span style={{ display: 'block', fontSize: 12, letterSpacing: '0.12em', color: '#fff', fontWeight: conv.unread > 0 ? 700 : 400, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(conv.otherUserName ?? 'UNKNOWN').toUpperCase()}
                </span>
                {conv.otherUserUsername && (
                  <span style={{ display: 'block', fontSize: 10, color: '#c0392b', letterSpacing: '0.12em', marginBottom: 3 }}>
                    @{conv.otherUserUsername.toUpperCase()}
                  </span>
                )}
                <span style={{ fontSize: 10, color: '#777', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {conv.last_message
                    ? (conv.last_message.length > 50 ? conv.last_message.slice(0, 50).toUpperCase() + '...' : conv.last_message.toUpperCase())
                    : 'NO MESSAGES YET'}
                </span>
              </div>

              {/* Right */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                {conv.last_message_at && (
                  <span style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em' }}>{timeAgo(conv.last_message_at)}</span>
                )}
                {conv.unread > 0 && (
                  <div style={{ background: '#c0392b', borderRadius: 7, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{conv.unread > 9 ? '9+' : conv.unread}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))
      )}

      <style>{`.conv-hover:hover { opacity: 0.75; }`}</style>
    </div>
  )
}
