import { useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import GifPicker from './GifPicker'
import ImageUpload from './ImageUpload'

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
      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim() || null,
          images: images.length > 0 ? images : null,
          gif_url: gifUrl || null,
          location: location.trim() || null,
          visibility,
          status,
        })

      if (insertError) {
        throw insertError
      }

      // Reset form
      setContent('')
      setImages([])
      setGifUrl(null)
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
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-6">
      {error && (
        <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Text Content */}
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={2}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors text-sm"
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors text-sm"
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
              onClick={() => setLocation(prompt('Enter location:') || '')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors text-sm"
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
              className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
            </select>
            <button
              type="submit"
              onClick={() => setStatus('published')}
              disabled={loading || (!content.trim() && images.length === 0 && !gifUrl)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Location Display */}
        {location && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
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
    </div>
  )
}
