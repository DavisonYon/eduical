import Search from './header/Search'
import Notifications from './header/Notifications'
import MessagesIcon from './header/MessagesIcon'
import UserDropdown from './header/UserDropdown'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="bg-gray-900 shadow-sm border-b border-gray-800">
      <div className="relative flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left side - Mobile menu button */}
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-gray-400 hover:text-white focus:outline-none focus:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Center - Search bar */}
        <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block w-full max-w-lg px-4">
          <Search />
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2">
          <MessagesIcon />
          <Notifications />
          <UserDropdown />
        </div>
      </div>
    </header>
  )
}
