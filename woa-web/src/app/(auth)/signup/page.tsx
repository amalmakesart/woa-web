'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WOALogo } from '@/components/WOALogo'

type Role = 'ARTIST' | 'GIG_POSTER' | 'COLLECTIVE' | 'ART_LOVER'
type Step = 1 | 2 | 3 | 4
type UsernameStatus = 'idle' | 'checking' | 'taken' | 'available'

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

const COLLECTIVE_TYPES = [
  'GALLERY', 'RECORD LABEL', 'DANCE COMPANY', 'THEATRE COMPANY',
  'FILM COLLECTIVE', 'MUSIC VENUE', 'ART RESIDENCY', 'PUBLISHING HOUSE',
  'CREATIVE AGENCY', 'COMMUNITY ARTS ORG', 'FESTIVAL / EVENT', 'OTHER',
]

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  {
    value: 'ARTIST',
    label: 'ARTIST',
    description: 'SHARE YOUR WORK, BUILD YOUR PROFILE, CONNECT WITH OTHER CREATIVES, AND APPLY FOR GIGS AND COLLABS.',
  },
  {
    value: 'GIG_POSTER',
    label: 'GIG POSTER',
    description: 'POST PAID OPPORTUNITIES, DISCOVER ARTISTS, REVIEW APPLICANTS, AND HIRE THE RIGHT CREATIVE TEAM.',
  },
  {
    value: 'COLLECTIVE',
    label: 'COLLECTIVE',
    description: 'CREATE A SHARED PRESENCE FOR YOUR GROUP, SHOWCASE MEMBERS, POST COLLABS, AND BE DISCOVERED AS AN ORGANIZATION.',
  },
  {
    value: 'ART_LOVER',
    label: 'ART LOVER',
    description: 'DISCOVER ART, FOLLOW ARTISTS, AND STAY IN THE ARTSY LOOP.',
  },
]

const EMAIL_REDIRECT_URL = 'https://www.workerofart.com/auth/confirmed'

function AvatarUpload({ preview, onChange }: { preview: string | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
      <label style={{ cursor: 'pointer', textAlign: 'center' }}>
        {preview ? (
          <img src={preview} alt="avatar" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 16, marginBottom: 10, display: 'block' }} />
        ) : (
          <div style={{ width: 90, height: 90, background: '#111', border: '1px solid #333', borderRadius: 16, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, color: '#444' }}>+</span>
          </div>
        )}
        <p style={{ fontSize: 11, color: preview ? '#2a7a4f' : '#c0392b', letterSpacing: '0.14em', fontFamily: 'inherit' }}>
          {preview ? '✓ PHOTO SELECTED' : '+ UPLOAD PHOTO'}
        </p>
        <input type="file" accept="image/*" onChange={onChange} style={{ display: 'none' }} />
      </label>
    </div>
  )
}

function ArtTypeGrid({
  selected, onToggle, max, label,
}: {
  selected: string[]
  onToggle: (type: string) => void
  max: number
  label: string
}) {
  return (
    <div>
      <label className="woa-input-label">{label} (UP TO {max} — OPTIONAL)</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {ALL_ART_TYPES.map(type => {
          const active = selected.includes(type)
          const disabled = !active && selected.length >= max
          return (
            <button
              key={type}
              type="button"
              onClick={() => !disabled && onToggle(type)}
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
      {selected.length > 0 && (
        <p style={{ fontSize: 10, color: '#888', marginTop: 8, letterSpacing: '0.06em' }}>
          {selected.length}/{max} SELECTED
        </p>
      )}
    </div>
  )
}

function StepBreadcrumb({ active }: { active: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
      {(['CREDENTIALS', 'PROFILE', 'LINKS'] as const).map((label, i) => {
        const num = (i + 1) as 1 | 2 | 3
        return (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 11,
              color: num < active ? '#666' : num === active ? '#fff' : '#333',
              letterSpacing: '0.12em',
              fontFamily: 'inherit',
            }}>
              {label}
            </span>
            {i < 2 && <span style={{ color: '#444', fontSize: 12 }}>›</span>}
          </span>
        )
      })}
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [role, setRole] = useState<Role>('ARTIST')

  // Step 2: credentials
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)

  // Profile photo
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Common
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [instagram, setInstagram] = useState('')
  const [website, setWebsite] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')

  // ARTIST
  const [discipline, setDiscipline] = useState('')
  const [artTypes, setArtTypes] = useState<string[]>([])
  const [experience, setExperience] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [spotify, setSpotify] = useState('')
  const [facebook, setFacebook] = useState('')

  // COLLECTIVE
  const [collectiveType, setCollectiveType] = useState('')
  const [memberCount, setMemberCount] = useState('')

  // ART_LOVER
  const [artInterests, setArtInterests] = useState<string[]>([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!username.trim()) { setUsernameStatus('idle'); return }
    setUsernameStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 500)
  }, [username])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function toggleArtType(type: string, max: number, current: string[], setter: (fn: (prev: string[]) => string[]) => void) {
    setter(prev => {
      if (prev.includes(type)) return prev.filter(t => t !== type)
      if (prev.length >= max) return prev
      return [...prev, type]
    })
  }

  function buildProfileData() {
    const base: Record<string, any> = {
      full_name: fullName.trim(),
      username: username.toLowerCase(),
      role,
      follower_count: 0,
      rating_count: 0,
    }
    if (role === 'ARTIST') {
      return {
        ...base,
        discipline,
        art_types: artTypes,
        country: country.trim() || null,
        city: city.trim() || null,
        experience: experience || null,
        is_available: isAvailable,
        bio: bio.trim() || null,
        instagram: instagram.trim() || null,
        spotify_url: spotify.trim() || null,
        facebook: facebook.trim() || null,
        website: website.trim() || null,
      }
    }
    if (role === 'COLLECTIVE') {
      return {
        ...base,
        collective_type: collectiveType,
        member_count: memberCount ? parseInt(memberCount, 10) : null,
        country: country.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
        instagram: instagram.trim() || null,
        website: website.trim() || null,
      }
    }
    if (role === 'ART_LOVER') {
      return { ...base, art_types: artInterests }
    }
    return base
  }

  async function uploadAvatar(userId: string) {
    if (!avatarFile) return null
    const supabase = createClient()
    const ext = avatarFile.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
    if (upErr) return null
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    return urlData.publicUrl
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const supabase = createClient()
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: buildProfileData(),
          emailRedirectTo: EMAIL_REDIRECT_URL,
        },
      })
      if (signUpErr) { setError(signUpErr.message.toUpperCase()); return }
      const user = signUpData.user
      if (!user) { setError('SIGN UP FAILED — TRY AGAIN.'); return }

      const avatarUrl = await uploadAvatar(user.id)

      await supabase.from('profiles').upsert({
        id: user.id,
        ...buildProfileData(),
        profile_photo_url: avatarUrl,
      })

      router.push('/feed')
      router.refresh()
    } catch (e: any) {
      setError(e.message?.toUpperCase() ?? 'SOMETHING WENT WRONG.')
    } finally {
      setLoading(false)
    }
  }

  const borderDim = 'rgba(255,255,255,0.15)'

  // ── Step 1: Role ────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: '#000' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <WOALogo size="lg" />
          </div>

          <p style={{ fontSize: 11, color: '#666', letterSpacing: '0.2em', marginBottom: 8, textAlign: 'center' }}>CHOOSE YOUR ROLE</p>
          <p style={{ fontSize: 10, color: '#444', letterSpacing: '0.12em', marginBottom: 20, textAlign: 'center', lineHeight: 1.7 }}>
            PICK THE WAY YOU WANT TO USE WORK(ER) OF ART. YOU CAN ALWAYS EXPAND LATER.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {ROLE_OPTIONS.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                style={{
                  border: `1px solid ${role === r.value ? '#c0392b' : borderDim}`,
                  background: role === r.value ? 'rgba(192,57,43,0.08)' : 'transparent',
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: role === r.value ? '#fff' : '#888880', marginBottom: 4 }}>
                  {r.label}
                </span>
                <span style={{ fontSize: 10, color: '#666', letterSpacing: '0.06em', lineHeight: 1.7, display: 'block', fontFamily: 'inherit' }}>
                  {r.description}
                </span>
              </button>
            ))}
          </div>

          <button className="btn-primary" onClick={() => setStep(2)} style={{ width: '100%', padding: '14px' }}>
            CONTINUE
          </button>

          <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em', textAlign: 'center', marginTop: 24 }}>
            HAVE AN ACCOUNT?{' '}
            <Link href="/login" style={{ color: '#c0392b', textDecoration: 'none' }}>SIGN IN</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Step 2: Credentials ─────────────────────────────────────────────────────
  if (step === 2) {
    const canContinue =
      username.trim().length >= 3 &&
      usernameStatus === 'available' &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      agreed

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: '#000' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <button
            onClick={() => setStep(1)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}
          >
            ← BACK
          </button>
          <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 24 }}>ROLE › CREDENTIALS</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="woa-input-label">USERNAME *</label>
              <input
                className="woa-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="@username"
                autoComplete="username"
                minLength={3}
                style={{
                  color: '#c0392b',
                  borderBottomColor:
                    usernameStatus === 'taken' ? '#c0392b' :
                    usernameStatus === 'available' ? '#2a7a4f' :
                    undefined,
                }}
              />
              {usernameStatus === 'checking' && (
                <p style={{ fontSize: 10, color: '#666', letterSpacing: '0.12em', marginTop: 4 }}>CHECKING...</p>
              )}
              {usernameStatus === 'taken' && (
                <p style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.12em', marginTop: 4 }}>✕ ALREADY TAKEN</p>
              )}
              {usernameStatus === 'available' && (
                <p style={{ fontSize: 10, color: '#2a7a4f', letterSpacing: '0.12em', marginTop: 4 }}>✓ AVAILABLE</p>
              )}
            </div>

            <div>
              <label className="woa-input-label">EMAIL *</label>
              <input
                className="woa-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="woa-input-label">PASSWORD *</label>
              <input
                className="woa-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
              onClick={() => setAgreed(!agreed)}
            >
              <div style={{
                width: 18,
                height: 18,
                border: `1px solid ${agreed ? '#c0392b' : '#777'}`,
                background: agreed ? '#c0392b' : 'transparent',
                flexShrink: 0,
                marginTop: 2,
              }} />
              <p style={{ fontSize: 11, color: '#666', letterSpacing: '0.08em', lineHeight: 1.8, margin: 0 }}>
                {'I AGREE TO THE '}
                <Link href="https://www.workerofart.com/terms-of-service.html" target="_blank" onClick={e => e.stopPropagation()} style={{ color: '#fff', textDecoration: 'none' }}>
                  TERMS OF SERVICE
                </Link>
                {' AND '}
                <Link href="https://www.workerofart.com/privacy-policy.html" target="_blank" onClick={e => e.stopPropagation()} style={{ color: '#fff', textDecoration: 'none' }}>
                  PRIVACY POLICY
                </Link>
                {'. I AM 13 YEARS OF AGE OR OLDER.'}
              </p>
            </div>

            {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

            <button
              className="btn-primary"
              onClick={() => { setError(''); setStep(3) }}
              disabled={!canContinue}
              style={{ padding: '14px', opacity: canContinue ? 1 : 0.35 }}
            >
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Profile ─────────────────────────────────────────────────────────
  if (step === 3) {

    // ── GIG POSTER ──────────────────────────────────────────────────────────
    if (role === 'GIG_POSTER') {
      const canLaunch = Boolean(fullName.trim() && !loading)
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: '#000' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}>
              ← BACK
            </button>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 24 }}>CREDENTIALS › PROFILE</p>

            <AvatarUpload preview={avatarPreview} onChange={handleAvatarChange} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="woa-input-label">FULL NAME *</label>
                <input className="woa-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" required />
              </div>

              {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

              <button className="btn-red" onClick={handleSubmit} disabled={!canLaunch} style={{ padding: '14px', opacity: canLaunch ? 1 : 0.35 }}>
                {loading ? 'CREATING PROFILE...' : 'LAUNCH MY PROFILE'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── ART LOVER ──────────────────────────────────────────────────────────
    if (role === 'ART_LOVER') {
      const canLaunch = Boolean(fullName.trim() && !loading)
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 80px', background: '#000' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}>
              ← BACK
            </button>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 24 }}>CREDENTIALS › PROFILE</p>

            <AvatarUpload preview={avatarPreview} onChange={handleAvatarChange} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="woa-input-label">FULL NAME *</label>
                <input className="woa-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" required />
              </div>

              <div style={{ background: '#090909', border: '1px solid #1f1f1f', padding: 12 }}>
                <p style={{ fontSize: 11, color: '#fff', letterSpacing: '0.18em', marginBottom: 4 }}>WHAT ART ARE YOU INTO?</p>
                <p style={{ fontSize: 10, color: '#888', letterSpacing: '0.1em', lineHeight: 1.7 }}>
                  PICK UP TO 7 TAGS. WE'LL USE THESE TO PERSONALISE YOUR FEED.
                </p>
              </div>

              <ArtTypeGrid
                selected={artInterests}
                onToggle={type => toggleArtType(type, 7, artInterests, setArtInterests)}
                max={7}
                label="INTERESTS"
              />

              {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

              <button className="btn-red" onClick={handleSubmit} disabled={!canLaunch} style={{ padding: '14px', opacity: canLaunch ? 1 : 0.35 }}>
                {loading ? 'CREATING PROFILE...' : 'ENTER WORK(ER) OF ART'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── COLLECTIVE ──────────────────────────────────────────────────────────
    if (role === 'COLLECTIVE') {
      const canLaunch = Boolean(fullName.trim() && collectiveType && country.trim() && city.trim() && !loading)
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 80px', background: '#000' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}>
              ← BACK
            </button>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 24 }}>CREDENTIALS › ORG PROFILE</p>

            <AvatarUpload preview={avatarPreview} onChange={handleAvatarChange} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="woa-input-label">ORGANIZATION NAME *</label>
                <input className="woa-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your organization name" autoComplete="organization" required />
              </div>
              <div>
                <label className="woa-input-label">ORGANIZATION TYPE *</label>
                <select className="woa-input" value={collectiveType} onChange={e => setCollectiveType(e.target.value)} style={{ cursor: 'pointer' }} required>
                  <option value="">SELECT TYPE</option>
                  {COLLECTIVE_TYPES.map(t => (
                    <option key={t} value={t} style={{ background: '#111' }}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="woa-input-label">NUMBER OF MEMBERS (OPTIONAL)</label>
                <input
                  className="woa-input"
                  type="number"
                  value={memberCount}
                  onChange={e => setMemberCount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="E.G. 12"
                  min="1"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="woa-input-label">COUNTRY *</label>
                  <input className="woa-input" type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="COUNTRY" required />
                </div>
                <div>
                  <label className="woa-input-label">CITY *</label>
                  <input className="woa-input" type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="CITY" required />
                </div>
              </div>
              <div>
                <label className="woa-input-label">BIO / ABOUT YOUR COLLECTIVE (OPTIONAL)</label>
                <textarea
                  className="woa-input"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="TELL PEOPLE WHAT YOUR COLLECTIVE DOES."
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="woa-input-label">INSTAGRAM URL (OPTIONAL)</label>
                <input className="woa-input" type="url" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/..." />
              </div>
              <div>
                <label className="woa-input-label">WEBSITE URL (OPTIONAL)</label>
                <input className="woa-input" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
              </div>

              {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

              <button className="btn-red" onClick={handleSubmit} disabled={!canLaunch} style={{ padding: '14px', opacity: canLaunch ? 1 : 0.35 }}>
                {loading ? 'CREATING PROFILE...' : 'LAUNCH OUR PROFILE'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── ARTIST: Profile step ──────────────────────────────────────────────
    function handleArtistContinue() {
      if (!avatarPreview) { setError('PLEASE UPLOAD A PROFILE PHOTO.'); return }
      if (!fullName.trim()) { setError('FULL NAME IS REQUIRED.'); return }
      if (!discipline) { setError('PLEASE SELECT YOUR DISCIPLINE.'); return }
      if (!country.trim()) { setError('PLEASE SELECT YOUR COUNTRY.'); return }
      if (!city.trim()) { setError('PLEASE SELECT YOUR CITY.'); return }
      if (!experience) { setError('YEARS OF EXPERIENCE IS REQUIRED.'); return }
      setError('')
      setStep(4)
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 80px', background: '#000' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}>
            ← BACK
          </button>

          <StepBreadcrumb active={2} />

          <AvatarUpload preview={avatarPreview} onChange={handleAvatarChange} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="woa-input-label">FULL NAME *</label>
              <input className="woa-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
            </div>

            <div>
              <label className="woa-input-label">DISCIPLINE *</label>
              <select
                className="woa-input"
                value={discipline}
                onChange={e => { setDiscipline(e.target.value); setArtTypes([]) }}
                style={{ cursor: 'pointer' }}
                required
              >
                <option value="">SELECT DISCIPLINE</option>
                {DISCIPLINES.map(d => <option key={d} value={d} style={{ background: '#111' }}>{d}</option>)}
              </select>
            </div>

            {discipline && (
              <div>
                <div style={{ background: '#090909', border: '1px solid #1f1f1f', padding: 12, marginBottom: 8 }}>
                  <p style={{ fontSize: 11, color: '#fff', letterSpacing: '0.18em', marginBottom: 4 }}>NOW ADD TAGS</p>
                  <p style={{ fontSize: 10, color: '#888', letterSpacing: '0.1em', lineHeight: 1.7 }}>
                    PICK UP TO 5 SPECIALTIES SO PEOPLE CAN FIND YOU BY WHAT YOU ACTUALLY DO.
                  </p>
                </div>
                <ArtTypeGrid
                  selected={artTypes}
                  onToggle={type => toggleArtType(type, 5, artTypes, setArtTypes)}
                  max={5}
                  label="TAGS / SPECIALTIES"
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="woa-input-label">COUNTRY *</label>
                <input className="woa-input" type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="COUNTRY" required />
              </div>
              <div>
                <label className="woa-input-label">CITY *</label>
                <input className="woa-input" type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="CITY" required />
              </div>
            </div>

            <div>
              <label className="woa-input-label">YEARS OF EXPERIENCE *</label>
              <input
                className="woa-input"
                type="number"
                value={experience}
                onChange={e => setExperience(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="E.G. 5"
                min="0"
                max="999"
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: 16 }}>
              <div>
                <p style={{ fontSize: 12, letterSpacing: '0.12em', color: '#fff', marginBottom: 2 }}>AVAILABLE FOR WORK</p>
                <p style={{ fontSize: 10, color: '#666', letterSpacing: '0.08em' }}>LET GIG POSTERS KNOW YOU ARE AVAILABLE</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvailable(!isAvailable)}
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: isAvailable ? '#c0392b' : '#222',
                  position: 'relative',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: 3,
                  left: isAvailable ? 19 : 3,
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

            <button className="btn-primary" onClick={handleArtistContinue} style={{ padding: '14px' }}>
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 4: ARTIST links + bio ───────────────────────────────────────────────
  const canLaunch = Boolean(bio.trim() && !loading)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 80px', background: '#000' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <button onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}>
          ← BACK
        </button>

        <StepBreadcrumb active={3} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="woa-input-label">BIO *</label>
            <textarea
              className="woa-input"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="TELL US ABOUT YOUR WORK..."
              rows={4}
              style={{ resize: 'vertical' }}
              required
            />
          </div>
          <div>
            <label className="woa-input-label">INSTAGRAM URL (OPTIONAL)</label>
            <input className="woa-input" type="url" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/..." />
          </div>
          <div>
            <label className="woa-input-label">SPOTIFY URL (OPTIONAL)</label>
            <input className="woa-input" type="url" value={spotify} onChange={e => setSpotify(e.target.value)} placeholder="https://open.spotify.com/artist/..." />
          </div>
          <div>
            <label className="woa-input-label">FACEBOOK URL (OPTIONAL)</label>
            <input className="woa-input" type="url" value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div>
            <label className="woa-input-label">WEBSITE / PORTFOLIO (OPTIONAL)</label>
            <input className="woa-input" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
          </div>

          {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

          <button className="btn-red" onClick={handleSubmit} disabled={!canLaunch} style={{ padding: '14px', opacity: canLaunch ? 1 : 0.35 }}>
            {loading ? 'CREATING PROFILE...' : 'LAUNCH MY PROFILE'}
          </button>
        </div>
      </div>
    </div>
  )
}
