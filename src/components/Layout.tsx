import { useState, useCallback, useEffect, useRef } from 'react'
import { Outlet, matchPath, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import RightSidebar from './RightSidebar'
import CourseNotificationAlerts from './CourseNotificationAlerts'
import {
  getRightSidebarCollapsedFromCookie,
  setRightSidebarCollapsedCookie,
} from '../lib/rightSidebarCookie'

export default function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(() =>
    typeof document !== 'undefined' ? getRightSidebarCollapsedFromCookie() : false
  )
  const preCourseCollapsedRef = useRef<boolean | null>(null)
  const isCourseDetailView = matchPath('/classes/:courseId', location.pathname) !== null

  useEffect(() => {
    if (isCourseDetailView) {
      if (preCourseCollapsedRef.current === null) {
        preCourseCollapsedRef.current = rightSidebarCollapsed
      }
      if (!rightSidebarCollapsed) {
        setRightSidebarCollapsed(true)
      }
      return
    }

    if (preCourseCollapsedRef.current !== null) {
      const previousCollapsed = preCourseCollapsedRef.current
      preCourseCollapsedRef.current = null
      if (previousCollapsed !== rightSidebarCollapsed) {
        setRightSidebarCollapsed(previousCollapsed)
      }
    }
  }, [isCourseDetailView, rightSidebarCollapsed])

  const toggleRightSidebarCollapsed = useCallback(() => {
    if (isCourseDetailView) return
    setRightSidebarCollapsed((prev) => {
      const next = !prev
      setRightSidebarCollapsedCookie(next)
      return next
    })
  }, [isCourseDetailView])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <CourseNotificationAlerts />

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6 dark:bg-gray-900">
            <Outlet />
          </main>

          <RightSidebar
            collapsed={rightSidebarCollapsed}
            onToggleCollapsed={toggleRightSidebarCollapsed}
          />
        </div>
      </div>
    </div>
  )
}
