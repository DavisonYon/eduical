import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import FriendRequestButton from '../components/friends/FriendRequestButton'
import BlockUserButton from '../components/user/BlockUserButton'

type DegreeType = 'undergrad' | 'masters' | 'phd' | 'post-bach' | 'continuing-edu' | null

type PublicProfile = {
  id: string
  full_name: string | null
  email: string | null
  degree_type: DegreeType
  graduation_year: number | null
  past_schools: Array<{ school: string; degree: string; year: number | null }> | null
  major: string | null
  linkedin_url: string | null
  github_url: string | null
  website_url: string | null
  profile_picture: string | null
}

type UserPost = {
  id: string
  user_id: string
  content: string | null
  images: string[] | null
  gif_url: string | null
  youtube_video_id: string | null
  location: string | null
  visibility: 'public' | 'friends'
  created_at: string
}

function parseImages(raw: unknown): string[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  return null
}

function degreeLabel(d: DegreeType): string | null {
  if (!d) return null
  const map: Record<NonNullable<DegreeType>, string> = {
    undergrad: 'Undergraduate',
    masters: "Master's",
    phd: 'PhD',
    'post-bach': 'Post-Baccalaureate',
    'continuing-edu': 'Continuing Education',
  }
  return map[d]
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [posts, setPosts] = useState<UserPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (pErr) throw pErr
      if (!p) {
        setError('')
        setProfile(null)
        setPosts([])
        return
      }
      setError('')
      setProfile(p as PublicProfile)

      const { data: postRows, error: postErr } = await supabase
        .from('posts')
        .select('id, user_id, content, images, gif_url, youtube_video_id, location, visibility, created_at')
        .eq('user_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
      if (postErr) throw postErr
      setPosts(
        (postRows || []).map((row: Record<string, unknown>) => ({
          ...(row as unknown as UserPost),
          images: parseImages(row.images),
        }))
      )
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not load profile')
      setProfile(null)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Member'
  const isOwn = user?.id === userId

  if (!userId) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-gray-600 dark:text-gray-400">Invalid profile link.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="py-20 text-center text-gray-600 dark:text-gray-400">Loading profile…</div>
      </div>
    )
  }

  if (!loading && error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-red-200 bg-white p-10 text-center dark:border-red-900/50 dark:bg-gray-800">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Could not load profile</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-6 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (profile === null) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Profile not found</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            This user does not exist or is no longer available.
          </p>
          <Link
            to={user ? '/' : '/login'}
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {user ? 'Back to home' : 'Sign in'}
          </Link>
        </div>
      </div>
    )
  }

  const degree = degreeLabel(profile.degree_type)
  const metaParts = [degree, profile.major, profile.graduation_year ? `Class of ${profile.graduation_year}` : null].filter(
    Boolean
  ) as string[]

  return (
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-700/80 dark:bg-gray-800/80">
        <div className="h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 sm:h-32" />
        <div className="relative px-6 pb-8 pt-0 sm:px-10">
          <div className="-mt-14 flex flex-col gap-6 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
              {profile.profile_picture ? (
                <img
                  src={profile.profile_picture}
                  alt=""
                  className="h-28 w-28 rounded-2xl border-4 border-white object-cover shadow-md dark:border-gray-800 sm:h-32 sm:w-32"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-white bg-gray-200 text-3xl font-semibold text-gray-600 shadow-md dark:border-gray-800 dark:bg-gray-700 dark:text-gray-200 sm:h-32 sm:w-32">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="text-center sm:mb-1 sm:pb-1 sm:text-left">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{displayName}</h1>
                {metaParts.length > 0 && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{metaParts.join(' · ')}</p>
                )}
                {profile.email && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{profile.email}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              {isOwn ? (
                <Link
                  to="/settings"
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  Edit profile
                </Link>
              ) : user ? (
                <>
                  <div className="flex items-center">
                    <FriendRequestButton userId={userId} onStatusChange={load} />
                  </div>
                  <BlockUserButton targetUserId={userId} />
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                    Sign in
                  </Link>{' '}
                  to add friends or block.
                </p>
              )}
            </div>
          </div>

          {(profile.linkedin_url || profile.github_url || profile.website_url) && (
            <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-100 pt-6 dark:border-gray-700/80">
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0A66C2]/10 px-3 py-1.5 text-sm font-medium text-[#0A66C2] hover:bg-[#0A66C2]/20"
                >
                  LinkedIn
                </a>
              )}
              {profile.github_url && (
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-900/10 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-900/15 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
                >
                  GitHub
                </a>
              )}
              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-400"
                >
                  Website
                </a>
              )}
            </div>
          )}

          {profile.past_schools && profile.past_schools.length > 0 && (
            <div className="mt-8 border-t border-gray-100 pt-6 dark:border-gray-700/80">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Education
              </h2>
              <ul className="mt-3 space-y-2">
                {profile.past_schools.map((s, i) => (
                  <li key={i} className="text-sm text-gray-800 dark:text-gray-200">
                    <span className="font-medium">{s.school}</span>
                    {s.degree ? ` — ${s.degree}` : ''}
                    {s.year ? ` (${s.year})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Posts</h2>
        {posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white/50 px-4 py-10 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
            No public posts yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => {
              const isYoutubeShare = !!post.youtube_video_id
              const shell = isYoutubeShare
                ? 'relative overflow-hidden rounded-xl border-2 border-violet-400/70 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/40 p-4 shadow-sm dark:border-violet-600/60 dark:from-violet-950/20 dark:via-gray-800 dark:to-fuchsia-950/15'
                : 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800'
              const dateLabel = new Date(post.created_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
              return (
                <li key={post.id} className={shell}>
                  {isYoutubeShare && (
                    <span className="mb-2 inline-flex rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Shared video
                    </span>
                  )}
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <time>{dateLabel}</time>
                    {post.location && (
                      <>
                        <span>·</span>
                        <span>{post.location}</span>
                      </>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        post.visibility === 'public'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {post.visibility === 'public' ? 'Public' : 'Friends'}
                    </span>
                  </div>
                  {post.content && (
                    <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{post.content}</p>
                  )}
                  {isYoutubeShare && post.youtube_video_id && user && (
                    <Link
                      to={`/events/watch/${post.youtube_video_id}`}
                      className="mt-3 block overflow-hidden rounded-lg border border-violet-200/80 dark:border-violet-800/50"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`}
                        alt=""
                        className="h-40 w-full object-cover sm:h-44"
                        loading="lazy"
                      />
                    </Link>
                  )}
                  {isYoutubeShare && post.youtube_video_id && !user && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-violet-200/80 opacity-90 dark:border-violet-800/50">
                      <img
                        src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`}
                        alt=""
                        className="h-40 w-full object-cover sm:h-44"
                        loading="lazy"
                      />
                      <p className="bg-violet-50/90 px-3 py-2 text-center text-xs text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
                        <Link to="/login" className="font-medium underline">
                          Sign in
                        </Link>{' '}
                        to open this event video.
                      </p>
                    </div>
                  )}
                  {!isYoutubeShare && post.gif_url && (
                    <div className="mt-3">
                      <img src={post.gif_url} alt="" className="max-h-64 w-full rounded-lg object-contain" />
                    </div>
                  )}
                  {!isYoutubeShare && post.images && post.images.length > 0 && (
                    <div
                      className={`mt-3 grid gap-2 ${
                        post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                      }`}
                    >
                      {post.images.map((img, i) => (
                        <img key={i} src={img} alt="" className="h-44 w-full rounded-lg object-cover" loading="lazy" />
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
