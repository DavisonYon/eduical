import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Organization {
  id: string
  name: string
  description: string | null
  image_url: string | null
  is_private: boolean
  created_at: string
  slug: string
}

type MembershipStatus = 'none' | 'pending' | 'approved' | 'banned'

interface Membership {
  organization_id: string
  status: MembershipStatus
  role: 'owner' | 'manager' | 'member'
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)

export default function Organizations() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [memberships, setMemberships] = useState<Record<string, Membership>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDescription, setNewOrgDescription] = useState('')
  const [newOrgPrivate, setNewOrgPrivate] = useState(true)
  const [profileRole, setProfileRole] = useState<string | null>(null)

  // Member management modal state
  const [manageOrgId, setManageOrgId] = useState<string | null>(null)
  const [manageMembers, setManageMembers] = useState<
    { id: string; user_id: string; role: string; status: MembershipStatus; full_name: string | null; email: string | null }[]
  >([])
  const [manageLoading, setManageLoading] = useState(false)
  const [manageError, setManageError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        // Load current user's profile role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setProfileRole(profile?.role ?? null)

        // Load organizations
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name, description, image_url, is_private, created_at, slug')
          .order('created_at', { ascending: false })

        if (orgsError) throw orgsError

        setOrganizations(orgs || [])

        // Load current user's memberships
        const { data: membershipRows, error: membershipsError } = await supabase
          .from('organization_memberships')
          .select('organization_id, role, status')
          .eq('user_id', user.id)

        if (membershipsError) throw membershipsError

        const membershipMap: Record<string, Membership> = {}
        ;(membershipRows || []).forEach((m: any) => {
          membershipMap[m.organization_id] = {
            organization_id: m.organization_id,
            status: m.status as MembershipStatus,
            role: m.role,
          }
        })
        setMemberships(membershipMap)
      } catch (e: any) {
        setError(e?.message || 'Failed to load organizations')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  const handleRequestToJoin = async (org: Organization) => {
    if (!user) return

    // Optimistic pending state
    setMemberships((prev) => ({
      ...prev,
      [org.id]: {
        organization_id: org.id,
        status: 'pending',
        role: 'member',
      },
    }))

    const { error: upsertError } = await supabase.from('organization_memberships').upsert(
      {
        organization_id: org.id,
        user_id: user.id,
        status: 'pending',
        role: 'member',
      },
      { onConflict: 'organization_id,user_id' }
    )

    if (upsertError) {
      // Revert optimistic change
      setMemberships((prev) => {
        const copy = { ...prev }
        delete copy[org.id]
        return copy
      })
      // Optionally set a toast or error message; keep page error generic
      console.error('Error requesting to join organization', upsertError)
    }
  }

  const handleCreateOrganization = async () => {
    if (!user) return
    if (!newOrgName.trim()) return

    const baseSlug = slugify(newOrgName)
    if (!baseSlug) {
      setError('Organization name must contain at least one letter or number.')
      return
    }

    setCreating(true)
    setError('')

    try {
      const { data, error: insertError } = await supabase
        .from('organizations')
        .insert({
          name: newOrgName.trim(),
          description: newOrgDescription.trim() || null,
          is_private: newOrgPrivate,
          created_by: user.id,
          slug: baseSlug,
        })
        .select('id, name, description, image_url, is_private, created_at, slug')
        .single()

      if (insertError) throw insertError

      // Automatically make creator owner + approved
      if (data) {
        await supabase.from('organization_memberships').insert({
          organization_id: data.id,
          user_id: user.id,
          role: 'owner',
          status: 'approved',
        })

        setOrganizations((prev) => [data as Organization, ...prev])
        setMemberships((prev) => ({
          ...prev,
          [data.id]: {
            organization_id: data.id,
            role: 'owner',
            status: 'approved',
          },
        }))
      }

      setNewOrgName('')
      setNewOrgDescription('')
      setNewOrgPrivate(true)
    } catch (e: any) {
      setError(e?.message || 'Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

  const renderMembershipBadge = (orgId: string) => {
    const m = memberships[orgId]
    if (!m) return null

    if (m.status === 'pending') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/60 text-yellow-300">
          Request pending
        </span>
      )
    }

    if (m.status === 'banned') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-300">
          Banned
        </span>
      )
    }

    if (m.status === 'approved') {
      if (m.role === 'owner' || m.role === 'manager') {
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300">
            {m.role === 'owner' ? 'Owner' : 'Manager'}
          </span>
        )
      }

      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/60 text-green-300">
          Member
        </span>
      )
    }

    return null
  }

  const canManageOrg = (orgId: string) => {
    const m = memberships[orgId]
    if (profileRole === 'super_admin') return true
    if (!m) return false
    return m.status === 'approved' && (m.role === 'owner' || m.role === 'manager')
  }

  const handleOpenManageMembers = async (orgId: string) => {
    if (!user || !canManageOrg(orgId)) return

    setManageOrgId(orgId)
    setManageMembers([])
    setManageLoading(true)
    setManageError('')

    try {
      const { data: rows, error } = await supabase
        .from('organization_memberships')
        .select('id, user_id, role, status')
        .eq('organization_id', orgId)

      if (error) throw error

      const membersBase = rows || []
      if (membersBase.length === 0) {
        setManageMembers([])
        return
      }

      const userIds = [...new Set(membersBase.map((m: any) => m.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      const list =
        membersBase.map((m: any) => {
          const profile = profiles?.find((p: any) => p.id === m.user_id)
          return {
            id: m.id as string,
            user_id: m.user_id as string,
            role: m.role as string,
            status: m.status as MembershipStatus,
            full_name: profile?.full_name ?? null,
            email: profile?.email ?? null,
          }
        }) || []

      setManageMembers(list)
    } catch (e: any) {
      setManageError(e?.message || 'Failed to load members')
    } finally {
      setManageLoading(false)
    }
  }

  const handleCloseManageMembers = () => {
    setManageOrgId(null)
    setManageMembers([])
    setManageError('')
    setManageLoading(false)
  }

  const updateMemberStatusOptimistic = (membershipId: string, status: MembershipStatus, role?: string) => {
    setManageMembers((prev) =>
      prev.map((m) =>
        m.id === membershipId
          ? {
              ...m,
              status,
              role: role ?? m.role,
            }
          : m
      )
    )
  }

  const handleApproveMember = async (membershipId: string) => {
    if (!manageOrgId) return
    const member = manageMembers.find((m) => m.id === membershipId)
    if (!member) return

    const previous = { ...member }
    updateMemberStatusOptimistic(membershipId, 'approved')

    const { error } = await supabase
      .from('organization_memberships')
      .update({ status: 'approved' })
      .eq('id', membershipId)

    if (error) {
      // Revert
      setManageMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? previous : m))
      )
      console.error('Error approving member', error)
    }
  }

  const handleRejectMember = async (membershipId: string) => {
    if (!manageOrgId) return
    const member = manageMembers.find((m) => m.id === membershipId)
    if (!member) return

    const previous = { ...member }
    updateMemberStatusOptimistic(membershipId, 'rejected')

    const { error } = await supabase
      .from('organization_memberships')
      .update({ status: 'rejected' })
      .eq('id', membershipId)

    if (error) {
      setManageMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? previous : m))
      )
      console.error('Error rejecting member', error)
    }
  }

  const handleBanMember = async (membershipId: string) => {
    if (!manageOrgId) return
    const member = manageMembers.find((m) => m.id === membershipId)
    if (!member) return

    const previous = { ...member }
    updateMemberStatusOptimistic(membershipId, 'banned')

    const { error } = await supabase
      .from('organization_memberships')
      .update({ status: 'banned' })
      .eq('id', membershipId)

    if (error) {
      setManageMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? previous : m))
      )
      console.error('Error banning member', error)
    }
  }

  if (!user) {
    return null
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Organizations</h1>
            <p className="text-sm text-gray-400 mt-1">
              Discover and join student groups, clubs, and organizations.
            </p>
          </div>
          {profileRole === 'super_admin' && (
            <button
              type="button"
              onClick={handleCreateOrganization}
              disabled={creating || !newOrgName.trim()}
              className="hidden sm:inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium text-white rounded-lg shadow-sm"
            >
              {creating ? 'Creating...' : 'Create organization'}
            </button>
          )}
        </div>

        {profileRole === 'super_admin' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-white">Create a new organization</p>
            <div className="space-y-3">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={newOrgDescription}
                onChange={(e) => setNewOrgDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={newOrgPrivate}
                  onChange={(e) => setNewOrgPrivate(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
                />
                Private group (only members can see posts)
              </label>
              <div className="flex justify-end sm:hidden">
                <button
                  type="button"
                  onClick={handleCreateOrganization}
                  disabled={creating || !newOrgName.trim()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium text-white rounded-lg shadow-sm"
                >
                  {creating ? 'Creating...' : 'Create organization'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading organizations...</div>
        ) : error ? (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg p-4 text-sm">
            {error}
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No organizations yet.
            {profileRole === 'super_admin' && (
              <> Create the first one to get things started.</>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => {
              const membership = memberships[org.id]
              const isMember = membership?.status === 'approved'
              const isPending = membership?.status === 'pending'

              return (
                <div
                  key={org.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col"
                >
                  {org.image_url ? (
                    <img
                      src={org.image_url}
                      alt={org.name}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="h-24 w-full bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-slate-900/60 flex items-center justify-center text-3xl font-semibold text-blue-300">
                      {org.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 3)}
                    </div>
                  )}
                  <div className="flex-1 flex flex-col p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-white line-clamp-2">
                          {org.name}
                        </h2>
                        <p className="mt-1 text-xs text-gray-400 line-clamp-3">
                          {org.description || 'No description provided yet.'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full ${
                            org.is_private
                              ? 'bg-gray-900 text-gray-300 border border-gray-700'
                              : 'bg-blue-900/60 text-blue-200 border border-blue-800/60'
                          }`}
                        >
                          {org.is_private ? 'Private' : 'Public'}
                        </span>
                        {renderMembershipBadge(org.id)}
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-gray-700/60">
                      <span className="text-[11px] text-gray-500">
                        Created{' '}
                        {new Date(org.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/organizations/${org.slug}`)}
                          className="px-2.5 py-1 text-[11px] rounded-full border border-gray-700 text-gray-200 hover:bg-gray-700/70"
                        >
                          View
                        </button>
                        {canManageOrg(org.id) && (
                          <button
                            type="button"
                            onClick={() => handleOpenManageMembers(org.id)}
                            className="px-2.5 py-1 text-[11px] rounded-full border border-blue-700 text-blue-200 hover:bg-blue-700/40"
                          >
                            Manage
                          </button>
                        )}
                        {!isMember && !isPending && (
                          <button
                            type="button"
                            onClick={() => handleRequestToJoin(org)}
                            className="px-2.5 py-1 text-[11px] rounded-full bg-blue-600 hover:bg-blue-500 text-white"
                          >
                            Request to join
                          </button>
                        )}
                        {isPending && (
                          <button
                            type="button"
                            disabled
                            className="px-2.5 py-1 text-[11px] rounded-full bg-gray-700 text-gray-300 cursor-default"
                          >
                            Pending
                          </button>
                        )}
                        {isMember && (
                          <button
                            type="button"
                            className="px-2.5 py-1 text-[11px] rounded-full bg-green-700/80 text-white cursor-default"
                          >
                            Joined
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Manage Members Modal */}
      {manageOrgId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseManageMembers()
          }}
        >
          <div className="w-full max-w-xl bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <p className="text-white font-semibold text-sm">Manage members</p>
                <p className="text-xs text-gray-400">
                  Approve or remove members for this organization.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseManageMembers}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4 text-sm">
              {manageLoading ? (
                <p className="text-gray-400">Loading members...</p>
              ) : manageError ? (
                <p className="text-red-300">{manageError}</p>
              ) : manageMembers.length === 0 ? (
                <p className="text-gray-400 text-sm">No members yet.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Pending requests
                    </p>
                    {manageMembers.filter((m) => m.status === 'pending').length === 0 ? (
                      <p className="text-xs text-gray-500">No pending requests.</p>
                    ) : (
                      manageMembers
                        .filter((m) => m.status === 'pending')
                        .map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 border border-gray-800 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs text-white font-medium truncate">
                                {m.full_name || m.email || 'User'}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {m.email || 'Pending member'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRejectMember(m.id)}
                                className="px-2 py-1 text-[11px] rounded-full border border-gray-700 text-gray-300 hover:bg-gray-800"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproveMember(m.id)}
                                className="px-2 py-1 text-[11px] rounded-full bg-green-600 hover:bg-green-500 text-white"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Members
                    </p>
                    {manageMembers.filter((m) => m.status === 'approved').length === 0 ? (
                      <p className="text-xs text-gray-500">No approved members yet.</p>
                    ) : (
                      manageMembers
                        .filter((m) => m.status === 'approved')
                        .map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 border border-gray-800 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs text-white font-medium truncate">
                                {m.full_name || m.email || 'User'}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {m.email || 'Member'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                                {m.role === 'owner'
                                  ? 'Owner'
                                  : m.role === 'manager'
                                  ? 'Manager'
                                  : 'Member'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleBanMember(m.id)}
                                className="px-2 py-1 text-[11px] rounded-full border border-red-700 text-red-300 hover:bg-red-900/40"
                              >
                                Ban
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

