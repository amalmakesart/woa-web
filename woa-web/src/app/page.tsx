import Link from 'next/link'

const ARTISTS = [
  { name: 'TESSA FLETT', type: 'MURALIST', city: 'CALGARY', image: '/marketing/tessa.jpg' },
  { name: 'AMAL ALHOMSI', type: 'VISUAL ARTIST', city: 'CALGARY', image: '/marketing/artist1.jpg' },
  { name: 'DANIELA LOPEZ', type: 'PHOTOGRAPHER', city: 'TORONTO', image: '/marketing/artist2.jpg' },
  { name: 'MILES CARTER', type: 'MUSICIAN', city: 'VANCOUVER', image: '/marketing/artist3.jpg' },
  { name: 'AIKO WONG', type: 'ANIMATOR', city: 'VICTORIA', image: '/marketing/artist4.jpg' },
  { name: 'NORA DEAN', type: 'TEXTILE ARTIST', city: 'BANFF', image: '/marketing/artist5.jpg' },
]

const FEATURES = [
  {
    number: '01',
    title: 'DISCOVER ARTISTS',
    description: 'Search artists by discipline, tags, city, and availability without relying on algorithms to decide who gets seen.',
  },
  {
    number: '02',
    title: 'SHARE THE WORK',
    description: 'Post images, video, audio, and writing in a feed designed for process, context, and real creative momentum.',
  },
  {
    number: '03',
    title: 'POST REAL GIGS',
    description: 'Create opportunities, review interest, and message the right artists directly from the same platform.',
  },
  {
    number: '04',
    title: 'BUILD YOUR NAME',
    description: 'Create a profile that feels like a living portfolio and lets people find you for the work you actually want.',
  },
]

const GIGS = [
  {
    title: 'MUSIC VIDEO SHOOT FOR SPRING CAMPAIGN',
    meta: 'VIDEOGRAPHER · APR 18 · 2:00 PM TO 9:00 PM',
    budget: '$800 — $1500',
    interest: '7 INTERESTED',
  },
  {
    title: 'LIVE PAINTER FOR BRAND ACTIVATION',
    meta: 'VISUAL ARTIST · MAY 02 · CALGARY',
    budget: '$600',
    interest: '4 INTERESTED',
  },
  {
    title: 'EDITORIAL PHOTO ASSISTANT',
    meta: 'PHOTOGRAPHER · MAY 11 · TORONTO',
    budget: '$350 DAY RATE',
    interest: '12 INTERESTED',
  },
]

export default function HomePage() {
  return (
    <main style={{ background: '#000', color: '#fff' }}>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              border: '1px solid #fff',
              width: 60,
              height: 60,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 7px',
              fontSize: 8,
              letterSpacing: '0.08em',
              lineHeight: 1.6,
              fontFamily: "'Courier Prime', 'Space Mono', monospace",
              whiteSpace: 'nowrap',
            }}
          >
            <span>WORK(ER)</span>
            <span>
              OF ART <span style={{ color: '#c0392b' }}>●</span>
            </span>
          </div>
        </Link>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link href="/feed" className="btn-primary" style={{ padding: '10px 18px', fontSize: 10 }}>
            OPEN APP
          </Link>
          <Link href="/signup" className="btn-red" style={{ padding: '10px 18px', fontSize: 10 }}>
            JOIN FREE
          </Link>
        </div>
      </nav>

      <section
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '140px 24px 72px',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.58,
          }}
        >
          <source src="/marketing/header-video.mp4" type="video/mp4" />
        </video>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.76) 60%, #000 100%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 1120, margin: '0 auto' }}>
          <p style={{ fontSize: 11, letterSpacing: '0.2em', color: '#c0392b', marginBottom: 26 }}>
            ● THE ULTIMATE ART PLATFORM
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)',
              gap: 28,
              alignItems: 'start',
            }}
            className="landing-hero-grid"
          >
            <div
              style={{
                border: '2px solid #fff',
                width: 'min(260px, 60vw)',
                aspectRatio: '1 / 1',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 24px',
                fontSize: 'clamp(24px, 2.5vw, 34px)',
                letterSpacing: '0.08em',
                lineHeight: 1.15,
                fontFamily: "'Courier Prime', 'Space Mono', monospace",
              }}
            >
              <span>WORK(ER)</span>
              <span>
                OF ART <span style={{ color: '#c0392b' }}>●</span>
              </span>
            </div>

            <div>
              <h1
                style={{
                  fontSize: 'clamp(54px, 9vw, 110px)',
                  lineHeight: 0.92,
                  letterSpacing: '-0.02em',
                  marginBottom: 28,
                  maxWidth: 760,
                }}
              >
                WHERE ART
                <br />
                <span style={{ color: '#888880', fontStyle: 'italic', fontWeight: 400 }}>FINDS</span> ITS
                <br />
                WORK.
              </h1>
              <p style={{ fontSize: 13, color: '#b0b0aa', lineHeight: 1.9, maxWidth: 520, marginBottom: 36 }}>
                DISCOVER ARTISTS. POST GIGS. BUILD YOUR PORTFOLIO.
                <br />
                A PLATFORM BUILT FOR ARTISTS BY ARTISTS.
              </p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <Link href="/artists" className="btn-primary">
                  EXPLORE ARTISTS
                </Link>
                <Link href="/gigs" className="btn-red">
                  VIEW GIGS
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.12)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          padding: '14px 0',
        }}
      >
        <div className="landing-ticker">
          {[
            'VISUAL ARTISTS',
            'MURALISTS',
            'ANIMATORS',
            'PHOTOGRAPHERS',
            'MUSICIANS',
            'ILLUSTRATORS',
            'TEXTILE ARTISTS',
            'CERAMICISTS',
            'TATTOO ARTISTS',
            'DANCERS',
            'SCULPTORS',
            'WRITERS',
          ]
            .concat([
              'VISUAL ARTISTS',
              'MURALISTS',
              'ANIMATORS',
              'PHOTOGRAPHERS',
              'MUSICIANS',
              'ILLUSTRATORS',
              'TEXTILE ARTISTS',
              'CERAMICISTS',
              'TATTOO ARTISTS',
              'DANCERS',
              'SCULPTORS',
              'WRITERS',
            ])
            .map((label, index) => (
              <span
                key={`${label}-${index}`}
                style={{ fontSize: 11, letterSpacing: '0.14em', color: '#888880', padding: '0 34px', display: 'inline-block' }}
              >
                <span style={{ color: '#c0392b', marginRight: 8 }}>●</span>
                {label}
              </span>
            ))}
        </div>
      </div>

      <section style={{ padding: '92px 24px', borderBottom: '1px solid rgba(255,255,255,0.12)' }} id="artists">
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="woa-section-label">ARTIST DIRECTORY</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 30 }}>
            <h2 style={{ fontSize: 'clamp(30px, 5vw, 54px)', lineHeight: 1, letterSpacing: '-0.02em' }}>FIND AN ARTIST.</h2>
            <Link href="/artists" className="btn-red" style={{ fontSize: 11, padding: '10px 20px' }}>
              BROWSE ALL ↗
            </Link>
          </div>

          <div className="landing-artist-grid">
            {ARTISTS.map((artist) => (
              <Link
                key={artist.name}
                href="/artists"
                style={{
                  position: 'relative',
                  aspectRatio: '3 / 4',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.06)',
                  textDecoration: 'none',
                  color: '#fff',
                }}
              >
                <img
                  src={artist.image}
                  alt={artist.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.72)' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 60%)',
                  }}
                />
                <div style={{ position: 'absolute', left: 12, right: 12, bottom: 14 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 3 }}>
                    {artist.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 10, color: '#888880', letterSpacing: '0.1em' }}>
                    {artist.type}
                  </span>
                </div>
                <span style={{ position: 'absolute', right: 12, bottom: 14, fontSize: 10, color: '#c0392b', letterSpacing: '0.08em' }}>
                  {artist.city}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '92px 24px', borderBottom: '1px solid rgba(255,255,255,0.12)' }} id="features">
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="woa-section-label">FEATURES</div>
          <div className="landing-feature-grid">
            {FEATURES.map((feature) => (
              <div
                key={feature.number}
                style={{
                  padding: '46px 36px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.01)',
                }}
              >
                <span style={{ display: 'block', fontSize: 11, color: '#c0392b', letterSpacing: '0.1em', marginBottom: 18 }}>
                  {feature.number}
                </span>
                <h3 style={{ fontSize: 22, letterSpacing: '0.02em', marginBottom: 14 }}>{feature.title}</h3>
                <p style={{ fontSize: 12, color: '#a7a7a2', lineHeight: 1.85 }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '92px 24px', borderBottom: '1px solid rgba(255,255,255,0.12)' }} id="gigs">
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="woa-section-label">GIGS</div>
          {GIGS.map((gig, index) => (
            <div
              key={gig.title}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 24,
                padding: '28px 0',
                borderTop: index === 0 ? '1px solid rgba(255,255,255,0.12)' : 'none',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 260 }}>
                <span style={{ display: 'block', fontSize: 'clamp(18px, 3vw, 28px)', marginBottom: 8, lineHeight: 1.2 }}>
                  {gig.title}
                </span>
                <span style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em' }}>{gig.meta}</span>
              </div>
              <div style={{ textAlign: 'right', minWidth: 160 }}>
                <span style={{ display: 'block', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{gig.budget}</span>
                <span style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.08em' }}>{gig.interest}</span>
              </div>
            </div>
          ))}
          <div style={{ paddingTop: 28 }}>
            <Link href="/gigs" className="btn-primary">
              OPEN GIG BOARD
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: '104px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(38px, 7vw, 86px)', lineHeight: 0.94, letterSpacing: '-0.02em', marginBottom: 28 }}>
            LET THE WORK
            <br />
            <span style={{ color: '#888880', fontStyle: 'italic', fontWeight: 400 }}>SPEAK</span> FIRST.
          </h2>
          <p style={{ fontSize: 13, color: '#a7a7a2', lineHeight: 1.9, marginBottom: 40 }}>
            WOA is completely free to use, takes no commission, and exists to help artists get seen,
            get hired, and build lasting creative momentum.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" className="btn-red">
              CREATE ACCOUNT
            </Link>
            <Link href="/feed" className="btn-primary">
              OPEN WEB APP
            </Link>
          </div>
        </div>
      </section>

      <footer
        style={{
          padding: '36px 24px',
          borderTop: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 11, color: '#888880', letterSpacing: '0.08em' }}>
            WORK(ER) OF ART © 2026
          </span>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Link href="/privacy" style={{ fontSize: 11, color: '#888880', textDecoration: 'none', letterSpacing: '0.08em' }}>
              PRIVACY
            </Link>
            <Link href="/terms" style={{ fontSize: 11, color: '#888880', textDecoration: 'none', letterSpacing: '0.08em' }}>
              TERMS
            </Link>
            <Link href="/feed" style={{ fontSize: 11, color: '#888880', textDecoration: 'none', letterSpacing: '0.08em' }}>
              WEB APP
            </Link>
          </div>
        </div>
      </footer>

      <style>{`
        .landing-ticker {
          display: inline-flex;
          min-width: max-content;
          animation: landingTicker 22s linear infinite;
        }
        .landing-artist-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
        }
        .landing-feature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
        }
        @keyframes landingTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (max-width: 900px) {
          .landing-hero-grid {
            grid-template-columns: 1fr !important;
          }
          .landing-artist-grid,
          .landing-feature-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 700px) {
          .landing-artist-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 560px) {
          .landing-artist-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  )
}
