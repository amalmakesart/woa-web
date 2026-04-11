'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Constants ──────────────────────────────────────────────────────────────

const GIG_ART_TYPES = [
  'PHOTOGRAPHER', 'VIDEOGRAPHER', 'FILMMAKER', 'MUSICIAN', 'SINGER', 'DJ', 'PRODUCER',
  'MODEL', 'ACTOR', 'DANCER', 'CHOREOGRAPHER', 'VISUAL ARTIST', 'PAINTER', 'ILLUSTRATOR',
  'GRAPHIC DESIGNER', 'ANIMATOR', 'MURALIST', 'SCULPTOR', 'TATTOO ARTIST', 'FASHION DESIGNER',
  'MAKEUP ARTIST', 'HAIR STYLIST', 'WRITER', 'CHEF', 'PERFORMER', 'INTERDISCIPLINARY ARTIST', 'OTHER',
]

const STANDARD_PRICE = 6.00
const FEATURED_PRICE = 14.00

// Inline a small subset — enough for the dropdown.
// Full list imported from the shared constants at build would be ideal but we keep this self-contained.
const COUNTRIES = [
  'Remote',
  'Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia',
  'Cameroon','Canada','Chile','China','Colombia','Congo','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia','Ethiopia',
  'Finland','France','Georgia','Germany','Ghana','Greece','Guatemala','Haiti','Honduras','Hungary',
  'India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan',
  'Kenya','Kuwait','Kyrgyzstan','Latvia','Lebanon','Libya','Lithuania','Luxembourg','Malaysia','Mali',
  'Malta','Mexico','Moldova','Mongolia','Morocco','Mozambique','Myanmar','Namibia','Nepal',
  'Netherlands','New Zealand','Nicaragua','Nigeria','Norway','Oman','Pakistan','Palestine','Panama',
  'Paraguay','Peru','Philippines','Poland','Portugal','Puerto Rico','Qatar','Romania','Russia',
  'Rwanda','Saudi Arabia','Senegal','Serbia','Singapore','Slovakia','Slovenia','Somalia',
  'South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Tunisia','Turkey','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
]

type Step = 'details' | 'review' | 'payment'

function formatDate(val: string) {
  if (!val) return ''
  return new Date(val + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
}
function formatTime(val: string) {
  if (!val) return ''
  const [h, m] = val.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase()
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PostGigPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('details')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [posterName, setPosterName] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pendingGigId, setPendingGigId] = useState<string | null>(null)
  const [checkoutVersion] = useState(() => Date.now().toString())
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [description, setDescription] = useState('')
  const [artType, setArtType] = useState('')
  const [gigImageFile, setGigImageFile] = useState<File | null>(null)
  const [gigImageUrl, setGigImageUrl] = useState<string | null>(null)
  const [gigImagePreview, setGigImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)
      const { data: me } = await supabase.from('profiles').select('full_name, username, company_name').eq('id', user.id).single()
      if (me) {
        const d = me as any
        setPosterName(d.company_name ?? d.full_name ?? d.username ?? null)
      }
    }
    load()
  }, [router])

  // Listen for payment success from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data?.type === 'gig_payment_success') {
          setPaymentSuccess(true)
          if (pendingGigId) {
            const supabase = createClient()
            supabase.from('gigs').update({ status: 'active', is_featured: isFeatured }).eq('id', pendingGigId)
              .then(() => { setTimeout(() => router.push('/gigs'), 2000) })
          } else {
            setTimeout(() => router.push('/gigs'), 2000)
          }
        }
      } catch {}
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [pendingGigId, isFeatured, router])

  const locationString = useMemo(() => {
    if (!selectedCountry) return null
    if (selectedCountry === 'Remote') return 'Remote'
    if (!selectedCity) return selectedCountry
    return `${selectedCity}, ${selectedCountry}`
  }, [selectedCountry, selectedCity])

  const dateTimeframe = useMemo(() => {
    const from = [startDate ? formatDate(startDate) : '', startTime ? formatTime(startTime) : ''].filter(Boolean).join(' · ')
    const to = [endDate ? formatDate(endDate) : '', endTime ? formatTime(endTime) : ''].filter(Boolean).join(' · ')
    if (from && to) return `${from} — ${to}`
    return from
  }, [startDate, startTime, endDate, endTime])

  const totalCost = isFeatured ? FEATURED_PRICE + STANDARD_PRICE : STANDARD_PRICE

  function validate() {
    if (!title.trim()) { setError('GIG TITLE IS REQUIRED'); return false }
    if (!artType) { setError('ART TYPE IS REQUIRED'); return false }
    if (!startDate || !startTime) { setError('START DATE & TIME ARE REQUIRED'); return false }
    if ((endDate && !endTime) || (!endDate && endTime)) { setError('PLEASE SELECT BOTH END DATE AND TIME'); return false }
    if (endDate && endTime) {
      const start = new Date(`${startDate}T${startTime}`)
      const end = new Date(`${endDate}T${endTime}`)
      if (end < start) { setError('END DATE MUST BE AFTER START DATE'); return false }
    }
    if (!selectedCountry) { setError('LOCATION IS REQUIRED'); return false }
    if (!budgetMin && !budgetMax) { setError('BUDGET RANGE IS REQUIRED'); return false }
    return true
  }

  function handleNext() {
    setError('')
    if (step === 'details') {
      if (!validate()) return
      setStep('review')
    } else if (step === 'review') {
      setStep('payment')
    }
  }

  function handleBack() {
    setError('')
    if (step === 'review') setStep('details')
    else if (step === 'payment') setStep('review')
    else router.back()
  }

  async function uploadImageIfNeeded() {
    if (!gigImageFile || !currentUserId) return gigImageUrl
    setUploadingImage(true)
    const supabase = createClient()
    const ext = gigImageFile.name.split('.').pop() ?? 'jpg'
    const path = `${currentUserId}/gig-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('posts').upload(path, gigImageFile, { upsert: true })
    if (upErr) { setUploadingImage(false); return null }
    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path)
    setGigImageUrl(urlData.publicUrl)
    setUploadingImage(false)
    return urlData.publicUrl
  }

  async function handleProceedToPayment() {
    if (!currentUserId) return
    setSubmitting(true)
    setError('')

    const imageUrl = await uploadImageIfNeeded()

    const minVal = budgetMin ? parseFloat(budgetMin.replace(/[^0-9.]/g, '')) : null
    const maxVal = budgetMax ? parseFloat(budgetMax.replace(/[^0-9.]/g, '')) : null

    const draft = {
      poster_id: currentUserId,
      title: title.trim(),
      company_name: companyName.trim() || posterName || null,
      description: description.trim() || null,
      art_type: artType || null,
      image_url: imageUrl || null,
      location: locationString,
      date_timeframe: dateTimeframe || null,
      budget_min: minVal,
      budget_max: maxVal,
      is_featured: isFeatured,
      status: 'payment_pending',
      interest_count: 0,
      poster_name: posterName,
    }

    const supabase = createClient()

    if (pendingGigId) {
      await supabase.from('gigs').update(draft).eq('id', pendingGigId)
    } else {
      const { data, error: insertErr } = await supabase.from('gigs').insert(draft).select('id').single()
      if (insertErr) {
        // Schema may not support payment_pending — post as active directly
        const { error: activeErr } = await supabase.from('gigs').insert({ ...draft, status: 'active' })
        if (!activeErr) { router.push('/gigs'); return }
        setError(insertErr.message); setSubmitting(false); return
      }
      if (data) setPendingGigId((data as any).id)
    }
    setSubmitting(false)
  }

  const STEPS: Step[] = ['details', 'review', 'payment']
  const stepIndex = STEPS.indexOf(step)

  // ── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 20px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={handleBack} style={{ background: 'none', border: 'none', color: '#888880', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>‹</button>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em' }}>POST A GIG</h1>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '100%', height: 3,
              background: i <= stepIndex ? '#c0392b' : '#1a1a1a',
              transition: 'background 0.3s',
            }} />
            <span style={{ fontSize: 9, letterSpacing: '0.14em', color: i <= stepIndex ? '#fff' : '#444', marginTop: 6, fontFamily: 'inherit' }}>
              {s.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      {/* ── STEP 1: DETAILS ──────────────────────────────────────────── */}
      {step === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.06em' }}>GIG DETAILS</p>

          <div>
            <label className="woa-input-label">TITLE *</label>
            <input className="woa-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="WHAT ARE YOU LOOKING FOR?" maxLength={100} />
          </div>

          <div>
            <label className="woa-input-label">VENUE / COMPANY NAME <span style={{ color: '#555' }}>(OPTIONAL)</span></label>
            <input className="woa-input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="E.G. THE JAZZ ROOM, VOGUE MAGAZINE" maxLength={80} />
          </div>

          {/* Gig image */}
          <div>
            <label className="woa-input-label">GIG IMAGE <span style={{ color: '#555' }}>(OPTIONAL)</span></label>
            {gigImagePreview ? (
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <img src={gigImagePreview} alt="Gig" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => { setGigImageFile(null); setGigImagePreview(null); setGigImageUrl(null) }}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                >REMOVE</button>
              </div>
            ) : (
              <label style={{ display: 'block', border: '1px dashed #333', padding: '24px', textAlign: 'center', cursor: 'pointer' }}>
                <p style={{ fontSize: 12, letterSpacing: '0.1em', color: '#888880', marginBottom: 4 }}>ADD A VISUAL</p>
                <p style={{ fontSize: 10, letterSpacing: '0.08em', color: '#555' }}>POSTER, REFERENCE, MOOD, OR EVENT IMAGE</p>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setGigImageFile(f)
                  setGigImagePreview(URL.createObjectURL(f))
                }} />
              </label>
            )}
          </div>

          <div>
            <label className="woa-input-label">ART TYPE *</label>
            <select className="woa-input" value={artType} onChange={e => setArtType(e.target.value)} style={{ cursor: 'pointer' }}>
              <option value="">SELECT TYPE</option>
              {GIG_ART_TYPES.map(t => <option key={t} value={t} style={{ background: '#111' }}>{t}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="woa-input-label">COUNTRY *</label>
              <select className="woa-input" value={selectedCountry} onChange={e => { setSelectedCountry(e.target.value); setSelectedCity('') }} style={{ cursor: 'pointer' }}>
                <option value="">SELECT COUNTRY</option>
                {COUNTRIES.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="woa-input-label">CITY</label>
              <input className="woa-input" value={selectedCity} onChange={e => setSelectedCity(e.target.value)} placeholder="Enter city" disabled={!selectedCountry || selectedCountry === 'Remote'} />
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="woa-input-label">SCHEDULE *</label>
            <div style={{ border: '1px solid #1a1a1a', padding: 16, marginBottom: 8 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.18em', color: '#555', marginBottom: 10 }}>FROM</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="woa-input-label">DATE</label>
                  <input className="woa-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="woa-input-label">TIME</label>
                  <input className="woa-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ colorScheme: 'dark' }} />
                </div>
              </div>
            </div>
            <div style={{ border: '1px solid #1a1a1a', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontSize: 9, letterSpacing: '0.18em', color: '#555' }}>TO</p>
                <span style={{ fontSize: 9, color: '#444', letterSpacing: '0.12em' }}>OPTIONAL</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="woa-input-label">DATE</label>
                  <input className="woa-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || new Date().toISOString().split('T')[0]} style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="woa-input-label">TIME</label>
                  <input className="woa-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ colorScheme: 'dark' }} />
                </div>
              </div>
            </div>
            {dateTimeframe && (
              <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em', marginTop: 8 }}>{dateTimeframe}</p>
            )}
          </div>

          {/* Budget */}
          <div>
            <label className="woa-input-label">BUDGET RANGE *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <span style={{ padding: '12px', color: '#555', fontSize: 12 }}>$</span>
                <input
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none', padding: '12px 12px 12px 0' }}
                  type="number" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="MIN" min="0"
                />
              </div>
              <span style={{ color: '#555', fontSize: 14 }}>—</span>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <span style={{ padding: '12px', color: '#555', fontSize: 12 }}>$</span>
                <input
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontFamily: 'inherit', letterSpacing: '0.04em', outline: 'none', padding: '12px 12px 12px 0' }}
                  type="number" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="MAX" min="0"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="woa-input-label">DESCRIPTION</label>
            <textarea
              className="woa-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="DESCRIBE THE GIG IN DETAIL..."
              rows={5}
              maxLength={1000}
              style={{ resize: 'vertical' }}
            />
            <p style={{ fontSize: 10, color: '#444', marginTop: 4, letterSpacing: '0.04em' }}>{description.length}/1000</p>
          </div>

          {/* Featured toggle */}
          <div style={{ border: '1px solid #1a1a1a', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>FEATURED LISTING</p>
              <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em', lineHeight: 1.6, marginBottom: 6 }}>YOUR GIG APPEARS AT THE TOP OF THE BOARD WITH A FEATURED BADGE</p>
              <p style={{ fontSize: 12, color: '#c0392b', fontWeight: 700 }}>+${FEATURED_PRICE.toFixed(2)} ONE-TIME</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFeatured(!isFeatured)}
              style={{ flexShrink: 0, width: 48, height: 26, borderRadius: 13, background: isFeatured ? '#c0392b' : '#222', position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: isFeatured ? 25 : 3, transition: 'left 0.2s' }} />
            </button>
          </div>

          {/* Pricing summary */}
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111' }}>
              <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.1em' }}>BASE LISTING</span>
              <span style={{ fontSize: 10, color: '#fff', letterSpacing: '0.06em' }}>${STANDARD_PRICE.toFixed(2)}</span>
            </div>
            {isFeatured && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111' }}>
                <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.1em' }}>FEATURED UPGRADE</span>
                <span style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.06em' }}>${FEATURED_PRICE.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>TOTAL</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#c0392b' }}>${totalCost.toFixed(2)}</span>
            </div>
          </div>

          {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

          <button onClick={handleNext} className="btn-red" style={{ padding: '14px', fontSize: 11, letterSpacing: '0.14em' }}>
            REVIEW ›
          </button>
        </div>
      )}

      {/* ── STEP 2: REVIEW ───────────────────────────────────────────── */}
      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.06em' }}>REVIEW YOUR GIG</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {artType && (
              <span style={{ fontSize: 9, color: '#c0392b', border: '1px solid rgba(192,57,43,0.4)', padding: '3px 10px', letterSpacing: '0.1em' }}>{artType}</span>
            )}
            {isFeatured && (
              <span style={{ fontSize: 9, color: '#f6c55a', border: '1px solid #f6c55a', padding: '3px 10px', letterSpacing: '0.1em' }}>★ FEATURED</span>
            )}
          </div>

          {gigImagePreview && (
            <img src={gigImagePreview} alt="Gig" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
          )}

          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>{title.toUpperCase()}</h2>
            {companyName && <p style={{ fontSize: 12, color: '#888880', letterSpacing: '0.08em' }}>{companyName.toUpperCase()}</p>}
          </div>

          <div style={{ border: '1px solid #1a1a1a' }}>
            {[
              { label: 'LOCATION', val: locationString },
              { label: 'TIMEFRAME', val: dateTimeframe || null },
              { label: 'BUDGET', val: budgetMin && budgetMax ? `$${budgetMin} — $${budgetMax}` : budgetMin ? `FROM $${budgetMin}` : budgetMax ? `UP TO $${budgetMax}` : null },
            ].filter(r => r.val).map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #111' }}>
                <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.14em' }}>{row.label}</span>
                <span style={{ fontSize: 10, color: '#fff', letterSpacing: '0.08em', textAlign: 'right', maxWidth: '60%' }}>{row.val!.toUpperCase()}</span>
              </div>
            ))}
          </div>

          {description && (
            <div>
              <p style={{ fontSize: 9, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>DESCRIPTION</p>
              <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>{description}</p>
            </div>
          )}

          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.1em', marginBottom: 4 }}>TOTAL DUE</p>
              <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em' }}>
                {isFeatured ? 'FEATURED GIG — PINNED TO TOP' : 'STANDARD LISTING'}
              </p>
            </div>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#c0392b' }}>${totalCost.toFixed(2)}</span>
          </div>

          <button onClick={handleNext} className="btn-red" style={{ padding: '14px', fontSize: 11, letterSpacing: '0.14em' }}>
            PAYMENT ›
          </button>
        </div>
      )}

      {/* ── STEP 3: PAYMENT ──────────────────────────────────────────── */}
      {step === 'payment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.06em' }}>PAYMENT</p>

          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>TOTAL DUE</p>
              <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em' }}>
                {isFeatured ? 'FEATURED GIG — PINNED TO TOP FOR 7 DAYS' : 'STANDARD GIG LISTING'}
              </p>
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#c0392b' }}>${totalCost.toFixed(2)}</span>
          </div>

          {paymentSuccess ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px solid #2a7a4f', background: 'rgba(42,122,79,0.06)' }}>
              <p style={{ fontSize: 32, marginBottom: 16 }}>✓</p>
              <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', color: '#2ecc71', marginBottom: 8 }}>GIG POSTED!</p>
              <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em' }}>YOUR GIG IS NOW LIVE. REDIRECTING...</p>
            </div>
          ) : !pendingGigId ? (
            <button
              onClick={handleProceedToPayment}
              className="btn-red"
              disabled={submitting || uploadingImage}
              style={{ padding: '14px', fontSize: 11, letterSpacing: '0.14em' }}
            >
              {submitting || uploadingImage ? 'PREPARING...' : 'PROCEED TO PAYMENT ›'}
            </button>
          ) : (
            <>
              <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em', textAlign: 'center' }}>
                COMPLETE YOUR PAYMENT BELOW
              </p>
              <div style={{ border: '1px solid #222', overflow: 'hidden' }}>
                <iframe
                  ref={iframeRef}
                  src={`https://workerofart.com/checkout/gig.html?v=${checkoutVersion}&user_id=${currentUserId}&featured=${isFeatured}&gig_id=${pendingGigId}`}
                  style={{ width: '100%', height: 520, border: 'none', background: '#000' }}
                  title="Payment"
                />
              </div>
              <p style={{ fontSize: 9, color: '#444', letterSpacing: '0.08em', textAlign: 'center' }}>
                PAYMENTS PROCESSED SECURELY BY STRIPE
              </p>
            </>
          )}

          {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}
        </div>
      )}
    </div>
  )
}
