import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import CourseForum from '../components/classes/CourseForum'
import CourseDocuments from '../components/classes/CourseDocuments'
import CourseNotificationsPanel from '../components/classes/CourseNotificationsPanel'

type CourseRow = {
  id: string
  name: string
  semester: string | null
  term: string | null
  start_date: string
  end_date: string
}

type Tab = 'forum' | 'docs' | 'notifications'

type EnrolledUser = {
  id: string
  full_name: string | null
  email: string | null
}

export default function ClassCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [course, setCourse] = useState<CourseRow | null>(null)
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('forum')
  const [enrolled, setEnrolled] = useState<EnrolledUser[]>([])
  const [rosterEmails, setRosterEmails] = useState('')
  const [savingRoster, setSavingRoster] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSemester, setEditSemester] = useState('')
  const [editTerm, setEditTerm] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [savingCourse, setSavingCourse] = useState(false)
  const [previewAsStudent, setPreviewAsStudent] = useState(false)

  const isSuperAdmin = profileRole === 'super_admin'
  const showAdminUi = isSuperAdmin && !previewAsStudent

  const loadRoster = useCallback(
    async (cid: string) => {
      const { data: rows, error: rErr } = await supabase
        .from('course_enrollments')
        .select('user_id')
        .eq('course_id', cid)
      if (rErr) throw rErr
      const ids = [...new Set((rows || []).map((r: { user_id: string }) => r.user_id))]
      if (ids.length === 0) {
        setEnrolled([])
        return
      }
      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids)
      if (pErr) throw pErr
      setEnrolled((profs || []) as EnrolledUser[])
    },
    []
  )

  useEffect(() => {
    const load = async () => {
      if (!user || !courseId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setProfileRole(profile?.role ?? null)
        const superA = profile?.role === 'super_admin'

        const { data: cRow, error: cErr } = await supabase
          .from('courses')
          .select('id, name, semester, term, start_date, end_date')
          .eq('id', courseId)
          .maybeSingle()

        if (cErr) throw cErr
        if (!cRow) {
          setCourse(null)
          setHasAccess(false)
          return
        }

        setCourse(cRow as CourseRow)
        setEditName(cRow.name)
        setEditSemester(cRow.semester || '')
        setEditTerm(cRow.term || '')
        setEditStart(cRow.start_date)
        setEditEnd(cRow.end_date)

        if (superA) {
          setHasAccess(true)
          await loadRoster(courseId)
          return
        }

        const { data: en, error: eErr } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('course_id', courseId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (eErr) throw eErr
        setHasAccess(!!en)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load course')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, courseId, loadRoster])

  const parseEmails = (raw: string) =>
    [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))]

  const addEnrollmentsByEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId || !isSuperAdmin) return
    const emails = parseEmails(rosterEmails)
    if (emails.length === 0) return
    setSavingRoster(true)
    setError('')
    try {
      const { data: profs, error: pErr } = await supabase.from('profiles').select('id, email').in('email', emails)
      if (pErr) throw pErr
      const found = (profs || []) as { id: string; email: string | null }[]
      const rows = found.map((p) => ({ course_id: courseId, user_id: p.id }))
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('course_enrollments').insert(rows)
        if (insErr) throw insErr
      }
      const foundEmails = new Set(found.map((p) => (p.email || '').toLowerCase()))
      const missing = emails.filter((em) => !foundEmails.has(em))
      if (missing.length > 0) {
        setError(`Some emails were not found: ${missing.join(', ')}`)
      }
      setRosterEmails('')
      await loadRoster(courseId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add enrollments')
    } finally {
      setSavingRoster(false)
    }
  }

  const removeEnrollment = async (userId: string) => {
    if (!courseId || !isSuperAdmin) return
    if (!window.confirm('Remove this user from the course?')) return
    setError('')
    try {
      const { error: dErr } = await supabase
        .from('course_enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('user_id', userId)
      if (dErr) throw dErr
      await loadRoster(courseId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove user')
    }
  }

  const saveCourseEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId || !isSuperAdmin || !editName.trim()) return
    setSavingCourse(true)
    setError('')
    try {
      const { error: uErr } = await supabase
        .from('courses')
        .update({
          name: editName.trim(),
          semester: editSemester.trim() || null,
          term: editTerm.trim() || null,
          start_date: editStart,
          end_date: editEnd,
        })
        .eq('id', courseId)
      if (uErr) throw uErr
      setEditOpen(false)
      const { data: cRow } = await supabase
        .from('courses')
        .select('id, name, semester, term, start_date, end_date')
        .eq('id', courseId)
        .single()
      if (cRow) setCourse(cRow as CourseRow)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update course')
    } finally {
      setSavingCourse(false)
    }
  }

  if (!user) {
    return <p className="text-gray-600 dark:text-gray-400">Sign in to view this course.</p>
  }

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Loading course…</p>
  }

  if (!course || !hasAccess) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-gray-700 dark:text-gray-300">You do not have access to this course or it does not exist.</p>
        <Link to="/classes" className="mt-4 inline-block text-blue-600 hover:underline dark:text-blue-400">
          Back to My Classes
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <button
        type="button"
        onClick={() => navigate('/classes')}
        className="mb-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        ← My Classes
      </button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{course.name}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {[course.semester, course.term].filter(Boolean).join(' · ') || 'No semester / term'}
            {' · '}
            {course.start_date} — {course.end_date}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('docs')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'docs'
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700'
            }`}
          >
            Course documents
          </button>
          {isSuperAdmin && !previewAsStudent && (
            <button
              type="button"
              onClick={() => {
                setEditOpen(false)
                setPreviewAsStudent(true)
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              View as student
            </button>
          )}
          {showAdminUi && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-600 dark:text-gray-200"
            >
              Edit course
            </button>
          )}
        </div>
      </div>

      {isSuperAdmin && previewAsStudent && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900/50 dark:bg-blue-950/40">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            Student preview: roster, editing, uploads, and announcements are hidden. Documents shown use the same
            visibility window as enrolled students.
          </p>
          <button
            type="button"
            onClick={() => setPreviewAsStudent(false)}
            className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Back to admin view
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {showAdminUi && (
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Roster</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {enrolled.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>
                  {p.full_name || '—'} <span className="text-gray-500">({p.email})</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeEnrollment(p.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addEnrollmentsByEmail} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              placeholder="Add emails (comma separated)"
              value={rosterEmails}
              onChange={(e) => setRosterEmails(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={savingRoster}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900"
            >
              {savingRoster ? 'Adding…' : 'Add users'}
            </button>
          </form>
        </section>
      )}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
        {(
          [
            ['forum', 'Discussion'],
            ['docs', 'Documents'],
            ['notifications', 'Announcements'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === id
                ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'forum' && <CourseForum courseId={course.id} isSuperAdmin={showAdminUi} />}
      {tab === 'docs' && (
        <CourseDocuments
          courseId={course.id}
          isSuperAdmin={showAdminUi}
          simulateStudentAccess={isSuperAdmin && previewAsStudent}
        />
      )}
      {tab === 'notifications' && (
        <CourseNotificationsPanel
          courseId={course.id}
          courseName={course.name}
          isSuperAdmin={showAdminUi}
        />
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit course</h2>
            <form onSubmit={saveCourseEdit} className="mt-4 space-y-3">
              <input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editSemester}
                  onChange={(e) => setEditSemester(e.target.value)}
                  placeholder="Semester"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <input
                  value={editTerm}
                  onChange={(e) => setEditTerm(e.target.value)}
                  placeholder="Term"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <input
                  required
                  type="date"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
