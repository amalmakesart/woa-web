'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Feature {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string | null
  duration: string | null
  artist_id: string | null
  created_at: string
  artist?: {
    id: string
    username: string | null
    full_name: string | null
    profile_photo_url: string | null
    art_type: string | null
    city: string | null
    country: string | null
  } | null
}

export default function FeaturesPage() {
  const router = useRouter()
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('features')
        .select('id, title, description, thumbnail_url, video_url, duration, artist_id, created_at')
        .order('created_at', { ascending: false })

      const baseFeatures = ((data as Feature[]) ?? []).map((feature) => ({
        ...feature,
        artist: null,
      }))

      const artistIds = [...new Set(baseFeatures.map((feature) => feature.artist_id).filter(Boolean))] as string[]
      if (artistIds.length === 0) {
        setFeatures(baseFeatures)
        setLoading(false)
        return
      }

      const { data: artistRows } = await supabase
        .from('profiles')
        .select('id, username, full_name, profile_photo_url, art_type, city, country')
        .in('id', artistIds)

      const artistMap = Object.fromEntries(((artistRows as any[]) ?? []).map((artist) => [artist.id, artist]))
      setFeatures(baseFeatures.map((feature) => ({
        ...feature,
        artist: feature.artist_id ? artistMap[feature.artist_id] ?? null : null,
      })))
      setLoading(false)
    }
    load()
  }, [])

  function renderLinkedArtist(feature: Feature, compact = false) {
    if (!feature.artist) return null

    const name = feature.artist.username
      ? `@${feature.artist.username.toUpperCase()}`
      : (feature.artist.full_name ?? 'LINKED ARTIST').toUpperCase()

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          router.push(`/artists/${feature.artist?.id}`)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          marginTop: compact ? 8 : 12,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {feature.artist.profile_photo_url ? (
          <img
            src={feature.artist.profile_photo_url}
            alt={feature.artist.full_name ?? feature.artist.username ?? 'Linked artist'}
            className="oct-avatar"
            style={{ width: compact ? 22 : 26, height: compact ? 22 : 26, flexShrink: 0 }}
          />
        ) : (
          <div
            className="oct-avatar"
            style={{
              width: compact ? 22 : 26,
              height: compact ? 22 : 26,
              background: '#1a1a1a',
              color: '#888880',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            ◯
          </div>
        )}
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span style={{ fontSize: compact ? 10 : 11, color: '#fff', letterSpacing: '0.08em' }}>
            {name}
          </span>
          {feature.artist.art_type && (
            <span style={{ fontSize: 9, color: '#c0392b', letterSpacing: '0.08em' }}>
              {feature.artist.art_type.toUpperCase()}
            </span>
          )}
        </span>
      </button>
    )
  }

  const [hero, ...rest] = features

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <p className="woa-section-label">FEATURED ARTISTS</p>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 24, lineHeight: 1.1 }}>
          SCOUTED.{' '}
          <em style={{ fontWeight: 400, color: '#888880' }}>FROM ACROSS THE NATION.</em>
        </h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
          LOADING...
        </div>
      ) : features.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>
          NO FEATURES YET
        </div>
      ) : (
        <>
          {/* Hero feature */}
          {hero && (
            <div
              style={{
                position: 'relative',
                height: 480,
                overflow: 'hidden',
                marginBottom: 2,
                cursor: 'pointer',
              }}
              onClick={() => playing === hero.id ? setPlaying(null) : setPlaying(hero.id)}
            >
              {playing === hero.id && hero.video_url ? (
                <video
                  src={hero.video_url}
                  autoPlay
                  controls
                  style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
                />
              ) : (
                <>
                  {hero.thumbnail_url ? (
                    <img
                      src={hero.thumbnail_url}
                      alt={hero.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.55)' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#111' }} />
                  )}

                  {/* Play button */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 64,
                      height: 64,
                      border: '2px solid #c0392b',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 2L14 8L4 14V2Z" fill="#c0392b" />
                    </svg>
                  </div>

                  {/* Info overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '32px 24px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)',
                    }}
                  >
                    <p style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.14em', marginBottom: 6 }}>
                      EP. {features.length} · FEATURED
                    </p>
                    <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.03em', marginBottom: 4 }}>
                      {hero.title}
                    </h2>
                    {hero.artist && (
                      <p style={{ fontSize: 12, color: '#888880', letterSpacing: '0.1em' }}>
                        {[hero.artist.city, hero.artist.country].filter(Boolean).join(', ').toUpperCase()}
                      </p>
                    )}
                    {renderLinkedArtist(hero)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Episode list */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {rest.map((feat, i) => (
              <div
                key={feat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                className="feature-row-hover"
                onClick={() => playing === feat.id ? setPlaying(null) : setPlaying(feat.id)}
              >
                {feat.thumbnail_url ? (
                  <img
                    src={feat.thumbnail_url}
                    alt={feat.title}
                    style={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      background: '#111',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#888880',
                    }}
                  >
                    ▷
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 10, color: '#c0392b', letterSpacing: '0.12em', marginBottom: 4 }}>
                    EP. {features.length - i - 1}
                  </span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>
                    {feat.title}
                  </span>
                  {feat.artist && (
                    <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>
                      {[feat.artist.city, feat.artist.country].filter(Boolean).join(', ').toUpperCase()}
                    </span>
                  )}
                  {renderLinkedArtist(feat, true)}
                </div>

                {feat.duration && (
                  <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em', flexShrink: 0 }}>
                    {feat.duration}
                  </span>
                )}

                <div style={{ color: playing === feat.id ? '#c0392b' : '#888880', fontSize: 18 }}>
                  {playing === feat.id ? '■' : '▷'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        .feature-row-hover:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>
    </div>
  )
}
