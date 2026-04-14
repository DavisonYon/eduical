import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePermission } from '../hooks/usePermission'

interface PermissionRouteProps {
  permissionKey: string
}

export default function PermissionRoute({ permissionKey }: PermissionRouteProps) {
  const { user, loading } = useAuth()
  const { allowed, loading: permissionLoading } = usePermission(permissionKey, 'global', null)

  if (loading || permissionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!allowed) return <Navigate to="/" replace />

  return <Outlet />
}
