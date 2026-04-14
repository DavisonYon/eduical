import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function AdminRoute() {
  const { user, loading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false)
          setChecking(false)
        }
        return
      }
      setChecking(true)
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!cancelled) {
        setIsAdmin(data?.role === 'super_admin')
        setChecking(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
