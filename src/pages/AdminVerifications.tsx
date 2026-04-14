import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PendingProfile = {
  id: string
  full_name: string | null
  email: string | null
  student_id: string | null
  created_at: string
}

export default function AdminVerifications() {
  const [pending, setPending] = useState<PendingProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, email, student_id, created_at')
        .eq('role', 'unverified')
        .order('created_at', { ascending: true })
      if (fetchError) throw fetchError
      setPending((data || []) as PendingProfile[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load pending accounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setRole = async (profileId: string, role: 'member' | 'banned') => {
    setSavingId(profileId)
    setError('')
    try {
      const { error: updateError } = await supabase.from('profiles').update({ role }).eq('id', profileId)
      if (updateError) throw updateError
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update account')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Account Verification Queue</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Approve users to grant app access, or reject to block the account.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading pending accounts...</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No pending accounts.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="font-semibold text-gray-900 dark:text-white">{p.full_name || 'No name provided'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{p.email || p.id}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                Student ID: {p.student_id || 'Not provided'} • Requested {new Date(p.created_at).toLocaleString()}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingId === p.id}
                  onClick={() => setRole(p.id, 'member')}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  type="button"
                  disabled={savingId === p.id}
                  onClick={() => setRole(p.id, 'banned')}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
