import { useEffect, useState, forwardRef, useImperativeHandle, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface FriendRequest {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  created_at: string
  requester?: {
    id: string
    full_name: string | null
    email: string | null
    profile_picture: string | null
  }
  addressee?: {
    id: string
    full_name: string | null
    email: string | null
    profile_picture: string | null
  }
}

export interface FriendRequestsRef {
  refresh: () => void
}

const FriendRequests = forwardRef<FriendRequestsRef>((_props, ref) => {
  const { user } = useAuth()
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
  const isFetchingRef = useRef(false)

  const fetchFriendRequests = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return
    }

    isFetchingRef.current = true
    setLoading(true)
    setError('')

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading(false)
      setError('Request timed out. Please check your connection.')
    }, 10000) // 10 second timeout

    try {
      // Fetch received requests
      const { data: receivedData, error: receivedError } = await supabase
        .from('friendships')
        .select('*')
        .eq('addressee_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (receivedError) {
        console.error('Error fetching received requests:', receivedError)
        throw receivedError
      }

      // Fetch sent requests
      const { data: sentData, error: sentError } = await supabase
        .from('friendships')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (sentError) {
        console.error('Error fetching sent requests:', sentError)
        throw sentError
      }

      // Fetch profile data for received requests
      if (receivedData && receivedData.length > 0) {
        const requesterIds = receivedData.map(r => r.requester_id)
        const { data: requesterProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, profile_picture')
          .in('id', requesterIds)

        const receivedWithProfiles = receivedData.map(request => ({
          ...request,
          requester: requesterProfiles?.find(p => p.id === request.requester_id) || null,
        }))
        setReceivedRequests(receivedWithProfiles)
      } else {
        setReceivedRequests([])
      }

      // Fetch profile data for sent requests
      if (sentData && sentData.length > 0) {
        const addresseeIds = sentData.map(s => s.addressee_id)
        const { data: addresseeProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, profile_picture')
          .in('id', addresseeIds)

        const sentWithProfiles = sentData.map(request => ({
          ...request,
          addressee: addresseeProfiles?.find(p => p.id === request.addressee_id) || null,
        }))
        setSentRequests(sentWithProfiles)
      } else {
        setSentRequests([])
      }
      clearTimeout(timeoutId)
    } catch (err: any) {
      clearTimeout(timeoutId)
      console.error('Error fetching friend requests:', err)
      setError(err.message || 'Failed to load friend requests')
      setReceivedRequests([])
      setSentRequests([])
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchFriendRequests()
    } else {
      setLoading(false)
    }
  }, [user, fetchFriendRequests])

  useImperativeHandle(ref, () => ({
    refresh: fetchFriendRequests,
  }), [fetchFriendRequests])

  const handleAccept = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      if (error) throw error

      fetchFriendRequests()
    } catch (err) {
      console.error('Error accepting request:', err)
      alert('Failed to accept friend request')
    }
  }

  const handleDecline = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId)

      if (error) throw error

      fetchFriendRequests()
    } catch (err) {
      console.error('Error declining request:', err)
      alert('Failed to decline friend request')
    }
  }

  const handleCancel = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId)

      if (error) throw error

      fetchFriendRequests()
    } catch (err) {
      console.error('Error canceling request:', err)
      alert('Failed to cancel friend request')
    }
  }

  const getInitials = (request: FriendRequest) => {
    const person = activeTab === 'received' ? request.requester : request.addressee
    if (!person) return 'U'
    
    if (person.full_name) {
      const names = person.full_name.split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase()
      }
      return names[0][0].toUpperCase()
    }
    if (person.email) {
      return person.email[0].toUpperCase()
    }
    return 'U'
  }

  const getName = (request: FriendRequest) => {
    const person = activeTab === 'received' ? request.requester : request.addressee
    return person?.full_name || person?.email || 'Unknown User'
  }

  const requests = activeTab === 'received' ? receivedRequests : sentRequests
  const hasRequests = requests.length > 0

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'received'
              ? 'border-blue-600 text-gray-900 dark:border-blue-500 dark:text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Received ({receivedRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sent'
              ? 'border-blue-600 text-gray-900 dark:border-blue-500 dark:text-white'
              : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Sent ({sentRequests.length})
        </button>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">Loading...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-400 text-sm">
          <p>{error}</p>
          <button
            onClick={fetchFriendRequests}
            className="mt-2 rounded bg-red-100 px-3 py-1 text-xs hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900/70"
          >
            Retry
          </button>
        </div>
      ) : !hasRequests ? (
        <div className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
          No {activeTab} friend requests
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:border-transparent dark:bg-gray-800 dark:hover:bg-gray-700"
            >
                           {(() => {
                const person = activeTab === 'received' ? request.requester : request.addressee
                const profileUserId = activeTab === 'received' ? request.requester_id : request.addressee_id
                const avatar = person?.profile_picture ? (
                  <img
                    src={person.profile_picture}
                    alt={getName(request)}
                    className="h-10 w-10 rounded-full border border-gray-300 object-cover dark:border-gray-600"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                    <span className="text-sm font-medium text-gray-800 dark:text-white">
                      {getInitials(request)}
                    </span>
                  </div>
                )
                return (
                  <Link
                    to={`/user/${profileUserId}`}
                    className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {avatar}
                  </Link>
                )
              })()}
              <div className="min-w-0 flex-1">
                <Link
                  to={`/user/${activeTab === 'received' ? request.requester_id : request.addressee_id}`}
                  className="block truncate text-sm font-medium text-gray-900 hover:underline dark:text-white"
                >
                  {getName(request)}
                </Link>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'received' ? (
                  <>
                    <button
                      onClick={() => handleAccept(request.id)}
                      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(request.id)}
                      className="rounded bg-gray-200 px-3 py-1.5 text-xs text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Decline
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleCancel(request.id)}
                    className="rounded bg-gray-200 px-3 py-1.5 text-xs text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

FriendRequests.displayName = 'FriendRequests'

export default FriendRequests
