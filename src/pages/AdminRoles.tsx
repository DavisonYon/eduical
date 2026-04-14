import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type RoleRow = {
  id: string
  key: string
  label: string
  description: string | null
  is_system: boolean
}

type PermissionRow = {
  id: string
  key: string
  description: string | null
}

export default function AdminRoles() {
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [permissions, setPermissions] = useState<PermissionRow[]>([])
  const [mapping, setMapping] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newRoleKey, setNewRoleKey] = useState('')
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [customPermissionDrafts, setCustomPermissionDrafts] = useState<Record<string, string>>({})
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [{ data: rolesData, error: rolesError }, { data: permsData, error: permsError }, { data: rpData, error: rpError }] =
        await Promise.all([
          supabase.from('roles').select('id, key, label, description, is_system').order('label', { ascending: true }),
          supabase.from('permissions').select('id, key, description').order('key', { ascending: true }),
          supabase.from('role_permissions').select('role_id, permission_id'),
        ])

      if (rolesError) throw rolesError
      if (permsError) throw permsError
      if (rpError) throw rpError

      const nextMap: Record<string, Set<string>> = {}
      for (const row of rpData || []) {
        if (!nextMap[row.role_id]) nextMap[row.role_id] = new Set<string>()
        nextMap[row.role_id].add(row.permission_id)
      }

      setRoles((rolesData || []) as RoleRow[])
      setPermissions((permsData || []) as PermissionRow[])
      setMapping(nextMap)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id)
    }
  }, [roles, selectedRoleId])

  const permissionById = useMemo(() => {
    const m = new Map<string, PermissionRow>()
    for (const p of permissions) m.set(p.id, p)
    return m
  }, [permissions])

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionRow[]> = {}
    for (const permission of permissions) {
      const group = permission.key.includes('.') ? permission.key.split('.')[0] : 'misc'
      if (!groups[group]) groups[group] = []
      groups[group].push(permission)
    }
    for (const group of Object.keys(groups)) {
      groups[group].sort((a, b) => a.key.localeCompare(b.key))
    }
    return groups
  }, [permissions])

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  )

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault()
    const key = newRoleKey.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_')
    if (!key || !newRoleLabel.trim()) return
    setError('')
    const { error: insertError } = await supabase.from('roles').insert({
      key,
      label: newRoleLabel.trim(),
      description: newRoleDescription.trim() || null,
      is_system: false,
    })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewRoleKey('')
    setNewRoleLabel('')
    setNewRoleDescription('')
    await load()
  }

  const ensurePermission = async (keyRaw: string): Promise<string | null> => {
    const key = keyRaw.trim().toLowerCase()
    if (!key) return null
    const existing = permissions.find((p) => p.key === key)
    if (existing) return existing.id
    const { data, error: insertError } = await supabase
      .from('permissions')
      .insert({ key, description: null })
      .select('id')
      .single()
    if (insertError) {
      setError(insertError.message)
      return null
    }
    await load()
    return data?.id || null
  }

  const addPermissionToRole = async (roleId: string, permissionKey: string) => {
    setSavingRoleId(roleId)
    setError('')
    try {
      const permissionId = await ensurePermission(permissionKey)
      if (!permissionId) return
      const { error: linkError } = await supabase.from('role_permissions').insert({
        role_id: roleId,
        permission_id: permissionId,
      })
      if (linkError && !linkError.message.includes('duplicate')) {
        throw linkError
      }
      setCustomPermissionDrafts((prev) => ({ ...prev, [roleId]: '' }))
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add permission')
    } finally {
      setSavingRoleId(null)
    }
  }

  const removePermissionFromRole = async (roleId: string, permissionId: string) => {
    setSavingRoleId(roleId)
    setError('')
    try {
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_id', permissionId)
      if (deleteError) throw deleteError
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove permission')
    } finally {
      setSavingRoleId(null)
    }
  }

  const togglePermission = async (roleId: string, permissionId: string) => {
    const assigned = mapping[roleId]?.has(permissionId)
    if (assigned) {
      await removePermissionFromRole(roleId, permissionId)
      return
    }
    const permissionKey = permissionById.get(permissionId)?.key
    if (!permissionKey) return
    await addPermissionToRole(roleId, permissionKey)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Role Management</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Create custom roles and attach permission strings, including scoped permissions.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={createRole} className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4 dark:border-gray-700 dark:bg-gray-800/40">
        <input value={newRoleKey} onChange={(e) => setNewRoleKey(e.target.value)} placeholder="role key (ta_support)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
        <input value={newRoleLabel} onChange={(e) => setNewRoleLabel(e.target.value)} placeholder="Role label" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
        <input value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} placeholder="Description (optional)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Create role
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading roles...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Roles</p>
            <ul className="space-y-1">
              {roles.map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedRoleId === role.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{role.label}</span>
                      {role.is_system && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          SYS
                        </span>
                      )}
                    </div>
                    <span className={`mt-0.5 block font-mono text-xs ${selectedRoleId === role.id ? 'text-blue-100' : 'text-gray-500'}`}>
                      {role.key}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
            {!selectedRole ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Select a role to manage permissions.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedRole.label}</p>
                    <p className="font-mono text-xs text-gray-500">{selectedRole.key}</p>
                    {selectedRole.description && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{selectedRole.description}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[...(mapping[selectedRole.id] || new Set<string>())].map((permissionId) => (
                    <span key={permissionId} className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900 dark:bg-blue-900/40 dark:text-blue-100">
                      {permissionById.get(permissionId)?.key || permissionId}
                      <button
                        type="button"
                        onClick={() => removePermissionFromRole(selectedRole.id, permissionId)}
                        className="font-bold"
                        disabled={savingRoleId === selectedRole.id}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {Object.entries(groupedPermissions).map(([groupName, groupItems]) => (
                    <div key={groupName}>
                      <p className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{groupName}</p>
                      <div className="flex flex-wrap gap-2">
                        {groupItems.map((permission) => {
                          const selected = mapping[selectedRole.id]?.has(permission.id) ?? false
                          return (
                            <button
                              key={permission.id}
                              type="button"
                              disabled={savingRoleId === selectedRole.id}
                              onClick={() => togglePermission(selectedRole.id, permission.id)}
                              className={`rounded-full border px-2 py-1 text-xs ${
                                selected
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300'
                              }`}
                              title={permission.description || permission.key}
                            >
                              {permission.key}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={customPermissionDrafts[selectedRole.id] || ''}
                    onChange={(e) =>
                      setCustomPermissionDrafts((prev) => ({ ...prev, [selectedRole.id]: e.target.value }))
                    }
                    placeholder="permission key (custom allowed)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={savingRoleId === selectedRole.id}
                    onClick={() => addPermissionToRole(selectedRole.id, customPermissionDrafts[selectedRole.id] || '')}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
                  >
                    Add permission
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
