'use client'

import { useEffect, useRef, useState } from 'react'

interface PostActionsMenuProps {
  canManage: boolean
  canPin?: boolean
  isPinned?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onReport?: () => void
  onPin?: () => void
  onShare?: () => void
  onFollow?: () => void
  onBlock?: () => void
  isFollowing?: boolean
}

export function PostActionsMenu({
  canManage,
  canPin,
  isPinned,
  onEdit,
  onDelete,
  onReport,
  onPin,
  onShare,
  onFollow,
  onBlock,
  isFollowing,
}: PostActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const item: React.CSSProperties = {
    width: '100%', background: 'none', border: 'none', textAlign: 'left',
    color: '#fff', fontSize: 10, letterSpacing: '0.12em',
    padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit',
  }

  function action(fn?: () => void) {
    return (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation(); setOpen(false); fn?.()
    }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Post actions"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        style={{
          width: 28, height: 28,
          border: '1px solid rgba(255,255,255,0.12)',
          background: '#0a0a0a', color: '#c0392b',
          cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 16, lineHeight: 1, fontFamily: 'inherit',
        }}
      >
        ⋮
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 34, right: 0, minWidth: 164,
          background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 18px 60px rgba(0,0,0,0.45)', zIndex: 20,
        }}>
          {/* Share — always shown */}
          {onShare && (
            <button type="button" onClick={action(onShare)} style={item}>
              SHARE POST
            </button>
          )}

          {canManage ? (
            <>
              {canPin && (
                <button type="button" onClick={action(onPin)} style={{ ...item, color: '#f5c842' }}>
                  {isPinned ? 'UNPIN POST' : 'PIN POST'}
                </button>
              )}
              <button type="button" onClick={action(onEdit)} style={item}>EDIT POST</button>
              <button type="button" onClick={action(onDelete)} style={{ ...item, color: '#c0392b' }}>DELETE POST</button>
            </>
          ) : (
            <>
              <button type="button" onClick={action(onFollow)} style={item}>
                {isFollowing ? 'UNFOLLOW' : 'FOLLOW'}
              </button>
              <button type="button" onClick={action(onReport)} style={{ ...item, color: '#888880' }}>REPORT POST</button>
              <button type="button" onClick={action(onBlock)} style={{ ...item, color: '#c0392b' }}>BLOCK USER</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
