import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import RightSidebar from './RightSidebar'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-gray-900 p-4 lg:p-6">
            {children}
          </main>
          
          <RightSidebar />
        </div>
      </div>
    </div>
  )
}
