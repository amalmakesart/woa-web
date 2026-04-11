'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WOALogo } from '@/components/WOALogo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/feed')
      router.refresh()
    }
  }

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
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <WOALogo size="lg" />
        </div>

        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: '#888880',
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          SIGN IN TO YOUR ACCOUNT
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{error}</p>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: 8, width: '100%' }}
            disabled={loading}
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
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
          NO ACCOUNT?{' '}
          <Link
            href="/signup"
            style={{ color: '#c0392b', textDecoration: 'none' }}
          >
            CREATE ONE
          </Link>
        </p>
      </div>
    </div>
  )
}
