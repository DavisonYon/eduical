import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const MAX_FILES = 3
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export default function ReportBug() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pageUrl, setPageUrl] = useState(typeof window !== 'undefined' ? window.location.href : '')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successId, setSuccessId] = useState('')

  const canSubmit = useMemo(
    () => !!user && title.trim().length >= 5 && description.trim().length >= 10 && !submitting,
    [user, title, description, submitting]
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length > MAX_FILES) {
      setError(`You can upload up to ${MAX_FILES} screenshots.`)
      return
    }
    const tooLarge = selected.find((f) => f.size > MAX_FILE_SIZE_BYTES)
    if (tooLarge) {
      setError(`"${tooLarge.name}" is too large. Max size is 5MB per image.`)
      return
    }
    setError('')
    setFiles(selected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('Please sign in to submit a bug report.')
      return
    }
    if (!canSubmit) return

    setSubmitting(true)
    setError('')
    setSuccessId('')
    try {
      const screenshotPaths: string[] = []

      for (const file of files) {
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from('bug-reports').upload(path, file, {
          upsert: false,
        })
        if (uploadError) throw uploadError
        screenshotPaths.push(path)
      }

      const { data: inserted, error: insertError } = await supabase
        .from('bug_reports')
        .insert({
          reporter_id: user.id,
          title: title.trim(),
          description: description.trim(),
          page_url: pageUrl.trim() || null,
          screenshot_paths: screenshotPaths,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      if (inserted?.id) {
        await supabase.from('bug_report_updates').insert({
          report_id: inserted.id,
          actor_id: user.id,
          update_type: 'created',
          body: 'Bug report created',
        })
      }

      setSuccessId(inserted?.id || '')
      setTitle('')
      setDescription('')
      setFiles([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit bug report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Report a Bug</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Share what happened, where it happened, and optionally add screenshots so admins can investigate.
      </p>

      {!user && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          You must be signed in to report bugs.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {successId && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
          Report submitted. Reference ID: <span className="font-mono">{successId}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/40">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary of the issue"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="What did you expect, what happened instead, and steps to reproduce."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Page URL</label>
          <input
            type="text"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Screenshots (optional, up to {MAX_FILES})
          </label>
          <input type="file" accept="image/*" multiple onChange={onFileChange} className="w-full text-sm" />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              {files.map((f) => (
                <li key={`${f.name}-${f.lastModified}`}>{f.name}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            Back to home
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>
  )
}
