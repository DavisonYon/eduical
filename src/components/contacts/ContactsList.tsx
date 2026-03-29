import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import FriendRequestButton from '../friends/FriendRequestButton'

interface Contact {
  id: string
  full_name: string | null
  email: string | null
  profile_picture: string | null
}

interface ContactsListProps {
  onFriendRequestSent?: () => void
}

export default function ContactsList({ onFriendRequestSent }: ContactsListProps = {}) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasFetchedRef = useRef(false)

  const fetchContacts = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    // Prevent refetching if already fetched
    if (hasFetchedRef.current && contacts.length > 0) {
      return
    }

    setLoading(true)
    setError('')

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading(false)
      setError('Request timed out. Please check your connection.')
    }, 10000) // 10 second timeout

    try {
      // Fetch all profiles (excluding current user)
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture')
        .neq('id', user.id)
        .order('full_name', { ascending: true, nullsFirst: false })
        .limit(50)

      clearTimeout(timeoutId)

      if (fetchError) {
        console.error('Error fetching contacts:', fetchError)
        throw fetchError
      }

      setContacts(data || [])
      hasFetchedRef.current = true
    } catch (err: any) {
      clearTimeout(timeoutId)
      console.error('Contacts fetch error:', err)
      setError(err.message || 'Failed to load contacts')
      setContacts([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const getInitials = (contact: Contact) => {
    if (contact.full_name) {
      const names = contact.full_name.split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase()
      }
      return names[0][0].toUpperCase()
    }
    if (contact.email) {
      return contact.email[0].toUpperCase()
    }
    return 'U'
  }

  const getDisplayName = (contact: Contact) => {
    return contact.full_name || contact.email || 'Unknown User'
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        Loading contacts...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <p>No contacts found</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group"
        >
          {contact.profile_picture ? (
            <img
              src={contact.profile_picture}
              alt={getDisplayName(contact)}
              className="w-10 h-10 rounded-full object-cover border border-gray-600 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-medium text-sm">
                {getInitials(contact)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Link
              to={`/conversations?with=${contact.id}`}
              className="text-white font-medium text-sm truncate block hover:text-blue-400 transition-colors"
            >
              {getDisplayName(contact)}
            </Link>
            {contact.full_name && contact.email && (
              <p className="text-gray-400 text-xs truncate">
                {contact.email}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <FriendRequestButton userId={contact.id} onStatusChange={onFriendRequestSent} />
          </div>
        </div>
      ))}
    </div>
  )
}
