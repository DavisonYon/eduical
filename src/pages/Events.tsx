import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GEORGIA_TECH_CHANNEL_ID,
  fetchChannelVideosFromRss,
  type YoutubeRssVideo,
} from '../lib/youtubeRss'

function formatPublished(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function Events() {
  const [videos, setVideos] = useState<YoutubeRssVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const list = await fetchChannelVideosFromRss(GEORGIA_TECH_CHANNEL_ID)
        if (!cancelled) setVideos(list)
      } catch (e: unknown) {
        if (!cancelled) {
          setVideos([])
          setError(e instanceof Error ? e.message : 'Failed to load videos')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Latest videos from the{' '}
            <a
              href="https://www.youtube.com/@georgiatech/videos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Georgia Tech YouTube channel
            </a>{' '}
            (public RSS — recent uploads only).
          </p>
        </div>

        {loading && (
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading videos…</p>
        )}

        {error && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">Could not load the feed</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">
              The app loads RSS via the same-origin path <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">/youtube-rss</code> (proxied by Vite in development). For a
              production build, configure your host to proxy that path to{' '}
              <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">https://www.youtube.com/feeds/videos.xml</code> with the same query string.
            </p>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">No videos in the feed.</p>
        )}

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <li key={v.videoId}>
              <Link
                to={`/events/watch/${v.videoId}`}
                state={{ video: v }}
                className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
              >
                <div className="aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {v.title}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatPublished(v.published)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
    </div>
  )
}
