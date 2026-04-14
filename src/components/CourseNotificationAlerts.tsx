import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useNotification } from '../contexts/NotificationContext'
import { useCourseNotificationAlerts } from '../hooks/useCourseNotificationAlerts'

/**
 * Polls unread class notifications, shows a header banner, and toasts each new id once per session.
 */
export default function CourseNotificationAlerts() {
  const { addNotification } = useNotification()
  const { unread, unreadCount } = useCourseNotificationAlerts()
  const toastedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const n of unread) {
      if (toastedRef.current.has(n.id)) continue
      toastedRef.current.add(n.id)
      const courseName = n.courses?.name ?? 'A class'
      addNotification({
        type: 'info',
        title: `${courseName}: ${n.title}`,
        message: n.body.length > 160 ? `${n.body.slice(0, 157)}…` : n.body,
        duration: 6000,
      })
    }
  }, [unread, addNotification])

  if (unreadCount === 0) return null

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/50 dark:text-amber-100">
      <Link to="/classes" className="font-medium underline hover:no-underline">
        You have {unreadCount === 1 ? 'a new class announcement' : `${unreadCount} new class announcements`}. Open My Classes to read them.
      </Link>
    </div>
  )
}
