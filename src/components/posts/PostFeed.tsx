import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { ensureProfile } from '../../utils/ensureProfile'
import { addEventYoutubeLike, removeEventYoutubeLike } from '../../lib/eventYoutubeEngagement'
import { type YoutubeRssVideo } from '../../lib/youtubeRss'
import { type DashboardFeedRow, type FeedPost } from '../../lib/buildDashboardFeed'
import { invalidateDashboardFeedCache, readFeedSnapshot, writeFeedSnapshot } from '../../lib/dashboardFeedCache'
import { loadDashboardFeed, shouldRefreshDashboardFeed } from '../../lib/dashboardFeedLoader'
import EventYoutubeComments from '../events/EventYoutubeComments'

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: {
    id: string
    full_name: string | null
    email: string | null
    profile_picture: string | null
  } | null
  likesCount?: number
  userHasLiked?: boolean
}

interface PostFeedProps {
  refreshKey?: number
}

export default function PostFeed({ refreshKey }: PostFeedProps) {
  const { user } = useAuth()
  const userId = user?.id
  const [feedRows, setFeedRows] = useState<DashboardFeedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [commentsModalPostId, setCommentsModalPostId] = useState<string | null>(null)
  const [commentsModalYoutubeId, setCommentsModalYoutubeId] = useState<string | null>(null)
  const [commentsModalYoutubeTitle, setCommentsModalYoutubeTitle] = useState('')
  const [commentsModalLoading, setCommentsModalLoading] = useState(false)
  const [commentsModalError, setCommentsModalError] = useState('')
  const [commentsModalComments, setCommentsModalComments] = useState<Comment[]>([])
  const [commentsModalInput, setCommentsModalInput] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const loadGenRef = useRef(0)

  const findPost = useCallback(
    (postId: string): FeedPost | undefined => {
      const row = feedRows.find((r): r is Extract<DashboardFeedRow, { kind: 'post' }> => r.kind === 'post' && r.post.id === postId)
      return row?.post
    },
    [feedRows]
  )

  const bumpEventCommentCount = useCallback((videoId: string) => {
    setFeedRows((prev) =>
      prev.map((row) => {
        if (row.kind === 'channel' && row.video.videoId === videoId) {
          return {
            ...row,
            engagement: {
              ...row.engagement,
              commentCount: row.engagement.commentCount + 1,
            },
          }
        }
        if (row.kind === 'post' && row.post.youtube_video_id === videoId) {
          return {
            ...row,
            post: {
              ...row.post,
              commentsCount: (row.post.commentsCount || 0) + 1,
            },
          }
        }
        return row
      })
    )
  }, [])

  useEffect(() => {
    if (user) {
      ensureProfile(user).catch(console.error)
    }
  }, [user])

  useEffect(() => {
    if (!userId) {
      setFeedRows([])
      setLoading(false)
      return
    }

    const gen = ++loadGenRef.current
    const rk = refreshKey || 0

    const run = async () => {
      const cached = readFeedSnapshot(userId)

      if (cached?.feedRows?.length) {
        if (gen === loadGenRef.current) {
          setFeedRows(cached.feedRows)
          setLoading(false)
        }
      } else if (gen === loadGenRef.current) {
        setLoading(true)
      }

      try {
        const needsFullReload = await shouldRefreshDashboardFeed({ cached, refreshKey: rk })
        if (gen !== loadGenRef.current) return

        if (!needsFullReload) {
          return
        }

        if (gen === loadGenRef.current) {
          if (!cached?.feedRows?.length) {
            setLoading(true)
          }
          setError('')
        }

        const result = await loadDashboardFeed(userId)
        if (gen !== loadGenRef.current) return

        setFeedRows(result.feedRows)
        writeFeedSnapshot({
          userId,
          feedRows: result.feedRows,
          dbFingerprint: result.dbFingerprint,
          rssHeadVideoId: result.rssHeadVideoId,
          refreshKeyAtFetch: rk,
          savedAt: Date.now(),
        })
        setError('')
      } catch (err: unknown) {
        if (gen !== loadGenRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load posts')
        if (!readFeedSnapshot(userId)?.feedRows.length) {
          setFeedRows([])
        }
      } finally {
        if (gen === loadGenRef.current) {
          setLoading(false)
        }
      }
    }

    run()
  }, [userId, refreshKey, reloadToken])

  const handleRetryFeed = () => {
    if (userId) invalidateDashboardFeedCache(userId)
    setReloadToken((t) => t + 1)
  }

  const handleToggleEventYoutubeLike = async (videoId: string) => {
    if (!user) return

    let currentlyLiked = false
    setFeedRows((prev) => {
      const row = prev.find(
        (r) =>
          (r.kind === 'channel' && r.video.videoId === videoId) ||
          (r.kind === 'post' && r.post.youtube_video_id === videoId)
      )
      currentlyLiked =
        row?.kind === 'channel'
          ? row.engagement.userHasLiked
          : row?.kind === 'post'
            ? row.post.userHasLiked ?? false
            : false

      return prev.map((r) => {
        if (r.kind === 'channel' && r.video.videoId === videoId) {
          return {
            ...r,
            engagement: {
              ...r.engagement,
              userHasLiked: !currentlyLiked,
              likeCount: r.engagement.likeCount + (currentlyLiked ? -1 : 1),
            },
          }
        }
        if (r.kind === 'post' && r.post.youtube_video_id === videoId) {
          return {
            ...r,
            post: {
              ...r.post,
              userHasLiked: !currentlyLiked,
              likesCount: (r.post.likesCount || 0) + (currentlyLiked ? -1 : 1),
            },
          }
        }
        return r
      })
    })

    try {
      if (currentlyLiked) {
        await removeEventYoutubeLike(videoId, user.id)
      } else {
        await addEventYoutubeLike(videoId, user.id)
      }
    } catch {
      setFeedRows((prev) =>
        prev.map((r) => {
          if (r.kind === 'channel' && r.video.videoId === videoId) {
            return {
              ...r,
              engagement: {
                ...r.engagement,
                userHasLiked: currentlyLiked,
                likeCount: r.engagement.likeCount + (currentlyLiked ? 1 : -1),
              },
            }
          }
          if (r.kind === 'post' && r.post.youtube_video_id === videoId) {
            return {
              ...r,
              post: {
                ...r.post,
                userHasLiked: currentlyLiked,
                likesCount: (r.post.likesCount || 0) + (currentlyLiked ? 1 : -1),
              },
            }
          }
          return r
        })
      )
    }
  }

  const handleToggleLike = async (postId: string) => {
    if (!user) return

    const post = findPost(postId)
    if (!post) return

    if (post.youtube_video_id) {
      await handleToggleEventYoutubeLike(post.youtube_video_id)
      return
    }

    const currentlyLiked = post.userHasLiked

    setFeedRows((prev) =>
      prev.map((r) =>
        r.kind === 'post' && r.post.id === postId
          ? {
              ...r,
              post: {
                ...r.post,
                userHasLiked: !currentlyLiked,
                likesCount: (r.post.likesCount || 0) + (currentlyLiked ? -1 : 1),
              },
            }
          : r
      )
    )

    if (currentlyLiked) {
      const { error: unlikeError } = await supabase.from('post_likes').delete().match({ post_id: postId, user_id: user.id })

      if (unlikeError) {
        setFeedRows((prev) =>
          prev.map((r) =>
            r.kind === 'post' && r.post.id === postId
              ? {
                  ...r,
                  post: {
                    ...r.post,
                    userHasLiked: currentlyLiked,
                    likesCount: (r.post.likesCount || 0) + (currentlyLiked ? 1 : -1),
                  },
                }
              : r
          )
        )
      }
    } else {
      const { error: likeError } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })

      if (likeError) {
        setFeedRows((prev) =>
          prev.map((r) =>
            r.kind === 'post' && r.post.id === postId
              ? {
                  ...r,
                  post: {
                    ...r.post,
                    userHasLiked: currentlyLiked,
                    likesCount: (r.post.likesCount || 0) + (currentlyLiked ? 1 : -1),
                  },
                }
              : r
          )
        )
      }
    }
  }

  const handleOpenComments = async (postId: string) => {
    const post = findPost(postId)
    if (post?.youtube_video_id) {
      setCommentsModalPostId(null)
      setCommentsModalComments([])
      setCommentsModalInput('')
      setCommentsModalError('')
      setCommentsModalLoading(false)
      setCommentsModalYoutubeId(post.youtube_video_id)
      setCommentsModalYoutubeTitle(
        post.content?.trim() ? post.content.trim().slice(0, 120) : 'Georgia Tech event video'
      )
      return
    }

    setCommentsModalYoutubeId(null)
    setCommentsModalYoutubeTitle('')
    setCommentsModalPostId(postId)
    setCommentsModalError('')
    setCommentsModalInput('')
    setCommentsModalComments([])
    setCommentsModalLoading(true)

    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('post_comments')
        .select('id, post_id, user_id, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (commentsError) throw commentsError

      const baseComments: Comment[] =
        commentsData?.map((c: { id: string; post_id: string; user_id: string; content: string; created_at: string }) => ({
          id: c.id,
          post_id: c.post_id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          profiles: null,
        })) || []

      if (baseComments.length === 0) {
        setCommentsModalComments([])
        return
      }

      const commenterIds = [...new Set(baseComments.map((c) => c.user_id))]
      const { data: commenterProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture')
        .in('id', commenterIds)

      const commentIds = baseComments.map((c) => c.id)
      const { data: commentLikesData } = await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)

      const likesByComment: Record<string, { count: number; userHasLiked: boolean }> = {}
      baseComments.forEach((c) => {
        likesByComment[c.id] = { count: 0, userHasLiked: false }
      })

      if (commentLikesData) {
        commentLikesData.forEach((like: { comment_id: string; user_id: string }) => {
          if (!likesByComment[like.comment_id]) {
            likesByComment[like.comment_id] = { count: 0, userHasLiked: false }
          }
          likesByComment[like.comment_id].count += 1
          if (userId && like.user_id === userId) {
            likesByComment[like.comment_id].userHasLiked = true
          }
        })
      }

      const enriched = baseComments.map((c) => ({
        ...c,
        profiles: commenterProfiles?.find((p) => p.id === c.user_id) || null,
        likesCount: likesByComment[c.id]?.count ?? 0,
        userHasLiked: likesByComment[c.id]?.userHasLiked ?? false,
      }))

      setCommentsModalComments(enriched)
    } catch (e: unknown) {
      setCommentsModalError(e instanceof Error ? e.message : 'Failed to load comments')
    } finally {
      setCommentsModalLoading(false)
    }
  }

  const handleOpenChannelComments = (video: YoutubeRssVideo) => {
    setCommentsModalPostId(null)
    setCommentsModalComments([])
    setCommentsModalInput('')
    setCommentsModalError('')
    setCommentsModalLoading(false)
    setCommentsModalYoutubeId(video.videoId)
    setCommentsModalYoutubeTitle(video.title)
  }

  const handleToggleCommentLike = async (commentId: string) => {
    if (!userId) return

    const comment = commentsModalComments.find((c) => c.id === commentId)
    if (!comment) return

    const currentlyLiked = comment.userHasLiked

    setCommentsModalComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              userHasLiked: !currentlyLiked,
              likesCount: (c.likesCount || 0) + (currentlyLiked ? -1 : 1),
            }
          : c
      )
    )

    if (currentlyLiked) {
      const { error } = await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: userId })

      if (error) {
        setCommentsModalComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  userHasLiked: currentlyLiked,
                  likesCount: (c.likesCount || 0) + (currentlyLiked ? 1 : -1),
                }
              : c
          )
        )
      }
    } else {
      const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId })

      if (error) {
        setCommentsModalComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  userHasLiked: currentlyLiked,
                  likesCount: (c.likesCount || 0) + (currentlyLiked ? 1 : -1),
                }
              : c
          )
        )
      }
    }
  }

  const handleCloseComments = () => {
    setCommentsModalPostId(null)
    setCommentsModalYoutubeId(null)
    setCommentsModalYoutubeTitle('')
    setCommentsModalComments([])
    setCommentsModalInput('')
    setCommentsModalError('')
    setCommentsModalLoading(false)
  }

  const handleAddCommentInModal = async () => {
    if (!userId) return
    if (!commentsModalPostId) return

    const content = commentsModalInput.trim()
    if (!content) return

    const post = findPost(commentsModalPostId)
    const tempId = `temp-${Date.now()}`

    const optimistic: Comment = {
      id: tempId,
      post_id: commentsModalPostId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      profiles: post?.profiles || null,
    }

    setCommentsModalComments((prev) => [optimistic, ...prev])
    setCommentsModalInput('')
    setFeedRows((prev) =>
      prev.map((r) =>
        r.kind === 'post' && r.post.id === commentsModalPostId
          ? { ...r, post: { ...r.post, commentsCount: (r.post.commentsCount || 0) + 1 } }
          : r
      )
    )

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: commentsModalPostId, user_id: userId, content })
      .select('id, post_id, user_id, content, created_at')
      .single()

    if (error || !data) {
      setCommentsModalComments((prev) => prev.filter((c) => c.id !== tempId))
      setFeedRows((prev) =>
        prev.map((r) =>
          r.kind === 'post' && r.post.id === commentsModalPostId
            ? { ...r, post: { ...r.post, commentsCount: Math.max(0, (r.post.commentsCount || 0) - 1) } }
            : r
        )
      )
      return
    }

    setCommentsModalComments((prev) =>
      prev.map((c) => (c.id === tempId ? { ...c, id: data.id, created_at: data.created_at } : c))
    )
  }

  const renderProfileAvatar = (p: FeedPost['profiles'], authorUserId: string, size: 'sm' | 'md' = 'md') => {
    const sm = size === 'sm'
    const box = sm ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
    const inner = p?.profile_picture ? (
      <img
        src={p.profile_picture}
        alt={p?.full_name || p?.email || 'User'}
        className={`${sm ? 'h-8 w-8' : 'h-10 w-10'} rounded-full border border-gray-300 object-cover dark:border-gray-600`}
      />
    ) : (
      <div className={`flex ${box} items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700`}>
        <span className={`font-medium text-gray-800 dark:text-white ${sm ? 'text-xs' : 'text-sm'}`}>
          {p?.full_name
            ? p.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : p?.email?.[0].toUpperCase() || 'U'}
        </span>
      </div>
    )
    return (
      <Link
        to={`/user/${authorUserId}`}
        className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      >
        {inner}
      </Link>
    )
  }

  if (loading) {
    return <div className="py-8 text-center text-gray-600 dark:text-gray-400">Loading posts...</div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200">
        <p className="font-semibold">Error loading posts</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          type="button"
          onClick={handleRetryFeed}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 dark:bg-red-700 dark:hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    )
  }

  if (feedRows.length === 0) {
    return (
      <div className="py-12 text-center text-gray-600 dark:text-gray-400">
        <p className="mb-2 text-lg">Nothing in your feed yet</p>
        <p className="text-sm">Community posts and Georgia Tech channel videos will show here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {feedRows.map((row) => {
        if (row.kind === 'channel') {
          const { video, engagement } = row
          const publishedLabel = video.published
            ? new Date(video.published).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''

          return (
            <div
              key={row.id}
              className="relative overflow-hidden rounded-lg border-2 border-amber-400/90 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 p-3 shadow-sm ring-2 ring-amber-300/60 dark:border-amber-600/80 dark:from-amber-950/30 dark:via-gray-800 dark:to-orange-950/20 dark:ring-amber-600/40 sm:p-4"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 dark:from-amber-500 dark:via-yellow-500 dark:to-orange-500" />
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm dark:bg-amber-500 sm:text-xs">
                  Georgia Tech · Event
                </span>
                <span className="text-[10px] text-amber-900/80 dark:text-amber-200/90 sm:text-xs">
                  Same thread as the event page
                </span>
              </div>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold leading-snug text-gray-900 dark:text-white sm:text-base">
                    <Link
                      to={`/events/watch/${video.videoId}`}
                      state={{ video }}
                      className="hover:text-amber-700 dark:hover:text-amber-300"
                    >
                      {video.title}
                    </Link>
                  </h3>
                  {publishedLabel && (
                    <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">Published {publishedLabel}</p>
                  )}
                </div>
              </div>
              <Link
                to={`/events/watch/${video.videoId}`}
                state={{ video }}
                className="mb-2 block h-36 w-full overflow-hidden rounded-md border border-amber-200/80 bg-black dark:border-amber-800/60 sm:h-40"
              >
                <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              </Link>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300 sm:text-xs">
                <span title="Educial views (not YouTube)" className="tabular-nums">
                  {engagement.viewCount.toLocaleString()} Educial views
                </span>
                <span className="text-gray-400">·</span>
                <span className="tabular-nums">{engagement.likeCount.toLocaleString()} likes</span>
              </div>
              <div className="flex items-center gap-4 border-t border-amber-200/60 pt-2 dark:border-amber-800/50 sm:gap-5">
                <button
                  type="button"
                  onClick={() => handleToggleEventYoutubeLike(video.videoId)}
                  disabled={!user}
                  className={`flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    engagement.userHasLiked
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  <span className="text-xs">
                    {engagement.likeCount > 0
                      ? `${engagement.likeCount} Like${engagement.likeCount === 1 ? '' : 's'}`
                      : 'Like'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenChannelComments(video)}
                  className="flex items-center gap-1.5 text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span className="text-xs">
                    {engagement.commentCount > 0
                      ? `${engagement.commentCount} Comment${engagement.commentCount === 1 ? '' : 's'}`
                      : 'Comment'}
                  </span>
                </button>
              </div>
            </div>
          )
        }

        const post = row.post
        const isYoutubeShare = !!post.youtube_video_id
        const sharedAtLabel = new Date(post.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        const youtubePublishedLabel =
          isYoutubeShare && post.youtube_published_at
            ? new Date(post.youtube_published_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : null

        const cardShell = isYoutubeShare
          ? 'relative overflow-hidden rounded-lg border-2 border-violet-400/85 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/35 p-3 shadow-sm ring-2 ring-violet-300/55 dark:border-violet-600/75 dark:from-violet-950/25 dark:via-gray-800 dark:to-fuchsia-950/20 dark:ring-violet-600/35 sm:p-4'
          : 'rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:p-4'

        return (
          <div key={row.id} className={cardShell}>
            {isYoutubeShare && (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 opacity-90 dark:opacity-100" />
                <div className="mb-1.5">
                  <span className="inline-flex items-center rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm dark:bg-violet-500 sm:text-xs">
                    Shared event video
                  </span>
                </div>
              </>
            )}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                {renderProfileAvatar(post.profiles, post.user_id, 'sm')}
                <div className="min-w-0">
                  <Link
                    to={`/user/${post.user_id}`}
                    className="truncate text-sm font-medium text-gray-900 hover:underline dark:text-white"
                  >
                    {post.profiles?.full_name || post.profiles?.email || 'User'}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400 sm:text-xs">
                    <span>{sharedAtLabel}</span>
                    {post.location && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {post.location}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        post.visibility === 'public'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {post.visibility === 'public' ? 'Public' : 'Friends Only'}
                    </span>
                  </div>
                  {youtubePublishedLabel && (
                    <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
                      YouTube upload: {youtubePublishedLabel}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {post.content && (
              <p className="mb-2 whitespace-pre-wrap text-sm leading-snug text-gray-900 dark:text-white">
                {post.content}
              </p>
            )}

            {isYoutubeShare && post.youtube_video_id && (
              <Link
                to={`/events/watch/${post.youtube_video_id}`}
                className="mb-2 block h-36 w-full overflow-hidden rounded-md border border-violet-200/80 bg-black dark:border-violet-800/50 sm:h-40"
              >
                <img
                  src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </Link>
            )}

            {!isYoutubeShare && post.gif_url && (
              <div className="mb-2">
                <img src={post.gif_url} alt="Post GIF" className="max-h-52 w-full rounded-md object-contain sm:max-h-60" />
              </div>
            )}

            {!isYoutubeShare && post.images && post.images.length > 0 && (
              <div
                className={`mb-2 grid gap-1.5 ${
                  post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'
                }`}
              >
                {post.images.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={`Post image ${index + 1}`}
                    className="h-40 w-full rounded-md object-cover sm:h-44"
                  />
                ))}
              </div>
            )}

            <div
              className={`flex items-center gap-4 border-t pt-2 sm:gap-5 ${
                isYoutubeShare ? 'border-violet-200/60 dark:border-violet-800/50' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  isYoutubeShare && post.youtube_video_id
                    ? handleToggleEventYoutubeLike(post.youtube_video_id)
                    : handleToggleLike(post.id)
                }
                disabled={!user}
                className={`flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  post.userHasLiked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <span className="text-xs">
                  {post.likesCount && post.likesCount > 0 ? `${post.likesCount} Like${post.likesCount === 1 ? '' : 's'}` : 'Like'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenComments(post.id)}
                className="flex items-center gap-1.5 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span className="text-xs">
                  {post.commentsCount && post.commentsCount > 0
                    ? `${post.commentsCount} Comment${post.commentsCount === 1 ? '' : 's'}`
                    : 'Comment'}
                </span>
              </button>
            </div>
          </div>
        )
      })}

      {commentsModalYoutubeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseComments()
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0 pr-2">
                <p className="font-semibold text-gray-900 dark:text-white">Event discussion</p>
                <p className="truncate text-xs text-gray-600 dark:text-gray-400">{commentsModalYoutubeTitle}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseComments}
                className="flex-shrink-0 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4">
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Same thread as on the{' '}
                <Link
                  to={`/events/watch/${commentsModalYoutubeId}`}
                  state={{ video: { videoId: commentsModalYoutubeId, title: commentsModalYoutubeTitle } as YoutubeRssVideo }}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                  onClick={handleCloseComments}
                >
                  event video page
                </Link>
                .
              </p>
              <EventYoutubeComments
                youtubeVideoId={commentsModalYoutubeId}
                variant="embedded"
                onThreadChange={() => bumpEventCommentCount(commentsModalYoutubeId)}
              />
            </div>
          </div>
        </div>
      )}

      {commentsModalPostId && !commentsModalYoutubeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseComments()
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Comments</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {findPost(commentsModalPostId)?.commentsCount || 0} total
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseComments}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                aria-label="Close comments"
              >
                ✕
              </button>
            </div>

            <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900/80">
              {(() => {
                const post = findPost(commentsModalPostId)
                if (!post) return null
                return (
                  <div className="flex items-start gap-3">
                    {renderProfileAvatar(post.profiles, post.user_id, 'sm')}
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/user/${post.user_id}`}
                        className="truncate text-sm font-semibold text-gray-900 hover:underline dark:text-white"
                      >
                        {post.profiles?.full_name || post.profiles?.email || 'User'}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                        <span>
                          {new Date(post.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {post.visibility && (
                          <>
                            <span>•</span>
                            <span>{post.visibility === 'public' ? 'Public' : 'Friends'}</span>
                          </>
                        )}
                      </div>
                      {post.content && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100">{post.content}</p>
                      )}
                      {post.gif_url && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                          <img src={post.gif_url} alt="Post GIF" className="max-h-72 w-full bg-black object-contain" />
                        </div>
                      )}
                      {post.images && post.images.length > 0 && (
                        <div
                          className={`mt-3 grid gap-1 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 ${
                            post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'
                          }`}
                        >
                          {post.images.map((img, index) => (
                            <img key={index} src={img} alt={`Post image ${index + 1}`} className="h-48 w-full object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="border-b border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentsModalInput}
                  onChange={(e) => setCommentsModalInput(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddCommentInModal()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCommentInModal}
                  className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                  disabled={!commentsModalInput.trim()}
                >
                  Post
                </button>
              </div>
              {commentsModalError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-300">{commentsModalError}</p>
              )}
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              {commentsModalLoading ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading comments...</p>
              ) : commentsModalComments.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {commentsModalComments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <Link
                        to={`/user/${comment.user_id}`}
                        className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {comment.profiles?.profile_picture ? (
                          <img
                            src={comment.profiles.profile_picture}
                            alt={comment.profiles.full_name || comment.profiles.email || 'User'}
                            className="h-8 w-8 rounded-full border border-gray-300 object-cover dark:border-gray-600"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                            <span className="text-xs font-medium text-gray-800 dark:text-white">
                              {comment.profiles?.full_name
                                ? comment.profiles.full_name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)
                                : comment.profiles?.email?.[0].toUpperCase() || 'U'}
                            </span>
                          </div>
                        )}
                      </Link>
                      <div className="flex-1 rounded-2xl border border-gray-100 bg-gray-100 px-3 py-2 dark:border-transparent dark:bg-gray-800">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <Link
                              to={`/user/${comment.user_id}`}
                              className="text-xs font-medium text-gray-800 hover:underline dark:text-gray-300"
                            >
                              {comment.profiles?.full_name || comment.profiles?.email || 'User'}
                            </Link>
                            <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-500">
                              {new Date(comment.created_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleCommentLike(comment.id)}
                            className={`flex items-center gap-1 text-[11px] font-medium ${
                              comment.userHasLiked
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                            }`}
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill={comment.userHasLiked ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                              />
                            </svg>
                            <span>
                              {comment.likesCount && comment.likesCount > 0 ? comment.likesCount : 'Like'}
                            </span>
                          </button>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
