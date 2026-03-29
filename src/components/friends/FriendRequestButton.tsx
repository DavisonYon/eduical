import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface FriendRequestButtonProps {
  userId: string
  onStatusChange?: () => void
}

type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | null

export default function FriendRequestButton({ userId, onStatusChange }: FriendRequestButtonProps) {
  const { user } = useAuth()
  const [status, setStatus] = useState<FriendshipStatus>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check current friendship status
  useEffect(() => {
    checkFriendshipStatus()
  }, [user, userId])

  const checkFriendshipStatus = async () => {
    if (!user || user.id === userId) {
      setChecking(false)
      return
    }

    // Add timeout
    const timeoutId = setTimeout(() => {
      setChecking(false)
      setStatus('none')
    }, 5000) // 5 second timeout

    try {
      // Check if there's an existing friendship (user as requester)
      const { data: asRequester, error: requesterError } = await supabase
        .from('friendships')
        .select('status, requester_id')
        .eq('requester_id', user.id)
        .eq('addressee_id', userId)
        .maybeSingle()

      if (requesterError && requesterError.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine
        throw requesterError
      }

      if (asRequester) {
        clearTimeout(timeoutId)
        if (asRequester.status === 'accepted') {
          setStatus('accepted')
        } else {
          setStatus('pending_sent')
        }
        setChecking(false)
        return
      }

      // Check if there's an existing friendship (user as addressee)
      const { data: asAddressee, error: addresseeError } = await supabase
        .from('friendships')
        .select('status, requester_id')
        .eq('requester_id', userId)
        .eq('addressee_id', user.id)
        .maybeSingle()

      if (addresseeError && addresseeError.code !== 'PGRST116') {
        throw addresseeError
      }

      clearTimeout(timeoutId)
      if (asAddressee) {
        if (asAddressee.status === 'accepted') {
          setStatus('accepted')
        } else {
          setStatus('pending_received')
        }
      } else {
        setStatus('none')
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      console.error('Error checking friendship status:', err)
      // If table doesn't exist or RLS issue, just show "Add Friend"
      setStatus('none')
    } finally {
      setChecking(false)
    }
  }

  const sendFriendRequest = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester_id: user.id,
          addressee_id: userId,
          status: 'pending',
        })

      if (error) throw error

      setStatus('pending_sent')
      if (onStatusChange) onStatusChange()
    } catch (err: any) {
      console.error('Error sending friend request:', err)
      alert('Failed to send friend request')
    } finally {
      setLoading(false)
    }
  }

  const acceptFriendRequest = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('addressee_id', user.id)
        .eq('requester_id', userId)
        .eq('status', 'pending')

      if (error) throw error

      setStatus('accepted')
      if (onStatusChange) onStatusChange()
    } catch (err: any) {
      console.error('Error accepting friend request:', err)
      alert('Failed to accept friend request')
    } finally {
      setLoading(false)
    }
  }

  const cancelFriendRequest = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('requester_id', user.id)
        .eq('addressee_id', userId)
        .eq('status', 'pending')

      if (error) throw error

      setStatus('none')
      if (onStatusChange) onStatusChange()
    } catch (err: any) {
      console.error('Error canceling friend request:', err)
      alert('Failed to cancel friend request')
    } finally {
      setLoading(false)
    }
  }

  if (!user || user.id === userId) {
    return null
  }

  if (checking) {
    return (
      <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin"></div>
    )
  }

  if (status === 'accepted') {
    return (
      <span className="px-3 py-1 text-xs bg-green-900/50 text-green-300 rounded-full">
        Friends
      </span>
    )
  }

  if (status === 'pending_sent') {
    return (
      <button
        onClick={cancelFriendRequest}
        disabled={loading}
        className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors disabled:opacity-50"
      >
        {loading ? '...' : 'Pending'}
      </button>
    )
  }

  if (status === 'pending_received') {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={acceptFriendRequest}
          disabled={loading}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Accept'}
        </button>
        <button
          onClick={cancelFriendRequest}
          disabled={loading}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Decline'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={sendFriendRequest}
      disabled={loading}
      className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors disabled:opacity-50"
    >
      {loading ? '...' : '+ Add Friend'}
    </button>
  )
}
