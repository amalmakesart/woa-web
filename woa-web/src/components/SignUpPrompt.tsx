'use client'

import Link from 'next/link'

interface Props {
  message?: string
  onClose: () => void
}

export function SignUpPrompt({ message = 'JOIN WOA TO CONTINUE', onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#0d0d0d', border: '1px solid #222',
        padding: '36px 32px', maxWidth: 360, width: '100%', textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>WOA</span>
          <span style={{ color: '#c0392b', fontSize: 8 }}>●</span>
        </div>

        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
          {message}
        </p>
        <p style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em', lineHeight: 1.7, marginBottom: 28 }}>
          CREATE A FREE ACCOUNT TO CONNECT WITH ARTISTS, POST GIGS, AND MORE.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/signup" className="btn-red" style={{ display: 'block', padding: '13px', fontSize: 11, letterSpacing: '0.14em', textDecoration: 'none' }}>
            CREATE ACCOUNT — FREE
          </Link>
          <Link href="/login" style={{ display: 'block', padding: '13px', fontSize: 11, letterSpacing: '0.14em', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)', color: '#888880' }}>
            LOG IN
          </Link>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#555', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', marginTop: 20, fontFamily: 'inherit' }}
        >
          CONTINUE BROWSING
        </button>
      </div>
    </div>
  )
}
