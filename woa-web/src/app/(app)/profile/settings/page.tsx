'use client'

import { useState, useEffect } from 'react'
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

  // Verified purchase
  const [profile, setProfile] = useState<any>(null)
  const [postCount, setPostCount] = useState(0)
  const [totalConnections, setTotalConnections] = useState(0)
  const [showVerifiedCheckout, setShowVerifiedCheckout] = useState(false)
  const [checkoutVersion] = useState(() => Date.now().toString())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prof }, { count: pc }, { count: followerCount }, { count: followingCount }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
      ])
      setProfile(prof)
      setPostCount(pc ?? 0)
      setTotalConnections((followerCount ?? 0) + (followingCount ?? 0))
    }
    load()
  }, [])

  // Listen for verified payment success from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data?.type === 'verified_success') {
          setShowVerifiedCheckout(false)
          setProfile((p: any) => p ? { ...p, is_verified: true } : p)
        }
      } catch {}
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

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
    await supabase.from('profiles').update({ full_name: '[DELETED]', username: null, bio: null, profile_photo_url: null }).eq('id', user.id)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const showVerified = profile && profile.role !== 'GIG_POSTER' && profile.role !== 'ART_LOVER'
  const meetsPost = postCount >= 6
  const meetsConnect = totalConnections >= 15

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 11, letterSpacing: '0.1em' }}>← BACK</button>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em' }}>SETTINGS</h1>
      </div>

      {/* WOA Verification */}
      {showVerified && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 12 }}>WOA VERIFICATION</p>
          {profile.is_verified ? (
            <div style={{ border: '1px solid #f6c55a', padding: '20px', background: '#0a0800', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 9, fontWeight: 700, background: '#f6c55a', color: '#000', padding: '4px 10px', letterSpacing: '0.18em', flexShrink: 0 }}>WOA</span>
              <div>
                <p style={{ fontSize: 12, color: '#f6c55a', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 4 }}>VERIFIED ARTIST</p>
                <p style={{ fontSize: 10, color: '#d6b95a', letterSpacing: '0.06em' }}>YOU ARE ELIGIBLE TO BE SCOUTED AND FEATURED BY WOA</p>
              </div>
            </div>
          ) : (
            <div style={{ border: '1px solid #f6c55a', background: '#0a0800' }}>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, background: '#f6c55a', color: '#000', padding: '3px 8px', letterSpacing: '0.18em' }}>WOA</span>
                    <span style={{ fontSize: 13, color: '#f6c55a', fontWeight: 700, letterSpacing: '0.16em' }}>GET VERIFIED</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#f6c55a', lineHeight: 1 }}>$30</p>
                    <p style={{ fontSize: 9, color: '#d6b95a', letterSpacing: '0.08em' }}>ONE TIME</p>
                  </div>
                </div>
                <p style={{ fontSize: 10, color: '#d6b95a', letterSpacing: '0.08em', lineHeight: 1.7, marginBottom: 16 }}>
                  ONLY VERIFIED ARTISTS WILL BE SCOUTED & FEATURED BY WOA. GET THE GOLD BADGE AND BE ELIGIBLE FOR SELECTION.
                </p>

                {/* Requirements */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(246,197,90,0.15)' }}>
                  <p style={{ fontSize: 9, color: '#888880', letterSpacing: '0.14em', marginBottom: 4 }}>REQUIREMENTS</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: meetsPost ? '#2ecc71' : '#c0392b' }}>{meetsPost ? '✓' : '✗'}</span>
                    <span style={{ fontSize: 10, color: meetsPost ? '#2ecc71' : '#888880', letterSpacing: '0.06em' }}>
                      AT LEAST 6 POSTS — {postCount} / 6
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: meetsConnect ? '#2ecc71' : '#c0392b' }}>{meetsConnect ? '✓' : '✗'}</span>
                    <span style={{ fontSize: 10, color: meetsConnect ? '#2ecc71' : '#888880', letterSpacing: '0.06em' }}>
                      AT LEAST 15 FOLLOWERS + FOLLOWING — {totalConnections} / 15
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!meetsPost || !meetsConnect) return
                    setShowVerifiedCheckout(true)
                  }}
                  disabled={!meetsPost || !meetsConnect}
                  style={{
                    width: '100%', padding: '14px', background: meetsPost && meetsConnect ? '#f6c55a' : 'transparent',
                    border: `1px solid ${meetsPost && meetsConnect ? '#f6c55a' : 'rgba(246,197,90,0.3)'}`,
                    color: meetsPost && meetsConnect ? '#000' : '#666',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', cursor: meetsPost && meetsConnect ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', transition: 'all 0.2s',
                  }}
                >
                  {meetsPost && meetsConnect ? 'GET VERIFIED — $30' : 'REQUIREMENTS NOT MET YET'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Account */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 12 }}>ACCOUNT</p>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/profile/edit" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="settings-row">
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: '#fff' }}>EDIT PROFILE</span>
            <span style={{ color: '#555', fontSize: 18 }}>›</span>
          </a>
          <button onClick={() => { setChangingPw(!changingPw); setPwError(''); setPwSuccess(false) }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontFamily: 'inherit' }} className="settings-row">
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
            { label: 'PRIVACY POLICY', href: 'https://www.workerofart.com/privacy-policy.html' },
            { label: 'TERMS OF SERVICE', href: 'https://www.workerofart.com/terms-of-service.html' },
          ].map((item, i, arr) => (
            <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', textDecoration: 'none', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }} className="settings-row">
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
          <button onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push('/login') }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} className="settings-row">
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: '#c0392b' }}>SIGN OUT</span>
            <span style={{ color: '#c0392b', fontSize: 18 }}>›</span>
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#c0392b', marginBottom: 12 }}>DANGER ZONE</p>
        <div style={{ border: '1px solid rgba(192,57,43,0.3)' }}>
          <button onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: '#c0392b' }}>DELETE ACCOUNT</span>
            <span style={{ color: '#c0392b', fontSize: 18 }}>{showDeleteConfirm ? '∨' : '›'}</span>
          </button>
          {showDeleteConfirm && (
            <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(192,57,43,0.2)' }}>
              <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.06em', margin: '16px 0 12px', lineHeight: 1.7 }}>
                THIS WILL PERMANENTLY DELETE YOUR ACCOUNT AND ALL ASSOCIATED DATA. THIS CANNOT BE UNDONE.
              </p>
              <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.06em', marginBottom: 10 }}>TYPE "DELETE" TO CONFIRM:</p>
              <input className="woa-input" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="DELETE" style={{ marginBottom: 12 }} />
              <button onClick={handleDeleteAccount} disabled={deleteInput.toUpperCase() !== 'DELETE' || deleting}
                style={{ width: '100%', padding: '12px', background: deleteInput.toUpperCase() === 'DELETE' ? '#c0392b' : '#1a0a0a', border: '1px solid #c0392b', color: deleteInput.toUpperCase() === 'DELETE' ? '#fff' : '#555', fontSize: 11, letterSpacing: '0.12em', cursor: deleteInput.toUpperCase() === 'DELETE' ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {deleting ? 'DELETING...' : 'PERMANENTLY DELETE ACCOUNT'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Verified checkout modal */}
      {showVerifiedCheckout && profile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', flexDirection: 'column' }}
          onClick={e => { if (e.target === e.currentTarget) setShowVerifiedCheckout(false) }}>
          <div style={{ background: '#000', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 520, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#f6c55a' }}>GET VERIFIED — $30</span>
              <button onClick={() => setShowVerifiedCheckout(false)} style={{ background: 'none', border: 'none', color: '#888880', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
            <iframe
              src={`https://workerofart.com/checkout/verified.html?v=${checkoutVersion}&user_id=${profile.id}`}
              style={{ flex: 1, border: 'none', background: '#000' }}
              title="Get Verified"
            />
          </div>
        </div>
      )}

      <style>{`.settings-row:hover { opacity: 0.75; }`}</style>
    </div>
  )
}
