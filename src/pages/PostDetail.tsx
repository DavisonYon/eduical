import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type PostRow = {
  id: string
  user_id: string
  content: string | null
  images: unknown
  gif_url: string | null
  youtube_video_id: string | null
  location: string | null
  visibility: string
  status: string
  created_at: string
}

function parseImages(raw: unknown): string[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  return null
}

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>()
  const [post, setPost] = useState<PostRow | null>(null)
  const [authorName, setAuthorName] = useState('Member')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!postId) {
      setLoading(false)
      setNotFound(true)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const { data, error } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle()
        if (cancelled) return
        if (error) throw error
        if (!data) {
          setPost(null)
          setNotFound(true)
          return
        }
        setPost(data as PostRow)
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', data.user_id)
          .maybeSingle()
        if (!cancelled && prof) {
          setAuthorName(prof.full_name || prof.email?.split('@')[0] || 'Member')
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setPost(null)
          setNotFound(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [postId])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-gray-600 dark:text-gray-400">Loading post…</div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-center text-gray-600 dark:text-gray-400">This post is not available or you do not have access.</p>
        <Link to="/" className="mt-4 block text-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          Back to home
        </Link>
      </div>
    )
  }

  const images = parseImages(post.images)
  const dateLabel = new Date(post.created_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
        ← Back to feed
      </Link>
      <article className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <Link to={`/user/${post.user_id}`} className="font-semibold text-gray-900 hover:underline dark:text-white">
            {authorName}
          </Link>
          <span className="text-gray-500 dark:text-gray-400">·</span>
          <time className="text-xs text-gray-500 dark:text-gray-400">{dateLabel}</time>
          {post.location && (
            <>
              <span className="text-gray-500 dark:text-gray-400">·</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">{post.location}</span>
            </>
          )}
        </div>
        {post.content && (
          <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{post.content}</p>
        )}
        {post.youtube_video_id && (
          <Link
            to={`/events/watch/${post.youtube_video_id}`}
            className="mt-4 block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <img
              src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`}
              alt=""
              className="h-48 w-full object-cover"
            />
          </Link>
        )}
        {post.gif_url && (
          <div className="mt-4">
            <img src={post.gif_url} alt="" className="max-h-72 w-full rounded-lg object-contain" />
          </div>
        )}
        {images && images.length > 0 && (
          <div className={`mt-4 grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {images.map((src, i) => (
              <img key={i} src={src} alt="" className="h-48 w-full rounded-lg object-cover" />
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
