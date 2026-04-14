import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type ThreadRow = {
  id: string
  course_id: string
  user_id: string
  title: string
  body: string
  created_at: string
}

type ReplyRow = {
  id: string
  thread_id: string
  user_id: string
  body: string
  created_at: string
}

interface CourseForumProps {
  courseId: string
  isSuperAdmin: boolean
}

export default function CourseForum({ courseId, isSuperAdmin }: CourseForumProps) {
  const { user } = useAuth()
  const [threads, setThreads] = useState<ThreadRow[]>([])
  const [names, setNames] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replies, setReplies] = useState<ReplyRow[]>([])
  const [replyBody, setReplyBody] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadNames = useCallback(async (userIds: string[]) => {
    const uniq = [...new Set(userIds)].filter(Boolean)
    if (uniq.length === 0) return {}
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', uniq)
    const map: Record<string, string | null> = {}
    ;(data || []).forEach((p: { id: string; full_name: string | null }) => {
      map[p.id] = p.full_name
    })
    return map
  }, [])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: qErr } = await supabase
        .from('course_threads')
        .select('id, course_id, user_id, title, body, created_at')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })

      if (qErr) throw qErr
      const list = (data || []) as ThreadRow[]
      setThreads(list)
      const nm = await loadNames(list.map((t) => t.user_id))
      setNames((prev) => ({ ...prev, ...nm }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load discussions')
    } finally {
      setLoading(false)
    }
  }, [courseId, loadNames])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  const loadReplies = useCallback(
    async (threadId: string) => {
      const { data, error: qErr } = await supabase
        .from('course_thread_replies')
        .select('id, thread_id, user_id, body, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })

      if (qErr) throw qErr
      const list = (data || []) as ReplyRow[]
      setReplies(list)
      const nm = await loadNames(list.map((r) => r.user_id))
      setNames((prev) => ({ ...prev, ...nm }))
    },
    [loadNames]
  )

  useEffect(() => {
    if (!selectedId) {
      setReplies([])
      return
    }
    loadReplies(selectedId).catch(() => setReplies([]))
  }, [selectedId, loadReplies])

  const displayName = (uid: string) => names[uid] || 'Member'

  const handleNewThread = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newTitle.trim() || !newBody.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const { error: insErr } = await supabase.from('course_threads').insert({
        course_id: courseId,
        user_id: user.id,
        title: newTitle.trim(),
        body: newBody.trim(),
      })
      if (insErr) throw insErr
      setNewTitle('')
      setNewBody('')
      await loadThreads()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create thread')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedId || !replyBody.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const { error: insErr } = await supabase.from('course_thread_replies').insert({
        thread_id: selectedId,
        user_id: user.id,
        body: replyBody.trim(),
      })
      if (insErr) throw insErr
      setReplyBody('')
      await loadReplies(selectedId)
      await loadThreads()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not post reply')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteThread = async (thread: ThreadRow) => {
    if (!user) return
    if (!isSuperAdmin && thread.user_id !== user.id) return
    if (!window.confirm('Delete this thread and all replies?')) return
    setError('')
    try {
      const { error: delErr } = await supabase.from('course_threads').delete().eq('id', thread.id)
      if (delErr) throw delErr
      if (selectedId === thread.id) setSelectedId(null)
      await loadThreads()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete thread')
    }
  }

  const deleteReply = async (reply: ReplyRow) => {
    if (!user) return
    if (!isSuperAdmin && reply.user_id !== user.id) return
    if (!window.confirm('Delete this reply?')) return
    setError('')
    try {
      const { error: delErr } = await supabase.from('course_thread_replies').delete().eq('id', reply.id)
      if (delErr) throw delErr
      if (selectedId) await loadReplies(selectedId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete reply')
    }
  }

  const selected = threads.find((t) => t.id === selectedId)

  if (loading && threads.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading discussions…</p>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleNewThread} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Start a thread</h3>
        <input
          type="text"
          placeholder="Title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <textarea
          placeholder="What would you like to discuss?"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={3}
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={submitting || !newTitle.trim() || !newBody.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Post thread
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Threads</h3>
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === t.id
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="font-medium text-gray-900 dark:text-white">{t.title}</span>
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    {displayName(t.user_id)} · {new Date(t.created_at).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {threads.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No threads yet. Start the first one above.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
          {!selected ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Select a thread to read and reply.</p>
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{selected.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {displayName(selected.user_id)} · {new Date(selected.created_at).toLocaleString()}
                  </p>
                </div>
                {user && (isSuperAdmin || selected.user_id === user.id) && (
                  <button
                    type="button"
                    onClick={() => deleteThread(selected)}
                    className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mb-6 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{selected.body}</p>

              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Replies
              </h5>
              <ul className="mb-4 space-y-3">
                {replies.map((r) => (
                  <li key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
                    <div className="flex justify-between gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {displayName(r.user_id)} · {new Date(r.created_at).toLocaleString()}
                      </span>
                      {user && (isSuperAdmin || r.user_id === user.id) && (
                        <button
                          type="button"
                          onClick={() => deleteReply(r)}
                          className="text-xs text-red-600 hover:underline dark:text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{r.body}</p>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleReply} className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <textarea
                  placeholder="Write a reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={3}
                  className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={submitting || !replyBody.trim()}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  Reply
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
