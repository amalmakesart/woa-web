'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WOALogo } from '@/components/WOALogo'
import { CITIES_BY_COUNTRY, COUNTRIES } from '@/lib/locationData'

type Role = 'ARTIST' | 'GIG_POSTER' | 'COLLECTIVE' | 'ART_LOVER'
type Step = 1 | 2 | 3 | 4
type UsernameStatus = 'idle' | 'checking' | 'taken' | 'available'

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
const MAX_AVATAR_FALLBACK_BYTES = 900 * 1024
const AVATAR_FALLBACK_MAX_EDGE = 320
const AVATAR_UPLOAD_MAX_EDGE = 1400
const AVATAR_UPLOAD_QUALITY = 0.86

function normalizeCity(value: string) {
  const normalized = value.trim().toUpperCase()
  return normalized || null
}

async function processAvatarFile(file: File) {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = objectUrl
    })

    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight) || 1
    const uploadScale = Math.min(1, AVATAR_UPLOAD_MAX_EDGE / longestEdge)
    const uploadCanvas = document.createElement('canvas')
    uploadCanvas.width = Math.max(1, Math.round(image.naturalWidth * uploadScale))
    uploadCanvas.height = Math.max(1, Math.round(image.naturalHeight * uploadScale))

    const uploadContext = uploadCanvas.getContext('2d')
    if (!uploadContext) {
      throw new Error('Failed to process image')
    }
    uploadContext.drawImage(image, 0, 0, uploadCanvas.width, uploadCanvas.height)

    const uploadBlob = await new Promise<Blob | null>((resolve) => {
      uploadCanvas.toBlob(
        blob => resolve(blob),
        'image/jpeg',
        AVATAR_UPLOAD_QUALITY
      )
    })
    if (!uploadBlob) {
      throw new Error('Failed to prepare image upload')
    }

    const uploadFile = new File(
      [uploadBlob],
      `${file.name.replace(/\.[^.]+$/, '') || 'avatar'}.jpg`,
      { type: 'image/jpeg' }
    )

    const fallbackScale = Math.min(1, AVATAR_FALLBACK_MAX_EDGE / longestEdge)
    const fallbackCanvas = document.createElement('canvas')
    fallbackCanvas.width = Math.max(1, Math.round(image.naturalWidth * fallbackScale))
    fallbackCanvas.height = Math.max(1, Math.round(image.naturalHeight * fallbackScale))

    const fallbackContext = fallbackCanvas.getContext('2d')
    if (!fallbackContext) {
      throw new Error('Failed to prepare image preview')
    }

    fallbackContext.drawImage(image, 0, 0, fallbackCanvas.width, fallbackCanvas.height)

    for (const quality of [0.82, 0.72, 0.6, 0.5]) {
      const dataUrl = fallbackCanvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= MAX_AVATAR_FALLBACK_BYTES) {
        return {
          uploadFile,
          previewUrl: URL.createObjectURL(uploadBlob),
          fallbackDataUrl: dataUrl,
        }
      }
    }

    return {
      uploadFile,
      previewUrl: URL.createObjectURL(uploadBlob),
      fallbackDataUrl: null,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

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

const ALL_ART_TYPES = Array.from(new Set(Object.values(ART_TYPES_BY_DISCIPLINE).flat())).sort()

function ArtTypeGrid({
  selected, onToggle, max, label, tags,
}: {
  selected: string[]
  onToggle: (type: string) => void
  max: number
  label: string
  tags?: string[]
}) {
  const list = tags ?? ALL_ART_TYPES
  return (
    <div>
      <label className="woa-input-label">{label} (UP TO {max} — OPTIONAL)</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {list.map(type => {
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
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)

  // Step 2: credentials
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)

  // Profile photo
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFallbackUrl, setAvatarFallbackUrl] = useState<string | null>(null)
  const [avatarProcessing, setAvatarProcessing] = useState(false)
  const [avatarError, setAvatarError] = useState('')

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
  const availableCities = useMemo(() => country ? (CITIES_BY_COUNTRY[country] ?? []) : [], [country])

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

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview)
      }
    }
  }, [avatarPreview])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')
    setAvatarProcessing(true)

    try {
      const processed = await processAvatarFile(file)
      setAvatarFile(processed.uploadFile)
      setAvatarFallbackUrl(processed.fallbackDataUrl)
      setAvatarPreview(current => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
        return processed.previewUrl
      })
    } catch {
      setAvatarFile(null)
      setAvatarFallbackUrl(null)
      setAvatarPreview(current => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current)
        return null
      })
      setAvatarError('PLEASE CHOOSE A JPG, PNG, OR WEBP PHOTO.')
    } finally {
      e.target.value = ''
      setAvatarProcessing(false)
    }
  }

  function toggleArtType(type: string, max: number, current: string[], setter: (fn: (prev: string[]) => string[]) => void) {
    setter(prev => {
      if (prev.includes(type)) return prev.filter(t => t !== type)
      if (prev.length >= max) return prev
      return [...prev, type]
    })
  }

  function buildProfileData(profilePhotoUrl?: string | null) {
    const normalizedCity = normalizeCity(city)
    const base: Record<string, any> = {
      full_name: fullName.trim(),
      username: username.toLowerCase(),
      role,
      profile_photo_url: profilePhotoUrl ?? null,
      follower_count: 0,
      rating_count: 0,
    }
    if (role === 'ARTIST') {
      return {
        ...base,
        discipline,
        art_types: artTypes,
        country: country.trim() || null,
        city: normalizedCity,
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
        city: normalizedCity,
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
    const path = `${userId}/avatar.jpg`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, {
      upsert: true,
      contentType: 'image/jpeg',
    })
    if (upErr) return null
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    return `${urlData.publicUrl}?t=${Date.now()}`
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const supabase = createClient()
    try {
      const profileData = buildProfileData(avatarFallbackUrl)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: profileData,
          emailRedirectTo: EMAIL_REDIRECT_URL,
        },
      })
      if (signUpErr) { setError(signUpErr.message.toUpperCase()); return }
      const user = signUpData.user
      if (!user) { setError('SIGN UP FAILED — TRY AGAIN.'); return }

      if (!signUpData.session) {
        setConfirmationEmail(email.trim())
        return
      }

      if (avatarFile) {
        void (async () => {
          const avatarUrl = await uploadAvatar(user.id)
          if (!avatarUrl) return

          await supabase.from('profiles').update({
            profile_photo_url: avatarUrl,
          }).eq('id', user.id)
        })()
      } else {
        void supabase.from('profiles').upsert({
          id: user.id,
          ...profileData,
          profile_photo_url: avatarFallbackUrl,
        })
      }

      router.push('/feed')
      router.refresh()
    } catch (e: any) {
      setError(e.message?.toUpperCase() ?? 'SOMETHING WENT WRONG.')
    } finally {
      setLoading(false)
    }
  }

  const borderDim = 'rgba(255,255,255,0.15)'

  if (confirmationEmail) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: '#000' }}>
        <div style={{ width: '100%', maxWidth: 440, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(10,10,10,0.92)', padding: '36px 28px', textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <WOALogo size="lg" />
          </div>

          <div style={{ display: 'inline-block', padding: '6px 10px', border: '1px solid rgba(246,197,90,0.5)', color: '#f6c55a', fontSize: 10, letterSpacing: '0.18em', marginBottom: 18 }}>
            CHECK YOUR EMAIL
          </div>

          <h1 style={{ fontSize: 18, lineHeight: 1.4, letterSpacing: '0.08em', marginBottom: 14 }}>
            CONFIRM YOUR ACCOUNT
          </h1>

          <p style={{ fontSize: 11, lineHeight: 1.9, letterSpacing: '0.08em', color: '#b5b5b5', marginBottom: 16 }}>
            WE SENT A CONFIRMATION LINK TO <span style={{ color: '#fff' }}>{confirmationEmail.toUpperCase()}</span>.
          </p>

          <p style={{ fontSize: 11, lineHeight: 1.9, letterSpacing: '0.08em', color: '#b5b5b5', marginBottom: 24 }}>
            OPEN THAT EMAIL, TAP THE LINK, AND YOU'LL LAND BACK ON WORK(ER) OF ART READY TO LOG IN.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link
              href="/login"
              style={{
                display: 'block',
                textDecoration: 'none',
                background: '#c0392b',
                color: '#fff',
                padding: '14px 18px',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              GO TO LOGIN
            </Link>
            <button
              type="button"
              onClick={() => setConfirmationEmail(null)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.16)',
                color: '#fff',
                padding: '14px 18px',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              BACK TO SIGNUP
            </button>
          </div>
        </div>
      </div>
    )
  }

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
      const canLaunch = Boolean(fullName.trim() && !loading && !avatarProcessing)
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: '#000' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}>
              ← BACK
            </button>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 24 }}>CREDENTIALS › PROFILE</p>

            <AvatarUpload preview={avatarPreview} onChange={handleAvatarChange} />
            {avatarError && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em', marginTop: -10, marginBottom: 12 }}>{avatarError}</p>}
            {avatarProcessing && <p style={{ fontSize: 10, color: '#888', letterSpacing: '0.12em', textAlign: 'center', marginTop: -10, marginBottom: 12 }}>OPTIMIZING PHOTO...</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="woa-input-label">FULL NAME *</label>
                <input className="woa-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" required />
              </div>

              {error && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>}

              <button className="btn-red" onClick={handleSubmit} disabled={!canLaunch} style={{ padding: '14px', opacity: canLaunch ? 1 : 0.35 }}>
                {avatarProcessing ? 'PREPARING PHOTO...' : loading ? 'CREATING PROFILE...' : 'LAUNCH MY PROFILE'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── ART LOVER ──────────────────────────────────────────────────────────
    if (role === 'ART_LOVER') {
      const canLaunch = Boolean(fullName.trim() && !loading && !avatarProcessing)
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 80px', background: '#000' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}>
              ← BACK
            </button>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 24 }}>CREDENTIALS › PROFILE</p>

            <AvatarUpload preview={avatarPreview} onChange={handleAvatarChange} />
            {avatarError && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em', marginTop: -10, marginBottom: 12 }}>{avatarError}</p>}
            {avatarProcessing && <p style={{ fontSize: 10, color: '#888', letterSpacing: '0.12em', textAlign: 'center', marginTop: -10, marginBottom: 12 }}>OPTIMIZING PHOTO...</p>}

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
                {avatarProcessing ? 'PREPARING PHOTO...' : loading ? 'CREATING PROFILE...' : 'ENTER WORK(ER) OF ART'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── COLLECTIVE ──────────────────────────────────────────────────────────
    if (role === 'COLLECTIVE') {
      const canLaunch = Boolean(fullName.trim() && collectiveType && country.trim() && city.trim() && !loading && !avatarProcessing)
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 80px', background: '#000' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, letterSpacing: '0.18em', marginBottom: 20, padding: 0, fontFamily: 'inherit' }}>
              ← BACK
            </button>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.2em', marginBottom: 24 }}>CREDENTIALS › ORG PROFILE</p>

            <AvatarUpload preview={avatarPreview} onChange={handleAvatarChange} />
            {avatarError && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em', marginTop: -10, marginBottom: 12 }}>{avatarError}</p>}
            {avatarProcessing && <p style={{ fontSize: 10, color: '#888', letterSpacing: '0.12em', textAlign: 'center', marginTop: -10, marginBottom: 12 }}>OPTIMIZING PHOTO...</p>}

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
                  <select
                    className="woa-input"
                    value={country}
                    onChange={e => { setCountry(e.target.value); setCity('') }}
                    style={{ cursor: 'pointer' }}
                    required
                  >
                    <option value="">SELECT COUNTRY</option>
                    {COUNTRIES.map(item => <option key={item} value={item} style={{ background: '#111' }}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label className="woa-input-label">CITY *</label>
                  <select
                    className="woa-input"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    style={{ cursor: country ? 'pointer' : 'not-allowed', opacity: country ? 1 : 0.5 }}
                    disabled={!country}
                    required
                  >
                    <option value="">{country ? 'SELECT CITY' : 'SELECT COUNTRY FIRST'}</option>
                    {availableCities.map(item => <option key={item} value={item} style={{ background: '#111' }}>{item}</option>)}
                  </select>
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
                {avatarProcessing ? 'PREPARING PHOTO...' : loading ? 'CREATING PROFILE...' : 'LAUNCH OUR PROFILE'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── ARTIST: Profile step ──────────────────────────────────────────────
    function handleArtistContinue() {
      if (avatarProcessing) { setError('PLEASE WAIT FOR YOUR PHOTO TO FINISH PROCESSING.'); return }
      if (avatarError) { setError(avatarError); return }
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
          {avatarError && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em', textAlign: 'center', marginTop: -10, marginBottom: 12 }}>{avatarError}</p>}
          {avatarProcessing && <p style={{ fontSize: 10, color: '#888', letterSpacing: '0.12em', textAlign: 'center', marginTop: -10, marginBottom: 12 }}>OPTIMIZING PHOTO...</p>}

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
                  tags={ART_TYPES_BY_DISCIPLINE[discipline] ?? []}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="woa-input-label">COUNTRY *</label>
                <select
                  className="woa-input"
                  value={country}
                  onChange={e => { setCountry(e.target.value); setCity('') }}
                  style={{ cursor: 'pointer' }}
                  required
                >
                  <option value="">SELECT COUNTRY</option>
                  {COUNTRIES.map(item => <option key={item} value={item} style={{ background: '#111' }}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="woa-input-label">CITY *</label>
                <select
                  className="woa-input"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  style={{ cursor: country ? 'pointer' : 'not-allowed', opacity: country ? 1 : 0.5 }}
                  disabled={!country}
                  required
                >
                  <option value="">{country ? 'SELECT CITY' : 'SELECT COUNTRY FIRST'}</option>
                  {availableCities.map(item => <option key={item} value={item} style={{ background: '#111' }}>{item}</option>)}
                </select>
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
  const canLaunch = Boolean(bio.trim() && !loading && !avatarProcessing)

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
              {avatarProcessing ? 'PREPARING PHOTO...' : loading ? 'CREATING PROFILE...' : 'LAUNCH MY PROFILE'}
            </button>
        </div>
      </div>
    </div>
  )
}
