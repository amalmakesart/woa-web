'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WOALogo } from './WOALogo'
import { isAdminEmail } from '@/lib/admin'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/feed', label: 'FEED' },
  { href: '/artists', label: 'ARTISTS' },
  { href: '/gigs', label: 'GIGS' },
  { href: '/projects', label: 'COLLAB' },
  { href: '/features', label: 'FEATURES' },
  { href: '/messages', label: 'MESSAGES' },
  { href: '/notifications', label: 'NOTIFICATIONS' },
  { href: '/profile', label: 'PROFILE' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let alive = true
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }: { data: { session: { user?: { email?: string | null } } | null } }) => {
      if (alive) setIsAdmin(isAdminEmail(data.session?.user?.email))
    })
    return () => { alive = false }
  }, [])

  const nav = isAdmin ? [...NAV, { href: '/admin', label: 'ADMIN' }] : NAV

  return (
    <aside
      style={{
        width: 200,
        minHeight: '100vh',
        borderRight: '1px solid rgba(255,255,255,0.12)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        position: 'fixed',
        top: 0,
        left: 0,
        background: '#000',
        zIndex: 50,
      }}
    >
      <div style={{ padding: '0 20px 32px' }}>
        <WOALogo size="sm" />
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'block',
                padding: '10px 20px',
                fontSize: 11,
                letterSpacing: '0.14em',
                textDecoration: 'none',
                color: active ? '#fff' : '#888880',
                borderLeft: active ? '2px solid #c0392b' : '2px solid transparent',
                transition: 'color 0.2s',
                fontWeight: active ? 700 : 400,
              }}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
