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
      <div className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
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
      <div className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>No contacts found</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Link to={`/user/${contact.id}`} className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {contact.profile_picture ? (
              <img
                src={contact.profile_picture}
                alt={getDisplayName(contact)}
                className="h-10 w-10 rounded-full border border-gray-300 object-cover dark:border-gray-600"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                <span className="text-sm font-medium text-gray-800 dark:text-white">
                  {getInitials(contact)}
                </span>
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              to={`/user/${contact.id}`}
              className="block truncate text-sm font-medium text-gray-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
            >
              {getDisplayName(contact)}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Link
                to={`/conversations?with=${contact.id}`}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Message
              </Link>
              {contact.full_name && contact.email && (
                <span className="truncate text-xs text-gray-600 dark:text-gray-400">{contact.email}</span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <FriendRequestButton userId={contact.id} onStatusChange={onFriendRequestSent} />
          </div>
        </div>
      ))}
    </div>
  )
}
