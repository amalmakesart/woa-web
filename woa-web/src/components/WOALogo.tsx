import Link from 'next/link'

export function WOALogo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 110 : 60
  const fs = size === 'lg' ? 11 : 7.5

  return (
    <Link href="/" style={{ textDecoration: 'none' }}>
      <div
        style={{
          border: '1px solid #fff',
          width: dim,
          height: dim,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '0 7px',
          fontSize: fs,
          letterSpacing: '0.08em',
          color: '#fff',
          lineHeight: 1.7,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <span>WORK(ER)</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          OF ART{' '}
          <span
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#c0392b',
              flexShrink: 0,
            }}
          />
        </span>
      </div>
    </Link>
  )
}
