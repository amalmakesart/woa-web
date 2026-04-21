'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/admin'

interface Project {
  id: string
  user_id: string
  title: string
  description: string
  discipline: string | null
  location: string | null
  budget: string | null
  is_closed: boolean
  comment_count: number
  created_at: string
  profiles?: { username: string | null; full_name: string | null; profile_photo_url: string | null; art_type: string | null; discipline: string | null } | null
}

interface ProjectComment {
  id: string
  project_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { username: string | null; profile_photo_url: string | null } | null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'NOW'
  if (m < 60) return m + 'M AGO'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'H AGO'
  const d = Math.floor(h / 24)
  if (d < 7) return d + 'D AGO'
  return Math.floor(d / 7) + 'W AGO'
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      setIsAdmin(isAdminEmail(user?.email))

      const [{ data: projectData }, { data: commentsData }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_comments')
          .select('id, project_id, user_id, content, created_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),
      ])

      if (!projectData) { setLoading(false); return }

      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('username, full_name, profile_photo_url, art_type, discipline')
        .eq('id', (projectData as any).user_id)
        .single()

      setProject({ ...(projectData as Project), profiles: authorProfile as any })

      const rawComments = (commentsData as ProjectComment[]) ?? []
      if (rawComments.length > 0) {
        const userIds = [...new Set(rawComments.map(c => c.user_id))]
        const { data: commentProfiles } = await supabase
          .from('profiles').select('id, username, profile_photo_url').in('id', userIds)
        const pMap = Object.fromEntries((commentProfiles ?? []).map((p: any) => [p.id, p]))
        setComments(rawComments.map(c => ({ ...c, profiles: pMap[c.user_id] ?? null })))
      }

      setLoading(false)
    }
    load()
  }, [projectId])

  async function handleDelete() {
    if (!project || (!isAdmin && currentUserId !== project.user_id)) return
    if (!window.confirm('DELETE THIS COLLAB? THIS CANNOT BE UNDONE.')) return
    const supabase = createClient()
    await supabase.from('projects').delete().eq('id', projectId)
    router.push('/projects')
  }

  async function handleClose() {
    if (!project || (!isAdmin && currentUserId !== project.user_id) || project.is_closed) return
    if (!window.confirm('CLOSE THIS COLLAB? COMMENTING WILL BE DISABLED.')) return
    setClosing(true)
    const supabase = createClient()
    const { error } = await supabase.from('projects').update({ is_closed: true }).eq('id', projectId)
    if (!error) {
      setProject(prev => prev ? { ...prev, is_closed: true } : prev)
    }
    setClosing(false)
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || !currentUserId || !project || project.is_closed) return
    setSubmitting(true)
    const content = commentText.trim()
    setCommentText('')
    const supabase = createClient()

    const { data: newComment } = await supabase
      .from('project_comments')
      .insert({ project_id: projectId, user_id: currentUserId, content })
      .select('id, project_id, user_id, content, created_at')
      .single()

    if (newComment) {
      const { data: prof } = await supabase
        .from('profiles').select('username, profile_photo_url').eq('id', currentUserId).single()
      setComments(prev => [...prev, { ...(newComment as ProjectComment), profiles: prof as any }])
      setProject(p => p ? { ...p, comment_count: p.comment_count + 1 } : p)
    }
    setSubmitting(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</div>
  }

  if (!project) {
    return <div style={{ textAlign: 'center', padding: '80px 20px', color: '#888880', fontSize: 11, letterSpacing: '0.1em' }}>PROJECT NOT FOUND</div>
  }

  const profile = project.profiles
  const canManage = currentUserId === project.user_id || isAdmin

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 20 }}>
        ← BACK
      </button>

      <div style={{ fontSize: 10, color: '#888880', letterSpacing: '0.16em', marginBottom: 20 }}>
        COLLAB
      </div>

      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href={`/artists/${project.user_id}`}>
          {profile?.profile_photo_url ? (
            <img src={profile.profile_photo_url} alt="" className="oct-avatar" style={{ width: 40, height: 40 }} />
          ) : (
            <div className="oct-avatar" style={{ width: 40, height: 40, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880' }}>◯</div>
          )}
        </Link>
        <div style={{ flex: 1 }}>
          <Link href={`/artists/${project.user_id}`} style={{ textDecoration: 'none' }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#fff' }}>
              {(profile?.username ?? profile?.full_name ?? 'UNKNOWN').toUpperCase()}
            </span>
          </Link>
          {(profile?.discipline ?? profile?.art_type) && (
            <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.08em' }}>
              {(profile?.discipline ?? profile?.art_type)?.toUpperCase()}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#888880', letterSpacing: '0.06em' }}>{timeAgo(project.created_at)}</span>
      </div>

      {/* Title */}
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2, marginBottom: 16 }}>
        {project.title}
      </h1>

      {(project.discipline || project.location) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          {project.discipline ? (
            <span style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.1em' }}>
              {project.discipline.toUpperCase()}
            </span>
          ) : null}
          {project.location ? (
            <span style={{ fontSize: 10, color: '#c0392b', letterSpacing: '0.1em' }}>
              {project.location.toUpperCase()}
            </span>
          ) : null}
        </div>
      )}

      {project.budget && (
        <div style={{ fontSize: 10, color: '#f5c842', letterSpacing: '0.1em', marginBottom: 20 }}>
          BUDGET: {project.budget.toUpperCase()}
        </div>
      )}

      {project.is_closed && (
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 9, color: '#888880', letterSpacing: '0.12em', border: '1px solid rgba(255,255,255,0.16)', padding: '4px 10px' }}>
            COLLAB CLOSED
          </span>
        </div>
      )}

      {/* Description */}
      <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.85, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
        {project.description}
      </p>

      {/* Admin/owner controls */}
      {canManage && (
        <div style={{ marginBottom: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!project.is_closed && (
            <button
              onClick={handleClose}
              className="btn-primary"
              style={{ fontSize: 10, padding: '8px 16px' }}
              disabled={closing}
            >
              {closing ? 'CLOSING...' : 'CLOSE COLLAB'}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="btn-red"
            style={{ fontSize: 10, padding: '8px 16px' }}
          >
            DELETE COLLAB
          </button>
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }} />

      {/* Comments */}
      <div style={{ marginBottom: 100 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.16em', color: '#888880', marginBottom: 16 }}>
          COMMENTS ({comments.length})
        </p>

        {project.is_closed ? (
          <p style={{ fontSize: 11, color: '#888880', letterSpacing: '0.1em', textAlign: 'center', padding: '24px 0' }}>
            THIS COLLAB IS CLOSED. COMMENTING HAS BEEN DISABLED.
          </p>
        ) : comments.length === 0 ? (
          <p style={{ fontSize: 11, color: '#444', letterSpacing: '0.1em', textAlign: 'center', padding: '24px 0' }}>
            BE THE FIRST TO COMMENT — EXPRESS YOUR INTEREST
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {comments.map(comment => (
              <div key={comment.id} style={{ display: 'flex', gap: 10 }}>
                <Link href={`/artists/${comment.user_id}`}>
                  {comment.profiles?.profile_photo_url ? (
                    <img src={comment.profiles.profile_photo_url} alt="" className="oct-avatar" style={{ width: 30, height: 30, flexShrink: 0 }} />
                  ) : (
                    <div className="oct-avatar" style={{ width: 30, height: 30, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 10, flexShrink: 0 }}>◯</div>
                  )}
                </Link>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                    <Link href={`/artists/${comment.user_id}`} style={{ textDecoration: 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
                        {(comment.profiles?.username ?? 'UNKNOWN').toUpperCase()}
                      </span>
                    </Link>
                    <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.06em' }}>{timeAgo(comment.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Comment input */}
      {currentUserId && !project.is_closed && (
        <form
          onSubmit={handleComment}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#000', borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '12px 20px', display: 'flex', gap: 10,
            maxWidth: 640, margin: '0 auto',
          }}
        >
          <input
            className="woa-input"
            style={{ flex: 1 }}
            placeholder="COMMENT OR EXPRESS INTEREST..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn-red" style={{ padding: '12px 16px', flexShrink: 0 }} disabled={submitting || !commentText.trim()}>
            POST
          </button>
        </form>
      )}
    </div>
  )
}
