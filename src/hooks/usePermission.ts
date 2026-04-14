import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function usePermission(permissionKey: string, scopeType: 'global' | 'course' | 'chat' = 'global', scopeId: string | null = null) {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('user_has_permission', {
      permission_key: permissionKey,
      target_scope_type: scopeType,
      target_scope_id: scopeType === 'global' ? null : scopeId,
    })
    if (!error) {
      setAllowed(Boolean(data))
    } else {
      setAllowed(false)
    }
    setLoading(false)
  }, [user, permissionKey, scopeType, scopeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { allowed, loading, refresh }
}
