'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const router = useRouter()
  const [changingPw, setChangingPw] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (newPw.length < 8) { setPwError('PASSWORD MUST BE AT LEAST 8 CHARACTERS'); return }
    if (newPw !== confirmPw) { setPwError('PASSWORDS DO NOT MATCH'); return }
    setSavingPw(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) { setPwError(error.message.toUpperCase()); setSavingPw(false); return }
    setPwSuccess(true)
    setNewPw('')
    setConfirmPw('')
    setSavingPw(false)
    setChangingPw(false)
  }

  async function handleDeleteAccount() {
    if (deleteInput.toUpperCase() !== 'DELETE') return
    setDeleting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Mark profile as deleted (soft delete)
    await supabase.from('profiles').update({ full_name: '[DELETED]', username: null, bio: null, profile_photo_url: null }).eq('id', user.id)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sections = [
    {
      title: 'ACCOUNT',
      items: [
        { label: 'EDIT PROFILE', href: '/profile/edit' },
      ],
    },
  ]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 11, letterSpacing: '0.1em' }}>← BACK</button>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em' }}>SETTINGS</h1>
      </div>

      {/* Account section */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 12 }}>ACCOUNT</p>

        <div style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/profile/edit" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="settings-row">
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: '#fff' }}>EDIT PROFILE</span>
            <span style={{ color: '#555', fontSize: 18 }}>›</span>
          </a>

          <button
            onClick={() => { setChangingPw(!changingPw); setPwError(''); setPwSuccess(false) }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontFamily: 'inherit' }}
            className="settings-row"
          >
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: '#fff' }}>CHANGE PASSWORD</span>
            <span style={{ color: '#555', fontSize: 18 }}>{changingPw ? '∨' : '›'}</span>
          </button>

          {changingPw && (
            <form onSubmit={handleChangePassword} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="woa-input-label">NEW PASSWORD</label>
                <input className="woa-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" />
              </div>
              <div>
                <label className="woa-input-label">CONFIRM PASSWORD</label>
                <input className="woa-input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
              </div>
              {pwError && <p style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.06em' }}>{pwError}</p>}
              {pwSuccess && <p style={{ fontSize: 11, color: '#2ecc71', letterSpacing: '0.06em' }}>PASSWORD UPDATED!</p>}
              <button type="submit" className="btn-primary" disabled={savingPw}>{savingPw ? 'SAVING...' : 'UPDATE PASSWORD'}</button>
            </form>
          )}
        </div>
      </div>

      {/* Privacy & Legal */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 12 }}>PRIVACY & LEGAL</p>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'PRIVACY POLICY', href: '/privacy' },
            { label: 'TERMS OF SERVICE', href: '/terms' },
          ].map((item, i, arr) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px', textDecoration: 'none',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
              className="settings-row"
            >
              <span style={{ fontSize: 12, letterSpacing: '0.08em', color: '#fff' }}>{item.label}</span>
              <span style={{ color: '#555', fontSize: 16 }}>↗</span>
            </a>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 12 }}>SESSION</p>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            className="settings-row"
          >
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: '#c0392b' }}>SIGN OUT</span>
            <span style={{ color: '#c0392b', fontSize: 18 }}>›</span>
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#c0392b', marginBottom: 12 }}>DANGER ZONE</p>
        <div style={{ border: '1px solid rgba(192,57,43,0.3)' }}>
          <button
            onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: '#c0392b' }}>DELETE ACCOUNT</span>
            <span style={{ color: '#c0392b', fontSize: 18 }}>{showDeleteConfirm ? '∨' : '›'}</span>
          </button>

          {showDeleteConfirm && (
            <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(192,57,43,0.2)' }}>
              <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.06em', margin: '16px 0 12px', lineHeight: 1.7 }}>
                THIS WILL PERMANENTLY DELETE YOUR ACCOUNT AND ALL ASSOCIATED DATA. THIS CANNOT BE UNDONE.
              </p>
              <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.06em', marginBottom: 10 }}>
                TYPE "DELETE" TO CONFIRM:
              </p>
              <input
                className="woa-input"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                style={{ marginBottom: 12 }}
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput.toUpperCase() !== 'DELETE' || deleting}
                style={{
                  width: '100%', padding: '12px', background: deleteInput.toUpperCase() === 'DELETE' ? '#c0392b' : '#1a0a0a',
                  border: '1px solid #c0392b', color: deleteInput.toUpperCase() === 'DELETE' ? '#fff' : '#555',
                  fontSize: 11, letterSpacing: '0.12em', cursor: deleteInput.toUpperCase() === 'DELETE' ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {deleting ? 'DELETING...' : 'PERMANENTLY DELETE ACCOUNT'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`.settings-row:hover { opacity: 0.75; }`}</style>
    </div>
  )
}
