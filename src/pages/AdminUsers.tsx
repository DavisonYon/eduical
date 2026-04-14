import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  student_id: string | null
}

type RoleRow = {
  id: string
  key: string
  label: string
}

type AssignmentRow = {
  id: string
  user_id: string
  role_id: string
  scope_type: 'global' | 'course' | 'chat'
  scope_id: string | null
}

type CourseRow = { id: string; name: string }
type ConversationRow = { id: string; user1_id: string; user2_id: string }

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [chats, setChats] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [draftRoleId, setDraftRoleId] = useState('')
  const [draftScopeType, setDraftScopeType] = useState<'global' | 'course' | 'chat'>('global')
  const [draftScopeId, setDraftScopeId] = useState('')
  const [savingForUserId, setSavingForUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [{ data: pData, error: pErr }, { data: rData, error: rErr }, { data: aData, error: aErr }, { data: cData }, { data: chatData }] =
        await Promise.all([
          supabase.from('profiles').select('id, full_name, email, role, student_id').order('created_at', { ascending: false }).limit(300),
          supabase.from('roles').select('id, key, label').order('label', { ascending: true }),
          supabase.from('user_role_assignments').select('id, user_id, role_id, scope_type, scope_id'),
          supabase.from('courses').select('id, name').order('name', { ascending: true }),
          supabase.from('conversations').select('id, user1_id, user2_id').order('updated_at', { ascending: false }).limit(100),
        ])
      if (pErr) throw pErr
      if (rErr) throw rErr
      if (aErr) throw aErr
      setProfiles((pData || []) as ProfileRow[])
      setRoles((rData || []) as RoleRow[])
      setAssignments((aData || []) as AssignmentRow[])
      setCourses((cData || []) as CourseRow[])
      setChats((chatData || []) as ConversationRow[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!draftRoleId && roles.length > 0) {
      setDraftRoleId(roles[0].id)
    }
  }, [roles, draftRoleId])

  const roleById = useMemo(() => {
    const map = new Map<string, RoleRow>()
    for (const r of roles) map.set(r.id, r)
    return map
  }, [roles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => [p.full_name, p.email, p.student_id, p.id].some((v) => (v || '').toLowerCase().includes(q)))
  }, [profiles, query])

  const addAssignment = async (userId: string) => {
    if (!draftRoleId) return
    if (draftScopeType !== 'global' && !draftScopeId) return
    setSavingForUserId(userId)
    setError('')
    try {
      const { error: insertError } = await supabase.from('user_role_assignments').insert({
        user_id: userId,
        role_id: draftRoleId,
        scope_type: draftScopeType,
        scope_id: draftScopeType === 'global' ? null : draftScopeId,
      })
      if (insertError && !insertError.message.includes('duplicate')) throw insertError
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not assign role')
    } finally {
      setSavingForUserId(null)
    }
  }

  const removeAssignment = async (assignmentId: string, userId: string) => {
    setSavingForUserId(userId)
    setError('')
    try {
      const { error: deleteError } = await supabase.from('user_role_assignments').delete().eq('id', assignmentId)
      if (deleteError) throw deleteError
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove assignment')
    } finally {
      setSavingForUserId(null)
    }
  }

  const scopeOptions = draftScopeType === 'course' ? courses : chats.map((c) => ({ id: c.id, name: `Chat ${c.id.slice(0, 8)}` }))

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Search users, inspect role assignments, and assign scoped access (global, course, chat).
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="mb-4 grid gap-2 rounded-xl border border-gray-200 bg-white p-3 md:grid-cols-4 dark:border-gray-700 dark:bg-gray-800/40">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user name/email/student id" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white md:col-span-2" />
        <select value={draftRoleId} onChange={(e) => setDraftRoleId(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select value={draftScopeType} onChange={(e) => setDraftScopeType(e.target.value as 'global' | 'course' | 'chat')} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
          <option value="global">Global</option>
          <option value="course">Course</option>
          <option value="chat">Chat</option>
        </select>
        {draftScopeType !== 'global' && (
          <select value={draftScopeId} onChange={(e) => setDraftScopeId(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white md:col-span-2">
            <option value="">Select scope</option>
            {scopeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading users...</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((user) => {
            const userAssignments = assignments.filter((a) => a.user_id === user.id)
            return (
              <li key={user.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{user.full_name || 'No name'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{user.email || user.id}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Legacy role: {user.role} • Student ID: {user.student_id || 'N/A'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={savingForUserId === user.id}
                    onClick={() => addAssignment(user.id)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Assign selected role
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {userAssignments.length === 0 && (
                    <span className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">No RBAC assignments</span>
                  )}
                  {userAssignments.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100">
                      {roleById.get(a.role_id)?.label || a.role_id} ({a.scope_type}
                      {a.scope_id ? `:${a.scope_id.slice(0, 8)}` : ''})
                      <button type="button" onClick={() => removeAssignment(a.id, user.id)} disabled={savingForUserId === user.id}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
