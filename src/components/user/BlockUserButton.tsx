import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface BlockUserButtonProps {
  targetUserId: string
  onChange?: () => void
}

export default function BlockUserButton({ targetUserId, onChange }: BlockUserButtonProps) {
  const { user } = useAuth()
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!user || user.id === targetUserId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocker_id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      setBlocked(!!data)
    } catch (e) {
      console.error(e)
      setBlocked(false)
    } finally {
      setLoading(false)
    }
  }, [user, targetUserId])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!user || user.id === targetUserId) return null

  const toggle = async () => {
    setBusy(true)
    try {
      if (blocked) {
        const { error } = await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', targetUserId)
        if (error) throw error
        setBlocked(false)
      } else {
        if (!confirm('Block this user? They will not be notified. You can unblock them later.')) {
          setBusy(false)
          return
        }
        const { error } = await supabase.from('user_blocks').insert({
          blocker_id: user.id,
          blocked_id: targetUserId,
        })
        if (error) throw error
        setBlocked(true)
      }
      onChange?.()
    } catch (e) {
      console.error(e)
      alert(blocked ? 'Could not unblock' : 'Could not block user')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" aria-hidden />
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        blocked
          ? 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
          : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60'
      }`}
    >
      {busy ? '…' : blocked ? 'Unblock' : 'Block'}
    </button>
  )
}
