import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type NotifRow = {
  id: string
  course_id: string
  title: string
  body: string
  created_at: string
}

interface CourseNotificationsPanelProps {
  courseId: string
  courseName: string
  isSuperAdmin: boolean
}

export default function CourseNotificationsPanel({
  courseId,
  courseName,
  isSuperAdmin,
}: CourseNotificationsPanelProps) {
  const { user } = useAuth()
  const [items, setItems] = useState<NotifRow[]>([])
  const [readSet, setReadSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const { data: notifs, error: nErr } = await supabase
        .from('course_notifications')
        .select('id, course_id, title, body, created_at')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })

      if (nErr) throw nErr
      setItems((notifs || []) as NotifRow[])

      const { data: reads, error: rErr } = await supabase
        .from('course_notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)

      if (rErr) throw rErr
      setReadSet(new Set((reads || []).map((r: { notification_id: string }) => r.notification_id)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [courseId, user])

  useEffect(() => {
    load()
  }, [load])

  const markRead = async (ids: string[]) => {
    if (!user || ids.length === 0) return
    try {
      const rows = ids.map((notification_id) => ({ notification_id, user_id: user.id }))
      const { error: uErr } = await supabase.from('course_notification_reads').upsert(rows, {
        onConflict: 'notification_id,user_id',
      })
      if (uErr) throw uErr
      setReadSet((prev) => new Set([...prev, ...ids]))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update read status')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !isSuperAdmin || !newTitle.trim() || !newBody.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const { error: insErr } = await supabase.from('course_notifications').insert({
        course_id: courseId,
        title: newTitle.trim(),
        body: newBody.trim(),
        created_by: user.id,
      })
      if (insErr) throw insErr
      setNewTitle('')
      setNewBody('')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not post notification')
    } finally {
      setSubmitting(false)
    }
  }

  const unreadIds = items.filter((n) => !readSet.has(n.id)).map((n) => n.id)

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {unreadIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            You have {unreadIds.length} unread announcement{unreadIds.length === 1 ? '' : 's'} in{' '}
            <span className="font-medium">{courseName}</span>.
          </p>
          <button
            type="button"
            onClick={() => markRead(unreadIds)}
            className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            Mark all read
          </button>
        </div>
      )}

      {isSuperAdmin && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Post announcement</h3>
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <textarea
            placeholder="Message to everyone enrolled in this course"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={4}
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={submitting || !newTitle.trim() || !newBody.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Publish
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No announcements yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const unread = !readSet.has(n.id)
            return (
              <li
                key={n.id}
                className={`rounded-xl border px-4 py-3 ${
                  unread
                    ? 'border-blue-300 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/30'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {unread && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">New</span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{n.body}</p>
                {unread && user && (
                  <button
                    type="button"
                    onClick={() => markRead([n.id])}
                    className="mt-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Mark as read
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        All class updates also appear in the{' '}
        <Link to="/classes" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          My Classes
        </Link>{' '}
        list and site banner when unread.
      </p>
    </div>
  )
}
