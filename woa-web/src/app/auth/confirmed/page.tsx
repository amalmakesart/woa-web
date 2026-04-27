'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { WOALogo } from '@/components/WOALogo'

type ConfirmationState = 'success' | 'error'

function readAuthStatus() {
  if (typeof window === 'undefined') {
    return { state: 'success' as ConfirmationState, message: '' }
  }

  const queryParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '')
  const params = hashParams.size > 0 ? hashParams : queryParams

  const errorDescription = params.get('error_description') ?? params.get('error')
  if (errorDescription) {
    const readable = decodeURIComponent(errorDescription).replace(/\+/g, ' ')
    return { state: 'error' as ConfirmationState, message: readable }
  }

  return { state: 'success' as ConfirmationState, message: '' }
}

export default function ConfirmedPage() {
  const [{ state, message }, setStatus] = useState(() => readAuthStatus())

  useEffect(() => {
    setStatus(readAuthStatus())
  }, [])

  const copy = useMemo(() => {
    if (state === 'error') {
      return {
        title: 'CONFIRMATION LINK ISSUE',
        body: message || 'THIS EMAIL LINK IS INVALID OR HAS EXPIRED. REQUEST A NEW ONE AND TRY AGAIN.',
        actionLabel: 'GO TO LOGIN',
      }
    }

    return {
      title: 'ACCOUNT CONFIRMED',
      body: 'YOUR EMAIL IS CONFIRMED. GO LOG IN TO YOUR WORK(ER) OF ART ACCOUNT NOW.',
      actionLabel: 'GO TO LOGIN',
    }
  }, [state, message])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, rgba(192,57,43,0.18), transparent 42%), #000',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(10,10,10,0.92)',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <WOALogo size="lg" />
        </div>

        <div
          style={{
            display: 'inline-block',
            padding: '6px 10px',
            border: `1px solid ${state === 'error' ? '#c0392b' : 'rgba(246,197,90,0.5)'}`,
            color: state === 'error' ? '#c0392b' : '#f6c55a',
            fontSize: 10,
            letterSpacing: '0.18em',
            marginBottom: 18,
          }}
        >
          {state === 'error' ? 'EMAIL LINK ISSUE' : 'EMAIL CONFIRMED'}
        </div>

        <h1
          style={{
            fontSize: 18,
            lineHeight: 1.4,
            letterSpacing: '0.08em',
            marginBottom: 14,
          }}
        >
          {copy.title}
        </h1>

        <p
          style={{
            fontSize: 11,
            lineHeight: 1.9,
            letterSpacing: '0.08em',
            color: '#b5b5b5',
            marginBottom: 24,
          }}
        >
          {copy.body}
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
            {copy.actionLabel}
          </Link>
          <a
            href="https://apps.apple.com/ca/app/work-er-of-art/id6761753841"
            style={{
              display: 'block',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#fff',
              padding: '14px 18px',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            OPEN THE APP
          </a>
        </div>
      </div>
    </main>
  )
}
