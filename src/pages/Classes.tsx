import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type CourseRow = {
  id: string
  name: string
  semester: string | null
  term: string | null
  start_date: string
  end_date: string
}

export default function Classes() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formName, setFormName] = useState('')
  const [formSemester, setFormSemester] = useState('')
  const [formTerm, setFormTerm] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formEmails, setFormEmails] = useState('')

  const isSuperAdmin = profileRole === 'super_admin'

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setProfileRole(profile?.role ?? null)

        if (profile?.role === 'super_admin') {
          const { data, error: qErr } = await supabase
            .from('courses')
            .select('id, name, semester, term, start_date, end_date')
            .order('start_date', { ascending: false })
          if (qErr) throw qErr
          setCourses((data || []) as CourseRow[])
        } else {
          const { data: en, error: eErr } = await supabase
            .from('course_enrollments')
            .select('course_id')
            .eq('user_id', user.id)
          if (eErr) throw eErr
          const ids = [...new Set((en || []).map((r: { course_id: string }) => r.course_id))]
          if (ids.length === 0) {
            setCourses([])
            return
          }
          const { data, error: qErr } = await supabase
            .from('courses')
            .select('id, name, semester, term, start_date, end_date')
            .in('id', ids)
            .order('start_date', { ascending: false })
          if (qErr) throw qErr
          setCourses((data || []) as CourseRow[])
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load classes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const parseEmails = (raw: string) =>
    [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))]

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !isSuperAdmin || !formName.trim() || !formStart || !formEnd) return
    setCreating(true)
    setError('')
    try {
      const { data: course, error: cErr } = await supabase
        .from('courses')
        .insert({
          name: formName.trim(),
          semester: formSemester.trim() || null,
          term: formTerm.trim() || null,
          start_date: formStart,
          end_date: formEnd,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (cErr) throw cErr
      const courseId = course?.id as string

      const emails = parseEmails(formEmails)
      if (emails.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, email')
          .in('email', emails)
        if (pErr) throw pErr

        const found = (profs || []) as { id: string; email: string | null }[]
        const rows = found.map((p) => ({ course_id: courseId, user_id: p.id }))
        if (rows.length > 0) {
          const { error: enErr } = await supabase.from('course_enrollments').insert(rows)
          if (enErr) throw enErr
        }
        const foundEmails = new Set(found.map((p) => (p.email || '').toLowerCase()))
        const missing = emails.filter((em) => !foundEmails.has(em))
        if (missing.length > 0) {
          setError(`Course created. Some emails were not found (not enrolled): ${missing.join(', ')}`)
        }
      }

      setShowCreate(false)
      setFormName('')
      setFormSemester('')
      setFormTerm('')
      setFormStart('')
      setFormEnd('')
      setFormEmails('')

      const { data: all, error: qErr } = await supabase
        .from('courses')
        .select('id, name, semester, term, start_date, end_date')
        .order('start_date', { ascending: false })
      if (qErr) throw qErr
      setCourses((all || []) as CourseRow[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create course')
    } finally {
      setCreating(false)
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl text-center text-gray-600 dark:text-gray-400">
        Sign in to view your classes.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Classes</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Discussions, documents, and announcements for each course you can access.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New course
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      ) : courses.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">
          {isSuperAdmin
            ? 'No courses yet. Create one to get started.'
            : 'You are not enrolled in any courses yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                to={`/classes/${c.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800/50"
              >
                <span className="font-semibold text-gray-900 dark:text-white">{c.name}</span>
                <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">
                  {[c.semester, c.term].filter(Boolean).join(' · ') || 'No semester / term'}
                  {' · '}
                  {c.start_date} — {c.end_date}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create course</h2>
            <form onSubmit={handleCreateCourse} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Semester</label>
                  <input
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value)}
                    placeholder="e.g. Fall"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Term</label>
                  <input
                    value={formTerm}
                    onChange={(e) => setFormTerm(e.target.value)}
                    placeholder="e.g. 2026"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Start date</label>
                  <input
                    required
                    type="date"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">End date</label>
                  <input
                    required
                    type="date"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Enroll users by email (optional, comma or newline separated)
                </label>
                <textarea
                  value={formEmails}
                  onChange={(e) => setFormEmails(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
