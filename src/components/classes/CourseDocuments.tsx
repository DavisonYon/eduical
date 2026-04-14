import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type DocRow = {
  id: string
  course_id: string
  title: string
  storage_path: string
  file_name: string
  mime_type: string | null
  visible_from: string
  visible_until: string | null
  created_at: string
}

interface CourseDocumentsProps {
  courseId: string
  isSuperAdmin: boolean
  /** When true (e.g. super_admin preview), list only docs visible to students right now. */
  simulateStudentAccess?: boolean
}

function isWithinStudentVisibilityWindow(doc: DocRow, now = new Date()) {
  const t = now.getTime()
  if (new Date(doc.visible_from).getTime() > t) return false
  if (doc.visible_until != null && new Date(doc.visible_until).getTime() < t) return false
  return true
}

export default function CourseDocuments({
  courseId,
  isSuperAdmin,
  simulateStudentAccess = false,
}: CourseDocumentsProps) {
  const { user } = useAuth()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [visibleFrom, setVisibleFrom] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [visibleUntil, setVisibleUntil] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: qErr } = await supabase
        .from('course_documents')
        .select(
          'id, course_id, title, storage_path, file_name, mime_type, visible_from, visible_until, created_at'
        )
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })

      if (qErr) throw qErr
      setDocs((data || []) as DocRow[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const displayDocs = simulateStudentAccess ? docs.filter((d) => isWithinStudentVisibilityWindow(d)) : docs

  const safeFileName = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(0, 180)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !isSuperAdmin || !file || !title.trim()) return
    setUploading(true)
    setError('')
    try {
      const objectName = `${crypto.randomUUID()}-${safeFileName(file.name)}`
      const storagePath = `${courseId}/${objectName}`

      const { error: upErr } = await supabase.storage.from('course-docs').upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })
      if (upErr) throw upErr

      const fromIso = new Date(visibleFrom).toISOString()
      const untilIso = visibleUntil.trim() ? new Date(visibleUntil).toISOString() : null

      const { error: insErr } = await supabase.from('course_documents').insert({
        course_id: courseId,
        title: title.trim(),
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || null,
        visible_from: fromIso,
        visible_until: untilIso,
        uploaded_by: user.id,
      })
      if (insErr) throw insErr

      setTitle('')
      setFile(null)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const download = async (doc: DocRow) => {
    setError('')
    try {
      const { data, error: sErr } = await supabase.storage
        .from('course-docs')
        .createSignedUrl(doc.storage_path, 3600)
      if (sErr || !data?.signedUrl) throw sErr || new Error('No download URL')
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not download file')
    }
  }

  const removeDoc = async (doc: DocRow) => {
    if (!isSuperAdmin) return
    if (!window.confirm('Remove this document from the course?')) return
    setError('')
    try {
      await supabase.storage.from('course-docs').remove([doc.storage_path])
      const { error: dErr } = await supabase.from('course_documents').delete().eq('id', doc.id)
      if (dErr) throw dErr
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete document')
    }
  }

  const windowLabel = (doc: DocRow) => {
    const from = new Date(doc.visible_from).toLocaleString()
    const until = doc.visible_until ? new Date(doc.visible_until).toLocaleString() : 'open-ended'
    return `${from} → ${until}`
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {isSuperAdmin && (
        <form
          onSubmit={handleUpload}
          className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800/40"
        >
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Upload course document</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Visible from</label>
              <input
                type="datetime-local"
                value={visibleFrom}
                onChange={(e) => setVisibleFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Visible until (optional)</label>
              <input
                type="datetime-local"
                value={visibleUntil}
                onChange={(e) => setVisibleUntil(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">File</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading || !title.trim() || !file}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading documents…</p>
      ) : displayDocs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {displayDocs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{d.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{d.file_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Available: {windowLabel(d)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => download(d)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
                >
                  Download
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => removeDoc(d)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
