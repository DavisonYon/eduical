import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { excerptAroundMatch, parseSearchQuery, escapeRegExp } from '../lib/searchUtils'

export type SearchResultType = 'all' | 'posts' | 'comments' | 'people'
export type SearchSort = 'newest' | 'oldest'

type ProfileSnippet = {
  id: string
  full_name: string | null
  email: string | null
}

type PostHit = {
  kind: 'post'
  id: string
  content: string | null
  user_id: string
  created_at: string
  youtube_video_id: string | null
}

type PostCommentHit = {
  kind: 'post_comment'
  id: string
  content: string
  user_id: string
  created_at: string
  post_id: string
  post: {
    id: string
    content: string | null
    user_id: string
    created_at: string
    youtube_video_id: string | null
  } | null
}

type EventCommentHit = {
  kind: 'event_comment'
  id: string
  content: string
  user_id: string
  created_at: string
  youtube_video_id: string
}

type Hit = PostHit | PostCommentHit | EventCommentHit

function displayName(p: ProfileSnippet | undefined): string {
  return p?.full_name || p?.email?.split('@')[0] || 'Member'
}

function sortHits(hits: Hit[], sort: SearchSort): Hit[] {
  const mul = sort === 'newest' ? -1 : 1
  return [...hits].sort((a, b) => (a.created_at < b.created_at ? -mul : a.created_at > b.created_at ? mul : 0))
}

export default function SearchPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const qParam = searchParams.get('q')?.trim() || ''
  const typeParam = (searchParams.get('type') as SearchResultType) || 'all'
  const sortParam = (searchParams.get('sort') as SearchSort) || 'newest'

  const type: SearchResultType = ['all', 'posts', 'comments', 'people'].includes(typeParam) ? typeParam : 'all'
  const sort: SearchSort = sortParam === 'oldest' ? 'oldest' : 'newest'

  const terms = useMemo(() => parseSearchQuery(qParam), [qParam])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [peopleHits, setPeopleHits] = useState<ProfileSnippet[]>([])
  const [profilesById, setProfilesById] = useState<Record<string, ProfileSnippet>>({})

  const runSearch = useCallback(async () => {
    if (terms.length === 0) {
      setHits([])
      setPeopleHits([])
      setProfilesById({})
      setError('')
      return
    }

    setLoading(true)
    setError('')

    try {
      const collected: Hit[] = []
      const needPeople = type === 'all' || type === 'people'
      const needPosts = type === 'all' || type === 'posts'
      const needComments = type === 'all' || type === 'comments'

      let peopleRows: ProfileSnippet[] = []
      if (needPeople) {
        let profileQuery = supabase.from('profiles').select('id, full_name, email')
        for (const t of terms) {
          const safe = t.replace(/,/g, '')
          profileQuery = profileQuery.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`)
        }
        const { data: profRows, error: profileErr } = await profileQuery.limit(50)
        if (profileErr) throw profileErr
        const seen = new Set<string>()
        for (const row of profRows || []) {
          const p = row as ProfileSnippet
          if (seen.has(p.id)) continue
          seen.add(p.id)
          peopleRows.push(p)
        }
        peopleRows.sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }))
        setPeopleHits(peopleRows)
      } else {
        setPeopleHits([])
      }

      if (needPosts) {
        let pq = supabase
          .from('posts')
          .select('id, content, user_id, created_at, youtube_video_id')
          .eq('status', 'published')
        for (const t of terms) {
          pq = pq.ilike('content', `%${t}%`)
        }
        const { data: posts, error: pe } = await pq.order('created_at', { ascending: false }).limit(80)
        if (pe) throw pe
        for (const row of posts || []) {
          collected.push({
            kind: 'post',
            id: row.id,
            content: row.content,
            user_id: row.user_id,
            created_at: row.created_at,
            youtube_video_id: row.youtube_video_id,
          })
        }
      }

      if (needComments) {
        let cq = supabase.from('post_comments').select(
          `id, content, user_id, created_at, post_id,
 posts(id, content, user_id, created_at, youtube_video_id)`
        )
        for (const t of terms) {
          cq = cq.ilike('content', `%${t}%`)
        }
        const { data: comments, error: ce } = await cq.order('created_at', { ascending: false }).limit(80)
        if (ce) throw ce
        for (const row of comments || []) {
          const raw = row.posts as PostCommentHit['post'] | PostCommentHit['post'][] | null
          const post = Array.isArray(raw) ? raw[0] ?? null : raw
          if (!post) continue
          collected.push({
            kind: 'post_comment',
            id: row.id,
            content: row.content,
            user_id: row.user_id,
            created_at: row.created_at,
            post_id: row.post_id,
            post,
          })
        }

        if (user) {
          let eq = supabase
            .from('event_youtube_comments')
            .select('id, content, user_id, created_at, youtube_video_id')
          for (const t of terms) {
            eq = eq.ilike('content', `%${t}%`)
          }
          const { data: ev, error: ee } = await eq.order('created_at', { ascending: false }).limit(80)
          if (ee) throw ee
          for (const row of ev || []) {
            collected.push({
              kind: 'event_comment',
              id: row.id,
              content: row.content,
              user_id: row.user_id,
              created_at: row.created_at,
              youtube_video_id: row.youtube_video_id,
            })
          }
        }
      }

      const sorted = sortHits(collected, sort)
      setHits(sorted)

      const map: Record<string, ProfileSnippet> = {}
      for (const p of peopleRows) {
        map[p.id] = p
      }

      const ids = new Set<string>()
      for (const h of sorted) {
        ids.add(h.user_id)
        if (h.kind === 'post_comment' && h.post) ids.add(h.post.user_id)
      }
      const missing = [...ids].filter((id) => !map[id])
      if (missing.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', missing)
        if (profErr) throw profErr
        for (const p of profs || []) {
          map[p.id] = p as ProfileSnippet
        }
      }
      setProfilesById(map)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Search failed')
      setHits([])
      setPeopleHits([])
      setProfilesById({})
    } finally {
      setLoading(false)
    }
  }, [terms, type, sort, user])

  useEffect(() => {
    runSearch()
  }, [runSearch])

  const setFilter = (key: 'type' | 'sort', value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    if (qParam) next.set('q', qParam)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Search</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Search posts and comments{user ? ' (including event video comments)' : ''}, or find people by{' '}
        <strong className="font-medium text-gray-800 dark:text-gray-200">name</strong> or{' '}
        <strong className="font-medium text-gray-800 dark:text-gray-200">email</strong>. Use the &ldquo;Match
        in&rdquo; filter to narrow results.
      </p>

      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[140px] flex-1">
          <label htmlFor="search-type" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Match in
          </label>
          <select
            id="search-type"
            value={type}
            onChange={(e) => setFilter('type', e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">Posts, comments & people</option>
            <option value="posts">Posts only</option>
            <option value="comments">Comments only</option>
            <option value="people">People only</option>
          </select>
        </div>
        {type !== 'people' && (
          <div className="min-w-[140px] flex-1">
            <label htmlFor="search-sort" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Sort by date
            </label>
            <select
              id="search-sort"
              value={sort}
              onChange={(e) => setFilter('sort', e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        )}
      </div>

      {terms.length === 0 && (
        <p className="mt-10 text-center text-sm text-gray-600 dark:text-gray-400">
          Use the search bar for keywords, a person&apos;s display name, or part of an email address. Posts and comments
          respect what you can see on the feed; people results use the public profile directory.
        </p>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {terms.length > 0 && loading && (
        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">Searching…</p>
      )}

      {terms.length > 0 && !loading && !error && hits.length === 0 && peopleHits.length === 0 && (
        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">No matches for those terms.</p>
      )}

      {peopleHits.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">People</h2>
          <ul className="mt-3 space-y-3">
            {peopleHits.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                    Profile
                  </span>
                </div>
                <Link
                  to={`/user/${p.id}`}
                  className="mt-2 block text-base font-semibold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                >
                  <Highlight text={displayName(p)} terms={terms} />
                </Link>
                {p.email && (
                  <p className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-400">
                    <Highlight text={p.email} terms={terms} />
                  </p>
                )}
                <Link
                  to={`/user/${p.id}`}
                  className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  View profile
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hits.length > 0 && (
        <ul className="mt-8 space-y-4">
          {hits.map((hit) => {
            if (hit.kind === 'post') {
              const excerpt = excerptAroundMatch(hit.content, terms)
              const author = profilesById[hit.user_id]
              return (
                <li
                  key={`post-${hit.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                      Post
                    </span>
                    <Link to={`/user/${hit.user_id}`} className="font-medium text-gray-700 hover:underline dark:text-gray-300">
                      {displayName(author)}
                    </Link>
                    <span>·</span>
                    <time dateTime={hit.created_at}>
                      {new Date(hit.created_at).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                    <Highlight text={excerpt} terms={terms} />
                  </p>
                  <Link
                    to={`/p/${hit.id}`}
                    className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View post
                  </Link>
                </li>
              )
            }

            if (hit.kind === 'post_comment') {
              const postAuthor = hit.post ? profilesById[hit.post.user_id] : undefined
              const commenter = profilesById[hit.user_id]
              const commentExcerpt = excerptAroundMatch(hit.content, terms)
              const postCtx = excerptAroundMatch(hit.post?.content, terms, 50, 90)
              return (
                <li
                  key={`pc-${hit.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                      Comment on post
                    </span>
                    <Link to={`/user/${hit.user_id}`} className="font-medium text-gray-700 hover:underline dark:text-gray-300">
                      {displayName(commenter)}
                    </Link>
                    <span>·</span>
                    <time dateTime={hit.created_at}>
                      {new Date(hit.created_at).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    On a post by{' '}
                    <Link to={`/user/${hit.post?.user_id}`} className="font-medium text-gray-800 hover:underline dark:text-gray-200">
                      {displayName(postAuthor)}
                    </Link>
                    {postCtx ? (
                      <>
                        : <span className="italic">&ldquo;{postCtx}&rdquo;</span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                    <Highlight text={commentExcerpt} terms={terms} />
                  </p>
                  <Link
                    to={`/p/${hit.post_id}`}
                    className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View post thread
                  </Link>
                </li>
              )
            }

            const commenter = profilesById[hit.user_id]
            const commentExcerpt = excerptAroundMatch(hit.content, terms)
            return (
              <li
                key={`ev-${hit.id}`}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-100">
                    Event video comment
                  </span>
                  <Link to={`/user/${hit.user_id}`} className="font-medium text-gray-700 hover:underline dark:text-gray-300">
                    {displayName(commenter)}
                  </Link>
                  <span>·</span>
                  <time dateTime={hit.created_at}>
                    {new Date(hit.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  On Georgia Tech event video ·{' '}
                  <Link
                    to={`/events/watch/${hit.youtube_video_id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Open video
                  </Link>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                  <Highlight text={commentExcerpt} terms={terms} />
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  const pattern = new RegExp(`(${terms.map((t) => escapeRegExp(t)).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-700/80 dark:text-white">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}
