import { Link } from 'react-router-dom'
import { useUnreadMessages } from '../../contexts/UnreadMessagesContext'

export default function MessagesIcon() {
  const { unreadCount } = useUnreadMessages()

  return (
    <Link
      to="/conversations"
      className="relative rounded-lg border border-gray-300 bg-white p-2 text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
      aria-label={`Messages${unreadCount ? ` (${unreadCount} new)` : ''}`}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-blue-600 text-white text-xs font-bold rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
