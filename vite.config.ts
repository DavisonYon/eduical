import type { ProxyOptions } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** YouTube RSS has no CORS for browsers; proxy same-origin `/youtube-rss` to their Atom feed. */
const youtubeRssProxy: ProxyOptions = {
  target: 'https://www.youtube.com',
  changeOrigin: true,
  secure: true,
  configure(proxy) {
    proxy.on('proxyReq', (proxyReq, req) => {
      const base = req.headers.host ? `http://${req.headers.host}` : 'http://localhost'
      const u = new URL(req.url || '/youtube-rss', base)
      const cid = u.searchParams.get('channel_id')
      proxyReq.path = cid
        ? `/feeds/videos.xml?channel_id=${encodeURIComponent(cid)}`
        : '/feeds/videos.xml'
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/youtube-rss': youtubeRssProxy,
    },
  },
  preview: {
    proxy: {
      '/youtube-rss': youtubeRssProxy,
    },
  },
})
