import { useState, useRef } from 'react'
import ContactsList from './contacts/ContactsList'
import FriendRequests from './friends/FriendRequests'

type FriendRequestsRef = {
  refresh: () => void
}

interface RightSidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function RightSidebar({ collapsed, onToggleCollapsed }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'contacts' | 'requests'>('contacts')
  const friendRequestsRef = useRef<FriendRequestsRef>(null)

  const handleFriendRequestSent = () => {
    if (friendRequestsRef.current) {
      friendRequestsRef.current.refresh()
    }
  }

  return (
    <aside
      className={`hidden shrink-0 flex-col border-l border-gray-200 bg-white transition-[width] duration-200 ease-out dark:border-gray-800 dark:bg-gray-900 xl:flex ${
        collapsed ? 'w-11' : 'w-80'
      }`}
    >
      <div
        className={`flex shrink-0 items-center gap-1 border-b border-gray-200 dark:border-gray-800 ${
          collapsed ? 'flex-col px-1 py-3' : 'p-4'
        }`}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand contacts sidebar' : 'Collapse contacts sidebar'}
          className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {collapsed ? (
            <ChevronLeftIcon className="h-5 w-5" />
          ) : (
            <ChevronRightIcon className="h-5 w-5" />
          )}
        </button>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('contacts')}
              className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'contacts'
                  ? 'bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
              }`}
            >
              Contacts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'requests'
                  ? 'bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
              }`}
            >
              Requests
            </button>
          </div>
        )}
      </div>
      <div
        className={`min-h-0 flex-1 ${collapsed ? 'hidden' : 'block overflow-y-auto p-4'}`}
        aria-hidden={collapsed}
      >
        {activeTab === 'contacts' ? (
          <ContactsList onFriendRequestSent={handleFriendRequestSent} />
        ) : (
          <FriendRequests ref={friendRequestsRef} />
        )}
      </div>
    </aside>
  )
}
