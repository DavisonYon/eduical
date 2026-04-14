import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function UserDropdown() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  // Fetch profile picture
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.from('profiles').select('profile_picture').eq('id', user.id).single()
        if (!cancelled && data?.profile_picture) setProfilePicture(data.profile_picture)
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  // Get user initials from user metadata or email
  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase()
      }
      return names[0][0].toUpperCase()
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  const handleSignOut = async () => {
    await signOut()
    setDropdownOpen(false)
    navigate('/login')
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
      >
        {profilePicture ? (
          <img
            src={profilePicture}
            alt="Profile"
            className="h-8 w-8 rounded-full border border-gray-300 object-cover dark:border-gray-600"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
            <span className="text-xs font-medium text-gray-700 dark:text-white">{getUserInitials()}</span>
          </div>
        )}
        <svg 
          className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="py-1">
            <a
              href="#"
              className="block px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
              onClick={(e) => {
                e.preventDefault()
                setDropdownOpen(false)
                if (user?.id) navigate(`/user/${user.id}`)
              }}
            >
              View profile
            </a>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
              onClick={(e) => {
                e.preventDefault()
                setDropdownOpen(false)
                navigate('/settings')
              }}
            >
              Settings
            </a>
            <button
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left text-sm text-gray-900 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
