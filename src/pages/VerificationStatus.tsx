import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type ProfileRole = 'super_admin' | 'admin' | 'member' | 'unverified' | 'banned' | null

export default function VerificationStatus() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<ProfileRole>(null)
  const [studentId, setStudentId] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('profiles').select('role, student_id').eq('id', user.id).single()
    setRole((data?.role as ProfileRole) ?? null)
    setStudentId(data?.student_id ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return
    loadStatus()
    const t = window.setInterval(loadStatus, 15000)
    return () => window.clearInterval(t)
  }, [user, loadStatus])

  if (!user) return <Navigate to="/login" replace />
  if (!loading && role && role !== 'unverified' && role !== 'banned') return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Account Verification</h1>
      {loading ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Checking your verification status...</p>
      ) : role === 'banned' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Your account is currently restricted. Please contact support for help.
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Your account is pending super admin verification.</p>
          <p className="mt-2">
            You can sign in and track progress here, but full app access is blocked until you are approved.
          </p>
          <p className="mt-2 text-xs opacity-90">
            Verification checks run automatically every 15 seconds.
            {studentId ? ` Student ID on file: ${studentId}.` : ' No student ID on file.'}
          </p>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
