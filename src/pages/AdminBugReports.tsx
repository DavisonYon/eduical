import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type BugReport = {
  id: string
  reporter_id: string
  title: string
  description: string
  page_url: string | null
  status: 'open' | 'triaged' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  screenshot_paths: string[]
  admin_notes: string | null
  created_at: string
  updated_at: string
  reporter_profile: { full_name: string | null; email: string | null } | null
}

const statusOptions: BugReport['status'][] = ['open', 'triaged', 'in_progress', 'resolved', 'closed']
const priorityOptions: BugReport['priority'][] = ['low', 'medium', 'high', 'critical']

export default function AdminBugReports() {
  const [items, setItems] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | BugReport['status']>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('bug_reports')
        .select('id, reporter_id, title, description, page_url, status, priority, screenshot_paths, admin_notes, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      const rawItems = (data || []) as Omit<BugReport, 'reporter_profile'>[]
      const reporterIds = [...new Set(rawItems.map((r) => r.reporter_id))]
      let profileMap = new Map<string, { full_name: string | null; email: string | null }>()

      if (reporterIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', reporterIds)
        if (profilesError) throw profilesError
        profileMap = new Map(
          (profilesData || []).map((p: { id: string; full_name: string | null; email: string | null }) => [
            p.id,
            { full_name: p.full_name, email: p.email },
          ])
        )
      }

      setItems(
        rawItems.map((r) => ({
          ...r,
          reporter_profile: profileMap.get(r.reporter_id) || null,
        }))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load reports')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const openScreenshot = async (path: string) => {
    const { data, error: signedUrlError } = await supabase.storage
      .from('bug-reports')
      .createSignedUrl(path, 60)
    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || 'Could not open screenshot')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const updateReport = async (report: BugReport, patch: Partial<Pick<BugReport, 'status' | 'priority' | 'admin_notes'>>) => {
    setSavingId(report.id)
    setError('')
    try {
      const nextStatus = patch.status ?? report.status
      const nextPriority = patch.priority ?? report.priority
      const nextNotes = patch.admin_notes ?? report.admin_notes

      const { error: updateError } = await supabase
        .from('bug_reports')
        .update({
          status: nextStatus,
          priority: nextPriority,
          admin_notes: nextNotes,
        })
        .eq('id', report.id)
      if (updateError) throw updateError

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('You must be signed in to update reports')

      if (patch.status && patch.status !== report.status) {
        await supabase.from('bug_report_updates').insert({
          report_id: report.id,
          actor_id: user.id,
          update_type: 'status_changed',
          body: `Status changed from ${report.status} to ${patch.status}`,
        })
      }

      if (patch.admin_notes !== undefined && patch.admin_notes !== report.admin_notes) {
        await supabase.from('bug_report_updates').insert({
          report_id: report.id,
          actor_id: user.id,
          update_type: 'note',
          body: 'Admin notes updated',
        })
      }

      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update report')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bug Reports</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Admin queue for triaging and managing submitted issues.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | BugReport['status'])}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading reports...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No bug reports found.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((report) => (
            <li key={report.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{report.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {report.reporter_profile?.full_name || report.reporter_profile?.email || report.reporter_id} •{' '}
                    {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="font-mono text-xs text-gray-500">{report.id}</p>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{report.description}</p>

              {report.page_url && (
                <a
                  href={report.page_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Reported URL
                </a>
              )}

              {report.screenshot_paths.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.screenshot_paths.map((path) => (
                    <button
                      type="button"
                      key={path}
                      onClick={() => openScreenshot(path)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Screenshot
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">
                  Status
                  <select
                    value={report.status}
                    disabled={savingId === report.id}
                    onChange={(e) => updateReport(report, { status: e.target.value as BugReport['status'] })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-gray-600 dark:text-gray-400">
                  Priority
                  <select
                    value={report.priority}
                    disabled={savingId === report.id}
                    onChange={(e) => updateReport(report, { priority: e.target.value as BugReport['priority'] })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3">
                <label className="text-xs text-gray-600 dark:text-gray-400">Admin notes</label>
                <textarea
                  defaultValue={report.admin_notes || ''}
                  rows={3}
                  placeholder="Internal notes for triage and resolution"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    updateReport(report, { admin_notes: value || null })
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
