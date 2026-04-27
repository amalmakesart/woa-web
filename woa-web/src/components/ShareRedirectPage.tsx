'use client'

import { useEffect } from 'react'
import { APP_ICON_PATH, APP_STORE_URL } from '@/lib/share'

export function ShareRedirectPage({
  title,
  subtitle,
  deepLinkUrl,
}: {
  title: string
  subtitle: string
  deepLinkUrl: string
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isMobile = /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)
    let fallbackTimer: number | null = null

    const cancelFallback = () => {
      if (fallbackTimer != null) {
        window.clearTimeout(fallbackTimer)
        fallbackTimer = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelFallback()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    fallbackTimer = window.setTimeout(() => {
      window.location.replace(APP_STORE_URL)
    }, isMobile ? 1600 : 900)

    if (isMobile) {
      window.location.href = deepLinkUrl
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      cancelFallback()
    }
  }, [deepLinkUrl])

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
          maxWidth: 420,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(10,10,10,0.92)',
          padding: '28px 24px',
          textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        <img
          src={APP_ICON_PATH}
          alt="WORK(ER) OF ART"
          style={{ width: 72, height: 72, borderRadius: 18, margin: '0 auto 18px', display: 'block' }}
        />
        <div style={{ fontSize: 12, letterSpacing: '0.28em', color: '#c0392b', marginBottom: 10 }}>
          WORK(ER) OF ART
        </div>
        <h1 style={{ fontSize: 18, lineHeight: 1.4, letterSpacing: '0.04em', marginBottom: 10 }}>
          {title}
        </h1>
        <p style={{ fontSize: 11, lineHeight: 1.8, letterSpacing: '0.08em', color: '#b5b5b5', marginBottom: 22 }}>
          {subtitle}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={deepLinkUrl}
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
            Open In App
          </a>
          <a
            href={APP_STORE_URL}
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
            Download From App Store
          </a>
        </div>
      </div>
    </main>
  )
}
