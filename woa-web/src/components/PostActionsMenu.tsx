'use client'

import { useEffect, useRef, useState } from 'react'

interface PostActionsMenuProps {
  isOwner: boolean
  onEdit?: () => void
  onDelete?: () => void
  onReport?: () => void
}

export function PostActionsMenu({
  isOwner,
  onEdit,
  onDelete,
  onReport,
}: PostActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const itemStyle: React.CSSProperties = {
    width: '100%',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    color: '#fff',
    fontSize: 10,
    letterSpacing: '0.12em',
    padding: '11px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Post actions"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        style={{
          width: 28,
          height: 28,
          border: '1px solid rgba(255,255,255,0.12)',
          background: '#0a0a0a',
          color: '#c0392b',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
          fontFamily: 'inherit',
        }}
      >
        ⋮
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 34,
            right: 0,
            minWidth: 164,
            background: '#090909',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 18px 60px rgba(0,0,0,0.45)',
            zIndex: 20,
          }}
        >
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setOpen(false)
                  onEdit?.()
                }}
                style={itemStyle}
              >
                EDIT POST
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setOpen(false)
                  onDelete?.()
                }}
                style={{ ...itemStyle, color: '#c0392b' }}
              >
                DELETE POST
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setOpen(false)
                onReport?.()
              }}
              style={{ ...itemStyle, color: '#c0392b' }}
            >
              REPORT POST
            </button>
          )}
        </div>
      )}
    </div>
  )
}
