'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type NotifType = 'new_message' | 'new_follower' | 'post_liked' | 'post_comment' | 'gig_interest' | 'gig_nearby'

interface Notif {
  id: string
  user_id: string
  type: NotifType
  actor_id: string | null
  reference_id: string | null
  reference_type: string | null
  preview_text: string | null
  is_read: boolean
  created_at: string
  // enriched
  actorName: string | null
  actorUsername: string | null
  actorAvatar: string | null
  gigTitle: string | null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'NOW'
  if (m < 60) return m + 'M AGO'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'H AGO'
  return Math.floor(h / 24) + 'D AGO'
}

function notifIcon(type: string) {
  if (type === 'post_liked') return '♥'
  if (type === 'new_follower') return '+'
  if (type === 'post_comment') return '◻'
  if (type === 'gig_interest' || type === 'gig_nearby') return '◎'
  if (type === 'new_message') return '▷'
  return '●'
}

function notifText(n: Notif): { main: string; sub: string | null } {
  const handle = n.actorUsername
    ? `@${n.actorUsername.toUpperCase()}`
    : n.reference_type === 'welcome'
      ? 'WOA'
      : n.actorName?.toUpperCase() ?? 'SOMEONE'

  switch (n.type) {
    case 'new_message':
      return {
        main: n.reference_type === 'welcome' ? 'WOA SENT YOU A WELCOME MESSAGE' : `${handle} SENT YOU A MESSAGE`,
        sub: n.preview_text ?? null,
      }
    case 'new_follower':
      return { main: `${handle} STARTED FOLLOWING YOU`, sub: null }
    case 'post_liked':
      return { main: `${handle} LIKED YOUR POST`, sub: n.preview_text ?? null }
    case 'post_comment':
      return { main: `${handle} COMMENTED ON YOUR POST`, sub: n.preview_text ?? null }
    case 'gig_interest':
      return { main: `${handle} EXPRESSED INTEREST IN YOUR GIG`, sub: n.gigTitle ?? n.preview_text ?? null }
    case 'gig_nearby':
      return { main: 'NEW GIG POSTED NEAR YOU', sub: n.gigTitle ?? n.preview_text ?? null }
    default:
      return { main: 'NEW NOTIFICATION', sub: null }
  }
}

function notifHref(n: Notif): string {
  switch (n.type) {
    case 'post_liked':
    case 'post_comment':
      return n.reference_id ? `/feed/${n.reference_id}` : '#'
    case 'gig_interest':
    case 'gig_nearby':
      return n.reference_id ? `/gigs/${n.reference_id}` : '#'
    case 'new_follower':
      return n.actor_id ? `/artists/${n.actor_id}` : '#'
    case 'new_message':
      return n.reference_id && n.reference_type !== 'welcome' ? `/messages/${n.reference_id}` : '/messages'
    default:
      return '#'
  }
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: raw } = await supabase
        .from('notifications')
        .select('id, user_id, type, actor_id, reference_id, reference_type, preview_text, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60)

      if (!raw?.length) { setNotifs([]); setLoading(false); return }

      // Fetch actor profiles
      const actorIds = [...new Set((raw as any[]).map((n: any) => n.actor_id).filter(Boolean))] as string[]
      const profileMap: Record<string, any> = {}
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, username, full_name, profile_photo_url').in('id', actorIds)
        ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
      }

      // Fetch gig titles
      const gigIds = [...new Set(
        (raw as any[]).filter(n => (n.type === 'gig_interest' || n.type === 'gig_nearby') && n.reference_id)
          .map((n: any) => n.reference_id)
      )]
      const gigMap: Record<string, string> = {}
      if (gigIds.length > 0) {
        const { data: gigs } = await supabase.from('gigs').select('id, title').in('id', gigIds)
        ;(gigs ?? []).forEach((g: any) => { gigMap[g.id] = g.title })
      }

      const enriched: Notif[] = (raw as any[]).map(n => {
        const actor = n.actor_id ? profileMap[n.actor_id] : null
        return {
          ...n,
          actorName: actor?.full_name ?? null,
          actorUsername: actor?.username ?? null,
          actorAvatar: actor?.profile_photo_url ?? null,
          gigTitle: (n.type === 'gig_interest' || n.type === 'gig_nearby') && n.reference_id
            ? (gigMap[n.reference_id] ?? null)
            : null,
        }
      })

      setNotifs(enriched)

      // Mark all as read
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)

      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
      <h1 style={{
        fontSize: 13, letterSpacing: '0.18em', fontWeight: 400,
        marginBottom: 24, paddingBottom: 16,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        NOTIFICATIONS
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '60px 0' }}>
          LOADING...
        </div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', padding: '60px 0' }}>
          NO NOTIFICATIONS YET
        </div>
      ) : (
        notifs.map(notif => {
          const href = notifHref(notif)
          const { main, sub } = notifText(notif)

          return (
            <Link key={notif.id} href={href} style={{ textDecoration: 'none', display: 'block' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: !notif.is_read ? 'rgba(192,57,43,0.04)' : 'transparent',
                  cursor: 'pointer',
                }}
                className="notif-hover"
              >
                {/* Actor avatar or type icon */}
                <div style={{ flexShrink: 0 }}>
                  {notif.actorAvatar ? (
                    <img src={notif.actorAvatar} alt="" className="oct-avatar" style={{ width: 40, height: 40 }} />
                  ) : (
                    <div
                      className="oct-avatar"
                      style={{
                        width: 40, height: 40, background: '#1a1a1a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#c0392b', fontSize: 16,
                      }}
                    >
                      {notifIcon(notif.type)}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: '#fff', letterSpacing: '0.04em', lineHeight: 1.5, marginBottom: sub ? 3 : 0 }}>
                    {main}
                  </p>
                  {sub && (
                    <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub}
                    </p>
                  )}
                  <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em', display: 'block', marginTop: 4 }}>
                    {timeAgo(notif.created_at)}
                  </span>
                </div>

                {!notif.is_read && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c0392b', flexShrink: 0 }} />
                )}
              </div>
            </Link>
          )
        })
      )}

      <style>{`.notif-hover:hover { opacity: 0.8; }`}</style>
    </div>
  )
}
