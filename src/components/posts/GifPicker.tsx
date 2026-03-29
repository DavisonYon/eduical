import { useState, useEffect } from 'react'

interface GifPickerProps {
  onSelect: (gifUrl: string) => void
  onClose: () => void
}

// Using Giphy's public API (you can get your own API key from https://developers.giphy.com/)
// Add VITE_GIPHY_API_KEY to your .env file
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || ''
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search'

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [gifs, setGifs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (searchTerm.trim()) {
      searchGifs(searchTerm)
    } else {
      // Load trending GIFs
      loadTrendingGifs()
    }
  }, [searchTerm])

  const loadTrendingGifs = async () => {
    if (!GIPHY_API_KEY) {
      setError('Giphy API key not configured. Add VITE_GIPHY_API_KEY to your .env file.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20`
      )
      if (response.ok) {
        const data = await response.json()
        setGifs(data.data || [])
      } else {
        setError('Failed to load GIFs. Please check your API key.')
      }
    } catch (err) {
      setError('Failed to load GIFs. Please check your API key.')
    } finally {
      setLoading(false)
    }
  }

  const searchGifs = async (query: string) => {
    if (!GIPHY_API_KEY) {
      setError('Giphy API key not configured.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${GIPHY_SEARCH_URL}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20`
      )
      if (response.ok) {
        const data = await response.json()
        setGifs(data.data || [])
      } else {
        setError('Failed to search GIFs')
      }
    } catch (err) {
      setError('Failed to search GIFs')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Select a GIF</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search GIFs..."
        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      />

      {error && (
        <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg text-yellow-200 text-sm">
          {error}
          <p className="mt-2 text-xs">
            Get a free API key at{' '}
            <a
              href="https://developers.giphy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              developers.giphy.com
            </a>
            {' '}and update GIPHY_API_KEY in src/components/posts/GifPicker.tsx
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading GIFs...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif.images.fixed_height.url)}
              className="relative aspect-square overflow-hidden rounded-lg hover:ring-2 hover:ring-blue-500 transition-all"
            >
              <img
                src={gif.images.fixed_height_small.url}
                alt={gif.title}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {!loading && gifs.length === 0 && !error && (
        <div className="text-center py-8 text-gray-400">
          No GIFs found. Try a different search term.
        </div>
      )}
    </div>
  )
}
