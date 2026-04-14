import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

/** Layout route: wrap nested routes; renders `<Outlet />` when authenticated. */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const [checkingRole, setCheckingRole] = useState(true)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user) {
        if (!cancelled) {
          setRole(null)
          setCheckingRole(false)
        }
        return
      }
      setCheckingRole(true)
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!cancelled) {
        setRole(data?.role ?? null)
        setCheckingRole(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || checkingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role === 'unverified' || role === 'banned') {
    return <Navigate to="/verification" replace />
  }

  return <Outlet />
}
