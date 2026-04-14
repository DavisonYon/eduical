import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  GEORGIA_TECH_CHANNEL_ID,
  fetchChannelVideosFromRss,
  type YoutubeRssVideo,
} from '../../lib/youtubeRss'
import GifPicker from './GifPicker'

interface CreatePostProps {
  onPostCreated?: () => void
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showGifPicker, setShowGifPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sharePickerOpen, setSharePickerOpen] = useState(false)
  const [shareRssVideos, setShareRssVideos] = useState<YoutubeRssVideo[]>([])
  const [shareRssLoading, setShareRssLoading] = useState(false)
  const [shareRssError, setShareRssError] = useState('')
  const [shareVideo, setShareVideo] = useState<YoutubeRssVideo | null>(null)

  useEffect(() => {
    if (!sharePickerOpen) return
    let cancelled = false
    ;(async () => {
      setShareRssLoading(true)
      setShareRssError('')
      try {
        const list = await fetchChannelVideosFromRss(GEORGIA_TECH_CHANNEL_ID)
        if (!cancelled) setShareRssVideos(list.slice(0, 24))
      } catch (e: unknown) {
        if (!cancelled) {
          setShareRssVideos([])
          setShareRssError(e instanceof Error ? e.message : 'Could not load channel videos')
        }
      } finally {
        if (!cancelled) setShareRssLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sharePickerOpen])

  const clearShareVideo = () => {
    setShareVideo(null)
    setSharePickerOpen(false)
  }

  const pickShareVideo = (v: YoutubeRssVideo) => {
    setShareVideo(v)
    setSharePickerOpen(false)
    setGifUrl(null)
    setImages([])
    setShowGifPicker(false)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          setImages((prev) => [...prev, base64])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGifSelect = (gifUrl: string) => {
    setGifUrl(gifUrl)
    setShowGifPicker(false)
    // Remove images when GIF is selected (or vice versa)
    if (images.length > 0) {
      setImages([])
    }
  }

  const removeGif = () => {
    setGifUrl(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!user) {
      setError('You must be logged in to create a post')
      setLoading(false)
      return
    }

    try {
      const payload = shareVideo
        ? {
            user_id: user.id,
            content: content.trim() || null,
            images: [] as string[],
            gif_url: null as string | null,
            youtube_video_id: shareVideo.videoId,
            youtube_published_at: shareVideo.published || null,
            location: location.trim() || null,
            visibility,
            status,
          }
        : {
            user_id: user.id,
            content: content.trim() || null,
            images: images.length > 0 ? images : null,
            gif_url: gifUrl || null,
            location: location.trim() || null,
            visibility,
            status,
          }

      const { error: insertError } = await supabase.from('posts').insert(payload)

      if (insertError) {
        throw insertError
      }

      // Reset form
      setContent('')
      setImages([])
      setGifUrl(null)
      setShareVideo(null)
      setLocation('')
      setVisibility('public')
      setStatus('draft')

      if (onPostCreated) {
        onPostCreated()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:p-4">
      {error && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {shareVideo && (
          <div className="rounded-lg border-2 border-amber-300/80 bg-amber-50/80 p-3 dark:border-amber-700/60 dark:bg-amber-950/30">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                Sharing to your feed
              </p>
              <button
                type="button"
                onClick={clearShareVideo}
                className="text-xs font-medium text-amber-800 hover:underline dark:text-amber-300"
              >
                Remove
              </button>
            </div>
            <div className="mt-2 flex gap-3">
              <img
                src={shareVideo.thumbnailUrl}
                alt=""
                className="h-16 w-28 flex-shrink-0 rounded object-cover"
              />
              <p className="line-clamp-3 text-sm font-medium text-gray-900 dark:text-white">{shareVideo.title}</p>
            </div>
            <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/90">
              Likes and comments use the same event thread as the Events page.
            </p>
          </div>
        )}

        {/* Text Content */}
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={shareVideo ? 'Add a caption (optional)…' : "What's on your mind?"}
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>

        {/* Preview Images */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, index) => (
              <div key={index} className="relative group">
                <img
                  src={img}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-20 object-cover rounded"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Preview GIF */}
        {gifUrl && (
          <div className="relative">
            <img
              src={gifUrl}
              alt="Selected GIF"
              className="w-full max-h-48 object-contain rounded"
            />
            <button
              type="button"
              onClick={removeGif}
              className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
            >
              ×
            </button>
          </div>
        )}

        {/* Media Buttons and Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-transparent bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:border-transparent dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
              disabled={!!gifUrl}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              disabled={!!gifUrl}
            />

            <button
              type="button"
              onClick={() => setShowGifPicker(!showGifPicker)}
              className="flex items-center gap-1.5 rounded-lg border border-transparent bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:border-transparent dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
              disabled={images.length > 0}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">GIF</span>
            </button>

            <button
              type="button"
              onClick={() => setSharePickerOpen(true)}
              disabled={!!gifUrl || images.length > 0}
              className="flex items-center gap-1.5 rounded-lg border border-transparent bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-200 hover:text-amber-950 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="hidden sm:inline">Share GT video</span>
            </button>

            <button
              type="button"
              onClick={() => setLocation(prompt('Enter location:') || '')}
              className="flex items-center gap-1.5 rounded-lg border border-transparent bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:border-transparent dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">{location || 'Location'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'friends')}
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
            </select>
            <button
              type="submit"
              onClick={() => setStatus('published')}
              disabled={loading || (!shareVideo && !content.trim() && images.length === 0 && !gifUrl)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Location Display */}
        {location && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {location}
            <button
              type="button"
              onClick={() => setLocation('')}
              className="text-red-400 hover:text-red-300 ml-1"
            >
              ×
            </button>
          </div>
        )}

        {/* GIF Picker */}
        {showGifPicker && (
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
        )}
      </form>

      {sharePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSharePickerOpen(false)
          }}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <p className="font-semibold text-gray-900 dark:text-white">Pick a Georgia Tech video</p>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                onClick={() => setSharePickerOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[calc(85vh-3.5rem)] overflow-y-auto p-3">
              {shareRssLoading && <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>}
              {shareRssError && (
                <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {shareRssError}
                </p>
              )}
              {!shareRssLoading && !shareRssError && shareRssVideos.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">No videos found.</p>
              )}
              <ul className="space-y-2">
                {shareRssVideos.map((v) => (
                  <li key={v.videoId}>
                    <button
                      type="button"
                      onClick={() => pickShareVideo(v)}
                      className="flex w-full gap-3 rounded-lg border border-gray-200 p-2 text-left transition hover:border-amber-400 hover:bg-amber-50/50 dark:border-gray-700 dark:hover:border-amber-700 dark:hover:bg-amber-950/20"
                    >
                      <img src={v.thumbnailUrl} alt="" className="h-14 w-24 flex-shrink-0 rounded object-cover" />
                      <span className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">{v.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
