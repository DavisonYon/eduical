import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import EventYoutubeComments from '../components/events/EventYoutubeComments'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  addEventYoutubeLike,
  fetchEventYoutubeEngagement,
  recordEventYoutubeView,
  removeEventYoutubeLike,
  type EventYoutubeEngagement,
} from '../lib/eventYoutubeEngagement'
import {
  GEORGIA_TECH_CHANNEL_ID,
  fetchChannelVideosFromRss,
  type YoutubeRssVideo,
} from '../lib/youtubeRss'

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/

function placeholderVideo(videoId: string): YoutubeRssVideo {
  return {
    videoId,
    title: 'YouTube video',
    link: `https://www.youtube.com/watch?v=${videoId}`,
    published: '',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    description: '',
  }
}

function formatCount(n: number) {
  return n.toLocaleString()
}

export default function EventVideo() {
  const { videoId = '' } = useParams<{ videoId: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const initial = (location.state as { video?: YoutubeRssVideo } | null)?.video

  const [video, setVideo] = useState<YoutubeRssVideo | null>(
    initial && initial.videoId === videoId ? initial : null
  )
  const [metaError, setMetaError] = useState('')
  const [metaLoading, setMetaLoading] = useState(!initial || initial.videoId !== videoId)

  const [engagement, setEngagement] = useState<EventYoutubeEngagement>({
    viewCount: 0,
    likeCount: 0,
    userHasLiked: false,
  })
  const [engagementError, setEngagementError] = useState('')
  const [likeBusy, setLikeBusy] = useState(false)

  const [shareCaption, setShareCaption] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [shareMessage, setShareMessage] = useState('')

  const refreshEngagement = useCallback(async () => {
    const e = await fetchEventYoutubeEngagement(videoId, user?.id)
    setEngagement(e)
  }, [videoId, user?.id])

  useEffect(() => {
    if (!VIDEO_ID_RE.test(videoId)) return

    if (initial?.videoId === videoId) {
      setVideo(initial)
      setMetaLoading(false)
      return
    }

    let cancelled = false
    setVideo(null)
    ;(async () => {
      setMetaLoading(true)
      setMetaError('')
      try {
        const list = await fetchChannelVideosFromRss(GEORGIA_TECH_CHANNEL_ID)
        if (cancelled) return
        const found = list.find((v) => v.videoId === videoId)
        setVideo(found ?? placeholderVideo(videoId))
      } catch {
        if (!cancelled) {
          setVideo(placeholderVideo(videoId))
          setMetaError('Could not load video details from the channel feed.')
        }
      } finally {
        if (!cancelled) setMetaLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [videoId, initial])

  useEffect(() => {
    if (!VIDEO_ID_RE.test(videoId)) return
    let cancelled = false

    ;(async () => {
      setEngagementError('')
      try {
        if (user) {
          try {
            await recordEventYoutubeView(videoId, user.id)
          } catch {
            /* table missing or network; still show counts */
          }
        }
        const e = await fetchEventYoutubeEngagement(videoId, user?.id)
        if (!cancelled) setEngagement(e)
      } catch (err) {
        if (!cancelled) {
          setEngagementError(err instanceof Error ? err.message : 'Could not load Educial stats')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [videoId, user?.id])

  const handleShareToFeed = async () => {
    if (!user || shareBusy) return
    setShareBusy(true)
    setShareMessage('')
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: shareCaption.trim() || null,
        images: [],
        gif_url: null,
        youtube_video_id: videoId,
        youtube_published_at: video?.published || null,
        location: null,
        visibility: 'public',
        status: 'published',
      })
      if (error) throw error
      setShareCaption('')
      setShareMessage('Shared to your feed. Open the dashboard to see it.')
    } catch (e: unknown) {
      setShareMessage(e instanceof Error ? e.message : 'Could not share to feed')
    } finally {
      setShareBusy(false)
    }
  }

  const handleToggleLike = async () => {
    if (!user || likeBusy) return
    const currently = engagement.userHasLiked
    setLikeBusy(true)
    setEngagement((prev) => ({
      ...prev,
      userHasLiked: !currently,
      likeCount: prev.likeCount + (currently ? -1 : 1),
    }))
    try {
      if (currently) {
        await removeEventYoutubeLike(videoId, user.id)
      } else {
        await addEventYoutubeLike(videoId, user.id)
      }
      await refreshEngagement()
    } catch {
      setEngagement((prev) => ({
        ...prev,
        userHasLiked: currently,
        likeCount: prev.likeCount + (currently ? 1 : -1),
      }))
    } finally {
      setLikeBusy(false)
    }
  }

  if (!VIDEO_ID_RE.test(videoId)) {
    return <Navigate to="/events" replace />
  }

  const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`

  return (
    <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link
            to="/events"
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            ← Back to events
          </Link>
          {metaLoading ? (
            <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">Loading…</h1>
          ) : (
            <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{video?.title}</h1>
          )}
          {metaError && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{metaError}</p>
          )}
          {video?.published && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Published {new Date(video.published).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/80">
            <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300" title="Educial views (not YouTube)">
              <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="font-medium tabular-nums">{formatCount(engagement.viewCount)}</span>
              <span className="text-gray-500 dark:text-gray-400">Educial views</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={!user || likeBusy}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  engagement.userHasLiked
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
                title="Educial likes (not YouTube)"
              >
                <svg
                  className={`h-5 w-5 ${engagement.userHasLiked ? 'fill-current' : ''}`}
                  fill={engagement.userHasLiked ? 'currentColor' : 'none'}
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
                <span className="tabular-nums">{formatCount(engagement.likeCount)}</span>
              </button>
              {!user && (
                <span className="text-xs text-gray-500 dark:text-gray-400">Sign in to like</span>
              )}
            </div>
          </div>
          {engagementError && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{engagementError}</p>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-black shadow-sm dark:border-gray-700">
          <div className="aspect-video w-full">
            <iframe
              title={video?.title || 'YouTube video'}
              src={embedUrl}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          <a
            href={video?.link || `https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Open on YouTube
          </a>
        </p>

        {user && (
          <div className="rounded-xl border-2 border-violet-300/70 bg-gradient-to-br from-violet-50/90 to-white p-4 dark:border-violet-700/50 dark:from-violet-950/30 dark:to-gray-900">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Share on your feed</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Appears on the dashboard with the same Educial likes and comments as this page.
            </p>
            <textarea
              value={shareCaption}
              onChange={(e) => setShareCaption(e.target.value)}
              rows={2}
              placeholder="Optional caption…"
              className="mt-3 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleShareToFeed}
                disabled={shareBusy}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {shareBusy ? 'Sharing…' : 'Post to my feed'}
              </button>
            </div>
            {shareMessage && (
              <p
                className={`mt-2 text-xs ${shareMessage.startsWith('Shared') ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-300'}`}
              >
                {shareMessage}
              </p>
            )}
          </div>
        )}

        <EventYoutubeComments youtubeVideoId={videoId} />
    </div>
  )
}
