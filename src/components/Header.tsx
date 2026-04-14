import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Search from './header/Search'
import Notifications from './header/Notifications'
import MessagesIcon from './header/MessagesIcon'
import UserDropdown from './header/UserDropdown'
import ThemeToggle from './header/ThemeToggle'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth()

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* minmax(0,1fr) so side columns stay equal width; plain 1fr uses min-content and skews center when right is wider */}
      <div className="grid h-16 grid-cols-2 items-center gap-x-2 px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-6">
        <div className="flex min-w-0 items-center justify-self-start">
          <button
            onClick={onMenuClick}
            className="text-gray-600 hover:text-gray-900 focus:text-gray-900 focus:outline-none lg:hidden dark:text-gray-400 dark:hover:text-white dark:focus:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="hidden min-w-0 justify-self-center md:col-start-2 md:row-start-1 md:block md:w-full md:max-w-2xl lg:max-w-3xl">
          <Search />
        </div>

        <div className="flex min-w-0 items-center justify-end justify-self-end space-x-2 md:col-start-3 md:row-start-1">
          <ThemeToggle />
          {user ? (
            <>
              <MessagesIcon />
              <Notifications />
              <UserDropdown />
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
