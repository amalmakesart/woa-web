'use client'

const APP_STORE_URL = 'https://apps.apple.com/ca/app/work-er-of-art/id6761753841'

export function FloatingAppButton() {
  return (
    <>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 82,
          zIndex: 120,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          padding: '12px 16px',
          border: '1px solid rgba(255,255,255,0.16)',
          background: 'rgba(192,57,43,0.96)',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
        }}
        className="woa-floating-app-button"
      >
        Download App For Full Features
      </a>

      <style>{`
        @media (min-width: 768px) {
          .woa-floating-app-button {
            right: 24px !important;
            bottom: 22px !important;
          }
        }
      `}</style>
    </>
  )
}
