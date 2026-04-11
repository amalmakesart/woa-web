'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/feed', label: 'FEED', icon: '◈' },
  { href: '/artists', label: 'ARTISTS', icon: '◉' },
  { href: '/gigs', label: 'GIGS', icon: '◎' },
  { href: '/search', label: 'SEARCH', icon: '⊙' },
  { href: '/messages', label: 'MSG', icon: '◻' },
  { href: '/profile', label: 'ME', icon: '◯' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(0,0,0,0.95)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        zIndex: 50,
      }}
    >
      {NAV.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '10px 0',
              textDecoration: 'none',
              color: active ? '#fff' : '#888880',
              fontSize: 16,
              transition: 'color 0.2s',
            }}
          >
            <span>{icon}</span>
            <span style={{ fontSize: 8, letterSpacing: '0.1em', fontWeight: active ? 700 : 400 }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
