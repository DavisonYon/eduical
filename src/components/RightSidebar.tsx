import { useState, useRef } from 'react'
import ContactsList from './contacts/ContactsList'
import FriendRequests from './friends/FriendRequests'

type FriendRequestsRef = {
  refresh: () => void
}

export default function RightSidebar() {
  const [activeTab, setActiveTab] = useState<'contacts' | 'requests'>('contacts')
  const friendRequestsRef = useRef<FriendRequestsRef>(null)

  const handleFriendRequestSent = () => {
    // Refresh friend requests when a request is sent
    if (friendRequestsRef.current) {
      friendRequestsRef.current.refresh()
    }
  }

  return (
    <aside className="hidden xl:block w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
              activeTab === 'contacts'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Contacts
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
              activeTab === 'requests'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Requests
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'contacts' ? (
          <ContactsList onFriendRequestSent={handleFriendRequestSent} />
        ) : (
          <FriendRequests ref={friendRequestsRef} />
        )}
      </div>
    </aside>
  )
}
