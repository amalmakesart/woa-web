'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/admin'

const DISCIPLINES = [
  'Photographer', 'Musician', 'Videographer', 'Model', 'Dancer', 'Filmmaker',
  'Visual Artist', 'Graphic Designer', 'Muralist', 'Actor', 'DJ', 'Tattoo Artist',
  'Fashion Designer', 'Animator', 'Illustrator', 'Writer', 'Chef', 'Makeup Artist',
  'Hair Stylist', 'Performer', 'Craftsperson', 'Interdisciplinary Artist',
]

const ART_TYPES_BY_DISCIPLINE: Record<string, string[]> = {
  'Photographer': ['Portrait Photographer','Fashion Photographer','Documentary Photographer','Event Photographer','Wedding Photographer','Music Photographer','Food Photographer','Product Photographer','Commercial Photographer','Architectural Photographer','Analog Photographer','Photo Retoucher'],
  'Musician': ['Singer','Songwriter','Composer','Producer','Beatmaker','Multi-Instrumentalist','Pianist','Guitarist','Bassist','Drummer','Violinist','Cellist','Saxophonist','Trumpet Player','Percussionist','Vocalist','Choir Singer','Opera Singer','Sound Designer','Audio Engineer','Mixing Engineer','Mastering Engineer'],
  'Videographer': ['Videographer','Director','Cinematographer','Camera Operator','Video Editor','Documentary Videographer','Event Videographer','Music Video Director','Drone Videographer','Motion Graphics Editor','Colorist','Livestream Producer'],
  'Model': ['Fashion Model','Runway Model','Commercial Model','Editorial Model','Fit Model','Plus-Size Model','Beauty Model','Lifestyle Model','Hand Model','Brand Ambassador'],
  'Dancer': ['Contemporary Dancer','Hip Hop Dancer','Ballet Dancer','Latin Dancer','Jazz Dancer','Choreographer','Dance Captain','Movement Director','Backup Dancer'],
  'Filmmaker': ['Director','Screenwriter','Producer','Assistant Director','Cinematographer','Editor','Gaffer','Production Designer','Set Designer','Documentary Filmmaker','Short Film Director'],
  'Visual Artist': ['Painter','Sculptor','Ceramic Artist','Mixed Media Artist','Printmaker','Installation Artist','Digital Artist','Street Artist','Calligrapher','Collage Artist','Glass Artist','Textile Artist','Fiber Artist','Conceptual Artist'],
  'Graphic Designer': ['Brand Designer','Poster Designer','Editorial Designer','Motion Designer','Packaging Designer','UI Designer','Web Designer','Type Designer','Illustrator','3D Designer'],
  'Muralist': ['Public Muralist','Street Muralist','Community Muralist','Live Painter','Lettering Artist','Large-Scale Illustrator'],
  'Actor': ['Film Actor','Theatre Actor','Voice Actor','Commercial Actor','Improviser','Musical Theatre Performer','Stunt Performer'],
  'DJ': ['Club DJ','Event DJ','Radio DJ','Turntablist','Open Format DJ','House DJ','Hip Hop DJ','Afrobeat DJ','Wedding DJ'],
  'Tattoo Artist': ['Fine Line Tattoo Artist','Traditional Tattoo Artist','Blackwork Tattoo Artist','Colour Tattoo Artist','Illustrative Tattoo Artist','Handpoke Artist'],
  'Fashion Designer': ['Womenswear Designer','Menswear Designer','Costume Designer','Textile Designer','Pattern Maker','Stylist','Accessory Designer','Jewelry Designer'],
  'Animator': ['2D Animator','3D Animator','Motion Designer','Stop Motion Animator','Character Animator','Storyboard Artist','VFX Artist'],
  'Illustrator': ['Editorial Illustrator','Children\'s Illustrator','Comic Artist','Character Designer','Concept Artist','Surface Designer','Book Cover Illustrator'],
  'Writer': ['Screenwriter','Playwright','Novelist','Poet','Copywriter','Journalist','Essayist','Spoken Word Artist','Zine Maker','Lyricist'],
  'Chef': ['Chef','Baker','Pastry Chef','Food Stylist','Caterer','Mixologist','Barista','Chocolatier'],
  'Makeup Artist': ['Bridal Makeup Artist','Editorial Makeup Artist','SFX Makeup Artist','Film Makeup Artist','Beauty Educator','Drag Makeup Artist'],
  'Hair Stylist': ['Session Stylist','Bridal Stylist','Barber','Colorist','Wig Stylist','Natural Hair Stylist'],
  'Performer': ['Comedian','Drag Performer','Spoken Word Performer','Host','MC','Magician','Circus Performer','Puppeteer','Performance Artist','Storyteller'],
  'Craftsperson': ['Woodworker','Furniture Maker','Weaver','Embroiderer','Ceramic Artist','Leatherworker','Metalworker','Candle Maker','Soap Maker','Mosaic Artist','Bookbinder','Paper Artist'],
  'Interdisciplinary Artist': ['Multimedia Artist','Interdisciplinary Artist','Installation Artist','Experience Designer','Interactive Artist','VR Artist','AR Artist','Sound Artist','Light Artist','Environmental Artist','Community Artist','AI Artist'],
}

const ALL_ART_TYPES = Array.from(new Set(Object.values(ART_TYPES_BY_DISCIPLINE).flat())).sort()

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
  }, [targetId])

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
            {!isGigPoster && !isArtLover && (
              <div>
                <label className="woa-input-label">USERNAME</label>
                <input className="woa-input" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username" />
              </div>
            )}
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
            {!isGigPoster && !isArtLover && (
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
            )}
          </div>
        </div>

        {/* Art discipline */}
        {showArtistFields && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 14 }}>DISCIPLINE & EXPERIENCE</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="woa-input-label">MAIN DISCIPLINE</label>
                <select className="woa-input" value={discipline} onChange={e => { setDiscipline(e.target.value); setArtTypes([]) }} style={{ cursor: 'pointer' }}>
                  <option value="">SELECT DISCIPLINE</option>
                  {DISCIPLINES.map(d => <option key={d} value={d} style={{ background: '#111' }}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="woa-input-label">YEARS OF EXPERIENCE</label>
                <input
                  className="woa-input"
                  type="number"
                  value={experience}
                  onChange={e => setExperience(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="E.G. 5"
                  min="0"
                  max="99"
                />
              </div>
              <div>
                <label className="woa-input-label">SPECIALTIES (SELECT UP TO 5)</label>
                {!discipline ? (
                  <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em', marginTop: 6 }}>
                    SELECT A DISCIPLINE FIRST
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {(ART_TYPES_BY_DISCIPLINE[discipline] ?? []).map(type => {
                        const active = artTypes.includes(type)
                        const disabled = !active && artTypes.length >= 5
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => !disabled && toggleArtType(type)}
                            style={{
                              padding: '6px 12px',
                              fontSize: 10,
                              letterSpacing: '0.06em',
                              border: active ? '1px solid #c0392b' : '1px solid #2a2a2a',
                              background: active ? 'rgba(192,57,43,0.12)' : 'transparent',
                              color: active ? '#c0392b' : disabled ? '#333' : '#888',
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
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Location — not for GIG_POSTER or ART_LOVER */}
        {!isGigPoster && !isArtLover && (
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
        )}

        {/* Social links — not for GIG_POSTER or ART_LOVER */}
        {!isGigPoster && !isArtLover && (
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
        )}

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
