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
      const [
        { data: profileData },
        { data: superPermission },
        { data: usersManagePermission },
        { data: rolesManagePermission },
        { data: verifyAccountsPermission },
        { data: bugReportsPermission },
      ] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.rpc('user_has_permission', {
          permission_key: 'system.super_admin',
          target_scope_type: 'global',
          target_scope_id: null,
        }),
        supabase.rpc('user_has_permission', {
          permission_key: 'users.manage',
          target_scope_type: 'global',
          target_scope_id: null,
        }),
        supabase.rpc('user_has_permission', {
          permission_key: 'roles.manage',
          target_scope_type: 'global',
          target_scope_id: null,
        }),
        supabase.rpc('user_has_permission', {
          permission_key: 'accounts.verify',
          target_scope_type: 'global',
          target_scope_id: null,
        }),
        supabase.rpc('user_has_permission', {
          permission_key: 'bug_reports.manage',
          target_scope_type: 'global',
          target_scope_id: null,
        }),
      ])
      if (!cancelled) {
        const hasPermission =
          Boolean(usersManagePermission) ||
          Boolean(rolesManagePermission) ||
          Boolean(verifyAccountsPermission) ||
          Boolean(bugReportsPermission)
        setIsAdmin(profileData?.role === 'super_admin' || Boolean(superPermission) || hasPermission)
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
