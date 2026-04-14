import { Link } from 'react-router-dom'
import { useCourseNotificationAlerts } from '../../hooks/useCourseNotificationAlerts'

export default function Notifications() {
  const { unreadCount } = useCourseNotificationAlerts()

  return (
    <Link
      to="/classes"
      className="relative rounded-lg border border-gray-300 bg-white p-2 text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
      aria-label={`Notifications${unreadCount ? ` (${unreadCount} new class announcements)` : ''}`}
      title={unreadCount ? `${unreadCount} unread class announcements` : 'Notifications'}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
