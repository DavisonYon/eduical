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
    if (user) {
      supabase
        .from('profiles')
        .select('profile_picture')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.profile_picture) {
            setProfilePicture(data.profile_picture)
          }
        })
        .catch(console.error)
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
        className="flex items-center space-x-2 text-sm font-medium bg-gray-800 border border-gray-700 text-white hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors focus:outline-none"
      >
        {profilePicture ? (
          <img
            src={profilePicture}
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover border border-gray-600"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-white font-medium text-xs">{getUserInitials()}</span>
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
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <a
              href="#"
              className="block px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
              onClick={(e) => {
                e.preventDefault()
                setDropdownOpen(false)
                navigate('/profile')
              }}
            >
              Your Profile
            </a>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
              onClick={(e) => {
                e.preventDefault()
                setDropdownOpen(false)
                navigate('/profile')
              }}
            >
              Settings
            </a>
            <button
              onClick={handleSignOut}
              className="w-full text-left block px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
