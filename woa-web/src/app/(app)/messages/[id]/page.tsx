'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

interface OtherProfile {
  id: string
  username: string | null
  full_name: string | null
  profile_photo_url: string | null
  art_type: string | null
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'TODAY'
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string

  const [messages, setMessages] = useState<Message[]>([])
  const [otherProfile, setOtherProfile] = useState<OtherProfile | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [gigTitle, setGigTitle] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const markAsRead = useCallback(async (userId: string, role: string) => {
    const supabase = createClient()
    const col = role === 'GIG_POSTER' ? 'gig_poster_unread' : 'artist_unread'
    await supabase.from('conversations').update({ [col]: 0 }).eq('id', conversationId)
    await supabase.from('messages').update({ is_read: true })
      .eq('conversation_id', conversationId).neq('sender_id', userId)
  }, [conversationId])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      // Load conversation + other user + messages
      const [{ data: conv }, { data: msgData }, { data: me }] = await Promise.all([
        supabase.from('conversations')
          .select('gig_poster_id, artist_id, gig_id')
          .eq('id', conversationId).single(),
        supabase.from('messages')
          .select('id, conversation_id, sender_id, content, is_read, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
        supabase.from('profiles').select('role').eq('id', user.id).single(),
      ])

      const role = (me as any)?.role ?? null
      setCurrentUserRole(role)

      if (conv) {
        const otherId = (conv as any).gig_poster_id === user.id
          ? (conv as any).artist_id
          : (conv as any).gig_poster_id

        const [{ data: prof }, gigData] = await Promise.all([
          supabase.from('profiles').select('id, username, full_name, profile_photo_url, art_type').eq('id', otherId).single(),
          (conv as any).gig_id
            ? supabase.from('gigs').select('title').eq('id', (conv as any).gig_id).single()
            : Promise.resolve({ data: null }),
        ])
        setOtherProfile(prof as OtherProfile)
        if (gigData?.data) setGigTitle((gigData.data as any).title)
      }

      setMessages((msgData as Message[]) ?? [])
      setLoading(false)

      if (role) await markAsRead(user.id, role)
    }
    init()
  }, [conversationId, router, markAsRead])

  // Real-time new messages
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`conv_msgs_${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload: any) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new as Message]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !currentUserId) return
    setSending(true)
    const content = text.trim()
    setText('')
    const supabase = createClient()

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
      is_read: false,
    })

    setSending(false)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>
  }

  // Group messages with date dividers
  type ListItem = { type: 'divider'; label: string; key: string } | { type: 'message'; msg: Message }
  const items: ListItem[] = []
  let lastLabel = ''
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at)
    if (label !== lastLabel) {
      items.push({ type: 'divider', label, key: `div_${msg.id}` })
      lastLabel = label
    }
    items.push({ type: 'message', msg })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)',
        flexShrink: 0,
      }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>‹</button>

        {otherProfile?.profile_photo_url ? (
          <img src={otherProfile.profile_photo_url} alt="" className="oct-avatar" style={{ width: 36, height: 36 }} />
        ) : (
          <div className="oct-avatar" style={{ width: 36, height: 36, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880' }}>◯</div>
        )}

        <div style={{ flex: 1 }}>
          {gigTitle && (
            <span style={{ display: 'block', fontSize: 9, color: '#666', letterSpacing: '0.12em', marginBottom: 2 }}>
              RE: {gigTitle.toUpperCase()}
            </span>
          )}
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>
            {(otherProfile?.full_name ?? otherProfile?.username ?? '').toUpperCase()}
          </span>
          {otherProfile?.username && otherProfile?.full_name && (
            <span style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.08em' }}>
              @{otherProfile.username.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888880', fontSize: 11, letterSpacing: '0.1em', margin: 'auto 0' }}>
            START THE CONVERSATION
          </div>
        )}
        {items.map((item, i) => {
          if (item.type === 'divider') {
            return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
                <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.14em' }}>{item.label}</span>
                <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
              </div>
            )
          }
          const { msg } = item
          const isMine = msg.sender_id === currentUserId
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '72%' }}>
                <div style={{
                  padding: '10px 14px',
                  background: isMine ? '#c0392b' : '#1a1a1a',
                  fontSize: 12, lineHeight: 1.6, letterSpacing: '0.04em', color: '#fff',
                }}>
                  {msg.content}
                </div>
                <span style={{ display: 'block', fontSize: 9, color: '#555', letterSpacing: '0.06em', marginTop: 3, textAlign: isMine ? 'right' : 'left' }}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '12px 20px', display: 'flex', gap: 10,
        background: '#000', flexShrink: 0,
      }}>
        <input
          className="woa-input"
          style={{ flex: 1 }}
          placeholder="TYPE A MESSAGE..."
          value={text}
          onChange={e => setText(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn-red" style={{ padding: '12px 20px', flexShrink: 0 }} disabled={sending || !text.trim()}>
          SEND
        </button>
      </form>
    </div>
  )
}
