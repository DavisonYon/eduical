import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
        >
          <span className="text-lg leading-none">←</span>
          Back to organizations
        </button>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading organization...</div>
        ) : error || !org ? (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg p-4 text-sm">
            {error || 'Organization not found'}
          </div>
        ) : (
          <>
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              {org.image_url ? (
                <img
                  src={org.image_url}
                  alt={org.name}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="h-32 w-full bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-slate-900/60 flex items-center justify-center text-4xl font-semibold text-blue-300">
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
                    <h1 className="text-xl font-bold text-white">{org.name}</h1>
                    <p className="text-xs text-gray-400 mt-1">
                      Created{' '}
                      {new Date(org.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      org.is_private
                        ? 'bg-gray-900 text-gray-300 border border-gray-700'
                        : 'bg-blue-900/60 text-blue-200 border border-blue-800/60'
                    }`}
                  >
                    {org.is_private ? 'Private group' : 'Public group'}
                  </span>
                </div>
                {org.description && (
                  <p className="text-sm text-gray-200 mt-2 whitespace-pre-wrap">
                    {org.description}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-300 font-medium mb-2">
                Group feed and posts
              </p>
              <p className="text-xs text-gray-500">
                This will become the dedicated feed for this organization (posts, announcements,
                events, etc.). For now, it&apos;s a placeholder so you can navigate into a group
                and confirm routing works.
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

