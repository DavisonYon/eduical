import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export type CourseNotificationRow = {
  id: string
  title: string
  body: string
  course_id: string
  created_at: string
  courses: { name: string } | null
}

export function useCourseNotificationAlerts(pollMs = 45000) {
  const { user } = useAuth()
  const [unread, setUnread] = useState<CourseNotificationRow[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setUnread([])
      return
    }

    setLoading(true)
    try {
      const { data: enrollRows, error: enErr } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('user_id', user.id)

      if (enErr) throw enErr
      const courseIds = [...new Set((enrollRows || []).map((r: { course_id: string }) => r.course_id))]
      if (courseIds.length === 0) {
        setUnread([])
        return
      }

      const { data: notifRows, error: nErr } = await supabase
        .from('course_notifications')
        .select('id, title, body, course_id, created_at, courses(name)')
        .in('course_id', courseIds)
        .order('created_at', { ascending: false })
        .limit(100)

      if (nErr) throw nErr

      const { data: readRows, error: rErr } = await supabase
        .from('course_notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)

      if (rErr) throw rErr

      const readSet = new Set((readRows || []).map((r: { notification_id: string }) => r.notification_id))

      const normalizeCourseName = (raw: unknown): { name: string } | null => {
        if (raw == null) return null
        if (Array.isArray(raw)) {
          const first = raw[0] as { name?: string } | undefined
          return first?.name != null ? { name: first.name } : null
        }
        const o = raw as { name?: string }
        return o?.name != null ? { name: o.name } : null
      }

      const unreadList: CourseNotificationRow[] = (notifRows || [])
        .filter((n: { id: string }) => !readSet.has(n.id))
        .map((n: Record<string, unknown>) => ({
          id: n.id as string,
          title: n.title as string,
          body: n.body as string,
          course_id: n.course_id as string,
          created_at: n.created_at as string,
          courses: normalizeCourseName(n.courses),
        }))

      setUnread(unreadList)
    } catch {
      setUnread([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setUnread([])
      return
    }
    refresh()
    const t = window.setInterval(refresh, pollMs)
    return () => window.clearInterval(t)
  }, [user, refresh, pollMs])

  const markRead = useCallback(
    async (notificationIds: string[]) => {
      if (!user || notificationIds.length === 0) return
      const rows = notificationIds.map((notification_id) => ({
        notification_id,
        user_id: user.id,
      }))
      const { error } = await supabase.from('course_notification_reads').upsert(rows, {
        onConflict: 'notification_id,user_id',
      })
      if (!error) await refresh()
    },
    [user, refresh]
  )

  return { unread, unreadCount: unread.length, loading, refresh, markRead }
}
