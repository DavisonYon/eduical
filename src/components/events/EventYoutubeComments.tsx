import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

type ProfileSnippet = {
  id: string
  full_name: string | null
  email: string | null
  profile_picture: string | null
}

export type EventYoutubeCommentRow = {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles: ProfileSnippet | null
}

interface EventYoutubeCommentsProps {
  youtubeVideoId: string
  /** `embedded`: no outer card chrome (e.g. inside the dashboard comments modal). */
  variant?: 'page' | 'embedded'
  /** Called after a new top-level comment is posted (parent can refresh counts). */
  onThreadChange?: () => void
}

const MAX_LEN = 4000

export default function EventYoutubeComments({
  youtubeVideoId,
  variant = 'page',
  onThreadChange,
}: EventYoutubeCommentsProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<EventYoutubeCommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  const loadComments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: rows, error: qErr } = await supabase
        .from('event_youtube_comments')
        .select('id, user_id, content, created_at')
        .eq('youtube_video_id', youtubeVideoId)
        .order('created_at', { ascending: false })

      if (qErr) throw qErr

      const base =
        rows?.map((r: { id: string; user_id: string; content: string; created_at: string }) => ({
          id: r.id,
          user_id: r.user_id,
          content: r.content,
          created_at: r.created_at,
          profiles: null as ProfileSnippet | null,
        })) ?? []

      if (base.length === 0) {
        setComments([])
        return
      }

      const ids = [...new Set(base.map((c) => c.user_id))]
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture')
        .in('id', ids)

      if (pErr) throw pErr

      setComments(
        base.map((c) => ({
          ...c,
          profiles: profiles?.find((p) => p.id === c.user_id) ?? null,
        }))
      )
    } catch (e: unknown) {
      setComments([])
      setError(e instanceof Error ? e.message : 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }, [youtubeVideoId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const text = draft.trim()
    if (!text) return

    setPosting(true)
    setError('')
    try {
      const { error: insErr } = await supabase.from('event_youtube_comments').insert({
        youtube_video_id: youtubeVideoId,
        user_id: user.id,
        content: text.slice(0, MAX_LEN),
      })
      if (insErr) throw insErr
      setDraft('')
      await loadComments()
      onThreadChange?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not post comment')
    } finally {
      setPosting(false)
    }
  }

  const displayName = (p: ProfileSnippet | null) => p?.full_name || p?.email?.split('@')[0] || 'Member'

  const body = (
    <div className={variant === 'embedded' ? 'px-0 py-0' : 'p-4'}>
        {user ? (
          <form onSubmit={handleSubmit} className="mb-6 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={MAX_LEN}
              placeholder="Write a comment…"
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {draft.length}/{MAX_LEN}
              </span>
              <button
                type="submit"
                disabled={posting || !draft.trim()}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        ) : (
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">Sign in to comment.</p>
        )}

        {error && (
          <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No comments yet.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-gray-700/80">
                <Link
                  to={`/user/${c.user_id}`}
                  className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {c.profiles?.profile_picture ? (
                    <img
                      src={c.profiles.profile_picture}
                      alt=""
                      className="h-9 w-9 rounded-full border border-gray-200 object-cover dark:border-gray-600"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                      {displayName(c.profiles).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <Link
                      to={`/user/${c.user_id}`}
                      className="text-sm font-medium text-gray-900 hover:underline dark:text-white"
                    >
                      {displayName(c.profiles)}
                    </Link>
                    <time className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(c.created_at).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{c.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  )

  if (variant === 'embedded') {
    return <div className="text-left">{body}</div>
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Educial comments</h2>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
          Only people signed in to Educial can see these. They are not posted on YouTube.
        </p>
      </div>
      {body}
    </div>
  )
}
