import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export type ToastType = 'message' | 'info' | 'success' | 'warning' | 'error'

export interface ToastNotification {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
  createdAt: number
}

interface NotificationContextType {
  addNotification: (notification: Omit<ToastNotification, 'id' | 'createdAt'>) => void
  desktopToastsEnabled: boolean
  refreshToastPreference: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const DEFAULT_DURATION = 3000

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [queue, setQueue] = useState<ToastNotification[]>([])
  const [visible, setVisible] = useState<ToastNotification | null>(null)
  const [desktopToastsEnabled, setDesktopToastsEnabled] = useState(true)
  const [isDesktop, setIsDesktop] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const refreshToastPreference = useCallback(async () => {
    if (!user) {
      setDesktopToastsEnabled(true)
      return
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('desktop_toasts_enabled')
        .eq('id', user.id)
        .single()
      setDesktopToastsEnabled(data?.desktop_toasts_enabled ?? true)
    } catch {
      setDesktopToastsEnabled(true)
    }
  }, [user])

  useEffect(() => {
    if (user) refreshToastPreference()
  }, [user, refreshToastPreference])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const processNext = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        setVisible(null)
        return []
      }
      const [next, ...rest] = prev
      setVisible(next)
      const duration = next.duration ?? DEFAULT_DURATION
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        processNext()
      }, duration)
      return rest
    })
  }, [])

  useEffect(() => {
    if (queue.length > 0 && !visible && desktopToastsEnabled && isDesktop) {
      processNext()
    }
  }, [queue, visible, desktopToastsEnabled, isDesktop, processNext])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const addNotification = useCallback(
    (notification: Omit<ToastNotification, 'id' | 'createdAt'>) => {
      const toast: ToastNotification = {
        ...notification,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      setQueue((prev) => [...prev, toast])
    },
    []
  )

  const value = {
    addNotification,
    desktopToastsEnabled,
    refreshToastPreference,
  }

  const showToast = visible && desktopToastsEnabled && isDesktop

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-[9999] hidden md:block pointer-events-none">
          <div className="min-w-[280px] max-w-[360px] transform rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-xl transition-all duration-200 ease-out dark:border-gray-600 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {visible!.type === 'message' && (
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                )}
                {visible!.type === 'info' && (
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {visible!.type === 'success' && (
                  <svg
                    className="w-5 h-5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {(visible!.type === 'warning' || visible!.type === 'error') && (
                  <svg
                    className={`w-5 h-5 ${visible!.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {visible!.title && (
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{visible!.title}</p>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300">{visible!.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
