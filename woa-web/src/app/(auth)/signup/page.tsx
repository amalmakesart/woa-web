'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WOALogo } from '@/components/WOALogo'

type Role = 'ARTIST' | 'GIG_POSTER' | 'COLLECTIVE'
type Step = 1 | 2 | 3

const DISCIPLINES = [
  'VISUAL ARTIST', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'FILMMAKER',
  'MUSICIAN', 'SINGER', 'DJ', 'PRODUCER', 'MODEL', 'ACTOR',
  'DANCER', 'CHOREOGRAPHER', 'PAINTER', 'ILLUSTRATOR', 'GRAPHIC DESIGNER',
  'ANIMATOR', 'MURALIST', 'SCULPTOR', 'TATTOO ARTIST', 'FASHION DESIGNER',
  'MAKEUP ARTIST', 'HAIR STYLIST', 'WRITER', 'CHEF', 'PERFORMER', 'OTHER',
]

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'ARTIST', label: 'ARTIST', desc: 'I create and share work' },
  { value: 'GIG_POSTER', label: 'GIG POSTER', desc: 'I hire artists for projects' },
  { value: 'COLLECTIVE', label: 'COLLECTIVE', desc: 'We are a group or organization' },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [role, setRole] = useState<Role>('ARTIST')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [collectiveType, setCollectiveType] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canContinue = (() => {
    if (step === 1) return true
    if (step === 2) return email.trim().length > 0 && password.length >= 6
    if (!fullName.trim() || !username.trim()) return false
    if (role === 'ARTIST') return discipline.trim().length > 0
    if (role === 'COLLECTIVE') return collectiveType.trim().length > 0 && city.trim().length > 0 && country.trim().length > 0
    return true
  })()

  function buildProfileData() {
    if (role === 'ARTIST') {
      return {
        full_name: fullName,
        username,
        role,
        discipline,
        art_type: discipline,
      }
    }

    if (role === 'COLLECTIVE') {
      return {
        full_name: fullName,
        username,
        role,
        collective_type: collectiveType,
        country,
        city,
        bio,
      }
    }

    return {
      full_name: fullName,
      username,
      role,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canContinue) return
    if (step < 3) { setStep((step + 1) as Step); return }

    setError('')
    setLoading(true)
    const supabase = createClient()

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: buildProfileData() },
    })

    if (signUpErr) { setError(signUpErr.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        ...buildProfileData(),
        username: username.toLowerCase(),
        follower_count: 0,
        rating_count: 0,
      })
    }

    router.push('/feed')
    router.refresh()
  }

  const borderDim = 'rgba(255,255,255,0.15)'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: '#000',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <WOALogo size="lg" />
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          {[1, 2, 3].map(s => (
            <div
              key={s}
              style={{
                width: 24,
                height: 2,
                background: s <= step ? '#c0392b' : '#2a2a2a',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1 — Role + credentials */}
          {step === 1 && (
            <>
              <p className="woa-section-label" style={{ marginBottom: 16 }}>
                STEP 1 — YOUR ROLE
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ROLES.map(r => (
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
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: role === r.value ? '#fff' : '#888880',
                        marginBottom: 4,
                        fontFamily: 'inherit',
                      }}
                    >
                      {r.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2 — Email + password */}
          {step === 2 && (
            <>
              <p className="woa-section-label" style={{ marginBottom: 16 }}>
                STEP 2 — CREDENTIALS
              </p>
              <div>
                <label className="woa-input-label">EMAIL</label>
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
                <label className="woa-input-label">PASSWORD</label>
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
            </>
          )}

          {/* Step 3 — Profile */}
          {step === 3 && (
            <>
              <p className="woa-section-label" style={{ marginBottom: 16 }}>
                STEP 3 — YOUR PROFILE
              </p>
              <div>
                <label className="woa-input-label">{role === 'COLLECTIVE' ? 'COLLECTIVE NAME' : 'FULL NAME'}</label>
                <input
                  className="woa-input"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="woa-input-label">USERNAME</label>
                <input
                  className="woa-input"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="@username"
                  required
                  minLength={3}
                />
              </div>
              {role === 'ARTIST' && (
                <div>
                  <label className="woa-input-label">ART DISCIPLINE</label>
                  <select
                    className="woa-input"
                    value={discipline}
                    onChange={e => setDiscipline(e.target.value)}
                    style={{ cursor: 'pointer' }}
                    required
                  >
                    <option value="">SELECT YOUR DISCIPLINE</option>
                    {DISCIPLINES.map(d => (
                      <option key={d} value={d} style={{ background: '#111' }}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
              {role === 'COLLECTIVE' && (
                <>
                  <div>
                    <label className="woa-input-label">COLLECTIVE TYPE</label>
                    <input
                      className="woa-input"
                      type="text"
                      value={collectiveType}
                      onChange={e => setCollectiveType(e.target.value)}
                      placeholder="GALLERY, LABEL, COMPANY, STUDIO..."
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                    <div>
                      <label className="woa-input-label">CITY</label>
                      <input
                        className="woa-input"
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="CITY"
                        required
                      />
                    </div>
                    <div>
                      <label className="woa-input-label">COUNTRY</label>
                      <input
                        className="woa-input"
                        type="text"
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                        placeholder="COUNTRY"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="woa-input-label">ABOUT YOUR COLLECTIVE</label>
                    <textarea
                      className="woa-input"
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="TELL PEOPLE WHAT YOUR COLLECTIVE DOES."
                      style={{ minHeight: 120, resize: 'vertical' }}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {error && (
            <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {step > 1 && (
              <button
                type="button"
                className="btn-ghost"
                style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '12px 20px', flex: 1 }}
                onClick={() => setStep((step - 1) as Step)}
              >
                BACK
              </button>
            )}
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 2 }}
              disabled={loading || !canContinue}
            >
              {step < 3 ? 'NEXT' : loading ? 'CREATING...' : 'CREATE ACCOUNT'}
            </button>
          </div>
        </form>

        <p
          style={{
            fontSize: 11,
            color: '#888880',
            letterSpacing: '0.08em',
            textAlign: 'center',
            marginTop: 28,
          }}
        >
          HAVE AN ACCOUNT?{' '}
          <Link href="/login" style={{ color: '#c0392b', textDecoration: 'none' }}>
            SIGN IN
          </Link>
        </p>
      </div>
    </div>
  )
}
