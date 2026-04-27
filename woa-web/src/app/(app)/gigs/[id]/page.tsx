'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/admin'

interface Gig {
  id: string
  poster_id: string
  title: string
  description: string | null
  art_type: string | null
  image_url: string | null
  location: string | null
  date_timeframe: string | null
  budget_min: number | null
  budget_max: number | null
  poster_name: string | null
  company_name: string | null
  is_featured: boolean
  status: 'active' | 'closed'
  interest_count: number
  created_at: string
}

function formatBudget(min: number | null, max: number | null) {
  if (!min && !max) return 'NEGOTIABLE'
  if (min && max) return `$${min.toLocaleString()} — $${max.toLocaleString()}`
  if (min) return `FROM $${min.toLocaleString()}`
  return `UP TO $${max!.toLocaleString()}`
}

export default function GigDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [gig, setGig] = useState<Gig | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasInterest, setHasInterest] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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

      const [{ data: gigData }, { data: interest }] = await Promise.all([
        supabase.from('gigs').select('*').eq('id', id).single(),
        user
          ? supabase.from('gig_interests').select('id').eq('gig_id', id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      setGig(gigData as Gig)
      setHasInterest(!!interest)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleExpressInterest(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId) { router.push('/login'); return }
    setSubmitting(true)
    const supabase = createClient()
    await supabase.from('gig_interests').insert({
      gig_id: id,
      user_id: currentUserId,
      message: message.trim() || null,
    })
    await supabase.rpc('increment_interest_count', { gig_id: id })
    setHasInterest(true)
    setSubmitted(true)
    setSubmitting(false)
    setGig(g => g ? { ...g, interest_count: g.interest_count + 1 } : g)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
        LOADING...
      </div>
    )
  }

  if (!gig) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
        GIG NOT FOUND
      </div>
    )
  }

  const isOwner = currentUserId === gig.poster_id
  const canManage = isOwner || isAdmin

  async function handleDeleteGig() {
    if (!canManage) return
    const gigId = gig?.id
    if (!gigId) return
    if (!window.confirm('DELETE THIS GIG? THIS CANNOT BE UNDONE.')) return
    const supabase = createClient()
    await supabase.from('gigs').delete().eq('id', gigId)
    router.push('/gigs')
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px' }}>
      <button
        onClick={() => router.back()}
        className="btn-ghost"
        style={{ marginBottom: 24, fontSize: 11, letterSpacing: '0.1em' }}
      >
        ← BACK
      </button>

      {gig.is_featured && (
        <span
          style={{
            display: 'inline-block',
            fontSize: 9,
            color: '#c0392b',
            letterSpacing: '0.14em',
            border: '1px solid #c0392b',
            padding: '3px 8px',
            marginBottom: 16,
          }}
        >
          FEATURED
        </span>
      )}

      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '0.02em',
          lineHeight: 1.15,
          marginBottom: 16,
        }}
      >
        {gig.title}
      </h1>

      {/* Meta grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 0,
          border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 28,
        }}
      >
        {[
          { label: 'POSTED BY', value: gig.company_name ?? gig.poster_name ?? 'ANONYMOUS' },
          { label: 'ART TYPE', value: gig.art_type ?? '—' },
          { label: 'LOCATION', value: gig.location ?? '—' },
          { label: 'TIMEFRAME', value: gig.date_timeframe ?? '—' },
          { label: 'BUDGET', value: formatBudget(gig.budget_min, gig.budget_max) },
          { label: 'INTERESTED', value: String(gig.interest_count) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span style={{ display: 'block', fontSize: 9, color: '#888880', letterSpacing: '0.14em', marginBottom: 4 }}>
              {label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>
              {value.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      {/* Description */}
      {gig.description && (
        <div style={{ marginBottom: 32 }}>
          <p className="woa-section-label">DESCRIPTION</p>
          <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {gig.description}
          </p>
        </div>
      )}

      {/* Image */}
      {gig.image_url && (
        <div style={{ marginBottom: 32 }}>
          <img
            src={gig.image_url}
            alt={gig.title}
            style={{ width: '100%', maxHeight: 400, objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Express interest */}
      {!isOwner && gig.status === 'active' && currentUserRole !== 'ART_LOVER' && (
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '24px',
            marginBottom: 24,
          }}
        >
          {submitted || hasInterest ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: 12, color: '#c0392b', letterSpacing: '0.12em' }}>
                ● INTEREST EXPRESSED
              </span>
            </div>
          ) : (
            <form onSubmit={handleExpressInterest} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 11, letterSpacing: '0.1em', color: '#888880', marginBottom: 4 }}>
                EXPRESS YOUR INTEREST
              </p>
              <textarea
                className="woa-input"
                placeholder="TELL THEM WHY YOU'RE THE RIGHT FIT (OPTIONAL)"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                style={{ resize: 'vertical' }}
              />
              {!currentUserId && (
                <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>
                  YOU MUST BE SIGNED IN TO EXPRESS INTEREST
                </p>
              )}
              <button
                type="submit"
                className="btn-red"
                disabled={submitting || !currentUserId}
                style={{ width: '100%' }}
              >
                {submitting ? 'SUBMITTING...' : 'EXPRESS INTEREST'}
              </button>
            </form>
          )}
        </div>
      )}

      {canManage && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push(`/gigs/new?edit=${gig.id}`)}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            EDIT GIG
          </button>
          <button
            onClick={() => router.push(`/gigs/${id}/interested`)}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            VIEW INTERESTED ARTISTS ({gig.interest_count})
          </button>
          <button
            onClick={handleDeleteGig}
            className="btn-red"
            style={{ flex: 1 }}
          >
            DELETE GIG
          </button>
        </div>
      )}
    </div>
  )
}
