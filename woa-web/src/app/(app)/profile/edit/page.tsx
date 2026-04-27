'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/admin'

const DISCIPLINES = [
  'VISUAL ARTIST', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'FILMMAKER',
  'MUSICIAN', 'SINGER', 'DJ', 'PRODUCER', 'MODEL', 'ACTOR',
  'DANCER', 'CHOREOGRAPHER', 'PAINTER', 'ILLUSTRATOR', 'GRAPHIC DESIGNER',
  'ANIMATOR', 'MURALIST', 'SCULPTOR', 'TATTOO ARTIST', 'FASHION DESIGNER',
  'MAKEUP ARTIST', 'HAIR STYLIST', 'WRITER', 'CHEF', 'PERFORMER', 'OTHER',
]

const ALL_ART_TYPES = [
  'ABSTRACT', 'ACRYLIC', 'ALBUM ART', 'ANIMATION', 'ARCHITECTURE', 'BAND PHOTOGRAPHY',
  'BLACK & WHITE', 'BOOK COVER', 'BRANDING', 'CALLIGRAPHY', 'CERAMICS', 'CHARACTER DESIGN',
  'CHARCOAL', 'COLLAGE', 'COMIC ART', 'CONCEPT ART', 'COVER ART', 'DANCE',
  'DIGITAL ART', 'DOCUMENTARY', 'EDITORIAL', 'EMBROIDERY', 'EXPERIMENTAL', 'FASHION',
  'FILM PHOTOGRAPHY', 'FINE ART', 'FLORAL', 'FOLK ART', 'FOOD PHOTOGRAPHY', 'FRESCO',
  'GAME ART', 'GLASSWORK', 'GRAFFITI', 'GRAPHIC NOVEL', 'ILLUSTRATION', 'INK',
  'INSTALLATION ART', 'JEWELRY', 'LANDSCAPE', 'LETTERING', 'LIGHT ART', 'LIVE MUSIC',
  'LOGO DESIGN', 'MAKEUP ART', 'MIXED MEDIA', 'MOSAIC', 'MOTION GRAPHICS', 'MURAL',
  'NATURE', 'NFT ART', 'OIL PAINTING', 'ORIGAMI', 'PAINTING', 'PAPER ART',
  'PASTEL', 'PATTERN', 'PERFORMANCE ART', 'PHOTOGRAPHY', 'PIXEL ART', 'PORTRAIT',
  'POSTER DESIGN', 'POTTERY', 'PRINT', 'SCULPTURE', 'SKETCH', 'SOUND DESIGN',
  'SPOKEN WORD', 'SPRAY PAINT', 'STREET ART', 'STREET PHOTOGRAPHY', 'TATTOO',
  'TEXTILE', 'TYPOGRAPHY', 'UI/UX', 'VIDEO ART', 'WATERCOLOR', 'WEB DESIGN', 'WOODWORK',
]

const EXPERIENCE_OPTIONS = ['< 1 YEAR', '1-2 YEARS', '3-5 YEARS', '6-10 YEARS', '10+ YEARS']

export default function EditProfilePage() {
  const router = useRouter()
  const [targetId, setTargetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [artTypes, setArtTypes] = useState<string[]>([])
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [bio, setBio] = useState('')
  const [experience, setExperience] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [isAvailable, setIsAvailable] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [collectiveType, setCollectiveType] = useState('')
  const [memberCount, setMemberCount] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const normalizedRole = (role ?? '').toUpperCase()
  const isGigPoster = normalizedRole === 'GIG_POSTER'
  const isCollective = normalizedRole === 'COLLECTIVE'
  const isArtLover = normalizedRole === 'ART_LOVER'
  const showArtistFields = !isGigPoster && !isCollective && !isArtLover

  useEffect(() => {
    if (typeof window === 'undefined') return
    setTargetId(new URLSearchParams(window.location.search).get('target'))
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const admin = isAdminEmail(user.email)
      setIsAdmin(admin)
      const profileId = targetId && admin ? targetId : user.id
      const { data } = await supabase.from('profiles').select('*').eq('id', profileId).single()
      if (data) {
        const d = data as any
        setFullName(d.full_name ?? '')
        setUsername(d.username ?? '')
        setDiscipline(d.discipline ?? d.art_type ?? '')
        setArtTypes(d.art_types ?? [])
        setCity(d.city ?? '')
        setCountry(d.country ?? '')
        setBio(d.bio ?? '')
        setExperience(d.experience ?? '')
        setInstagram(d.instagram ?? '')
        setFacebook(d.facebook ?? '')
        setWebsite(d.website ?? '')
        setSpotifyUrl(d.spotify_url ?? '')
        setIsAvailable(d.is_available ?? false)
        setCompanyName(d.company_name ?? '')
        setCollectiveType(d.collective_type ?? '')
        setMemberCount(d.member_count != null ? String(d.member_count) : '')
        setAvatarUrl(d.profile_photo_url ?? '')
        setRole(d.role ?? null)
      }
      setLoading(false)
    }
    load()
  }, [router, targetId])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ext = file.name.split('.').pop()
    const profileId = targetId && isAdmin ? targetId : user.id
    const path = `${profileId}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(urlData.publicUrl + '?t=' + Date.now())
    }
    setUploading(false)
  }

  function toggleArtType(type: string) {
    setArtTypes(prev => {
      if (prev.includes(type)) return prev.filter(t => t !== type)
      if (prev.length >= 5) return prev
      return [...prev, type]
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const profileId = targetId && isAdmin ? targetId : user.id

    const updates: Record<string, any> = {
      full_name: fullName || null,
      username: username.toLowerCase().trim() || null,
      city: city || null,
      country: country || null,
      bio: bio || null,
      instagram: instagram || null,
      facebook: facebook || null,
      website: website || null,
      profile_photo_url: avatarUrl || null,
    }
    if (showArtistFields) {
      updates.discipline = discipline || null
      updates.art_type = discipline || null
      updates.art_types = artTypes.length > 0 ? artTypes : null
      updates.experience = experience || null
      updates.spotify_url = spotifyUrl || null
      updates.is_available = isAvailable
    }
    if (isCollective) {
      updates.collective_type = collectiveType || null
      updates.member_count = memberCount ? parseInt(memberCount, 10) : null
    }
    if (isGigPoster) {
      updates.company_name = companyName || null
    }
    if (isArtLover) {
      updates.art_types = artTypes.length > 0 ? artTypes : null
    }

    const { error: err } = await supabase.from('profiles').update(updates).eq('id', profileId)

    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true)
    setSaving(false)
    setTimeout(() => { router.push(targetId && isAdmin ? `/artists/${profileId}` : '/profile') }, 800)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
        LOADING...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ marginBottom: 24, fontSize: 11, letterSpacing: '0.1em' }}>
        ← BACK
      </button>

      <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 32 }}>
        {targetId && isAdmin ? 'ADMIN EDIT PROFILE' : 'EDIT PROFILE'}
      </h1>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="oct-avatar" style={{ width: 80, height: 80 }} />
        ) : (
          <div className="oct-avatar" style={{ width: 80, height: 80, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 28 }}>◯</div>
        )}
        <div>
          <label className="btn-primary" style={{ padding: '8px 16px', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', display: 'inline-block' }}>
            {uploading ? 'UPLOADING...' : 'CHANGE PHOTO'}
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          </label>
          <p style={{ fontSize: 10, color: '#555', marginTop: 8, letterSpacing: '0.06em' }}>JPG, PNG OR GIF</p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Basic info */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 14 }}>BASIC INFO</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="woa-input-label">FULL NAME</label>
              <input className="woa-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="woa-input-label">USERNAME</label>
              <input className="woa-input" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username" />
            </div>
            {isGigPoster && (
              <div>
                <label className="woa-input-label">COMPANY / VENUE NAME</label>
                <input className="woa-input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company or venue" />
              </div>
            )}
            {isCollective && (
              <>
                <div>
                  <label className="woa-input-label">ORGANIZATION TYPE</label>
                  <select className="woa-input" value={collectiveType} onChange={e => setCollectiveType(e.target.value)} style={{ cursor: 'pointer' }}>
                    <option value="">SELECT TYPE</option>
                    {['GALLERY', 'RECORD LABEL', 'DANCE COMPANY', 'THEATRE COMPANY', 'FILM COLLECTIVE', 'MUSIC VENUE', 'ART RESIDENCY', 'PUBLISHING HOUSE', 'CREATIVE AGENCY', 'COMMUNITY ARTS ORG', 'FESTIVAL / EVENT', 'OTHER'].map(t => (
                      <option key={t} value={t} style={{ background: '#111' }}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="woa-input-label">NUMBER OF MEMBERS (OPTIONAL)</label>
                  <input className="woa-input" type="number" value={memberCount} onChange={e => setMemberCount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="E.G. 12" min="1" />
                </div>
              </>
            )}
            <div>
              <label className="woa-input-label">BIO</label>
              <textarea
                className="woa-input"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="A few words about your work..."
                rows={4}
                maxLength={500}
                style={{ resize: 'vertical' }}
              />
              <p style={{ fontSize: 10, color: '#444', marginTop: 4, letterSpacing: '0.04em' }}>{bio.length}/500</p>
            </div>
          </div>
        </div>

        {/* Art discipline */}
        {showArtistFields && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 14 }}>DISCIPLINE & EXPERIENCE</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="woa-input-label">MAIN DISCIPLINE</label>
                <select className="woa-input" value={discipline} onChange={e => setDiscipline(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="">SELECT DISCIPLINE</option>
                  {DISCIPLINES.map(d => <option key={d} value={d} style={{ background: '#111' }}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="woa-input-label">YEARS OF EXPERIENCE</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EXPERIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setExperience(experience === opt ? '' : opt)}
                      style={{
                        padding: '8px 14px',
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        border: experience === opt ? '1px solid #fff' : '1px solid #333',
                        background: experience === opt ? '#fff' : 'transparent',
                        color: experience === opt ? '#000' : '#888',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="woa-input-label">ART TYPES (SELECT UP TO 5)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {ALL_ART_TYPES.map(type => {
                    const active = artTypes.includes(type)
                    const disabled = !active && artTypes.length >= 5
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => !disabled && toggleArtType(type)}
                        style={{
                          padding: '5px 10px',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          border: active ? '1px solid #c0392b' : '1px solid #2a2a2a',
                          background: active ? 'rgba(192,57,43,0.12)' : 'transparent',
                          color: active ? '#c0392b' : disabled ? '#333' : '#666',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                          opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        {type}
                      </button>
                    )
                  })}
                </div>
                {artTypes.length > 0 && (
                  <p style={{ fontSize: 10, color: '#888', marginTop: 8, letterSpacing: '0.06em' }}>
                    {artTypes.length}/5 SELECTED
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Location */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 14 }}>LOCATION</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="woa-input-label">CITY</label>
              <input className="woa-input" value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
            </div>
            <div>
              <label className="woa-input-label">COUNTRY</label>
              <input className="woa-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" />
            </div>
          </div>
        </div>

        {/* Social links */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 14 }}>LINKS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="woa-input-label">INSTAGRAM HANDLE</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <span style={{ background: '#111', border: '1px solid #222', borderRight: 'none', padding: '12px', fontSize: 11, color: '#555', letterSpacing: '0.04em' }}>@</span>
                <input className="woa-input" value={instagram} onChange={e => setInstagram(e.target.value.replace('@', ''))} placeholder="yourhandle" style={{ borderLeft: 'none' }} />
              </div>
            </div>
            <div>
              <label className="woa-input-label">FACEBOOK</label>
              <input className="woa-input" value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div>
              <label className="woa-input-label">WEBSITE</label>
              <input className="woa-input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
            </div>
            {showArtistFields && (
              <div>
                <label className="woa-input-label">SPOTIFY / SOUNDCLOUD</label>
                <input className="woa-input" value={spotifyUrl} onChange={e => setSpotifyUrl(e.target.value)} placeholder="https://open.spotify.com/..." />
              </div>
            )}
          </div>
        </div>

        {showArtistFields && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 14 }}>AVAILABILITY</p>
            <button
              type="button"
              onClick={() => setIsAvailable(!isAvailable)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
            <div style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              background: isAvailable ? '#2ecc71' : '#222',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 3,
                left: isAvailable ? 23 : 3,
                transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: isAvailable ? '#2ecc71' : '#888880', fontFamily: 'inherit' }}>
              {isAvailable ? 'AVAILABLE FOR BOOKINGS' : 'NOT AVAILABLE'}
            </span>
            </button>
          </div>
        )}

        {/* ART LOVER — art interests */}
        {isArtLover && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 14 }}>INTERESTS (UP TO 7)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_ART_TYPES.map(type => {
                const active = artTypes.includes(type)
                const disabled = !active && artTypes.length >= 7
                return (
                  <button key={type} type="button" onClick={() => !disabled && toggleArtType(type)}
                    style={{ padding: '5px 10px', fontSize: 9, letterSpacing: '0.08em', border: active ? '1px solid #c0392b' : '1px solid #2a2a2a', background: active ? 'rgba(192,57,43,0.12)' : 'transparent', color: active ? '#c0392b' : disabled ? '#333' : '#666', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1 }}>
                    {type}
                  </button>
                )
              })}
            </div>
            {artTypes.length > 0 && <p style={{ fontSize: 10, color: '#888', marginTop: 8, letterSpacing: '0.06em' }}>{artTypes.length}/7 SELECTED</p>}
          </div>
        )}

        {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}
        {success && <p style={{ fontSize: 11, color: '#2ecc71', letterSpacing: '0.06em' }}>SAVED!</p>}

        <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 4, padding: '14px' }}>
          {saving ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </form>
    </div>
  )
}
