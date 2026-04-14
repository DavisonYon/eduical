import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

export default function OrganizationDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug || !user) {
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const { data, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, description, image_url, is_private, created_at, slug')
          .eq('slug', slug)
          .single()

        if (orgError) throw orgError

        setOrg(data as Organization)
      } catch (e: any) {
        setError(e?.message || 'Organization not found')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [slug, user])

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <span className="text-lg leading-none">←</span>
          Back to organizations
        </button>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-600 dark:text-gray-400">Loading organization...</div>
        ) : error || !org ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200">
            {error || 'Organization not found'}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              {org.image_url ? (
                <img
                  src={org.image_url}
                  alt={org.name}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-gradient-to-r from-blue-100 via-indigo-100 to-slate-100 text-4xl font-semibold text-blue-700 dark:from-blue-900/60 dark:via-indigo-900/60 dark:to-slate-900/60 dark:text-blue-300">
                  {org.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 3)}
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{org.name}</h1>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Created{' '}
                      {new Date(org.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      org.is_private
                        ? 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                        : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/60 dark:text-blue-200'
                    }`}
                  >
                    {org.is_private ? 'Private group' : 'Public group'}
                  </span>
                </div>
                {org.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                    {org.description}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-300">
                Group feed and posts
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-500">
                This will become the dedicated feed for this organization (posts, announcements,
                events, etc.). For now, it&apos;s a placeholder so you can navigate into a group
                and confirm routing works.
              </p>
            </div>
          </>
        )}
    </div>
  )
}

